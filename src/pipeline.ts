import { createHash } from 'node:crypto';
import { FastifyInstance, FastifyReply } from 'fastify';
import { pool } from './db.js';
import { requireAuth, auth } from './auth.js';
import { foldPt } from './fit-rules.js';

export type PipelineStatus = 'interessa' | 'preparacao' | 'submetida' | 'ganha' | 'perdida' | 'descartada';
export type ItemType = 'anuncio_aberto' | 'renovacao';

const STATUSES: readonly PipelineStatus[] = ['interessa', 'preparacao', 'submetida', 'ganha', 'perdida', 'descartada'];

const ALLOWED: Record<PipelineStatus | 'nova', readonly PipelineStatus[]> = {
  nova: ['interessa', 'preparacao', 'submetida', 'descartada'],
  interessa: ['preparacao', 'submetida', 'descartada'],
  preparacao: ['interessa', 'submetida', 'descartada'],
  submetida: ['ganha', 'perdida', 'descartada'],
  descartada: ['interessa'],
  ganha: [],
  perdida: [],
};

export function assertTransition(from: PipelineStatus | null, to: PipelineStatus): void {
  const key: PipelineStatus | 'nova' = from ?? 'nova';
  const allowed = ALLOWED[key];
  if (allowed.includes(to)) return;
  if ((key === 'ganha' || key === 'perdida') && (to === 'interessa' || to === 'preparacao')) {
    throw Object.assign(new Error('Uma proposta ganha ou perdida só pode ser reaberta por um administrador da empresa'), { statusCode: 409 });
  }
  if (key === 'submetida') {
    throw Object.assign(
      new Error('Uma proposta submetida só pode passar a Ganha, Perdida ou Descartada'),
      { statusCode: 409 }
    );
  }
  throw Object.assign(new Error('Transição de estado não permitida'), { statusCode: 409 });
}

function parseType(raw: string): ItemType | null {
  if (raw === 'anuncio_aberto' || raw === 'renovacao') return raw;
  return null;
}

function parseStatus(raw: unknown): PipelineStatus | null {
  const s = String(raw ?? '');
  return (STATUSES as readonly string[]).includes(s) ? (s as PipelineStatus) : null;
}

export function itemTextHash(text: string): string {
  return createHash('sha1').update(foldPt(text)).digest('hex');
}

