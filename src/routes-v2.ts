import { FastifyInstance } from 'fastify';
import { pool } from './db.js';
import { requireAuth } from './auth.js';
import { createProfileRun } from './profiles.js';
import { normalize } from './cpv.js';
import { aiEnabled, analyzeAnnouncement, analyzeContract, digestIntro, fitScores, FitItem, responseTemplate } from './ai.js';

/**
 * Rotas v2: perfis de pesquisa, anúncios e insights comerciais
 * (renovações, sazonalidade, mapa, entidades, concorrentes, scoring).
 */

// Fragmentos de scope: contratos/anúncios pertencentes a um perfil (qualquer run).
const PROFILE_CONTRACTS = `
  SELECT DISTINCT sr.contract_id AS id
  FROM search_results sr
  JOIN searches s ON s.id = sr.search_id
  JOIN profile_runs pr ON pr.id = s.profile_run_id
  WHERE pr.profile_id = $1`;

const PROFILE_ANNOUNCEMENTS = `
  SELECT DISTINCT sa.announcement_id AS id
  FROM search_announcements sa
  JOIN searches s ON s.id = sa.search_id
  JOIN profile_runs pr ON pr.id = s.profile_run_id
  WHERE pr.profile_id = $1`;

function contractScope(profileId: number | null): { join: string; params: unknown[] } {
  if (profileId == null) return { join: '', params: [] };
  return { join: `JOIN (${PROFILE_CONTRACTS}) scope ON scope.id = c.id`, params: [profileId] };
}

// Data prevista de fim do contrato: celebração + N dias do prazo de execução.
const END_DATE = `(c.signing_date + (substring(c.execution_deadline from '(\\d+)')::int))`;
const HAS_END = `c.signing_date IS NOT NULL AND c.execution_deadline ~ '\\d+'`;
// Distrito a partir de "Portugal, Lisboa, Sintra" (primeiro local se houver vários).
const DISTRICT = `NULLIF(btrim(split_part(split_part(c.execution_place, '|', 1), ',', 2)), '')`;

