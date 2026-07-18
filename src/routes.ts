import { FastifyInstance } from 'fastify';
import { pool } from './db.js';
import { requireAuth, verifyCredentials, SESSION_COOKIE, auth, companyFilter } from './auth.js';
import { capabilitiesFor, seatLimit, aiCap } from './plans.js';
import { aiUsageSummary } from './aiUsage.js';
import { buildSearchWorkbook } from './excel.js';

interface Paging {
  page: number;
  size: number;
}

function paging(query: Record<string, unknown>, defaultSize = 25, maxSize = 200): Paging {
  const page = Math.max(0, parseInt(String(query.page ?? '0'), 10) || 0);
  const size = Math.min(maxSize, Math.max(1, parseInt(String(query.size ?? String(defaultSize)), 10) || defaultSize));
  return { page, size };
}

const CONTRACT_END = `(c.signing_date + (substring(c.execution_deadline from '(\\d+)')::int))`;
const CONTRACT_HAS_END = `c.signing_date IS NOT NULL AND c.execution_deadline ~ '\\d+'`;

/**
 * Filtros temporais de listagens de contratos:
 * - active=1 → só contratos em execução ou futuros (fim previsto >= hoje)
 * - from/até → intervalo sobre a data de publicação (YYYY-MM-DD)
 */
function dateFilters(query: Record<string, unknown>, params: unknown[]): string[] {
  const conditions: string[] = [];
  if (query.active === '1') {
    conditions.push(`(${CONTRACT_HAS_END} AND ${CONTRACT_END} >= CURRENT_DATE)`);
  }
  const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (isDate(query.from)) {
    params.push(query.from);
    conditions.push(`c.publication_date >= $${params.length}`);
  }
  if (isDate(query.to)) {
    params.push(query.to);
    conditions.push(`c.publication_date <= $${params.length}`);
  }
  return conditions;
}

async function contractDocuments(contractId: number) {
  const { rows } = await pool.query(
    `SELECT id, basegov_id, file_name, content_type, size_bytes, download_ok, download_error
     FROM documents WHERE contract_id = $1 ORDER BY id`,
    [contractId]
  );
  return rows.map((d) => ({
    id: d.id,
    basegov_id: Number(d.basegov_id),
    file_name: d.file_name,
    content_type: d.content_type,
    size_bytes: d.size_bytes ? Number(d.size_bytes) : null,
    download_ok: d.download_ok,
    download_error: d.download_error,
    download_url: `/api/documents/${d.id}/content`,
  }));
}

async function contractEntities(contractId: number) {
  const { rows } = await pool.query(
    `SELECT ce.role, e.id, e.nif, e.name FROM contract_entities ce
     JOIN entities e ON e.id = ce.entity_id WHERE ce.contract_id = $1`,
    [contractId]
  );
  const byRole: Record<string, { id: number; nif: string; name: string }[]> = {};
  for (const r of rows) {
    (byRole[r.role] ??= []).push({ id: r.id, nif: r.nif, name: r.name });
  }
  return byRole;
}

/* Fim previsto do contrato: celebração + N dias do prazo de execução — a mesma
   regra do END_DATE em SQL (renovações, mapa, digest), para a data apresentada
   no detalhe bater certo com as listagens. */
function estimatedEndDate(c: Record<string, unknown>): string | null {
  const days = typeof c.execution_deadline === 'string' ? c.execution_deadline.match(/\d+/) : null;
  if (!c.signing_date || !days) return null;
  const signing = new Date(c.signing_date as string | Date);
  if (Number.isNaN(signing.getTime())) return null;
  return new Date(signing.getTime() + Number(days[0]) * 86400000).toISOString().slice(0, 10);
}

/**
 * Extrai as modificações ao contrato do JSON de detalhe do BASE que já
 * guardamos (raw_detail_json), de forma defensiva: o BASE pode expor o array
 * sob nomes diferentes (contractModification, modificacoes, adendas, …). Não
 * depende de novo scraping. Devolve [] se não houver nada reconhecível.
 */