async function isCompanyOwnerOrAdmin(companyId: number, userId: number | null, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;
  if (userId == null) return false;
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE company_id = $1 ORDER BY id ASC LIMIT 1`,
    [companyId]
  );
  return rows[0]?.id === userId;
}

export async function itemInCompanyScope(companyId: number, type: ItemType, id: number): Promise<boolean> {
  if (type === 'anuncio_aberto') {
    const { rows } = await pool.query(
      `SELECT 1
         FROM announcements a
         JOIN search_announcements sa ON sa.announcement_id = a.id
         JOIN searches s ON s.id = sa.search_id
         JOIN profile_runs pr ON pr.id = s.profile_run_id
         JOIN profiles p ON p.id = pr.profile_id
        WHERE a.id = $1 AND p.company_id = $2
        LIMIT 1`,
      [id, companyId]
    );
    return rows.length > 0;
  }
  const { rows } = await pool.query(
    `SELECT 1
       FROM contracts c
       JOIN search_results sr ON sr.contract_id = c.id
       JOIN searches s ON s.id = sr.search_id
       JOIN profile_runs pr ON pr.id = s.profile_run_id
       JOIN profiles p ON p.id = pr.profile_id
      WHERE c.id = $1 AND p.company_id = $2
      LIMIT 1`,
    [id, companyId]
  );
  return rows.length > 0;
}

export async function statusesForCompany(
  companyId: number
): Promise<Map<string, PipelineStatus>> {
  const { rows } = await pool.query(
    `SELECT item_type, item_id, status FROM opportunity_status WHERE company_id = $1`,
    [companyId]
  );
  const m = new Map<string, PipelineStatus>();
  for (const r of rows) m.set(`${r.item_type}:${r.item_id}`, r.status);
  return m;
}

async function currentStatus(companyId: number, type: ItemType, id: number): Promise<{
  id: number; status: PipelineStatus; note: string | null; assigned_user_id: number | null;
} | null> {
  const { rows } = await pool.query(
    `SELECT id, status, note, assigned_user_id FROM opportunity_status
      WHERE company_id = $1 AND item_type = $2 AND item_id = $3`,
    [companyId, type, id]
  );
  return rows[0] ?? null;
}

export async function registerPipelineRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/pipeline', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId, userId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa.' } });
    const q = req.query as Record<string, unknown>;
    const statusFilter = parseStatus(q.status);
    const assignedMe = q.assigned === 'me';
    const params: unknown[] = [companyId];
    const where: string[] = ['os.company_id = $1'];
    if (statusFilter) {
      params.push(statusFilter);
      where.push(`os.status = $${params.length}`);
    }
    if (assignedMe && userId != null) {
      params.push(userId);
      where.push(`os.assigned_user_id = $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT os.*, u.first_name, u.last_name, u.email, u.username
         FROM opportunity_status os
         LEFT JOIN users u ON u.id = os.assigned_user_id
        WHERE ${where.join(' AND ')}
        ORDER BY os.updated_at DESC`,
      params
    );

    const anIds = rows.filter((r) => r.item_type === 'anuncio_aberto').map((r) => r.item_id);
    const cIds = rows.filter((r) => r.item_type === 'renovacao').map((r) => r.item_id);
    const anns = anIds.length
      ? (await pool.query(
          `SELECT id, contract_designation AS title, contracting_entity AS entity, base_price AS value,
                  proposal_deadline_date AS deadline
             FROM announcements WHERE id = ANY($1)`,
          [anIds]
        )).rows
      : [];
    const cons = cIds.length
      ? (await pool.query(
          `SELECT c.id,
                  c.object_brief_description AS title,
                  (SELECT string_agg(e.name, '; ') FROM contract_entities ce JOIN entities e ON e.id = ce.entity_id
                    WHERE ce.contract_id = c.id AND ce.role = 'contracting') AS entity,
                  c.initial_contractual_price AS value,
                  (c.signing_date + (substring(c.execution_deadline from '(\\d+)')::int)) AS deadline
             FROM contracts c WHERE c.id = ANY($1)`,
          [cIds]
        )).rows
      : [];
    const byAnn = new Map(anns.map((a) => [a.id, a]));
    const byCon = new Map(cons.map((c) => [c.id, c]));

    const keys = rows.map((r) => [r.item_type, r.item_id] as const);
    const progress = await checklistProgress(companyId, keys);

    const items = rows.map((r) => {
      const meta = r.item_type === 'anuncio_aberto' ? byAnn.get(r.item_id) : byCon.get(r.item_id);
      const prog = progress.get(`${r.item_type}:${r.item_id}`) ?? { checked: 0, total: 0 };
      const assignee = r.assigned_user_id
        ? {
            id: r.assigned_user_id,
            name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || r.username,
          }
        : null;
      return {
        item_type: r.item_type,
        item_id: r.item_id,
        status: r.status,
        note: r.note,
        assigned_user_id: r.assigned_user_id,
        assignee,
        updated_at: r.updated_at,
        submitted_at: r.submitted_at,
        decided_at: r.decided_at,
        title: meta?.title ?? null,
        entity: meta?.entity ?? null,
        value: meta?.value != null ? Number(meta.value) : null,
        deadline: meta?.deadline ?? null,
        checklist: prog,
        internal_url: r.item_type === 'anuncio_aberto' ? `#/announcements/${r.item_id}` : `#/contracts/${r.item_id}`,
      };
    });

    items.sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    });

    return { items };
  });

  app.put('/api/pipeline/:type/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId, userId, isAdmin } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa.' } });
    const type = parseType((req.params as { type: string }).type);
    const id = Number((req.params as { id: string }).id);
    if (!type || !Number.isFinite(id)) {
      return reply.code(400).send({ error: { code: 'invalid', message: 'Tipo ou id inválido.' } });
    }
    if (!(await itemInCompanyScope(companyId, type, id))) {
      return reply.code(404).send({ error: { code: 'not_found', message: 'Oportunidade não encontrada' } });
    }
    const body = (req.body ?? {}) as { status?: string; note?: string; assigned_user_id?: number | null };
    const cur = await currentStatus(companyId, type, id);
    const nextStatus = body.status != null ? parseStatus(body.status) : cur?.status ?? null;
    if (body.status != null && !nextStatus) {
      return reply.code(400).send({ error: { code: 'invalid_status', message: 'Estado inválido.' } });
    }

    if (nextStatus && nextStatus !== cur?.status) {
      const from = cur?.status ?? null;
      const reopen = (from === 'ganha' || from === 'perdida') && nextStatus !== from;
      if (reopen) {
        if (!(await isCompanyOwnerOrAdmin(companyId, userId, isAdmin))) {
          return reply.code(409).send({
            error: { code: 'transition', message: 'Uma proposta ganha ou perdida só pode ser reaberta por um administrador da empresa' },
          });
        }
      } else {
        try {
          assertTransition(from, nextStatus);
        } catch (err) {
          const e = err as Error & { statusCode?: number };
          return reply.code(e.statusCode ?? 409).send({ error: { code: 'transition', message: e.message } });
        }
      }
    }

    if (body.note != null && String(body.note).length > 2000) {
      return reply.code(400).send({ error: { code: 'note_too_long', message: 'A nota não pode ter mais de 2 000 caracteres.' } });
    }

    if (body.assigned_user_id != null) {
      const { rows: mem } = await pool.query(
        'SELECT 1 FROM users WHERE id = $1 AND company_id = $2',
        [body.assigned_user_id, companyId]
      );
      if (!mem.length) return reply.code(400).send({ error: { code: 'invalid_assignee', message: 'O responsável tem de ser da mesma empresa.' } });
    }

    const status = nextStatus ?? cur?.status;
    if (!status) {
      return reply.code(400).send({ error: { code: 'invalid', message: 'Indique um estado.' } });
    }

    const note = body.note !== undefined ? (String(body.note).trim() || null) : cur?.note ?? null;
    const assigned = body.assigned_user_id !== undefined ? body.assigned_user_id : cur?.assigned_user_id ?? null;
    const statusChanged = !cur || cur.status !== status;
    const submittedAt = status === 'submetida' && statusChanged ? new Date() : null;
    const decidedAt = (status === 'ganha' || status === 'perdida') && statusChanged ? new Date() : null;

    const { rows } = await pool.query(
      `INSERT INTO opportunity_status (company_id, item_type, item_id, status, note, assigned_user_id, updated_by, submitted_at, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (company_id, item_type, item_id) DO UPDATE SET
         status = EXCLUDED.status,
         note = COALESCE(EXCLUDED.note, opportunity_status.note),
         assigned_user_id = EXCLUDED.assigned_user_id,
         updated_by = EXCLUDED.updated_by,
         updated_at = now(),
         submitted_at = COALESCE(EXCLUDED.submitted_at, opportunity_status.submitted_at),
         decided_at = COALESCE(EXCLUDED.decided_at, opportunity_status.decided_at)
       RETURNING *`,
      [companyId, type, id, status, note, assigned, userId, submittedAt, decidedAt]
    );
    const row = rows[0];
    if (statusChanged) {
      await pool.query(
        `INSERT INTO opportunity_status_history (status_id, from_status, to_status, changed_by)
         VALUES ($1,$2,$3,$4)`,
        [row.id, cur?.status ?? null, status, userId]
      );
    }
    return { ok: true, item: row, unchanged: !statusChanged && body.status != null };
  });

  app.get('/api/pipeline/:type/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa.' } });
    const type = parseType((req.params as { type: string }).type);
    const id = Number((req.params as { id: string }).id);
    if (!type || !Number.isFinite(id)) {
      return reply.code(400).send({ error: { code: 'invalid', message: 'Tipo ou id inválido.' } });
    }
    const cur = await currentStatus(companyId, type, id);
    const checklist = await checklistForItem(companyId, type, id);
    return {
      status: cur?.status ?? null,
      note: cur?.note ?? null,
      assigned_user_id: cur?.assigned_user_id ?? null,
      checklist,
    };
  });

  app.get('/api/pipeline/:type/:id/history', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa.' } });
    const type = parseType((req.params as { type: string }).type);
    const id = Number((req.params as { id: string }).id);
    if (!type) return reply.code(400).send({ error: { code: 'invalid', message: 'Tipo inválido.' } });
    const { rows } = await pool.query(
      `SELECT h.from_status, h.to_status, h.changed_at, h.changed_by,
              u.first_name, u.last_name, u.email, u.username
         FROM opportunity_status os
         JOIN opportunity_status_history h ON h.status_id = os.id
         LEFT JOIN users u ON u.id = h.changed_by
        WHERE os.company_id = $1 AND os.item_type = $2 AND os.item_id = $3
        ORDER BY h.changed_at ASC`,
      [companyId, type, id]
    );
    return {
      items: rows.map((r) => ({
        from_status: r.from_status,
        to_status: r.to_status,
        changed_at: r.changed_at,
        changed_by: r.changed_by,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || r.username,
      })),
    };
  });

  app.put('/api/pipeline/:type/:id/checklist', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId, userId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa.' } });
    const type = parseType((req.params as { type: string }).type);
    const id = Number((req.params as { id: string }).id);
    const body = (req.body ?? {}) as { item_text?: string; checked?: boolean };
    if (!type || !body.item_text) {
      return reply.code(400).send({ error: { code: 'invalid', message: 'item_text é obrigatório.' } });
    }
    const hash = itemTextHash(body.item_text);
    const checked = body.checked !== false;
    if (checked) {
      await pool.query(
        `INSERT INTO opportunity_checklist (company_id, item_type, item_id, item_text_hash, checked, checked_by, checked_at)
         VALUES ($1,$2,$3,$4,true,$5,now())
         ON CONFLICT (company_id, item_type, item_id, item_text_hash) DO UPDATE SET
           checked = true, checked_by = EXCLUDED.checked_by, checked_at = now()`,
        [companyId, type, id, hash, userId]
      );
    } else {
      await pool.query(
        `DELETE FROM opportunity_checklist
          WHERE company_id = $1 AND item_type = $2 AND item_id = $3 AND item_text_hash = $4`,
        [companyId, type, id, hash]
      );
    }
    return { ok: true, item_text_hash: hash, checked };
  });

  app.get('/api/pipeline/:type/:id/checklist', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa.' } });
    const type = parseType((req.params as { type: string }).type);
    const id = Number((req.params as { id: string }).id);
    if (!type) return reply.code(400).send({ error: { code: 'invalid', message: 'Tipo inválido.' } });
    const items = await checklistForItem(companyId, type, id);
    return { items };
  });
}

