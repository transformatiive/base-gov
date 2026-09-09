import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { auth, requireAuth, tryAuth } from './auth.js';
import { config } from './config.js';
import { pool } from './db.js';
import {
  VISITOR_COOKIE,
  actionLabel,
  fillDailySeries,
  labelModule,
  newVisitorId,
  originLabel,
  parseDays,
  parseUsageEvent,
  svgTrend,
  type UsageEventInput,
} from './usage.js';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

function siteHost(): string | undefined {
  try {
    if (!config.appBaseUrl) return undefined;
    return new URL(config.appBaseUrl).hostname;
  } catch {
    return undefined;
  }
}

function extraHosts(): string[] {
  const h = siteHost();
  return h ? [h] : [];
}

function visitorFrom(req: FastifyRequest, bodyId: string | null): string {
  const cookie = req.cookies[VISITOR_COOKIE];
  if (cookie && /^[0-9a-f-]{36}$/i.test(cookie)) return cookie.toLowerCase();
  if (bodyId) return bodyId;
  return newVisitorId();
}

function setVisitorCookie(reply: FastifyReply, id: string): void {
  reply.setCookie(VISITOR_COOKIE, id, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    maxAge: COOKIE_MAX_AGE,
  });
}

function queryUtm(req: FastifyRequest): { utm_source?: string; utm_medium?: string; utm_campaign?: string } {
  const q = (req.query ?? {}) as Record<string, unknown>;
  const pick = (k: string) => (typeof q[k] === 'string' ? q[k] as string : undefined);
  return {
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
  };
}

async function insertEvent(
  ev: UsageEventInput,
  userId: number | null,
  companyId: number | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO usage_events
       (kind, path, module, action, origin, referrer_host, utm_source, utm_medium, utm_campaign,
        visitor_id, landing, user_id, company_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      ev.kind, ev.path, ev.module, ev.action, ev.origin, ev.referrer_host,
      ev.utm_source, ev.utm_medium, ev.utm_campaign, ev.visitor_id, ev.landing,
      userId, companyId,
    ],
  );
}

/** Hit de página pública (landing, guias, legais). Nunca lança. */
export async function ingestPublicPage(req: FastifyRequest, reply: FastifyReply, path: string): Promise<void> {
  try {
    const utm = queryUtm(req);
    const visitor = visitorFrom(req, null);
    setVisitorCookie(reply, visitor);
    const user = await tryAuth(req);
    const parsed = parseUsageEvent({
      kind: 'page_view',
      path,
      visitor_id: visitor,
      referrer: typeof req.headers.referer === 'string' ? req.headers.referer : null,
      landing: path,
      ...utm,
    }, extraHosts());
    if (!parsed.ok) return;
    parsed.value.visitor_id = visitor;
    await insertEvent(parsed.value, user?.userId ?? null, user?.companyId ?? null);
  } catch (err) {
    console.warn('[usage] falha a registar página pública:', String(err).slice(0, 160));
  }
}

