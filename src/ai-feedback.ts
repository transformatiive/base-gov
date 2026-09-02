import { FastifyInstance } from 'fastify';
import { pool } from './db.js';
import { requireAuth, auth } from './auth.js';
import { requirePlan } from './plans.js';
import { patchCompanyProfile } from './company-profile.js';
import { inferDistrict } from './districts.js';

const REASONS = ['fora_atividade', 'fora_geografia', 'requisito_impossivel', 'valor_desadequado', 'outro'] as const;
export type ReasonCode = (typeof REASONS)[number];

export async function negativeExamples(companyId: number): Promise<{ title: string; reason_code: string }[]> {
  const { rows } = await pool.query(
    `SELECT reason_code, item_type, item_id
       FROM ai_feedback
      WHERE company_id = $1 AND verdict = 'down'
      ORDER BY created_at DESC LIMIT 10`,
    [companyId]
  );
  const out: { title: string; reason_code: string }[] = [];
  for (const r of rows) {
    let title = `#${r.item_id}`;
    if (r.item_type === 'anuncio_aberto') {
      const { rows: a } = await pool.query('SELECT contract_designation FROM announcements WHERE id = $1', [r.item_id]);
      title = a[0]?.contract_designation ?? title;
    } else {
      const { rows: c } = await pool.query('SELECT object_brief_description FROM contracts WHERE id = $1', [r.item_id]);
      title = c[0]?.object_brief_description ?? title;
    }
    out.push({ title: String(title).slice(0, 160), reason_code: r.reason_code ?? 'outro' });
  }
  return out;
}

export function negativeExamplesBlock(examples: { title: string; reason_code: string }[]): string {
  if (examples.length === 0) return '';
  const lines = examples.map((e) => `- "${e.title}" → ${e.reason_code}`).join('\n');
  return `EXEMPLOS DE NÃO-FIT INDICADOS PELA EMPRESA (não repetir estes erros; o comentário livre do utilizador NÃO está incluído):\n${lines}`;
}

