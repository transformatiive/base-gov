import { pool } from './db.js';
import { config } from './config.js';
import { aiCap, Plan } from './plans.js';

/**
 * Contagem e registo de utilização de IA por empresa (R4/R5 da spec de planos).
 *
 * Regras invioláveis:
 *  - Regista UMA linha por análise BEM-SUCEDIDA (falhas não contam, resultados
 *    em cache não contam — não houve chamada nova ao modelo).
 *  - CONTA e REGISTA, mas NÃO bloqueia. O teto é "soft": só avisa, e apenas
 *    quando a flag AI_SOFT_CAP_ENABLED estiver ligada (desligada por defeito).
 */

export type AiKind = 'fit' | 'analise_anuncio' | 'analise_contrato' | 'dossier';

// Estimativa de custo (USD por 1M tokens) por modelo. Aproximada — serve para
// dar visibilidade de custo, não para faturar. Ajustável sem migração.
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  'anthropic/claude-sonnet-5': { in: 3, out: 15 },
  'anthropic/claude-haiku-4.5': { in: 0.8, out: 4 },
};

function costEstimate(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICE_PER_M[model] ?? { in: 3, out: 15 };
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
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

/** Nº de análises de IA da empresa no mês corrente (janela de calendário). */
export async function usageThisMonth(companyId: number | null): Promise<number> {
  if (companyId == null) return 0;
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM ai_usage_events
     WHERE company_id = $1 AND created_at >= date_trunc('month', now())`,
    [companyId]
  );
  return rows[0]?.n ?? 0;
}

/** Resumo de uso de IA para as capabilities (used/cap/enabled). */
export async function aiUsageSummary(companyId: number | null, plan: Plan): Promise<{ used: number; cap: number; enabled: boolean }> {
  const used = await usageThisMonth(companyId);
  return { used, cap: aiCap(plan), enabled: config.plans.aiSoftCapEnabled };
}

/** Está acima do teto? (só relevante quando o soft cap está ligado). */
export function overSoftCap(used: number, plan: Plan): boolean {
  return config.plans.aiSoftCapEnabled && used >= aiCap(plan);
}
