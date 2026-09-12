import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ingestPublicPage } from './routes-usage.js';
import { auth, requireAuth } from './auth.js';
import { config } from './config.js';
import { pool } from './db.js';
import { applyCrawlerNoStore } from './crawler-cache.js';
import {
  GUIDE_AGENT_SPEC,
  guideRecordFromRow,
  llmsFullTxt,
  llmsTxt,
  markdownToHtml,
  parseGuidePayload,
  parsePublicGuideParam,
  publicSiteOrigin,
  renderGuideArticleHtml,
  renderGuideIndexHtml,
  renderGuideMarkdown,
  resolveGuideAgent,
  robotsTxt,
  sitemapXml,
  type GuideAgent,
  type GuideRecord,
} from './guides.js';

async function requireGuideAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (!auth(req).isAdmin) {
    reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores (API key ou sessão admin).' } });
  }
}

function origin(): string {
  return publicSiteOrigin(config.appBaseUrl);
}

function headerAgent(req: FastifyRequest): string | undefined {
  const raw = req.headers['x-agent'];
  return typeof raw === 'string' ? raw : undefined;
}

async function loadGuide(slug: string): Promise<GuideRecord | null> {
  const { rows } = await pool.query('SELECT * FROM guide_articles WHERE slug = $1', [slug]);
  return rows[0] ? guideRecordFromRow(rows[0] as Record<string, unknown>) : null;
}

async function listPublished(): Promise<GuideRecord[]> {
  const { rows } = await pool.query(
    `SELECT * FROM guide_articles
      WHERE status = 'published'
      ORDER BY CASE intent WHEN 'informativa' THEN 0 ELSE 1 END, title`,
  );
  return rows.map((r) => guideRecordFromRow(r as Record<string, unknown>));
}

function crawlerNoStore(reply: FastifyReply): void {
  applyCrawlerNoStore(reply);
}

export async function registerPublicGuideRoutes(app: FastifyInstance): Promise<void> {
  app.get('/robots.txt', async (_req, reply) => {
    crawlerNoStore(reply);
    reply.type('text/plain; charset=utf-8');
    return robotsTxt(origin());
  });

  app.get('/sitemap.xml', async (_req, reply) => {
    const published = await listPublished();
    crawlerNoStore(reply);
    reply.type('application/xml; charset=utf-8');
    return sitemapXml(
      origin(),
      published.map((g) => ({ slug: g.slug, updated_at: g.updated_at })),
    );
  });

  app.get('/llms.txt', async (_req, reply) => {
    const published = await listPublished();
    crawlerNoStore(reply);
    reply.type('text/plain; charset=utf-8');
    return llmsTxt(
      origin(),
      published.map((g) => ({ slug: g.slug, title: g.title, description: g.description })),
    );
  });

  app.get('/llms-full.txt', async (_req, reply) => {
    const published = await listPublished();
    crawlerNoStore(reply);
    reply.type('text/plain; charset=utf-8');
    return llmsFullTxt(origin(), published);
  });

  const sendIndex = async (req: FastifyRequest, reply: FastifyReply) => {
    ingestPublicPage(req, reply, '/guias');
    const published = await listPublished();
    reply.type('text/html; charset=utf-8');
    return renderGuideIndexHtml(origin(), published);
  };
  app.get('/guias', sendIndex);
  app.get('/guias/', sendIndex);

  app.get<{ Params: { slug: string } }>('/guias/:slug', async (req, reply) => {
    const { slug, format } = parsePublicGuideParam(req.params.slug);
    const guide = await loadGuide(slug);
    if (!guide || guide.status !== 'published') {
      return reply.code(404).type('text/plain; charset=utf-8').send('Guia não encontrado.');
    }
    ingestPublicPage(req, reply, `/guias/${slug}${format === 'markdown' ? '.md' : ''}`);
    if (format === 'markdown') {
      reply.type('text/markdown; charset=utf-8');
      return renderGuideMarkdown(origin(), guide);
    }
    reply.type('text/html; charset=utf-8');
    return renderGuideArticleHtml(origin(), guide);
  });
}

