import type { FastifyReply, FastifyRequest } from 'fastify';
import { pool } from './db.js';
import { config } from './config.js';
import { auth } from './auth.js';
import { aiCap, Plan } from './plans.js';
import { quotaLevel, quotaPeriod, resetLabel, type AiQuotaLevel } from './aiQuota.js';

/**
 * Contagem e teto de utilização de IA por utilizador.
 *
 * Regras:
 *  - Uma linha por análise bem-sucedida (falhas e cache não contam).
 *  - Teto por utilizador (40 Pro / 250 Business), ciclo de 30 dias a partir
 *    da data de inscrição, reset às 00:00 de Lisboa.
 *  - Novas chamadas ao modelo são bloqueadas quando used >= cap.
 *  - Resultados já em cache continuam a ser servidos.
 */

export type AiKind = 'fit' | 'analise_anuncio' | 'analise_contrato' | 'dossier' | 'requisitos' | 'proposta' | 'reeavaliacao' | 'previsao_fecho';

export interface AiUsageSummary {
  used: number;
  cap: number;
  remaining: number;
  ratio: number;
  level: AiQuotaLevel;
  enabled: boolean;
  period_start: string | null;
  period_end: string | null;
  reset_at: string | null;
  reset_label: string | null;
}

// Estimativa de custo (USD por 1M tokens) por modelo. Aproximada — serve para
// dar visibilidade de custo, não para faturar. Ajustável sem migração.
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  'anthropic/claude-sonnet-5': { in: 3, out: 15 },
  'anthropic/claude-haiku-4.5': { in: 1, out: 5 },
};

function costEstimate(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICE_PER_M[model] ?? { in: 3, out: 15 };
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
}

function emptySummary(plan: Plan, enabled: boolean): AiUsageSummary {
  const cap = aiCap(plan);
  return {
    used: 0,
    cap,
    remaining: cap,
    ratio: 0,
    level: 'ok',
    enabled: enabled && cap > 0,
    period_start: null,
    period_end: null,
    reset_at: null,
    reset_label: null,
  };
}

/** Regista um evento de utilização de IA. Nunca lança — falhar o registo não
 *  deve quebrar a análise que já foi entregue ao utilizador. */