async function analysisChecklist(type: ItemType, id: number): Promise<string[]> {
  if (type === 'anuncio_aberto') {
    const { rows } = await pool.query(
      `SELECT analysis FROM ai_analyses WHERE announcement_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [id]
    );
    const c = rows[0]?.analysis?.checklist;
    return Array.isArray(c) ? c.map(String) : [];
  }
  const { rows } = await pool.query(
    `SELECT analysis FROM ai_contract_analyses WHERE contract_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [id]
  );
  const c = rows[0]?.analysis?.checklist;
  return Array.isArray(c) ? c.map(String) : [];
}

export async function checklistForItem(companyId: number, type: ItemType, id: number): Promise<{
  text: string; hash: string; checked: boolean;
}[]> {
  const texts = await analysisChecklist(type, id);
  if (texts.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT item_text_hash FROM opportunity_checklist
      WHERE company_id = $1 AND item_type = $2 AND item_id = $3 AND checked`,
    [companyId, type, id]
  );
  const checked = new Set(rows.map((r) => r.item_text_hash as string));
  return texts.map((text) => {
    const hash = itemTextHash(text);
    return { text, hash, checked: checked.has(hash) };
  });
}

async function checklistProgress(
  companyId: number,
  keys: readonly (readonly [string, number])[]
): Promise<Map<string, { checked: number; total: number }>> {
  const out = new Map<string, { checked: number; total: number }>();
  for (const [type, id] of keys) {
    const items = await checklistForItem(companyId, type as ItemType, id);
    out.set(`${type}:${id}`, {
      checked: items.filter((i) => i.checked).length,
      total: items.length,
    });
  }
  return out;
}

export function sendPipelineError(reply: FastifyReply, err: unknown): void {
  const e = err as Error & { statusCode?: number };
  reply.code(e.statusCode ?? 500).send({ error: { code: 'pipeline', message: e.message } });
}