function extractModifications(raw: unknown): { date: string | null; label: string; price_text: string | null }[] {
  if (!raw || typeof raw !== 'object') return [];
  const pickStr = (o: Record<string, unknown>, re: RegExp): string | null => {
    for (const [k, v] of Object.entries(o)) {
      if (re.test(k) && (typeof v === 'string' || typeof v === 'number') && String(v).trim()) return String(v).trim();
    }
    return null;
  };
  const out: { date: string | null; label: string; price_text: string | null }[] = [];
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/modif|adenda|prorrog|alter/i.test(k) || !Array.isArray(v)) continue;
    for (const m of v) {
      if (!m || typeof m !== 'object') continue;
      const o = m as Record<string, unknown>;
      const date = pickStr(o, /date|data/i);
      const label = pickStr(o, /descri|object|reason|motiv|fundament|type|tipo|caus/i)
        // se não houver campo descritivo, junta os primeiros textos do item
        ?? Object.values(o).filter((x) => (typeof x === 'string') && x.trim() && x.length < 200).slice(0, 2).join(' · ')
        ?? '(modificação)';
      out.push({ date, label: label || '(modificação)', price_text: pickStr(o, /price|valor|value/i) });
    }
  }
  return out;
}

function contractToJson(c: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const modifications = extractModifications(c.raw_detail_json);
  return {
    id: c.id,
    basegov_id: Number(c.basegov_id),
    description: c.description,
    object_brief_description: c.object_brief_description,
    contracting_procedure_type: c.contracting_procedure_type,
    contract_types: c.contract_types,
    publication_date: c.publication_date,
    signing_date: c.signing_date,
    close_date: c.close_date,
    execution_deadline: c.execution_deadline,
    estimated_end_date: estimatedEndDate(c),
    execution_place: c.execution_place,
    initial_contractual_price: c.initial_contractual_price != null ? Number(c.initial_contractual_price) : null,
    total_effective_price: c.total_effective_price != null ? Number(c.total_effective_price) : null,
    cpvs: c.cpvs,
    cpvs_designation: c.cpvs_designation,
    contract_fundamentation: c.contract_fundamentation,
    regime: c.regime,
    contracting_procedure_url: c.contracting_procedure_url,
    centralized_procedure: c.centralized_procedure,
    ambient_criteria: c.ambient_criteria,
    ccp: c.ccp,
    detail_scraped_at: c.detail_scraped_at,
    modifications,
    basegov_url: `https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=${c.basegov_id}`,
    ...extra,
  };
}