export async function recordUsage(opts: {
  companyId: number | null;
  userId: number | null;
  kind: AiKind;
  tokensIn: number;
  tokensOut: number;
  model: string;
}): Promise<void> {
  try {
    if (opts.companyId == null) return;   // acesso global (api-key) não conta
    await pool.query(
      `INSERT INTO ai_usage_events (company_id, user_id, kind, tokens_in, tokens_out, cost_estimate, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        opts.companyId, opts.userId, opts.kind,
        Math.max(0, opts.tokensIn | 0), Math.max(0, opts.tokensOut | 0),
        costEstimate(opts.model, opts.tokensIn, opts.tokensOut).toFixed(6),
        opts.model,
      ]
    );
  } catch (err) {
    console.warn('[aiUsage] falha a registar evento:', String(err).slice(0, 160));
  }
}

export async function persistUserQuotaPeriod(
  userId: number,
  enrolledAt: Date,
  now = new Date(),
): Promise<{ start: Date; end: Date }> {
  const period = quotaPeriod(enrolledAt, now);
  await pool.query(
    `UPDATE users SET ai_period_start = $2, ai_period_end = $3
      WHERE id = $1 AND (ai_period_start IS DISTINCT FROM $2 OR ai_period_end IS DISTINCT FROM $3)`,
    [userId, period.start, period.end],
  );
  return period;
}

/** Avança (ou inicializa) o ciclo de 30 dias de todos os utilizadores em atraso. */
export async function rollAiQuotaPeriods(now = new Date()): Promise<{ scanned: number; advanced: number }> {
  const { rows } = await pool.query(
    `SELECT id, created_at, ai_period_start, ai_period_end
       FROM users
      WHERE ai_period_end IS NULL OR ai_period_end <= $1`,
    [now],
  );
  let advanced = 0;
  for (const row of rows) {
    const before = row.ai_period_end ? new Date(row.ai_period_end as string).getTime() : null;
    const period = await persistUserQuotaPeriod(Number(row.id), new Date(row.created_at as string), now);
    if (before == null || period.end.getTime() !== before) advanced++;
  }
  if (advanced > 0) {
    console.log(`[ai-quota] reset de ${advanced} utilizador(es) (${rows.length} em revisão)`);
  }
  return { scanned: rows.length, advanced };
}

export async function usageInPeriod(userId: number | null, periodStart: Date, periodEnd: Date): Promise<number> {
  if (userId == null) return 0;
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM ai_usage_events
      WHERE user_id = $1 AND created_at >= $2 AND created_at < $3`,
    [userId, periodStart, periodEnd],
  );
  return rows[0]?.n ?? 0;
}

/** Nº de análises do utilizador no ciclo corrente. */
export async function usageThisPeriod(userId: number | null, now = new Date()): Promise<number> {
  if (userId == null) return 0;
  const { rows } = await pool.query('SELECT created_at FROM users WHERE id = $1', [userId]);
  if (rows.length === 0) return 0;
  const period = quotaPeriod(new Date(rows[0].created_at as string), now);
  return usageInPeriod(userId, period.start, period.end);
}

export async function aiUsageSummary(
  userId: number | null,
  plan: Plan,
  now = new Date(),
): Promise<AiUsageSummary> {
  const enabled = config.plans.aiCapEnabled;
  if (userId == null) return emptySummary(plan, enabled);
  const { rows } = await pool.query(
    'SELECT created_at, ai_period_start, ai_period_end FROM users WHERE id = $1',
    [userId],
  );
  if (rows.length === 0) return emptySummary(plan, enabled);
  const enrolledAt = new Date(rows[0].created_at as string);
  const period = quotaPeriod(enrolledAt, now);
  const storedStart = rows[0].ai_period_start ? new Date(rows[0].ai_period_start as string).getTime() : null;
  const storedEnd = rows[0].ai_period_end ? new Date(rows[0].ai_period_end as string).getTime() : null;
  if (storedStart !== period.start.getTime() || storedEnd !== period.end.getTime()) {
    await persistUserQuotaPeriod(userId, enrolledAt, now);
  }
  const cap = aiCap(plan);
  const used = await usageInPeriod(userId, period.start, period.end);
  const remaining = Math.max(0, cap - used);
  return {
    used,
    cap,
    remaining,
    ratio: cap > 0 ? used / cap : 0,
    level: quotaLevel(used, cap),
    enabled: enabled && cap > 0,
    period_start: period.start.toISOString(),
    period_end: period.end.toISOString(),
    reset_at: period.end.toISOString(),
    reset_label: resetLabel(period.end),
  };
}

export function overAiCap(summary: Pick<AiUsageSummary, 'enabled' | 'used' | 'cap'>): boolean {
  return summary.enabled && summary.cap > 0 && summary.used >= summary.cap;
}

export async function isAiCapped(userId: number | null, plan: Plan): Promise<boolean> {
  if (userId == null) return false;
  const summary = await aiUsageSummary(userId, plan);
  return overAiCap(summary);
}

/**
 * Bloqueia novas chamadas de IA quando o teto do utilizador está esgotado.
 * Devolve true se a resposta 429 já foi enviada.
 * Admin e acesso global (api-key) não são limitados.
 */
export async function rejectIfAiCapped(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const a = auth(req);
  if (a.isAdmin || a.companyId == null || a.userId == null) return false;
  const summary = await aiUsageSummary(a.userId, a.plan);
  if (!overAiCap(summary)) return false;
  reply.code(429).send({
    error: {
      code: 'ai_cap_reached',
      message: `Atingiu o teto de ${summary.cap} análises deste ciclo. Reinicia a ${summary.reset_label}.`,
      ...summary,
    },
  });
  return true;
}