export async function registerGuideAgentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/agent/guides/spec', { preHandler: requireGuideAdmin }, async () => GUIDE_AGENT_SPEC);

  app.get('/api/agent/guides', { preHandler: requireGuideAdmin }, async () => {
    const { rows } = await pool.query('SELECT * FROM guide_articles ORDER BY updated_at DESC');
    return { items: rows.map((r) => guideRecordFromRow(r as Record<string, unknown>)) };
  });

  app.get<{ Params: { slug: string } }>('/api/agent/guides/:slug', { preHandler: requireGuideAdmin }, async (req, reply) => {
    const guide = await loadGuide(req.params.slug);
    if (!guide) return reply.code(404).send({ error: { code: 'not_found', message: 'Guia não encontrado.' } });
    return guide;
  });

  app.put<{ Params: { slug: string } }>('/api/agent/guides/:slug', { preHandler: requireGuideAdmin }, async (req, reply) => {
    const parsed = parseGuidePayload(req.params.slug, req.body);
    if (!parsed.ok) {
      return reply.code(400).send({ error: { code: 'invalid_guide', message: parsed.error } });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const agent = resolveGuideAgent(headerAgent(req), typeof body.agent === 'string' ? body.agent : undefined);
    if (agent == null) {
      return reply.code(400).send({
        error: { code: 'invalid_agent', message: 'X-Agent / agent deve ser claude, grok, grok-bot ou omitido (human).' },
      });
    }
    const html = markdownToHtml(parsed.value.markdown);
    const { rows } = await pool.query(
      `INSERT INTO guide_articles
         (slug, title, description, lede, intent, markdown, body_html, faq, tags, status, published_at, author_agent, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,
               CASE WHEN $10 = 'published' THEN now() ELSE NULL END,
               $11, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         lede = EXCLUDED.lede,
         intent = EXCLUDED.intent,
         markdown = EXCLUDED.markdown,
         body_html = EXCLUDED.body_html,
         faq = EXCLUDED.faq,
         tags = EXCLUDED.tags,
         status = EXCLUDED.status,
         published_at = CASE
           WHEN EXCLUDED.status = 'published' THEN COALESCE(guide_articles.published_at, now())
           ELSE guide_articles.published_at
         END,
         author_agent = EXCLUDED.author_agent,
         updated_at = now()
       RETURNING *`,
      [
        parsed.value.slug,
        parsed.value.title,
        parsed.value.description,
        parsed.value.lede,
        parsed.value.intent,
        parsed.value.markdown,
        html,
        JSON.stringify(parsed.value.faq),
        parsed.value.tags,
        parsed.value.status,
        agent,
      ],
    );
    return { ok: true, guide: guideRecordFromRow(rows[0] as Record<string, unknown>) };
  });

  app.post<{ Params: { slug: string } }>('/api/agent/guides/:slug/publish', { preHandler: requireGuideAdmin }, async (req, reply) => {
    const { rows } = await pool.query(
      `UPDATE guide_articles
          SET status = 'published',
              published_at = COALESCE(published_at, now()),
              updated_at = now(),
              author_agent = COALESCE($2, author_agent)
        WHERE slug = $1
        RETURNING *`,
      [req.params.slug, agentFromReq(req)],
    );
    if (!rows[0]) return reply.code(404).send({ error: { code: 'not_found', message: 'Guia não encontrado.' } });
    return { ok: true, guide: guideRecordFromRow(rows[0] as Record<string, unknown>) };
  });

  app.post<{ Params: { slug: string } }>('/api/agent/guides/:slug/unpublish', { preHandler: requireGuideAdmin }, async (req, reply) => {
    const { rows } = await pool.query(
      `UPDATE guide_articles
          SET status = 'draft', updated_at = now(),
              author_agent = COALESCE($2, author_agent)
        WHERE slug = $1
        RETURNING *`,
      [req.params.slug, agentFromReq(req)],
    );
    if (!rows[0]) return reply.code(404).send({ error: { code: 'not_found', message: 'Guia não encontrado.' } });
    return { ok: true, guide: guideRecordFromRow(rows[0] as Record<string, unknown>) };
  });

  app.delete<{ Params: { slug: string } }>('/api/agent/guides/:slug', { preHandler: requireGuideAdmin }, async (req, reply) => {
    const { rows } = await pool.query('DELETE FROM guide_articles WHERE slug = $1 RETURNING slug', [req.params.slug]);
    if (!rows[0]) return reply.code(404).send({ error: { code: 'not_found', message: 'Guia não encontrado.' } });
    return { ok: true, slug: rows[0].slug as string };
  });
}

function agentFromReq(req: FastifyRequest): GuideAgent | null {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const resolved = resolveGuideAgent(headerAgent(req), typeof body.agent === 'string' ? body.agent : undefined);
  if (resolved === 'human' && !headerAgent(req) && typeof body.agent !== 'string') return null;
  return resolved;
}