/** true se a pesquisa pertence à empresa do pedido (ou acesso global). */
async function searchOwned(req: Parameters<typeof auth>[0], id: number): Promise<boolean> {
  const { companyId } = auth(req);
  if (companyId == null) return true;
  const { rows } = await pool.query('SELECT 1 FROM searches WHERE id = $1 AND company_id = $2', [id, companyId]);
  return rows.length > 0;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // ---- Auth ----
  app.post('/api/auth/login', async (req, reply) => {
    // "username" aceita username OU email (compat. com a conta admin legada).
    const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
    const user = username && password ? await verifyCredentials(username, password) : null;
    if (!user) {
      return reply.code(401).send({ error: { code: 'invalid_credentials', message: 'Credenciais inválidas' } });
    }
    reply.setCookie(SESSION_COOKIE, user.username, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      signed: true,
      maxAge: 60 * 60 * 24 * 7,
    });
    return { ok: true, username: user.username };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => {
    const { username, companyId, isAdmin, plan } = auth(req);
    let company = null;
    if (companyId != null) {
      const { rows } = await pool.query(
        `SELECT id, name, nif, plan, subscription_status, trial_ends_at, renewal_at,
           (subscription_status = 'active'
             OR (subscription_status = 'trialing' AND (trial_ends_at IS NULL OR trial_ends_at > now()))) AS access_ok,
           CASE WHEN subscription_status = 'trialing' AND trial_ends_at IS NOT NULL
                THEN GREATEST(0, ceil(extract(epoch FROM (trial_ends_at - now())) / 86400)::int) END AS trial_days_left
         FROM companies WHERE id = $1`, [companyId]);
      company = rows[0] ?? null;
    }
    // plan aqui é o plano EFETIVO (resolvido no backend) — não o valor bruto da coluna.
    return { username, is_admin: isAdmin, plan, company };
  });

  // Capabilities: fonte única para o frontend espelhar o gating (o backend é
  // sempre a verdade — 403 nas rotas fora do plano, independentemente disto).
  app.get('/api/me/capabilities', { preHandler: requireAuth }, async (req) => {
    const { companyId, isAdmin, plan } = auth(req);
    // Admin/acesso global: plano efetivo business (tudo desbloqueado).
    const effPlan = isAdmin ? 'business' : plan;
    const [seatUsed] = companyId != null
      ? (await pool.query('SELECT count(*)::int AS n FROM users WHERE company_id = $1', [companyId])).rows
      : [{ n: 0 }];
    const ai = await aiUsageSummary(companyId, effPlan);
    return {
      plan: effPlan,
      capabilities: capabilitiesFor(effPlan),
      ai_usage: ai,
      seats: { used: seatUsed.n, max: seatLimit(effPlan) },
      caps: { ai_cap: aiCap(effPlan) },
    };
  });

  // ---- Searches ----
  app.get('/api/searches', { preHandler: requireAuth }, async (req) => {
    const { page, size } = paging(req.query as Record<string, unknown>);
    const params: unknown[] = [];
    const scope = companyFilter(req, 's.company_id', params);
    params.push(size, page * size);
    const { rows } = await pool.query(
      `SELECT s.*, u.username AS created_by_username,
         count(*) OVER() AS full_count
       FROM searches s LEFT JOIN users u ON u.id = s.created_by
       ${scope ? `WHERE ${scope}` : ''}
       ORDER BY s.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return {
      total: rows.length ? Number(rows[0].full_count) : 0,
      page,
      size,
      items: rows.map(({ full_count: _fc, ...s }) => s),
    };
  });

  app.post('/api/searches', { preHandler: requireAuth }, async (req, reply) => {
    const { term, fetch_documents } = (req.body ?? {}) as { term?: string; fetch_documents?: boolean };
    const cleaned = term?.trim();
    if (!cleaned) {
      return reply.code(400).send({ error: { code: 'invalid_term', message: 'Campo "term" é obrigatório' } });
    }
    const { userId, companyId } = auth(req);
    const { rows } = await pool.query(
      `INSERT INTO searches (term, created_by, company_id, fetch_documents) VALUES ($1, $2, $3, $4)
       RETURNING id, term, status, fetch_documents, created_at`,
      [cleaned, userId, companyId, fetch_documents === true]
    );
    return reply.code(201).send(rows[0]);
  });

  app.get('/api/searches/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!(await searchOwned(req, id))) return reply.code(404).send({ error: { code: 'not_found', message: 'Pesquisa não encontrada' } });
    const { rows } = await pool.query(
      `SELECT s.*, u.username AS created_by_username FROM searches s
       LEFT JOIN users u ON u.id = s.created_by WHERE s.id = $1`,
      [id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: { code: 'not_found', message: 'Pesquisa não encontrada' } });
    return rows[0];
  });

  // Reagenda uma pesquisa falhada; o processamento é idempotente e retoma onde ficou.
  app.post('/api/searches/:id/retry', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!(await searchOwned(req, id))) return reply.code(404).send({ error: { code: 'not_found', message: 'Pesquisa não encontrada' } });
    const { rows } = await pool.query(
      `UPDATE searches SET status = 'pending', retries = 0, next_attempt_at = NULL, finished_at = NULL
       WHERE id = $1 AND status = 'failed' RETURNING id`,
      [id]
    );
    if (rows.length === 0) {
      return reply.code(409).send({ error: { code: 'not_retryable', message: 'A pesquisa não está em estado failed' } });
    }
    return { ok: true };
  });

  app.get('/api/searches/:id/results', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!(await searchOwned(req, id))) return reply.code(404).send({ error: { code: 'not_found', message: 'Pesquisa não encontrada' } });
    const query = req.query as Record<string, unknown>;
    const { page, size } = paging(query);
    const params: unknown[] = [id];
    const extra = dateFilters(query, params);
    const where = extra.length ? `AND ${extra.join(' AND ')}` : '';
    params.push(size, page * size);
    const { rows } = await pool.query(
      `SELECT c.*, sr.position, count(*) OVER() AS full_count,
         (SELECT count(*) FROM documents d WHERE d.contract_id = c.id) AS n_docs
       FROM search_results sr JOIN contracts c ON c.id = sr.contract_id
       WHERE sr.search_id = $1 ${where}
       ORDER BY c.publication_date DESC NULLS LAST, sr.position
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return {
      total: rows.length ? Number(rows[0].full_count) : 0,
      page,
      size,
      items: rows.map((c) => contractToJson(c, { n_docs: Number(c.n_docs) })),
    };
  });

  // Endpoint para integrações externas: detalhe completo + documentos.
  app.get('/api/searches/:id/full', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!(await searchOwned(req, id))) return reply.code(404).send({ error: { code: 'not_found', message: 'Pesquisa não encontrada' } });
    const { page, size } = paging(req.query as Record<string, unknown>, 100, 500);
    const { rows } = await pool.query(
      `SELECT c.*, count(*) OVER() AS full_count
       FROM search_results sr JOIN contracts c ON c.id = sr.contract_id
       WHERE sr.search_id = $1 ORDER BY sr.position LIMIT $2 OFFSET $3`,
      [id, size, page * size]
    );
    const items = [];
    for (const c of rows) {
      items.push(
        contractToJson(c, {
          entities: await contractEntities(c.id as number),
          documents: await contractDocuments(c.id as number),
          raw_detail: c.raw_detail_json,
        })
      );
    }
    return { total: rows.length ? Number(rows[0].full_count) : 0, page, size, items };
  });

  app.get('/api/searches/:id/export.xlsx', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!(await searchOwned(req, id))) return reply.code(404).send({ error: { code: 'not_found', message: 'Pesquisa não encontrada' } });
    const { rows } = await pool.query('SELECT term FROM searches WHERE id = $1', [id]);
    if (rows.length === 0) return reply.code(404).send({ error: { code: 'not_found', message: 'Pesquisa não encontrada' } });
    const buf = await buildSearchWorkbook(id);
    const safeTerm = String(rows[0].term).replace(/[^\w\-]+/g, '_').slice(0, 40);
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="pesquisa-${id}-${safeTerm}.xlsx"`);
    return reply.send(buf);
  });

  // ---- Contracts ----
  app.get('/api/contracts', { preHandler: requireAuth }, async (req) => {
    const q = req.query as Record<string, unknown>;
    const { page, size } = paging(q);
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (q.term) {
      params.push(`%${q.term}%`);
      conditions.push(`(c.object_brief_description ILIKE $${params.length} OR c.description ILIKE $${params.length})`);
    }
    if (q.search_id) {
      params.push(Number(q.search_id));
      conditions.push(`EXISTS (SELECT 1 FROM search_results sr WHERE sr.contract_id = c.id AND sr.search_id = $${params.length})`);
    }
    conditions.push(...dateFilters(q, params));
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(size, page * size);
    const { rows } = await pool.query(
      `SELECT c.*, count(*) OVER() AS full_count FROM contracts c ${where}
       ORDER BY c.publication_date DESC NULLS LAST LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return {
      total: rows.length ? Number(rows[0].full_count) : 0,
      page,
      size,
      items: rows.map((c) => contractToJson(c)),
    };
  });

  app.get('/api/contracts/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const raw = (req.query as Record<string, unknown>).raw === '1';
    const { rows } = await pool.query('SELECT * FROM contracts WHERE id = $1', [id]);
    if (rows.length === 0) return reply.code(404).send({ error: { code: 'not_found', message: 'Contrato não encontrado' } });
    const c = rows[0];
    return contractToJson(c, {
      entities: await contractEntities(id),
      documents: await contractDocuments(id),
      ...(raw ? { raw_detail: c.raw_detail_json, raw_list: c.raw_list_json } : {}),
    });
  });

  // ---- Documents ----
  app.get('/api/documents/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const { rows } = await pool.query(
      `SELECT id, contract_id, basegov_id, file_name, content_type, size_bytes, download_ok, download_error, downloaded_at
       FROM documents WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: { code: 'not_found', message: 'Documento não encontrado' } });
    const d = rows[0];
    return { ...d, basegov_id: Number(d.basegov_id), size_bytes: d.size_bytes ? Number(d.size_bytes) : null, download_url: `/api/documents/${d.id}/content` };
  });

  app.get('/api/documents/:id/content', { preHandler: requireAuth }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const { rows } = await pool.query('SELECT file_name, content_type, content FROM documents WHERE id = $1', [id]);
    if (rows.length === 0 || !rows[0].content) {
      return reply.code(404).send({ error: { code: 'not_found', message: 'Documento sem conteúdo disponível' } });
    }
    const d = rows[0];
    const safeName = String(d.file_name).replace(/["\r\n]/g, '');
    reply
      .header('Content-Type', d.content_type || 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${safeName}"`);
    return reply.send(d.content);
  });
}