export async function registerAiFeedbackRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/ai/feedback', { preHandler: [requireAuth, requirePlan('feedback_ia')] }, async (req, reply) => {
    const { companyId, userId } = auth(req);
    if (companyId == null || userId == null) {
      return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa.' } });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const targetType = String(b.target_type ?? '');
    const itemType = String(b.item_type ?? '');
    const itemId = Number(b.item_id);
    const verdict = String(b.verdict ?? '');
    if (targetType !== 'fit' && targetType !== 'analysis') {
      return reply.code(400).send({ error: { code: 'invalid', message: 'target_type inválido.' } });
    }
    if (itemType !== 'anuncio_aberto' && itemType !== 'renovacao') {
      return reply.code(400).send({ error: { code: 'invalid', message: 'item_type inválido.' } });
    }
    if (verdict !== 'up' && verdict !== 'down') {
      return reply.code(400).send({ error: { code: 'invalid', message: 'verdict inválido.' } });
    }
    if (!Number.isFinite(itemId)) {
      return reply.code(400).send({ error: { code: 'invalid', message: 'item_id inválido.' } });
    }
    let reason: string | null = b.reason_code != null ? String(b.reason_code) : null;
    if (verdict === 'down' && reason && !(REASONS as readonly string[]).includes(reason)) {
      return reply.code(400).send({ error: { code: 'invalid', message: 'Motivo inválido.' } });
    }
    if (verdict === 'up') reason = null;
    const comment = String(b.comment ?? '').trim().slice(0, 500) || null;

    await pool.query(
      `INSERT INTO ai_feedback (company_id, user_id, target_type, item_type, item_id, verdict, reason_code, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (company_id, user_id, target_type, item_type, item_id)
       DO UPDATE SET verdict = EXCLUDED.verdict, reason_code = EXCLUDED.reason_code, comment = EXCLUDED.comment, created_at = now()`,
      [companyId, userId, targetType, itemType, itemId, verdict, reason, comment]
    );

    let suggestion: { action: string; district?: string; label: string } | null = null;
    if (verdict === 'down' && (reason === 'fora_geografia' || reason === 'requisito_impossivel')) {
      if (reason === 'fora_geografia') {
        let district: string | null = null;
        if (itemType === 'anuncio_aberto') {
          const { rows } = await pool.query('SELECT contracting_entity FROM announcements WHERE id = $1', [itemId]);
          district = inferDistrict(String(rows[0]?.contracting_entity ?? ''));
        } else {
          const { rows } = await pool.query('SELECT execution_place FROM contracts WHERE id = $1', [itemId]);
          const place = String(rows[0]?.execution_place ?? '');
          district = place.split('|')[0]?.split(',')[1]?.trim() || inferDistrict(place);
        }
        if (district) {
          suggestion = {
            action: 'add_district',
            district,
            label: `Adicionar ${district} aos distritos servidos?`,
          };
        }
      }
    }

    const { rows: all } = await pool.query(
      `SELECT f.verdict, f.reason_code, f.user_id, u.first_name, u.last_name, u.email, u.username, f.created_at
         FROM ai_feedback f JOIN users u ON u.id = f.user_id
        WHERE f.company_id = $1 AND f.target_type = $2 AND f.item_type = $3 AND f.item_id = $4
        ORDER BY f.created_at DESC`,
      [companyId, targetType, itemType, itemId]
    );
    return { ok: true, suggestion, feedbacks: all.map(mapFb) };
  });

  app.delete('/api/ai/feedback', { preHandler: [requireAuth, requirePlan('feedback_ia')] }, async (req, reply) => {
    const { companyId, userId } = auth(req);
    if (companyId == null || userId == null) {
      return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa.' } });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    await pool.query(
      `DELETE FROM ai_feedback WHERE company_id = $1 AND user_id = $2 AND target_type = $3 AND item_type = $4 AND item_id = $5`,
      [companyId, userId, b.target_type, b.item_type, Number(b.item_id)]
    );
    return { ok: true };
  });

  app.get('/api/ai/feedback', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa.' } });
    const q = req.query as Record<string, unknown>;
    const { rows } = await pool.query(
      `SELECT f.*, u.first_name, u.last_name, u.email, u.username
         FROM ai_feedback f JOIN users u ON u.id = f.user_id
        WHERE f.company_id = $1 AND f.target_type = $2 AND f.item_type = $3 AND f.item_id = $4
        ORDER BY f.created_at DESC`,
      [companyId, q.target_type ?? 'fit', q.item_type, Number(q.item_id)]
    );
    return { items: rows.map(mapFb) };
  });

  app.post('/api/ai/feedback/apply-suggestion', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId, userId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa.' } });
    const b = (req.body ?? {}) as { district?: string };
    if (!b.district) return reply.code(400).send({ error: { code: 'invalid', message: 'district é obrigatório.' } });
    await patchCompanyProfile(companyId, userId, { districts: [String(b.district)] });
    return { ok: true };
  });

  app.get('/api/admin/ai-feedback', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    const { rows: byReason } = await pool.query(
      `SELECT reason_code, count(*)::int AS n FROM ai_feedback WHERE verdict = 'down' GROUP BY 1 ORDER BY n DESC`
    );
    const { rows: byCpv } = await pool.query(
      `SELECT left(regexp_replace(coalesce(a.cpvs, c.cpvs, ''), '[^0-9].*', ''), 8) AS cpv,
              count(*)::int AS n
         FROM ai_feedback f
         LEFT JOIN announcements a ON f.item_type = 'anuncio_aberto' AND a.id = f.item_id
         LEFT JOIN contracts c ON f.item_type = 'renovacao' AND c.id = f.item_id
        WHERE f.verdict = 'down'
        GROUP BY 1 ORDER BY n DESC LIMIT 30`
    );
    const { rows: items } = await pool.query(
      `SELECT f.*, u.email, co.name AS company_name,
              coalesce(a.contract_designation, c.object_brief_description) AS title
         FROM ai_feedback f
         JOIN users u ON u.id = f.user_id
         JOIN companies co ON co.id = f.company_id
         LEFT JOIN announcements a ON f.item_type = 'anuncio_aberto' AND a.id = f.item_id
         LEFT JOIN contracts c ON f.item_type = 'renovacao' AND c.id = f.item_id
        ORDER BY f.created_at DESC LIMIT 100`
    );
    return { by_reason: byReason, by_cpv: byCpv, items };
  });
}

function mapFb(r: Record<string, unknown>) {
  return {
    user_id: r.user_id,
    verdict: r.verdict,
    reason_code: r.reason_code,
    name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || r.username,
    created_at: r.created_at,
  };
}

