import crypto from 'node:crypto';
import { pool } from './db.js';
import { config } from './config.js';
import { normalizePlan, Plan } from './plans.js';

/**
 * Faturação e subscrições via Easypay (métodos PT: Multibanco, MB WAY, cartão,
 * débito direto). O PLANO da empresa é a fonte de verdade do gating; os webhooks
 * do Easypay atualizam plano + estado da subscrição.
 *
 * Estados da empresa (companies.subscription_status):
 *   trialing  → trial Pro de 7 dias (trial_ends_at)
 *   active    → subscrição paga a decorrer (usa companies.plan)
 *   past_due  → falha de cobrança / pagamento pendente (retries)
 *   canceled  → sem subscrição → plano efetivo cai para free
 *
 * Fluxo de checkout: guardamos o plano pretendido em companies.pending_plan;
 * só o webhook PAGO (após verificação de assinatura) promove plan = pending_plan.
 */

export function billingConfigured(): boolean {
  return Boolean(config.easypay.accountId && config.easypay.apiKey);
}

const EUR = (cents: number) => Math.round(cents) / 100;

/** Preço mensal (cêntimos, sem IVA) de um plano pago. */
export function planPriceCents(plan: Plan): number {
  return config.plans.priceCents[plan] ?? config.planPriceCents;
}

interface EasypayResult {
  id: string;
  plan: Plan;
  method: string;
  // dados para o cliente pagar (variam por método): referência MB, url de cartão, etc.
  payment: Record<string, unknown>;
  raw: unknown;
}

/**
 * Cria uma subscrição mensal no Easypay para a empresa, para o `plan` indicado
 * (pro | business). `method` = 'cc' (cartão), 'mb' (Multibanco), 'mbw' (MB WAY)
 * ou 'dd' (débito direto). O plano pretendido fica em companies.pending_plan e
 * só é promovido quando o webbook de pagamento confirmar (verificado por assinatura).
 */
export async function createSubscription(
  company: { id: number; name: string; nif: string | null },
  customer: { name: string; email: string; phone?: string | null },
  method: string,
  plan: Plan
): Promise<EasypayResult> {
  if (!billingConfigured()) throw new Error('Easypay não configurado');
  if (plan !== 'pro' && plan !== 'business') throw new Error('Plano inválido para subscrição');

  const priceCents = planPriceCents(plan);
  const planLabel = plan === 'business' ? 'Business' : 'Pro';

  const body = {
    key: `company-${company.id}-${plan}`,        // idempotência do nosso lado
    value: EUR(priceCents),
    currency: 'EUR',
    frequency: '1M',                             // mensal
    method,
    capture: { descriptive: `${config.planName} ${planLabel} — subscrição mensal` },
    retries: [{ days: 1 }, { days: 3 }, { days: 5 }],   // tentativas em caso de falha
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone ?? undefined,
      fiscal_number: company.nif ?? undefined,
      key: `customer-${company.id}`,
    },
    ...(config.appBaseUrl
      ? { notifications: { webhook: `${config.appBaseUrl}/api/billing/webhook` } }
      : {}),
  };

  const res = await fetch(`${config.easypay.baseUrl}/subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      AccountId: config.easypay.accountId,
      ApiKey: config.easypay.apiKey,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Easypay ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  const id = String((json.id as string) ?? (json.subscription as string) ?? '');
  if (id) {
    await pool.query(
      'UPDATE companies SET easypay_subscription_id = $1, pending_plan = $2 WHERE id = $3',
      [id, plan, company.id]
    );
  }
  // O corpo de "method" traz os dados de pagamento (referência MB, url de cartão, etc.).
  return { id, plan, method, payment: (json.method as Record<string, unknown>) ?? json, raw: json };
}

/**
 * Verifica a autenticidade de um webhook do Easypay ANTES de mutar qualquer
 * estado (regra inviolável). Aceita dois modos:
 *  - segredo partilhado: header `x-easypay-signature` (ou `?secret=`) igual ao
 *    EASYPAY_WEBHOOK_SECRET (comparação em tempo constante);
 *  - HMAC-SHA256 do corpo cru com o mesmo segredo (assinatura hex de 64 chars).
 * Sem segredo configurado → falha fechada (não muta estado).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | undefined,
  querySecret: string | undefined
): boolean {
  const secret = config.easypay.webhookSecret;
  if (!secret) return false;   // fail-closed: nunca mutar sem poder verificar

  const safeEq = (a: string, b: string): boolean => {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
  };

  // Modo segredo partilhado (header ou query).
  if (signature && safeEq(signature, secret)) return true;
  if (querySecret && safeEq(querySecret, secret)) return true;

  // Modo HMAC do corpo cru.
  if (signature && /^[a-f0-9]{64}$/i.test(signature)) {
    const hmac = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    if (safeEq(signature.toLowerCase(), hmac)) return true;
  }
  return false;
}

/** Mapeia o estado que o Easypay reporta para o nosso subscription_status. */
function mapStatus(raw: string): 'active' | 'past_due' | 'canceled' | null {
  const s = raw.toLowerCase();
  if (['paid', 'success', 'succeeded', 'active', 'captured'].some((k) => s.includes(k))) return 'active';
  if (['failed', 'declined', 'error', 'pending'].some((k) => s.includes(k))) return 'past_due';
  if (['canceled', 'cancelled', 'expired', 'refunded'].some((k) => s.includes(k))) return 'canceled';
  return null;
}

/**
 * Processa um webhook do Easypay (JÁ verificado): encontra a empresa pela
 * subscrição e atualiza plano + estado. Tolerante à forma exata do payload.
 *  - pago  → subscription_status='active' e promove plan = pending_plan (upgrade);
 *  - falha → past_due (plano efetivo cai para free até regularizar);
 *  - cancel→ canceled (plano efetivo cai para free).
 */
export async function applyWebhook(body: Record<string, unknown>): Promise<{ ok: boolean; companyId?: number; status?: string; plan?: string }> {
  const subId =
    (body.subscription as string) ||
    ((body.subscription as Record<string, unknown>)?.id as string) ||
    (body.id as string) ||
    '';
  const statusRaw =
    (body.status as string) ||
    (body.type as string) ||
    ((body.payment as Record<string, unknown>)?.status as string) ||
    '';
  const mapped = statusRaw ? mapStatus(statusRaw) : null;

  if (!subId || !mapped) return { ok: false };

  const { rows } = await pool.query(
    'SELECT id, plan, pending_plan FROM companies WHERE easypay_subscription_id = $1', [subId]);
  if (rows.length === 0) return { ok: false };
  const companyId = rows[0].id as number;

  if (mapped === 'active') {
    // Promove para o plano pretendido (checkout) — inclui upgrade Pro→Business.
    const target = normalizePlan(rows[0].pending_plan ?? rows[0].plan);
    await pool.query(
      `UPDATE companies
       SET subscription_status = 'active', plan = $1, pending_plan = NULL,
           trial_ends_at = NULL, renewal_at = now() + interval '1 month'
       WHERE id = $2`,
      [target, companyId]
    );
    console.log(`[billing] empresa #${companyId}: subscrição ATIVA no plano ${target} (${statusRaw})`);
    return { ok: true, companyId, status: 'active', plan: target };
  }

  // Falha/cancelamento: baixa o estado (o plano efetivo cai para free via effectivePlan).
  await pool.query('UPDATE companies SET subscription_status = $1 WHERE id = $2', [mapped, companyId]);
  console.log(`[billing] empresa #${companyId}: subscrição -> ${mapped} (${statusRaw})`);
  return { ok: true, companyId, status: mapped };
}
