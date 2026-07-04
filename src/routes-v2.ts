import { FastifyInstance } from 'fastify';
import { pool } from './db.js';
import { requireAuth } from './auth.js';
import { createProfileRun } from './profiles.js';

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
      name?: string; terms?: string[]; schedule?: string; include_announcements?: boolean;
      fetch_documents?: boolean; run_now?: boolean;
    };
    const name = body.name?.trim();
    const terms = (body.terms ?? []).map((t) => String(t).trim()).filter(Boolean);
    const schedule = ['manual', 'daily', 'weekly'].includes(body.schedule ?? '') ? body.schedule : 'manual';
    if (!name || terms.length === 0) {
      return reply.code(400).send({ error: { code: 'invalid_profile', message: 'name e terms[] são obrigatórios' } });
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO profiles (name, terms, schedule, include_announcements, fetch_documents)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [name, terms, schedule, body.include_announcements !== false, body.fetch_documents === true]
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
    const profileId = parseProfileId(req.query as Record<string, unknown>);
    const scope = contractScope(profileId);
    const { rows } = await pool.query(
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
    const profileId = parseProfileId(req.query as Record<string, unknown>);
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

    // Renovações nos próximos 6 meses. Recorrência = nº de contratos registados
    // da entidade adjudicante (lookup direto por índice; contar dentro do scope
    // completo degenerava em planos de segundos com 100k+ contratos).
    const { rows: renewals } = await pool.query(
      `WITH win AS (
         SELECT c.id, c.basegov_id, c.object_brief_description, c.initial_contractual_price,
           ${END_DATE} AS end_date, (${END_DATE} - CURRENT_DATE) AS days_left
         FROM contracts c ${scope.join}
         WHERE ${HAS_END}
           AND ${END_DATE} BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '6 months'
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
    ].sort((a, b) => b.score - a.score);

    return { items: opportunities.slice(0, 100) };
  });
}