function parseProfileId(query: Record<string, unknown>): number | null {
  const v = query.profile_id;
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function registerRoutesV2(app: FastifyInstance): Promise<void> {
  // ---------- Perfis ----------
  app.get('/api/profiles', { preHandler: requireAuth }, async () => {
    const { rows } = await pool.query(`
      SELECT p.*,
        (SELECT count(*) FROM (${PROFILE_CONTRACTS.replace('$1', 'p.id')}) x) AS n_contracts,
        (SELECT count(*) FROM (${PROFILE_ANNOUNCEMENTS.replace('$1', 'p.id')}) x) AS n_announcements,
        (SELECT row_to_json(r) FROM (
           SELECT id, status, new_contracts, new_announcements, started_at, finished_at
           FROM profile_runs WHERE profile_id = p.id ORDER BY created_at DESC LIMIT 1) r) AS last_run
      FROM profiles p ORDER BY p.name`);
    return { items: rows.map((p) => ({ ...p, n_contracts: Number(p.n_contracts), n_announcements: Number(p.n_announcements) })) };
  });

  app.post('/api/profiles', { preHandler: requireAuth }, async (req, reply) => {
    const body = (req.body ?? {}) as {
      name?: string; terms?: string[]; cpv_codes?: string[]; schedule?: string;
      include_announcements?: boolean; fetch_documents?: boolean; run_now?: boolean;
    };
    const cpvCodes = (body.cpv_codes ?? []).map((c) => String(c).trim()).filter((c) => /^\d{4,8}(-\d)?$/.test(c));
    const name = body.name?.trim();
    const terms = (body.terms ?? []).map((t) => String(t).trim()).filter(Boolean);
    const schedule = ['manual', 'daily', 'weekly'].includes(body.schedule ?? '') ? body.schedule : 'manual';
    if (!name || terms.length === 0) {
      return reply.code(400).send({ error: { code: 'invalid_profile', message: 'name e terms[] são obrigatórios' } });
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO profiles (name, terms, cpv_codes, schedule, include_announcements, fetch_documents)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [name, terms, cpvCodes, schedule, body.include_announcements !== false, body.fetch_documents === true]
      );
      const profile = rows[0];
      let runId: number | null = null;
      if (body.run_now !== false) {
        const username = (req as unknown as { username: string }).username;
        const { rows: u } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        runId = await createProfileRun(profile.id, u[0]?.id ?? null);
      }
      return reply.code(201).send({ ...profile, run_id: runId });
    } catch (err: unknown) {
      if (String(err).includes('duplicate key')) {
        return reply.code(409).send({ error: { code: 'duplicate', message: 'Já existe um perfil com esse nome' } });
      }
      throw err;
    }
  });

  app.get('/api/profiles/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const { rows } = await pool.query('SELECT * FROM profiles WHERE id = $1', [id]);
    if (rows.length === 0) return reply.code(404).send({ error: { code: 'not_found', message: 'Perfil não encontrado' } });
    const { rows: runs } = await pool.query(
      `SELECT pr.*,
         (SELECT json_agg(json_build_object('id', s.id, 'term', s.term, 'kind', s.kind, 'status', s.status,
             'total_reported', s.total_reported, 'total_scraped', s.total_scraped) ORDER BY s.id)
          FROM searches s WHERE s.profile_run_id = pr.id) AS searches
       FROM profile_runs pr WHERE pr.profile_id = $1 ORDER BY pr.created_at DESC LIMIT 20`,
      [id]
    );
    const { rows: [totals] } = await pool.query(
      `SELECT
         (SELECT count(*) FROM (${PROFILE_CONTRACTS}) x) AS n_contracts,
         (SELECT coalesce(sum(c.initial_contractual_price),0) FROM contracts c JOIN (${PROFILE_CONTRACTS}) x ON x.id = c.id) AS total_value,
         (SELECT count(*) FROM (${PROFILE_ANNOUNCEMENTS}) x) AS n_announcements,
         (SELECT count(*) FROM announcements a JOIN (${PROFILE_ANNOUNCEMENTS}) x ON x.id = a.id
           WHERE a.proposal_deadline_date >= CURRENT_DATE) AS open_announcements`,
      [id]
    );
    return {
      ...rows[0],
      runs,
      totals: {
        n_contracts: Number(totals.n_contracts),
        total_value: Number(totals.total_value),
        n_announcements: Number(totals.n_announcements),
        open_announcements: Number(totals.open_announcements),
      },
    };
  });

  app.post('/api/profiles/:id/run', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const { rows: pending } = await pool.query(
      `SELECT 1 FROM profile_runs WHERE profile_id = $1 AND status IN ('pending','running')`, [id]);
    if (pending.length > 0) {
      return reply.code(409).send({ error: { code: 'already_running', message: 'Este perfil já tem um run em curso' } });
    }
    const username = (req as unknown as { username: string }).username;
    const { rows: u } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    const runId = await createProfileRun(id, u[0]?.id ?? null);
    return reply.code(201).send({ run_id: runId });
  });

  app.delete('/api/profiles/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    await pool.query('DELETE FROM profiles WHERE id = $1', [id]);
    return reply.code(204).send();
  });

  // ---------- Dados abertos (histórico oficial do IMPIC) ----------
  app.get('/api/opendata/imports', { preHandler: requireAuth }, async () => {
    const { rows } = await pool.query('SELECT * FROM opendata_imports ORDER BY year DESC, created_at DESC');
    const { rows: [tot] } = await pool.query(
      `SELECT count(*) AS n FROM contracts WHERE opendata_imported`);
    return { total_opendata_contracts: Number(tot.n), items: rows };
  });

  app.post('/api/opendata/import', { preHandler: requireAuth }, async (req, reply) => {
    const { years } = (req.body ?? {}) as { years?: number[] };
    const list = (years ?? []).map(Number).filter((y) => y >= 2012 && y <= 2100);
    if (list.length === 0) {
      return reply.code(400).send({ error: { code: 'invalid_years', message: 'years[] entre 2012 e o ano atual' } });
    }
    const created: number[] = [];
    for (const year of list) {
      const { rows: dup } = await pool.query(
        `SELECT 1 FROM opendata_imports WHERE year = $1 AND status IN ('pending','running')`, [year]);
      if (dup.length > 0) continue;
      const { rows } = await pool.query(
        'INSERT INTO opendata_imports (year) VALUES ($1) RETURNING id', [year]);
      created.push(rows[0].id);
    }
    return reply.code(201).send({ created });
  });

  // ---------- IA (OpenRouter): ficha de oportunidade, fit scores, digest ----------
  app.get('/api/ai/status', { preHandler: requireAuth }, async () => ({ enabled: aiEnabled() }));

  app.post('/api/announcements/:id/analyze', { preHandler: requireAuth }, async (req, reply) => {
    if (!aiEnabled()) return reply.code(503).send({ error: { code: 'ai_disabled', message: 'IA não configurada' } });
    const id = Number((req.params as { id: string }).id);
    const profileId = Number((req.body as { profile_id?: number })?.profile_id ?? 0) || 0;
    try {
      return await analyzeAnnouncement(id, profileId);
    } catch (err) {
      return reply.code(502).send({ error: { code: 'ai_failed', message: String(err).slice(0, 300) } });
    }
  });

  app.post('/api/contracts/:id/analyze', { preHandler: requireAuth }, async (req, reply) => {
    if (!aiEnabled()) return reply.code(503).send({ error: { code: 'ai_disabled', message: 'IA não configurada' } });
    const id = Number((req.params as { id: string }).id);
    const profileId = Number((req.body as { profile_id?: number })?.profile_id ?? 0) || 0;
    try {
      return await analyzeContract(id, profileId);
    } catch (err) {
      return reply.code(502).send({ error: { code: 'ai_failed', message: String(err).slice(0, 300) } });
    }
  });

  // Template de resposta (dossier com placeholders) para um anúncio
  app.post('/api/announcements/:id/response-template', { preHandler: requireAuth }, async (req, reply) => {
    if (!aiEnabled()) return reply.code(503).send({ error: { code: 'ai_disabled', message: 'IA não configurada' } });
    const id = Number((req.params as { id: string }).id);
    const profileId = Number((req.body as { profile_id?: number })?.profile_id ?? 0) || 0;
    try {
      return await responseTemplate(id, profileId);
    } catch (err) {
      return reply.code(502).send({ error: { code: 'ai_failed', message: String(err).slice(0, 300) } });
    }
  });

  app.post('/api/profiles/:id/fit-scores', { preHandler: requireAuth }, async (req, reply) => {
    if (!aiEnabled()) return reply.code(503).send({ error: { code: 'ai_disabled', message: 'IA não configurada' } });
    const profileId = Number((req.params as { id: string }).id);
    const items = ((req.body as { items?: FitItem[] })?.items ?? []).slice(0, 100);
    try {
      return { scores: await fitScores(profileId, items) };
    } catch (err) {
      return reply.code(502).send({ error: { code: 'ai_failed', message: String(err).slice(0, 300) } });
    }
  });

  // Dados do digest (partilhados pela página da app e pelo layout de email)
  async function digestData(profileId: number) {
    const { rows: profRows } = await pool.query('SELECT * FROM profiles WHERE id = $1', [profileId]);
    if (profRows.length === 0) return null;
    const profile = profRows[0];

    const { rows: newAnns } = await pool.query(
      `SELECT a.* FROM announcements a JOIN (${PROFILE_ANNOUNCEMENTS}) s ON s.id = a.id
       WHERE a.created_at >= now() - interval '7 days' ORDER BY a.proposal_deadline_date NULLS LAST`,
      [profileId]
    );
    const { rows: openAnns } = await pool.query(
      `SELECT a.* FROM announcements a JOIN (${PROFILE_ANNOUNCEMENTS}) s ON s.id = a.id
       WHERE a.proposal_deadline_date >= CURRENT_DATE ORDER BY a.proposal_deadline_date`,
      [profileId]
    );
    const { rows: renewals } = await pool.query(
      `SELECT c.id, c.object_brief_description, c.initial_contractual_price,
         ${END_DATE} AS end_date, (${END_DATE} - CURRENT_DATE) AS days_left,
         (SELECT string_agg(e.name, '; ') FROM contract_entities ce JOIN entities e ON e.id = ce.entity_id
           WHERE ce.contract_id = c.id AND ce.role = 'contracting') AS contracting
       FROM contracts c JOIN (${PROFILE_CONTRACTS}) s ON s.id = c.id
       WHERE ${HAS_END} AND ${END_DATE} BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '90 days'
       ORDER BY end_date LIMIT 12`,
      [profileId]
    );

    const statsText0 = `Novos anúncios (7 dias): ${newAnns.length}. Concursos com prazo a decorrer: ${openAnns.length}. Contratos a terminar nos próximos 90 dias (oportunidades de renovação): ${renewals.length}. Detalhe renovações: ${renewals.map((r) => `${r.contracting} (${Number(r.initial_contractual_price ?? 0).toFixed(0)} EUR, termina ${String(r.end_date).slice(0, 10)})`).slice(0, 6).join('; ')}`;
    const intro0 = aiEnabled() ? await digestIntro(profile.name, statsText0) : '';
    return { profile, newAnns, openAnns, renewals, intro: intro0 };
  }

  // Digest como dados JSON (página da app)
  app.get('/api/profiles/:id/digest.json', { preHandler: requireAuth }, async (req, reply) => {
    const d = await digestData(Number((req.params as { id: string }).id));
    if (!d) return reply.code(404).send({ error: { code: 'not_found', message: 'Perfil não encontrado' } });
    return {
      profile: { id: d.profile.id, name: d.profile.name },
      intro: d.intro,
      generated_at: new Date().toISOString(),
      stats: { open: d.openAnns.length, new_7d: d.newAnns.length, renewals_90d: d.renewals.length },
      open_announcements: d.openAnns.slice(0, 15).map((a: Record<string, unknown>) => ({
        id: a.id, deadline: a.proposal_deadline_date, designation: a.contract_designation,
        entity: a.contracting_entity, base_price: a.base_price != null ? Number(a.base_price) : null,
      })),
      renewals: d.renewals.map((r: Record<string, unknown>) => ({
        id: r.id, end_date: r.end_date, days_left: r.days_left, entity: r.contracting,
        object: r.object_brief_description,
        value: r.initial_contractual_price != null ? Number(r.initial_contractual_price) : null,
      })),
    };
  });

  // Digest semanal em HTML pronto para email (layout independente da app)
  app.get('/api/profiles/:id/digest.html', { preHandler: requireAuth }, async (req, reply) => {
    const profileId = Number((req.params as { id: string }).id);
    const data = await digestData(profileId);
    if (!data) return reply.code(404).send({ error: { code: 'not_found', message: 'Perfil não encontrado' } });
    const { profile, newAnns, openAnns, renewals, intro } = data;

    const fmtEur = (v: unknown) =>
      v == null ? '—' : Number(v).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

    const row = (cells: string[], bold = false) =>
      `<tr>${cells.map((c) => `<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;${bold ? 'font-weight:600' : ''}">${c}</td>`).join('')}</tr>`;
    const th = (cells: string[]) =>
      `<tr>${cells.map((c) => `<td style="padding:8px 10px;border-bottom:2px solid #e2e8f0;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#64748b;font-weight:700">${c}</td>`).join('')}</tr>`;
    const section = (title: string, body: string) =>
      `<h2 style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#0f172a;margin:28px 0 8px">${title}</h2>${body}`;

    const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>BaseRadar — Digest ${esc(profile.name)}</title></head>
<body style="margin:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
<tr><td style="padding:22px 28px;border-bottom:1px solid #e2e8f0">
  <span style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.5px">Base<span style="color:#2563eb">Radar</span></span>
  <span style="font-size:11px;color:#64748b;letter-spacing:0.08em;text-transform:uppercase">&nbsp;&nbsp;Digest semanal — ${esc(profile.name)}</span>
</td></tr>
<tr><td style="padding:24px 28px">
  ${intro ? `<p style="font-size:14px;line-height:1.55;color:#334155;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;margin:0 0 8px">${esc(intro)}</p>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px"><tr>
    ${[[String(openAnns.length), 'Concursos abertos'], [String(newAnns.length), 'Novos (7 dias)'], [String(renewals.length), 'Renovações 90 dias']]
      .map(([n, l]) => `<td align="center" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px"><div style="font-size:22px;font-weight:700;color:#1e3a8a">${n}</div><div style="font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#64748b">${l}</div></td><td width="8"></td>`).join('')}
  </tr></table>

  ${section('Concursos com prazo a decorrer', openAnns.length
    ? `<table width="100%" cellpadding="0" cellspacing="0">${th(['Prazo', 'Designação', 'Entidade', 'Preço base'])}
       ${openAnns.slice(0, 10).map((a) => row([String(a.proposal_deadline_date).slice(0, 10), esc(a.contract_designation).slice(0, 90), esc(a.contracting_entity), fmtEur(a.base_price)])).join('')}</table>`
    : '<p style="font-size:13px;color:#64748b">Sem concursos abertos neste momento.</p>')}

  ${section('Renovações a preparar (próximos 90 dias)', renewals.length
    ? `<table width="100%" cellpadding="0" cellspacing="0">${th(['Termina', 'Entidade', 'Objeto', 'Valor'])}
       ${renewals.map((r) => row([`${String(r.end_date).slice(0, 10)} (${r.days_left}d)`, esc(r.contracting), esc(r.object_brief_description).slice(0, 80), fmtEur(r.initial_contractual_price)])).join('')}</table>`
    : '<p style="font-size:13px;color:#64748b">Sem renovações no horizonte de 90 dias.</p>')}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0">
  <p style="font-size:11px;color:#94a3b8;margin:0">Gerado por BaseRadar · Fonte: Portal BASE — IMPIC / dados.gov.pt · ${new Date().toLocaleDateString('pt-PT')}</p>
</td></tr>
</table></td></tr></table></body></html>`;

    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.send(html);
  });

  // ---------- Catálogo CPV (pesquisa por nome de atividade ou código) ----------
  app.get('/api/cpv', { preHandler: requireAuth }, async (req) => {
    const q = String((req.query as Record<string, unknown>).q ?? '').trim();
    if (!q) {
      const { rows } = await pool.query(
        `SELECT code, designation, n_contracts FROM cpv_catalog ORDER BY n_contracts DESC LIMIT 40`);
      return { items: rows };
    }
    if (/^\d{2,}/.test(q)) {
      const { rows } = await pool.query(
        `SELECT code, designation, n_contracts FROM cpv_catalog
         WHERE code LIKE $1 ORDER BY n_contracts DESC LIMIT 40`,
        [`${q.split('-')[0]}%`]
      );
      return { items: rows };
    }
    // pesquisa por nome: todas as palavras têm de aparecer (sem acentos, qualquer ordem)
    const words = normalize(q).split(/\s+/).filter((w) => w.length >= 2);
    const params: unknown[] = [];
    const where = words.map((w) => {
      params.push(`%${w}%`);
      return `designation_norm LIKE $${params.length}`;
    }).join(' AND ');
    const { rows } = await pool.query(
      `SELECT code, designation, n_contracts FROM cpv_catalog
       ${where ? `WHERE ${where}` : ''} ORDER BY n_contracts DESC LIMIT 40`,
      params
    );
    return { items: rows };
  });

  // ---------- Anúncios ----------
  app.get('/api/announcements', { preHandler: requireAuth }, async (req) => {
    const q = req.query as Record<string, unknown>;
    const profileId = parseProfileId(q);
    const onlyOpen = q.open === '1';
    const params: unknown[] = [];
    let join = '';
    if (profileId != null) {
      params.push(profileId);
      join = `JOIN (${PROFILE_ANNOUNCEMENTS}) scope ON scope.id = a.id`;
    }
    const where = onlyOpen ? `WHERE a.proposal_deadline_date >= CURRENT_DATE` : '';
    const page = Math.max(0, Number(q.page ?? 0) || 0);
    const size = Math.min(200, Math.max(1, Number(q.size ?? 50) || 50));
    params.push(size, page * size);
    const { rows } = await pool.query(
      `SELECT a.*, count(*) OVER() AS full_count FROM announcements a ${join} ${where}
       ORDER BY a.proposal_deadline_date DESC NULLS LAST, a.dr_publication_date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return {
      total: rows.length ? Number(rows[0].full_count) : 0,
      page, size,
      items: rows.map(({ full_count: _fc, raw_list_json: _rl, raw_detail_json: _rd, ...a }) => ({
        ...a,
        basegov_id: Number(a.basegov_id),
        base_price: a.base_price != null ? Number(a.base_price) : null,
        basegov_url: `https://www.base.gov.pt/Base4/pt/detalhe/?type=anuncios&id=${a.basegov_id}`,
      })),
    };
  });

  app.get('/api/announcements/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const raw = (req.query as Record<string, unknown>).raw === '1';
    const { rows } = await pool.query('SELECT * FROM announcements WHERE id = $1', [id]);
    if (rows.length === 0) return reply.code(404).send({ error: { code: 'not_found', message: 'Anúncio não encontrado' } });
    const a = rows[0];
    return {
      ...(raw ? a : { ...a, raw_list_json: undefined, raw_detail_json: undefined }),
      basegov_id: Number(a.basegov_id),
      base_price: a.base_price != null ? Number(a.base_price) : null,
      basegov_url: `https://www.base.gov.pt/Base4/pt/detalhe/?type=anuncios&id=${a.basegov_id}`,
      is_open: a.proposal_deadline_date != null && new Date(a.proposal_deadline_date) >= new Date(new Date().toISOString().slice(0, 10)),
    };
  });

  // ---------- Insights: drill-down por região/distrito ----------
  app.get('/api/insights/region', { preHandler: requireAuth }, async (req, reply) => {
    const q = req.query as Record<string, unknown>;
    const district = String(q.district ?? '').trim();
    if (!district) return reply.code(400).send({ error: { code: 'invalid_district', message: 'district é obrigatório' } });
    const profileId = parseProfileId(q);
    const scope = contractScope(profileId);
    const params = [...scope.params, district];
    const d = `$${params.length}`;

    const { rows: contracts } = await pool.query(
      `SELECT c.id, c.basegov_id, c.object_brief_description, c.initial_contractual_price,
         c.publication_date, c.contracting_procedure_type,
         (SELECT string_agg(e.name, '; ') FROM contract_entities ce JOIN entities e ON e.id = ce.entity_id
           WHERE ce.contract_id = c.id AND ce.role = 'contracting') AS contracting
       FROM contracts c ${scope.join}
       WHERE coalesce(${DISTRICT}, 'Desconhecido') = ${d}
       ORDER BY c.publication_date DESC NULLS LAST LIMIT 50`,
      params
    );
    const { rows: renewals } = await pool.query(
      `SELECT c.id, c.basegov_id, c.object_brief_description, c.initial_contractual_price,
         ${END_DATE} AS end_date, (${END_DATE} - CURRENT_DATE) AS days_left,
         (SELECT string_agg(e.name, '; ') FROM contract_entities ce JOIN entities e ON e.id = ce.entity_id
           WHERE ce.contract_id = c.id AND ce.role = 'contracting') AS contracting
       FROM contracts c ${scope.join}
       WHERE coalesce(${DISTRICT}, 'Desconhecido') = ${d}
         AND ${HAS_END} AND ${END_DATE} BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '12 months'
       ORDER BY end_date LIMIT 50`,
      params
    );
    const { rows: byYear } = await pool.query(
      `SELECT extract(year FROM c.publication_date)::int AS year, count(*) AS n,
              coalesce(sum(c.initial_contractual_price),0) AS total
       FROM contracts c ${scope.join}
       WHERE coalesce(${DISTRICT}, 'Desconhecido') = ${d} AND c.publication_date IS NOT NULL
       GROUP BY 1 ORDER BY 1`,
      params
    );
    const { rows: byMonth } = await pool.query(
      `SELECT extract(month FROM c.publication_date)::int AS month, count(*) AS n
       FROM contracts c ${scope.join}
       WHERE coalesce(${DISTRICT}, 'Desconhecido') = ${d} AND c.publication_date IS NOT NULL
       GROUP BY 1 ORDER BY 1`,
      params
    );
    const num = (v: unknown) => (v != null ? Number(v) : null);
    return {
      district,
      contracts: contracts.map((c) => ({ ...c, basegov_id: Number(c.basegov_id), initial_contractual_price: num(c.initial_contractual_price) })),
      renewals: renewals.map((r) => ({ ...r, basegov_id: Number(r.basegov_id), initial_contractual_price: num(r.initial_contractual_price) })),
      by_year: byYear.map((y) => ({ year: y.year, count: Number(y.n), total_value: Number(y.total) })),
      by_month: Array.from({ length: 12 }, (_, i) => {
        const r = byMonth.find((x) => Number(x.month) === i + 1);
        return { month: i + 1, count: r ? Number(r.n) : 0 };
      }),
    };
  });

  // ---------- Insights: renovações ----------
  app.get('/api/insights/renewals', { preHandler: requireAuth }, async (req) => {
    const q = req.query as Record<string, unknown>;
    const profileId = parseProfileId(q);
    const months = Math.min(24, Math.max(1, Number(q.months ?? 6) || 6));
    const scope = contractScope(profileId);
    const params = [...scope.params, months];
    const m = `$${params.length}`;
    const { rows } = await pool.query(
      `SELECT c.id, c.basegov_id, c.object_brief_description, c.initial_contractual_price,
         c.signing_date, c.execution_deadline, c.execution_place, ${END_DATE} AS end_date,
         (${END_DATE} - CURRENT_DATE) AS days_left,
         (SELECT string_agg(e.name, '; ') FROM contract_entities ce JOIN entities e ON e.id = ce.entity_id
           WHERE ce.contract_id = c.id AND ce.role = 'contracting') AS contracting,
         (SELECT string_agg(e.name, '; ') FROM contract_entities ce JOIN entities e ON e.id = ce.entity_id
           WHERE ce.contract_id = c.id AND ce.role = 'contracted') AS incumbent
       FROM contracts c ${scope.join}
       WHERE ${HAS_END}
         AND ${END_DATE} BETWEEN CURRENT_DATE AND CURRENT_DATE + (${m} || ' months')::interval
       ORDER BY end_date
       LIMIT 500`,
      params
    );
    return {
      months,
      items: rows.map((r) => ({
        ...r,
        basegov_id: Number(r.basegov_id),
        initial_contractual_price: r.initial_contractual_price != null ? Number(r.initial_contractual_price) : null,
        // 4 meses antes do fim do contrato, nunca no passado
        suggested_contact_date: r.end_date
          ? new Date(Math.max(Date.now(), new Date(r.end_date).getTime() - 120 * 86400000)).toISOString().slice(0, 10)
          : null,
        basegov_url: `https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=${r.basegov_id}`,
      })),
    };
  });

  // ---------- Insights: sazonalidade ----------
  app.get('/api/insights/seasonality', { preHandler: requireAuth }, async (req) => {
    const profileId = parseProfileId(req.query as Record<string, unknown>);
    const scope = contractScope(profileId);
    const { rows: contracts } = await pool.query(
      `SELECT extract(month FROM c.publication_date)::int AS month,
              count(*) AS n, coalesce(sum(c.initial_contractual_price),0) AS total
       FROM contracts c ${scope.join}
       WHERE c.publication_date IS NOT NULL GROUP BY 1 ORDER BY 1`,
      scope.params
    );
    let annJoin = '';
    const annParams: unknown[] = [];
    if (profileId != null) {
      annParams.push(profileId);
      annJoin = `JOIN (${PROFILE_ANNOUNCEMENTS}) scope ON scope.id = a.id`;
    }
    const { rows: announcements } = await pool.query(
      `SELECT extract(month FROM a.dr_publication_date)::int AS month,
              count(*) AS n, coalesce(sum(a.base_price),0) AS total
       FROM announcements a ${annJoin}
       WHERE a.dr_publication_date IS NOT NULL GROUP BY 1 ORDER BY 1`,
      annParams
    );
    const fill = (rows: { month: number; n: string; total: string }[]) =>
      Array.from({ length: 12 }, (_, i) => {
        const r = rows.find((x) => Number(x.month) === i + 1);
        return { month: i + 1, count: r ? Number(r.n) : 0, total_value: r ? Number(r.total) : 0 };
      });
    return { contracts: fill(contracts), announcements: fill(announcements) };
  });

  // ---------- Insights: mapa (por distrito) ----------
  app.get('/api/insights/map', { preHandler: requireAuth }, async (req) => {
    const profileId = parseProfileId(req.query as Record<string, unknown>);
    const scope = contractScope(profileId);
    const { rows } = await pool.query(
      `SELECT coalesce(${DISTRICT}, 'Desconhecido') AS district,
              count(*) AS n, coalesce(sum(c.initial_contractual_price),0) AS total,
              coalesce(avg(c.initial_contractual_price),0) AS avg
       FROM contracts c ${scope.join}
       GROUP BY 1 ORDER BY total DESC`,
      scope.params
    );
    return {
      items: rows.map((r) => ({
        district: r.district,
        count: Number(r.n),
        total_value: Number(r.total),
        avg_value: Number(r.avg),
      })),
    };
  });

  // ---------- Insights: timeline mensal por distrito (slider do mapa) ----------
  app.get('/api/insights/map-timeline', { preHandler: requireAuth }, async (req) => {
    const q = req.query as Record<string, unknown>;
    const profileId = parseProfileId(q);
    const scope = contractScope(profileId);
    // basis=end: meses futuros por data de FIM do contrato (renovações previstas por distrito)
    // basis=publication (default): meses históricos por data de publicação
    const basis = q.basis === 'end' ? 'end' : 'publication';
    const { rows } = basis === 'end'
      ? await pool.query(
          `SELECT coalesce(${DISTRICT}, 'Desconhecido') AS district,
                  to_char(${END_DATE}, 'YYYY-MM') AS month,
                  count(*) AS n, coalesce(sum(c.initial_contractual_price),0) AS total
           FROM contracts c ${scope.join}
           WHERE ${HAS_END}
             AND ${END_DATE} >= date_trunc('month', CURRENT_DATE)
             AND ${END_DATE} < CURRENT_DATE + interval '24 months'
           GROUP BY 1, 2`,
          scope.params
        )
      : await pool.query(
          `SELECT coalesce(${DISTRICT}, 'Desconhecido') AS district,
                  to_char(c.publication_date, 'YYYY-MM') AS month,
                  count(*) AS n, coalesce(sum(c.initial_contractual_price),0) AS total
           FROM contracts c ${scope.join}
           WHERE c.publication_date IS NOT NULL
           GROUP BY 1, 2`,
          scope.params
        );
    const monthsSet = new Set<string>();
    const districts: Record<string, Record<string, { count: number; total_value: number }>> = {};
    for (const r of rows) {
      monthsSet.add(r.month);
      (districts[r.district] ??= {})[r.month] = { count: Number(r.n), total_value: Number(r.total) };
    }
    return { months: [...monthsSet].sort(), districts };
  });

  // ---------- Entidades ----------
  app.get('/api/entities', { preHandler: requireAuth }, async (req) => {
    const q = req.query as Record<string, unknown>;
    const role = q.role === 'contracted' ? 'contracted' : 'contracting';
    const params: unknown[] = [role];
    let filter = '';
    if (q.q) {
      params.push(`%${q.q}%`);
      filter = `AND (e.name ILIKE $${params.length} OR e.nif ILIKE $${params.length})`;
    }
    const page = Math.max(0, Number(q.page ?? 0) || 0);
    const size = Math.min(200, Math.max(1, Number(q.size ?? 50) || 50));
    params.push(size, page * size);
    const { rows } = await pool.query(
      `SELECT e.id, e.nif, e.name,
         count(DISTINCT ce.contract_id) AS n_contracts,
         coalesce(sum(c.initial_contractual_price),0) AS total_value,
         max(c.publication_date) AS last_contract,
         count(*) OVER() AS full_count
       FROM entities e
       JOIN contract_entities ce ON ce.entity_id = e.id AND ce.role = $1
       JOIN contracts c ON c.id = ce.contract_id
       WHERE true ${filter}
       GROUP BY e.id
       ORDER BY total_value DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return {
      total: rows.length ? Number(rows[0].full_count) : 0,
      page, size, role,
      items: rows.map(({ full_count: _fc, ...e }) => ({
        ...e, n_contracts: Number(e.n_contracts), total_value: Number(e.total_value),
      })),
    };
  });

  app.get('/api/entities/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const { rows: ent } = await pool.query('SELECT * FROM entities WHERE id = $1', [id]);
    if (ent.length === 0) return reply.code(404).send({ error: { code: 'not_found', message: 'Entidade não encontrada' } });

    const asRole = async (role: string) => {
      const { rows: [agg] } = await pool.query(
        `SELECT count(DISTINCT c.id) AS n, coalesce(sum(c.initial_contractual_price),0) AS total,
                coalesce(avg(c.initial_contractual_price),0) AS avg
         FROM contract_entities ce JOIN contracts c ON c.id = ce.contract_id
         WHERE ce.entity_id = $1 AND ce.role = $2`, [id, role]);
      const { rows: byYear } = await pool.query(
        `SELECT extract(year FROM c.publication_date)::int AS year, count(*) AS n,
                coalesce(sum(c.initial_contractual_price),0) AS total
         FROM contract_entities ce JOIN contracts c ON c.id = ce.contract_id
         WHERE ce.entity_id = $1 AND ce.role = $2 AND c.publication_date IS NOT NULL
         GROUP BY 1 ORDER BY 1 DESC LIMIT 8`, [id, role]);
      const { rows: procedures } = await pool.query(
        `SELECT c.contracting_procedure_type AS type, count(*) AS n
         FROM contract_entities ce JOIN contracts c ON c.id = ce.contract_id
         WHERE ce.entity_id = $1 AND ce.role = $2 GROUP BY 1 ORDER BY n DESC`, [id, role]);
      const counterRole = role === 'contracting' ? 'contracted' : 'contracting';
      const { rows: counterparts } = await pool.query(
        `SELECT e2.id, e2.name, e2.nif, count(DISTINCT c.id) AS n,
                coalesce(sum(c.initial_contractual_price),0) AS total
         FROM contract_entities ce JOIN contracts c ON c.id = ce.contract_id
         JOIN contract_entities ce2 ON ce2.contract_id = c.id AND ce2.role = $3
         JOIN entities e2 ON e2.id = ce2.entity_id
         WHERE ce.entity_id = $1 AND ce.role = $2
         GROUP BY e2.id ORDER BY total DESC LIMIT 10`, [id, role, counterRole]);
      const { rows: contracts } = await pool.query(
        `SELECT c.id, c.basegov_id, c.object_brief_description, c.initial_contractual_price,
                c.publication_date, c.signing_date, c.execution_deadline, c.contracting_procedure_type,
                CASE WHEN ${HAS_END} THEN ${END_DATE} ELSE NULL END AS end_date
         FROM contract_entities ce JOIN contracts c ON c.id = ce.contract_id
         WHERE ce.entity_id = $1 AND ce.role = $2
         ORDER BY c.publication_date DESC NULLS LAST LIMIT 25`, [id, role]);
      return {
        n_contracts: Number(agg.n),
        total_value: Number(agg.total),
        avg_value: Number(agg.avg),
        by_year: byYear.map((y) => ({ year: y.year, count: Number(y.n), total_value: Number(y.total) })),
        procedure_types: procedures.map((p) => ({ type: p.type, count: Number(p.n) })),
        counterparts: counterparts.map((cp) => ({ id: cp.id, name: cp.name, nif: cp.nif, count: Number(cp.n), total_value: Number(cp.total) })),
        recent_contracts: contracts.map((c) => ({
          ...c,
          basegov_id: Number(c.basegov_id),
          initial_contractual_price: c.initial_contractual_price != null ? Number(c.initial_contractual_price) : null,
          basegov_url: `https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=${c.basegov_id}`,
        })),
      };
    };

    return {
      ...ent[0],
      as_contracting: await asRole('contracting'),
      as_contracted: await asRole('contracted'),
    };
  });

  // ---------- Insights: concorrentes (adjudicatários no scope) ----------
  app.get('/api/insights/competitors', { preHandler: requireAuth }, async (req) => {
    const profileId = parseProfileId(req.query as Record<string, unknown>);
    const scope = contractScope(profileId);
    const { rows } = await pool.query(
      `WITH scoped AS (SELECT c.* FROM contracts c ${scope.join}),
       tot AS (SELECT coalesce(sum(initial_contractual_price),0) AS v FROM scoped)
       SELECT e.id, e.name, e.nif,
         count(DISTINCT c.id) AS n,
         coalesce(sum(c.initial_contractual_price),0) AS total,
         coalesce(avg(c.initial_contractual_price),0) AS avg,
         round(100.0 * coalesce(sum(c.initial_contractual_price),0) / NULLIF((SELECT v FROM tot),0), 1) AS share_pct,
         (SELECT string_agg(DISTINCT e2.name, '; ')
            FROM scoped c3
            JOIN contract_entities cex ON cex.contract_id = c3.id AND cex.role = 'contracted' AND cex.entity_id = e.id
            JOIN contract_entities ce2 ON ce2.contract_id = c3.id AND ce2.role = 'contracting'
            JOIN entities e2 ON e2.id = ce2.entity_id) AS top_clients
       FROM scoped c
       JOIN contract_entities ce ON ce.contract_id = c.id AND ce.role = 'contracted'
       JOIN entities e ON e.id = ce.entity_id
       GROUP BY e.id
       ORDER BY total DESC LIMIT 50`,
      scope.params
    );
    return {
      items: rows.map((r) => ({
        id: r.id, name: r.name, nif: r.nif,
        n_contracts: Number(r.n),
        total_value: Number(r.total),
        avg_value: Number(r.avg),
        share_pct: r.share_pct != null ? Number(r.share_pct) : null,
        top_clients: r.top_clients,
      })),
    };
  });

  // ---------- Insights: oportunidades (scoring) ----------
  app.get('/api/insights/opportunities', { preHandler: requireAuth }, async (req) => {
    const query = req.query as Record<string, unknown>;
    const profileId = parseProfileId(query);
    const textFilter = String(query.q ?? '').trim().toLowerCase();
    const scope = contractScope(profileId);

    // Anúncios abertos no scope
    let annJoin = '';
    const annParams: unknown[] = [];
    if (profileId != null) {
      annParams.push(profileId);
      annJoin = `JOIN (${PROFILE_ANNOUNCEMENTS}) scope ON scope.id = a.id`;
    }
    const { rows: open } = await pool.query(
      `SELECT a.id, a.basegov_id, a.contract_designation, a.contracting_entity, a.base_price,
              a.proposal_deadline_date, (a.proposal_deadline_date - CURRENT_DATE) AS days_left
       FROM announcements a ${annJoin}
       WHERE a.proposal_deadline_date >= CURRENT_DATE
       ORDER BY a.proposal_deadline_date`,
      annParams
    );

    // Renovações nos próximos 12 meses — a mesma janela do separador Renovações
    // e do fit IA automático, para as contagens baterem certo entre vistas.
    // Recorrência = nº de contratos registados da entidade adjudicante (lookup
    // direto por índice; contar dentro do scope completo degenerava em planos
    // de segundos com 100k+ contratos).
    const { rows: renewals } = await pool.query(
      `WITH win AS (
         SELECT c.id, c.basegov_id, c.object_brief_description, c.initial_contractual_price,
           ${END_DATE} AS end_date, (${END_DATE} - CURRENT_DATE) AS days_left
         FROM contracts c ${scope.join}
         WHERE ${HAS_END}
           AND ${END_DATE} BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '12 months'
         ORDER BY ${END_DATE} LIMIT 300
       )
       SELECT w.*,
         (SELECT string_agg(e.name, '; ') FROM contract_entities ce JOIN entities e ON e.id = ce.entity_id
           WHERE ce.contract_id = w.id AND ce.role = 'contracting') AS contracting,
         coalesce((SELECT max(cnt) FROM (
             SELECT count(*) AS cnt FROM contract_entities ce2
             WHERE ce2.role = 'contracting' AND ce2.entity_id IN (
               SELECT ce3.entity_id FROM contract_entities ce3
               WHERE ce3.contract_id = w.id AND ce3.role = 'contracting')
             GROUP BY ce2.entity_id) t), 1) AS entity_recurrence
       FROM win w
       ORDER BY w.end_date`,
      scope.params
    );

    // Scoring 0-100: valor (log), urgência/proximidade e recorrência da entidade.
    const valueScore = (v: number | null) => Math.min(35, v && v > 0 ? Math.log10(v) * 7 : 0);
    const opportunities = [
      ...open.map((a) => {
        const value = a.base_price != null ? Number(a.base_price) : null;
        const days = Number(a.days_left);
        const urgency = Math.max(0, 40 - days); // quanto mais perto o prazo, mais urgente
        const score = Math.round(Math.min(100, 25 + valueScore(value) + urgency));
        return {
          type: 'anuncio_aberto',
          announcement_id: a.id,
          recurrence: null,
          internal_url: `#/announcements/${a.id}`,
          score,
          title: a.contract_designation,
          entity: a.contracting_entity,
          value,
          key_date: a.proposal_deadline_date,
          days_left: days,
          reason: `Concurso aberto — prazo de propostas em ${days} dia(s)`,
          action: 'Preparar e submeter proposta',
          basegov_url: `https://www.base.gov.pt/Base4/pt/detalhe/?type=anuncios&id=${a.basegov_id}`,
        };
      }),
      ...renewals.map((c) => {
        const value = c.initial_contractual_price != null ? Number(c.initial_contractual_price) : null;
        const days = Number(c.days_left);
        const proximity = Math.max(0, 30 - days / 6); // fim mais próximo → contactar já
        const recurrence = Math.min(15, Number(c.entity_recurrence) * 3);
        const score = Math.round(Math.min(100, valueScore(value) + proximity + recurrence));
        return {
          type: 'renovacao',
          contract_id: c.id,
          recurrence: Number(c.entity_recurrence),
          internal_url: `#/contracts/${c.id}`,
          score,
          title: c.object_brief_description,
          entity: c.contracting,
          value,
          key_date: c.end_date,
          days_left: days,
          reason: `Contrato termina em ${days} dia(s); entidade com ${c.entity_recurrence} contrato(s) na área`,
          action: 'Contactar a entidade antes do lançamento do novo procedimento',
          basegov_url: `https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=${c.basegov_id}`,
        };
      }),
    ]
      .filter((o) => !textFilter ||
        `${o.title ?? ''} ${o.entity ?? ''}`.toLowerCase().includes(textFilter))
      .sort((a, b) => b.score - a.score);

    return { items: opportunities.slice(0, 100) };
  });
}
