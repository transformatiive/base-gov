import { normalizePlan } from './plans.js';
import type { SqlQuery } from './stripe.js';

/** Empresa interna de seed — não se apaga pelo self-service. */
export const INTERNAL_COMPANY_NAME = 'Conta principal';

export type LifecycleErr = {
  ok: false;
  http: number;
  code: string;
  message: string;
};

export type LifecycleOk<T extends Record<string, unknown>> = { ok: true } & T;

export type CancelSubscription = (subscriptionId: string) => Promise<void>;

export interface LifecycleDeps {
  query: SqlQuery;
  cancelSubscription: CancelSubscription;
  billingReady: boolean;
}

/** Corpo JSON tem de trazer `confirm: true` — o diálogo da UI não chega. */
export function confirmRequested(body: unknown): boolean {
  return Boolean(body && typeof body === 'object' && (body as { confirm?: unknown }).confirm === true);
}

async function loadCompany(
  companyId: number,
  query: SqlQuery,
): Promise<{ name: string; plan: unknown; stripe_subscription_id: unknown } | null> {
  const { rows } = await query(
    `SELECT name, plan, stripe_subscription_id FROM companies WHERE id = $1`,
    [companyId],
  );
  if (!rows[0]) return null;
  return rows[0] as { name: string; plan: unknown; stripe_subscription_id: unknown };
}

async function memberCount(companyId: number, query: SqlQuery): Promise<number> {
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM users WHERE company_id = $1`,
    [companyId],
  );
  return Number(rows[0]?.n ?? 0);
}

async function cancelIfNeeded(
  subscriptionId: unknown,
  deps: Pick<LifecycleDeps, 'cancelSubscription' | 'billingReady'>,
): Promise<LifecycleErr | null> {
  const id = subscriptionId == null ? '' : String(subscriptionId).trim();
  if (!id) return null;
  if (!deps.billingReady) {
    return {
      ok: false,
      http: 503,
      code: 'billing_disabled',
      message: 'Não foi possível cancelar a subscrição no Stripe. Contacte o suporte.',
    };
  }
  await deps.cancelSubscription(id);
  return null;
}

/**
 * Cancela a subscrição Stripe (se existir) e passa a empresa para o plano Grátis.
 * Recusa se ainda houver mais do que 1 utilizador (limite do Grátis).
 */
export async function downgradeCompanyToFree(
  companyId: number,
  deps: LifecycleDeps,
): Promise<LifecycleOk<{ plan: 'free' }> | LifecycleErr> {
  const company = await loadCompany(companyId, deps.query);
  if (!company) {
    return { ok: false, http: 404, code: 'not_found', message: 'Empresa não encontrada.' };
  }
  const members = await memberCount(companyId, deps.query);
  if (members > 1) {
    return {
      ok: false,
      http: 409,
      code: 'seat_limit',
      message: 'O plano Grátis permite 1 utilizador. Remova os outros membros da equipa antes de passar para Grátis.',
    };
  }
  const alreadyFree = normalizePlan(company.plan) === 'free' && !company.stripe_subscription_id;
  if (alreadyFree) {
    return { ok: false, http: 409, code: 'already_free', message: 'A conta já está no plano Grátis.' };
  }
  const cancelErr = await cancelIfNeeded(company.stripe_subscription_id, deps);
  if (cancelErr) return cancelErr;

  await deps.query(
    `DELETE FROM company_invites WHERE company_id = $1 AND accepted_at IS NULL`,
    [companyId],
  );
  await deps.query(
    `UPDATE companies
        SET plan = 'free',
            subscription_status = 'active',
            stripe_subscription_id = NULL,
            access_until = NULL,
            renewal_at = NULL,
            pending_plan = NULL
      WHERE id = $1`,
    [companyId],
  );
  return { ok: true, plan: 'free' };
}

/** Apaga utilizadores e a empresa. Chamado depois de cancelar a subscrição Stripe. */
export async function applyCompanyDeletion(companyId: number, query: SqlQuery): Promise<void> {
  await query('DELETE FROM reminder_log WHERE company_id = $1', [companyId]);
  await query(
    `UPDATE searches SET created_by = NULL
      WHERE created_by IN (SELECT id FROM users WHERE company_id = $1)`,
    [companyId],
  );
  await query('DELETE FROM profiles WHERE company_id = $1', [companyId]);
  await query('DELETE FROM searches WHERE company_id = $1', [companyId]);
  await query('DELETE FROM users WHERE company_id = $1', [companyId]);
  await query('DELETE FROM companies WHERE id = $1', [companyId]);
}

/**
 * Cancela a subscrição Stripe (se existir) e apaga a empresa e os seus utilizadores.
 * A conta interna de seed não pode ser apagada por aqui.
 */
export async function deleteCompanyAccount(
  companyId: number,
  deps: LifecycleDeps,
): Promise<LifecycleOk<{ deleted: true }> | LifecycleErr> {
  const company = await loadCompany(companyId, deps.query);
  if (!company) {
    return { ok: false, http: 404, code: 'not_found', message: 'Empresa não encontrada.' };
  }
  if (company.name === INTERNAL_COMPANY_NAME) {
    return {
      ok: false,
      http: 409,
      code: 'protected_account',
      message: 'Esta conta interna não pode ser apagada por aqui. Contacte o suporte.',
    };
  }
  const cancelErr = await cancelIfNeeded(company.stripe_subscription_id, deps);
  if (cancelErr) return cancelErr;
  await applyCompanyDeletion(companyId, deps.query);
  return { ok: true, deleted: true };
}
