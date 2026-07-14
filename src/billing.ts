import { pool } from './db.js';
import { config } from './config.js';

/**
 * Faturação e subscrições via Easypay (métodos PT: Multibanco, MB WAY, cartão,
 * débito direto). O estado da subscrição da empresa é a fonte de verdade do
 * gating; os webhooks do Easypay atualizam esse estado.
 *
 * Estados da empresa (companies.subscription_status):
 *   trialing  → 7 dias grátis (trial_ends_at)
 *   active    → subscrição paga a decorrer
 *   past_due  → falha de cobrança (retries a decorrer)
 *   canceled  → sem acesso
 */

export function billingConfigured(): boolean {
  return Boolean(config.easypay.accountId && config.easypay.apiKey);
}

const EUR = (cents: number) => Math.round(cents) / 100;

interface EasypayResult {
  id: string;
  method: string;
  // dados para o cliente pagar (variam por método): referência MB, url de cartão, etc.
  payment: Record<string, unknown>;
  raw: unknown;
}

/**
 * Cria uma subscrição mensal no Easypay para a empresa. `method` = 'cc' (cartão),
 * 'mb' (Multibanco), 'mbw' (MB WAY) ou 'dd' (débito direto).
 * Nota: requer conta Easypay configurada (EASYPAY_ACCOUNT_ID / EASYPAY_API_KEY).
 */
export async function createSubscription(
  company: { id: number; name: string; nif: string | null },
  customer: { name: string; email: string; phone?: string | null },
  method: string
): Promise<EasypayResult> {
  if (!billingConfigured()) throw new Error('Easypay não configurado');

  const body = {
    key: `company-${company.id}`,               // idempotência do nosso lado
    value: EUR(config.planPriceCents),
    currency: 'EUR',
    frequency: '1M',                             // mensal
    method,
    capture: { descriptive: `${config.planName} — subscrição mensal` },
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
    await pool.query('UPDATE companies SET easypay_subscription_id = $1 WHERE id = $2', [id, company.id]);
  }
  // O corpo de "method" traz os dados de pagamento (referência MB, url de cartão, etc.).
  return { id, method, payment: (json.method as Record<string, unknown>) ?? json, raw: json };
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
 * Processa um webhook do Easypay: encontra a empresa pela subscrição e atualiza
 * o estado. Tolerante à forma exata do payload (varia por evento/versão).
 */
export async function applyWebhook(body: Record<string, unknown>): Promise<{ ok: boolean; companyId?: number }> {
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
    'SELECT id FROM companies WHERE easypay_subscription_id = $1', [subId]);
  if (rows.length === 0) return { ok: false };
  const companyId = rows[0].id as number;

  await pool.query('UPDATE companies SET subscription_status = $1 WHERE id = $2', [mapped, companyId]);
  console.log(`[billing] empresa #${companyId}: subscrição -> ${mapped} (${statusRaw})`);
  return { ok: true, companyId };
}