export async function registerUsageRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/usage', async (req, reply) => {
    try {
      const user = await tryAuth(req);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const parsed = parseUsageEvent(body, extraHosts());
      if (!parsed.ok) {
        return reply.code(204).send();
      }
      const visitor = visitorFrom(req, parsed.value.visitor_id);
      parsed.value.visitor_id = visitor;
      setVisitorCookie(reply, visitor);
      if (user?.username === 'api-key') return reply.code(204).send();
      await insertEvent(parsed.value, user?.userId ?? null, user?.companyId ?? null);
      return reply.code(204).send();
    } catch (err) {
      console.warn('[usage] falha a ingest:', String(err).slice(0, 160));
      return reply.code(204).send();
    }
  });

  app.get('/api/admin/usage', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) {
      return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    }
    const days = parseDays(String((req.query as { days?: string }).days ?? ''));
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - (days - 1));
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date();
    const fromDay = from.toISOString().slice(0, 10);
    const toDay = to.toISOString().slice(0, 10);

    const [kpis, daily, modules, actions, origins, companies, recent, searchKpis, searchesByKind, searchesByCompany, recentSearches] = await Promise.all([
      pool.query(
        `SELECT
           count(*) FILTER (WHERE kind = 'page_view')::int AS pageviews,
           count(*) FILTER (WHERE kind = 'action')::int AS actions,
           count(DISTINCT visitor_id)::int AS visitors,
           count(DISTINCT user_id)::int AS users,
           count(DISTINCT company_id)::int AS companies
         FROM usage_events WHERE created_at >= $1`,
        [from],
      ),
      pool.query(
        `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n
           FROM usage_events WHERE created_at >= $1
           GROUP BY 1 ORDER BY 1`,
        [from],
      ),
      pool.query(
        `SELECT module, count(*)::int AS n, count(DISTINCT COALESCE(user_id::text, visitor_id))::int AS users
           FROM usage_events WHERE created_at >= $1 AND kind = 'page_view'
           GROUP BY module ORDER BY n DESC`,
        [from],
      ),
      pool.query(
        `SELECT action, count(*)::int AS n
           FROM usage_events WHERE created_at >= $1 AND kind = 'action' AND action IS NOT NULL
           GROUP BY action ORDER BY n DESC`,
        [from],
      ),
      pool.query(
        `SELECT origin, count(*)::int AS n, count(DISTINCT visitor_id)::int AS visitors
           FROM usage_events WHERE created_at >= $1
           GROUP BY origin ORDER BY n DESC
           LIMIT 20`,
        [from],
      ),
      pool.query(
        `SELECT c.id AS company_id, c.name, c.plan,
                count(*)::int AS n, max(e.created_at) AS last_at
           FROM usage_events e
           JOIN companies c ON c.id = e.company_id
          WHERE e.created_at >= $1
          GROUP BY c.id, c.name, c.plan
          ORDER BY n DESC
          LIMIT 50`,
        [from],
      ),
      pool.query(
        `SELECT e.created_at, e.kind, e.module, e.path, e.action, e.origin, e.visitor_id,
                u.username, u.email, c.name AS company, c.plan
           FROM usage_events e
           LEFT JOIN users u ON u.id = e.user_id
           LEFT JOIN companies c ON c.id = e.company_id
          WHERE e.created_at >= $1
          ORDER BY e.created_at DESC
          LIMIT 80`,
        [from],
      ),
      pool.query(
        `SELECT count(*)::int AS n,
                count(*) FILTER (WHERE kind = 'anuncios')::int AS anuncios,
                count(*) FILTER (WHERE kind = 'contratos')::int AS contratos,
                count(DISTINCT company_id)::int AS companies,
                count(DISTINCT created_by)::int AS users
           FROM searches WHERE created_at >= $1`,
        [from],
      ),
      pool.query(
        `SELECT coalesce(kind,'contratos') AS kind, count(*)::int AS n,
                count(*) FILTER (WHERE status IN ('completed','completed_truncated'))::int AS done,
                count(*) FILTER (WHERE status = 'failed')::int AS failed
           FROM searches WHERE created_at >= $1
           GROUP BY kind ORDER BY n DESC`,
        [from],
      ),
      pool.query(
        `SELECT c.id AS company_id, c.name, c.plan, count(*)::int AS n, max(s.created_at) AS last_at
           FROM searches s JOIN companies c ON c.id = s.company_id
          WHERE s.created_at >= $1
          GROUP BY c.id, c.name, c.plan
          ORDER BY n DESC LIMIT 40`,
        [from],
      ),
      pool.query(
        `SELECT s.id, s.term, s.kind, s.status, s.created_at, s.finished_at, s.total_reported, s.total_scraped,
                c.name AS company, u.username
           FROM searches s
           LEFT JOIN companies c ON c.id = s.company_id
           LEFT JOIN users u ON u.id = s.created_by
          WHERE s.created_at >= $1
          ORDER BY s.created_at DESC
          LIMIT 40`,
        [from],
      ),
    ]);

    const dailyFilled = fillDailySeries(
      fromDay,
      toDay,
      daily.rows.map((r: { day: string; n: number }) => ({ day: String(r.day), n: Number(r.n) })),
    );

    return {
      days,
      from: from.toISOString(),
      to: to.toISOString(),
      kpis: kpis.rows[0],
      daily: dailyFilled,
      trend_svg: svgTrend(dailyFilled),
      modules: modules.rows.map((r: { module: string; n: number; users: number }) => ({
        module: r.module,
        label: labelModule(r.module),
        n: r.n,
        users: r.users,
      })),
      actions: actions.rows.map((r: { action: string; n: number }) => ({
        action: r.action,
        label: actionLabel(r.action),
        n: r.n,
      })),
      origins: origins.rows.map((r: { origin: string; n: number; visitors: number }) => ({
        origin: r.origin,
        label: originLabel(r.origin),
        n: r.n,
        visitors: r.visitors,
      })),
      companies: companies.rows,
      recent: recent.rows,
      searches: {
        kpis: searchKpis.rows[0],
        by_kind: searchesByKind.rows,
        by_company: searchesByCompany.rows,
        recent: recentSearches.rows,
      },
    };
  });
}
