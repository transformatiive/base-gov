import { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';
import { auth } from './auth.js';

export type Plan = 'free' | 'pro' | 'business';
const RANK: Record<Plan, number> = { free: 0, pro: 1, business: 2 };

/** Normaliza o valor guardado em companies.plan para um plano válido.
 *  Legado: o antigo plano único "baseradar" corresponde ao Pro. */
export function normalizePlan(raw: unknown): Plan {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'pro' || s === 'business' || s === 'free') return s;
  if (s === 'baseradar') return 'pro';
  return 'free';
}

/**
 * Plano EFETIVO da empresa, considerando o estado da subscrição e o trial:
 * - subscrição ativa → o plano comprado;
 * - trial a decorrer → o plano em trial;
 * - caso contrário (sem plano, trial expirado, cancelado, past_due) → free.
 * Empresa sem plano definido resolve sempre como free (nunca pago por omissão).
 */
export function effectivePlan(company: { plan?: unknown; subscription_status?: unknown; trial_ends_at?: unknown } | null | undefined): Plan {
  if (!company) return 'free';
  const plan = normalizePlan(company.plan);
  if (plan === 'free') return 'free';
  const status = String(company.subscription_status ?? '').toLowerCase();
  const trialOk = !company.trial_ends_at || new Date(company.trial_ends_at as string) > new Date();
  if (status === 'active') return plan;
  if (status === 'trialing' && trialOk) return plan;
  return 'free';
}

/** Plano mínimo exigido por uma feature (default free se não mapeada). */
export function minPlanFor(feature: string): Plan {
  return (config.plans.features[feature] as Plan) ?? 'free';
}

export function hasCapability(plan: Plan, feature: string): boolean {
  return RANK[plan] >= RANK[minPlanFor(feature)];
}

/** Lista de features acessíveis a um plano (para o frontend espelhar). */
export function capabilitiesFor(plan: Plan): string[] {
  return Object.keys(config.plans.features).filter((f) => hasCapability(plan, f));
}

export const seatLimit = (plan: Plan): number => config.plans.seats[plan] ?? 1;
export const aiCap = (plan: Plan): number => config.plans.aiCap[plan] ?? 0;

/**
 * Middleware Fastify: exige que a empresa tenha o plano mínimo para `feature`.
 * O backend é a fonte de verdade — 403 fora do plano, independentemente da UI.
 * Admin e acesso global (api-key, companyId null) não são gated.
 */
export function requirePlan(feature: string) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const a = auth(req);
    if (a.isAdmin || a.companyId == null) return; // admin / integrações
    if (!hasCapability(a.plan, feature)) {
      reply.code(403).send({
        error: {
          code: 'plan_required',
          message: `Esta funcionalidade requer o plano ${minPlanFor(feature).toUpperCase()}.`,
          feature,
          required_plan: minPlanFor(feature),
          current_plan: a.plan,
        },
      });
    }
  };
}
