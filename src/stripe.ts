import crypto from 'node:crypto';
import { pool } from './db.js';
import { config } from './config.js';
import { normalizePlan, Plan } from './plans.js';
import { createMoloniInvoice } from './moloni.js';

/**
 * Pagamentos via Stripe. Modelo híbrido:
 *  - cartão → subscrição mensal (mode=subscription), renovação automática;
 *  - MB WAY / Multibanco / transferência → pagamento pontual de 1 mês
 *    (mode=payment), sem renovação automática (o acesso expira em access_until).
 *
 * Os métodos disponíveis em cada checkout são os que estiverem ATIVOS no
 * dashboard Stripe (payment methods dinâmicos) — não os fixamos no código.
 *
 * A cada pagamento confirmado emitimos uma fatura no Moloni (best-effort).
 */

const API = 'https://api.stripe.com/v1';

export function stripeConfigured(): boolean {
  return Boolean(config.stripe.secretKey);
}

/** Preço bruto (com IVA), em cêntimos, a cobrar por um plano. */
export function grossCents(plan: Plan): number {
  const net = config.plans.priceCents[plan] ?? 0;
  return Math.round(net * (1 + config.ivaRate));
}

function subscriptionPriceId(plan: Plan): string {
  if (plan === 'pro') return config.stripe.pricePro;
  if (plan === 'business') return config.stripe.priceBusiness;
  return '';
}

/** Serializa um objeto aninhado para o formato form-encoded do Stripe (a[b][c]). */
function encodeForm(obj: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') parts.push(encodeForm(v as Record<string, unknown>, key));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.filter(Boolean).join('&');
}

async function stripePost(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.stripe.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: encodeForm(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

interface CheckoutInput {
  company: { id: number; name: string; nif: string | null; stripeCustomerId?: string | null };
  customer: { email: string; name?: string };
  plan: Plan;                 // pro | business
  mode: 'subscription' | 'payment';
}

/** Cria uma sessão de Checkout do Stripe e devolve o URL para redirecionar. */
export async function createCheckout(input: CheckoutInput): Promise<{ url: string; id: string }> {
  if (!stripeConfigured()) throw new Error('Stripe não configurado');
  const { company, customer, plan, mode } = input;
  if (plan !== 'pro' && plan !== 'business') throw new Error('Plano inválido para pagamento');

  const base = config.appBaseUrl || '';
  const successUrl = `${base}/app#/conta?pago=1`;
  const cancelUrl = `${base}/app#/planos`;
  const planLabel = plan === 'business' ? 'Business' : 'Pro';

  const body: Record<string, unknown> = {
    mode,
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: String(company.id),
    metadata: { company_id: String(company.id), plan },
    // Reutiliza o cliente Stripe se já existir; senão usa o email.
    ...(company.stripeCustomerId ? { customer: company.stripeCustomerId } : { customer_email: customer.email }),
  };

  if (mode === 'subscription') {
    const price = subscriptionPriceId(plan);
    if (!price) throw new Error(`Falta o price ID de subscrição para o plano ${plan}`);
    body.line_items = { 0: { price, quantity: 1 } };
    body.subscription_data = { metadata: { company_id: String(company.id), plan } };
  } else {
    // Pagamento pontual de 1 mês, com price_data inline (valor bruto).
    body.line_items = {
      0: {
        price_data: {
          currency: 'eur',
          unit_amount: grossCents(plan),
          product_data: { name: `${config.planName} ${planLabel} — 1 mês` },
        },
        quantity: 1,
      },
    };
    body.payment_intent_data = { metadata: { company_id: String(company.id), plan } };
  }

  const session = await stripePost('/checkout/sessions', body);
  return { url: String(session.url), id: String(session.id) };
}

/**
 * Verifica a assinatura de um webhook do Stripe (cabeçalho Stripe-Signature)
 * ANTES de processar o evento. Sem segredo configurado → falha fechada.
 */
export function verifyStripeSignature(rawBody: string, sigHeader: string | undefined): boolean {
  const secret = config.stripe.webhookSecret;
  if (!secret || !sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map((kv) => kv.split('=')));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const signed = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex');
  const a = Buffer.from(v1);
  const b = Buffer.from(signed);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  // Tolerância de 5 minutos contra replay.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  return Number.isFinite(age) && age < 300;
}

/** Obtém o company_id de um objeto Stripe (metadata ou client_reference_id). */
function companyIdOf(o: Record<string, unknown>): number | null {
  const meta = (o.metadata as Record<string, unknown>) ?? {};
  const raw = meta.company_id ?? o.client_reference_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function findCompanyId(o: Record<string, unknown>): Promise<number | null> {
  const direct = companyIdOf(o);
  if (direct) return direct;
  const cust = o.customer;
  const sub = o.subscription;
  if (typeof cust === 'string') {
    const { rows } = await pool.query('SELECT id FROM companies WHERE stripe_customer_id = $1', [cust]);
    if (rows[0]) return rows[0].id as number;
  }
  if (typeof sub === 'string') {
    const { rows } = await pool.query('SELECT id FROM companies WHERE stripe_subscription_id = $1', [sub]);
    if (rows[0]) return rows[0].id as number;
  }
  return null;
}

/** Regista o pagamento (idempotente por event id) e emite fatura no Moloni. */
async function recordPaymentAndInvoice(opts: {
  eventId: string; companyId: number; kind: 'subscription' | 'one_time'; plan: Plan; amountCents: number;
}): Promise<void> {
  // Idempotência: se o evento já foi processado, não repete (Stripe reenvia webhooks).
  const ins = await pool.query(
    `INSERT INTO payments (company_id, stripe_event_id, kind, plan, amount_cents)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (stripe_event_id) DO NOTHING RETURNING id`,
    [opts.companyId, opts.eventId, opts.kind, opts.plan, opts.amountCents]);
  if (ins.rowCount === 0) return; // já processado

  const paymentRowId = ins.rows[0].id as number;
  const { rows } = await pool.query('SELECT id, name, nif FROM companies WHERE id = $1', [opts.companyId]);
  const company = rows[0];
  if (!company) return;
  try {
    const inv = await createMoloniInvoice({
      company: { name: company.name, nif: company.nif },
      plan: opts.plan,
      netCents: config.plans.priceCents[opts.plan] ?? 0,
    });
    await pool.query('UPDATE payments SET moloni_document_id = $1, moloni_status = $2 WHERE id = $3',
      [inv.documentId ?? null, inv.status, paymentRowId]);
  } catch (err) {
    console.error('[stripe] fatura Moloni falhou:', String(err).slice(0, 200));
    await pool.query('UPDATE payments SET moloni_status = $1 WHERE id = $2', ['error', paymentRowId]);
  }
}

/**
 * Processa um evento Stripe JÁ verificado. Atualiza plano/estado e, nos eventos
 * de pagamento, regista o pagamento e emite a fatura Moloni.
 */
export async function handleStripeEvent(event: Record<string, unknown>): Promise<{ ok: boolean; companyId?: number }> {
  const type = String(event.type ?? '');
  const obj = ((event.data as Record<string, unknown>)?.object as Record<string, unknown>) ?? {};
  const eventId = String(event.id ?? '');

  switch (type) {
    case 'checkout.session.completed': {
      const companyId = await findCompanyId(obj);
      if (!companyId) return { ok: false };
      const plan = normalizePlan(((obj.metadata as Record<string, unknown>)?.plan) ?? 'pro') as Plan;
      const mode = String(obj.mode ?? '');
      const custId = typeof obj.customer === 'string' ? obj.customer : null;

      if (mode === 'subscription') {
        const subId = typeof obj.subscription === 'string' ? obj.subscription : null;
        await pool.query(
          `UPDATE companies SET plan = $1, subscription_status = 'active', pending_plan = NULL,
             trial_ends_at = NULL, access_until = NULL,
             stripe_customer_id = COALESCE($2, stripe_customer_id),
             stripe_subscription_id = COALESCE($3, stripe_subscription_id),
             renewal_at = now() + interval '1 month'
           WHERE id = $4`, [plan, custId, subId, companyId]);
        // A fatura é emitida no invoice.paid (evento canónico de pagamento da subscrição).
        return { ok: true, companyId };
      }
      // Pagamento pontual: só ativa se já estiver pago (métodos síncronos, ex. cartão).
      if (String(obj.payment_status ?? '') === 'paid') {
        await activateOneTime(companyId, plan, custId);
        await recordPaymentAndInvoice({ eventId, companyId, kind: 'one_time', plan, amountCents: Number(obj.amount_total ?? grossCents(plan)) });
      }
      return { ok: true, companyId };
    }

    case 'checkout.session.async_payment_succeeded': {
      // MB WAY / Multibanco / transferência confirmam aqui (assíncrono).
      const companyId = await findCompanyId(obj);
      if (!companyId) return { ok: false };
      const plan = normalizePlan(((obj.metadata as Record<string, unknown>)?.plan) ?? 'pro') as Plan;
      const custId = typeof obj.customer === 'string' ? obj.customer : null;
      await activateOneTime(companyId, plan, custId);
      await recordPaymentAndInvoice({ eventId, companyId, kind: 'one_time', plan, amountCents: Number(obj.amount_total ?? grossCents(plan)) });
      return { ok: true, companyId };
    }

    case 'invoice.paid': {
      // Pagamento (inicial e renovações) de uma subscrição por cartão.
      const companyId = await findCompanyId(obj);
      if (!companyId) return { ok: false };
      const { rows } = await pool.query('SELECT plan FROM companies WHERE id = $1', [companyId]);
      const plan = normalizePlan(rows[0]?.plan ?? 'pro') as Plan;
      const periodEnd = Number((obj.lines as Record<string, unknown>)?.data
        ? ((((obj.lines as Record<string, unknown>).data as unknown[])[0] as Record<string, unknown>)?.period as Record<string, unknown>)?.end
        : obj.period_end);
      await pool.query(
        `UPDATE companies SET subscription_status = 'active', access_until = NULL,
           renewal_at = COALESCE($2, now() + interval '1 month') WHERE id = $1`,
        [companyId, Number.isFinite(periodEnd) ? new Date(periodEnd * 1000).toISOString() : null]);
      await recordPaymentAndInvoice({ eventId, companyId, kind: 'subscription', plan, amountCents: Number(obj.amount_paid ?? grossCents(plan)) });
      return { ok: true, companyId };
    }

    case 'invoice.payment_failed': {
      const companyId = await findCompanyId(obj);
      if (companyId) await pool.query(`UPDATE companies SET subscription_status = 'past_due' WHERE id = $1`, [companyId]);
      return { ok: !!companyId, companyId: companyId ?? undefined };
    }

    case 'customer.subscription.updated': {
      const companyId = await findCompanyId(obj);
      if (!companyId) return { ok: false };
      const st = String(obj.status ?? '');
      const mapped = st === 'active' || st === 'trialing' ? 'active'
        : st === 'past_due' || st === 'unpaid' ? 'past_due'
        : st === 'canceled' || st === 'incomplete_expired' ? 'canceled' : null;
      if (mapped) await pool.query('UPDATE companies SET subscription_status = $1 WHERE id = $2', [mapped, companyId]);
      return { ok: true, companyId };
    }

    case 'customer.subscription.deleted': {
      const companyId = await findCompanyId(obj);
      if (companyId) await pool.query(
        `UPDATE companies SET subscription_status = 'canceled', stripe_subscription_id = NULL WHERE id = $1`, [companyId]);
      return { ok: !!companyId, companyId: companyId ?? undefined };
    }

    default:
      return { ok: true };
  }
}

async function activateOneTime(companyId: number, plan: Plan, custId: string | null): Promise<void> {
  await pool.query(
    `UPDATE companies SET plan = $1, subscription_status = 'active', pending_plan = NULL,
       trial_ends_at = NULL, access_until = now() + interval '1 month',
       renewal_at = now() + interval '1 month',
       stripe_customer_id = COALESCE($2, stripe_customer_id)
     WHERE id = $3`, [plan, custId, companyId]);
}
