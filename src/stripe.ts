import crypto from 'node:crypto';
import Stripe from 'stripe';
import { pool } from './db.js';
import { config } from './config.js';
import { normalizePlan, Plan } from './plans.js';
import { createMoloniInvoice } from './moloni.js';
import { sendMail, layout, esc } from './mail.js';

/**
 * Pagamentos via Stripe Checkout + Billing (SaaS, não Connect).
 *
 *  - cartão → subscrição mensal (mode=subscription), renovação automática;
 *  - MB WAY / Multibanco / transferência → pagamento pontual de 1 mês
 *    (mode=payment), sem renovação automática (o acesso expira em access_until).
 *
 * Os métodos disponíveis em cada checkout são os que estiverem ATIVOS no
 * dashboard Stripe (payment methods dinâmicos) — NUNCA passamos
 * payment_method_types. Stripe Tax (automatic_tax) fica desligado: o projecto
 * não tem registo de Stripe Tax; o IVA é tratado no preço + Moloni.
 */

export const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2026-07-29.dahlia';

const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

export type SqlQuery = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;

const defaultQuery: SqlQuery = (sql, params) => pool.query(sql, params);

let stripeClient: Stripe | null = null;
let stripeClientKey: string | null = null;

export function stripeConfigured(): boolean {
  return Boolean(config.stripe.secretKey);
}

/** Instância StripeClient. A chave vai no construtor — nunca Stripe.apiKey global. */
export function getStripeClient(): Stripe {
  const key = config.stripe.secretKey;
  if (!key) throw new Error('Stripe não configurado (STRIPE_SECRET_KEY).');
  if (stripeClient && stripeClientKey === key) return stripeClient;
  stripeClient = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });
  stripeClientKey = key;
  return stripeClient;
}

/** Cliente só para HMAC de webhooks (não chama a API). */
function webhookCryptoClient(): Stripe {
  if (config.stripe.secretKey) return getStripeClient();
  return new Stripe('rk_test_webhook_placeholder', {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });
}

export function isLiveStripeKey(key: string): boolean {
  return key.startsWith('sk_live') || key.startsWith('rk_live');
}

/** Preço bruto (com IVA), em cêntimos, a cobrar por um plano. */
export function grossCents(plan: Plan): number {
  const net = config.plans.priceCents[plan] ?? 0;
  return Math.round(net * (1 + config.ivaRate));
}

export function subscriptionPriceId(plan: Plan): string {
  if (plan === 'pro') return config.stripe.pricePro;
  if (plan === 'business') return config.stripe.priceBusiness;
  return '';
}

export function planFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  if (priceId === config.stripe.pricePro) return 'pro';
  if (priceId === config.stripe.priceBusiness) return 'business';
  return null;
}

export type LocalSubStatus = 'active' | 'past_due' | 'canceled';

export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): LocalSubStatus | null {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    case 'incomplete':
    case 'paused':
      return null;
    default:
      return null;
  }
}

/** Rótulo custom + 8 letras aleatórias (alfanumeric/dash, máx. 200). */
export function newIntegrationIdentifier(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.randomBytes(8);
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += letters[bytes[i]! % letters.length];
  return `baseradar-${suffix}`;
}

function publicAppUrl(): string {
  return config.appBaseUrl;
}

function refId(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref.id;
}

function paidPlanFromMeta(meta: Stripe.Metadata | null | undefined): Plan {
  const plan = normalizePlan(meta?.plan);
  return plan === 'business' ? 'business' : 'pro';
}

interface CheckoutInput {
  company: { id: number; name: string; nif: string | null; stripeCustomerId?: string | null };
  customer: { email: string; name?: string };
  plan: Plan;
  mode: 'subscription' | 'payment';
}

export function buildCheckoutSessionParams(
  input: CheckoutInput,
  integrationId = newIntegrationIdentifier(),
): Stripe.Checkout.SessionCreateParams {
  const { company, customer, plan, mode } = input;
  const base = publicAppUrl();
  if (!base) throw new Error('Falta APP_URL (URL público da aplicação).');
  if (plan !== 'pro' && plan !== 'business') throw new Error('Plano inválido para pagamento');

  const params: Stripe.Checkout.SessionCreateParams = {
    mode,
    success_url: `${base}/app#/conta?pago=1`,
    cancel_url: `${base}/app#/planos`,
    client_reference_id: String(company.id),
    metadata: { company_id: String(company.id), plan },
    integration_identifier: integrationId,
    locale: 'pt',
    // Sem payment_method_types: métodos dinâmicos do Dashboard.
    // Sem automatic_tax: não há Stripe Tax registado neste projecto.
  };

  if (company.stripeCustomerId) params.customer = company.stripeCustomerId;
  else if (customer.email) params.customer_email = customer.email;

  if (mode === 'subscription') {
    const price = subscriptionPriceId(plan);
    if (!price) throw new Error(`Falta o price ID de subscrição para o plano ${plan} (STRIPE_PRICE_${plan.toUpperCase()}).`);
    params.line_items = [{ price, quantity: 1 }];
    params.subscription_data = { metadata: { company_id: String(company.id), plan } };
  } else {
    const planLabel = plan === 'business' ? 'Business' : 'Pro';
    params.line_items = [{
      price_data: {
        currency: 'eur',
        unit_amount: grossCents(plan),
        product_data: { name: `${config.planName} ${planLabel} — 1 mês` },
      },
      quantity: 1,
    }];
    params.payment_intent_data = { metadata: { company_id: String(company.id), plan } };
  }

  return params;
}

export function buildPortalSessionParams(
  customerId: string,
  returnUrl: string,
): Stripe.BillingPortal.SessionCreateParams {
  return { customer: customerId, return_url: returnUrl };
}

export function classifyPortalError(err: unknown): { code: string; message: string; http: number } {
  const msg = err instanceof Error ? err.message : String(err);
  if (/no configuration provided|default configuration|billing portal is not|customer portal/i.test(msg)) {
    return {
      code: 'portal_unconfigured',
      http: 503,
      message: 'A gestão de pagamentos ainda não está ativa. Contacte o suporte.',
    };
  }
  return {
    code: 'portal_failed',
    http: 502,
    message: 'Não foi possível abrir a gestão de pagamentos. Tente de novo ou contacte o suporte.',
  };
}

/** Recurso Stripe já inexistente (subscrição cancelada / id inválido). */
export function isStripeMissingResource(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const rec = err as { code?: unknown; statusCode?: unknown };
  return rec.code === 'resource_missing' || rec.statusCode === 404;
}

/** Cancela já a subscrição. Id desaparecido conta como sucesso. */
export async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  try {
    await getStripeClient().subscriptions.cancel(subscriptionId);
  } catch (err) {
    if (isStripeMissingResource(err)) return;
    throw err;
  }
}

/** Abre o Customer Portal do Stripe (cartão, cancelar, método de pagamento). */
export async function createBillingPortal(customerId: string): Promise<{ url: string }> {
  if (!stripeConfigured()) throw new Error('Stripe não configurado');
  const base = publicAppUrl();
  if (!base) throw new Error('Falta APP_URL (URL público da aplicação).');
  const session = await getStripeClient().billingPortal.sessions.create(
    buildPortalSessionParams(customerId, `${base}/app#/conta`),
  );
  if (!session.url) throw new Error('Stripe Portal não devolveu URL');
  return { url: session.url };
}

/** Cria uma sessão de Checkout do Stripe e devolve o URL para redirecionar. */
export async function createCheckout(input: CheckoutInput): Promise<{ url: string; id: string; integration_identifier: string }> {
  if (!stripeConfigured()) throw new Error('Stripe não configurado');
  const integrationId = newIntegrationIdentifier();
  const session = await getStripeClient().checkout.sessions.create(buildCheckoutSessionParams(input, integrationId));
  if (!session.url) throw new Error('Stripe Checkout não devolveu URL');
  return { url: session.url, id: session.id, integration_identifier: integrationId };
}

export function constructStripeEvent(
  rawBody: string,
  sigHeader: string | undefined,
  secret: string = config.stripe.webhookSecret,
): Stripe.Event {
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET em falta');
  if (!sigHeader) throw new Error('Stripe-Signature em falta');
  return webhookCryptoClient().webhooks.constructEvent(rawBody, sigHeader, secret);
}

/**
 * Verifica a assinatura de um webhook do Stripe (cabeçalho Stripe-Signature)
 * ANTES de processar o evento. Sem segredo configurado → falha fechada.
 */
export function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | undefined,
  secret: string = config.stripe.webhookSecret,
): boolean {
  try {
    constructStripeEvent(rawBody, sigHeader, secret);
    return true;
  } catch {
    return false;
  }
}

async function findCompanyId(
  obj: {
    metadata?: Stripe.Metadata | null;
    client_reference_id?: string | null;
    customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
    subscription?: string | Stripe.Subscription | null;
    parent?: Stripe.Invoice.Parent | null;
  },
  query: SqlQuery,
): Promise<number | null> {
  const fromMeta = Number(obj.metadata?.company_id ?? obj.client_reference_id);
  if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta;

  const cust = refId(obj.customer as string | { id: string } | null | undefined);
  if (cust) {
    const { rows } = await query('SELECT id FROM companies WHERE stripe_customer_id = $1', [cust]);
    if (rows[0]) return Number(rows[0].id);
  }

  const subFromParent = obj.parent?.type === 'subscription_details'
    ? refId(obj.parent.subscription_details?.subscription)
    : null;
  const sub = subFromParent ?? refId(obj.subscription);
  if (sub) {
    const { rows } = await query('SELECT id FROM companies WHERE stripe_subscription_id = $1', [sub]);
    if (rows[0]) return Number(rows[0].id);
  }
  return null;
}

async function claimEvent(eventId: string, type: string, query: SqlQuery): Promise<boolean> {
  const ins = await query(
    `INSERT INTO stripe_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id`,
    [eventId, type],
  );
  return (ins.rowCount ?? 0) > 0;
}

async function releaseEvent(eventId: string, query: SqlQuery): Promise<void> {
  await query('DELETE FROM stripe_events WHERE id = $1', [eventId]);
}

/** Regista o pagamento (idempotente por event id) e emite fatura no Moloni da Transformatiive. */
async function recordPaymentAndInvoice(opts: {
  eventId: string; companyId: number; kind: 'subscription' | 'one_time'; plan: Plan; amountCents: number;
}, query: SqlQuery): Promise<void> {
  if (!Number.isFinite(opts.amountCents) || opts.amountCents <= 0) return;
  const ins = await query(
    `INSERT INTO payments (company_id, stripe_event_id, kind, plan, amount_cents)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (stripe_event_id) DO NOTHING RETURNING id`,
    [opts.companyId, opts.eventId, opts.kind, opts.plan, opts.amountCents]);
  if ((ins.rowCount ?? 0) === 0) return;

  const paymentRowId = ins.rows[0]!.id as number;
  const { rows } = await query('SELECT id, name, nif FROM companies WHERE id = $1', [opts.companyId]);
  const company = rows[0];
  if (!company) return;

  const { rows: contacts } = await query(
    `SELECT email, first_name FROM users WHERE company_id = $1 AND email IS NOT NULL ORDER BY id LIMIT 1`,
    [opts.companyId]);
  if (contacts[0]?.email) {
    const planLabel = opts.plan === 'business' ? 'Business' : 'Pro';
    const valor = (opts.amountCents / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2 });
    const recorrente = opts.kind === 'subscription';
    sendMail({
      to: String(contacts[0].email),
      subject: `BaseRadar — pagamento confirmado (plano ${planLabel})`,
      html: layout({
        title: 'Pagamento confirmado',
        body: `<p>Olá${contacts[0].first_name ? ' ' + esc(String(contacts[0].first_name)) : ''},</p>
               <p>Recebemos o seu pagamento de <strong>${valor} €</strong> (IVA incluído) referente ao plano <strong>${planLabel}</strong>. O acesso já está ativo.</p>
               <p>${recorrente
                 ? 'A subscrição renova automaticamente todos os meses. Pode cancelar ou alterar o cartão em Conta → Gerir subscrição.'
                 : 'Este pagamento dá acesso durante 1 mês. Não há renovação automática — receberá o aviso antes de terminar.'}</p>
               <p>A fatura fica disponível para descarregar na área de conta, assim que for emitida.</p>`,
        cta: config.appBaseUrl ? { label: 'Abrir o BaseRadar', url: `${config.appBaseUrl}/app#/conta` } : undefined,
      }),
      text: `Pagamento de ${valor} EUR confirmado — plano ${planLabel}. O acesso está ativo.`,
    }).catch((e) => console.error('[stripe] email de confirmação falhou:', String(e).slice(0, 150)));
  }
  try {
    const inv = await createMoloniInvoice({
      company: { name: String(company.name), nif: (company.nif as string | null) ?? null },
      plan: opts.plan,
      netCents: config.plans.priceCents[opts.plan] ?? 0,
    });
    if (inv.status === 'skipped') {
      console.error(`[stripe] pagamento ${paymentRowId} sem fatura Moloni (configuração em falta)`);
    }
    await query(
      'UPDATE payments SET moloni_document_id = $1, moloni_status = $2, moloni_number = $3 WHERE id = $4',
      [inv.documentId ?? null, inv.status, inv.number ?? null, paymentRowId]);
  } catch (err) {
    console.error('[stripe] fatura Moloni falhou:', String(err).slice(0, 200));
    await query('UPDATE payments SET moloni_status = $1 WHERE id = $2', ['error', paymentRowId]);
  }
}

async function activateOneTime(companyId: number, plan: Plan, custId: string | null, query: SqlQuery): Promise<void> {
  await query(
    `UPDATE companies SET plan = $1, subscription_status = 'active', pending_plan = NULL,
       trial_ends_at = NULL, access_until = now() + interval '1 month',
       renewal_at = now() + interval '1 month',
       stripe_customer_id = COALESCE($2, stripe_customer_id)
     WHERE id = $3`, [plan, custId, companyId]);
}

function planFromSubscription(sub: Stripe.Subscription): Plan | null {
  const fromPrice = planFromPriceId(sub.items?.data?.[0]?.price?.id);
  if (fromPrice) return fromPrice;
  const fromMeta = normalizePlan(sub.metadata?.plan);
  return fromMeta === 'pro' || fromMeta === 'business' ? fromMeta : null;
}

/**
 * Processa um evento Stripe JÁ verificado. Atualiza plano/estado e, nos eventos
 * de pagamento, regista o pagamento e emite a fatura Moloni.
 */
export async function handleStripeEvent(
  event: Stripe.Event,
  query: SqlQuery = defaultQuery,
): Promise<{ ok: boolean; companyId?: number; duplicate?: boolean }> {
  if (!event.id) return { ok: false };
  const claimed = await claimEvent(event.id, event.type, query);
  if (!claimed) return { ok: true, duplicate: true };

  try {
    return await dispatchStripeEvent(event, query);
  } catch (err) {
    await releaseEvent(event.id, query);
    throw err;
  }
}

async function dispatchStripeEvent(
  event: Stripe.Event,
  query: SqlQuery,
): Promise<{ ok: boolean; companyId?: number }> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const obj = event.data.object;
      const companyId = await findCompanyId(obj, query);
      if (!companyId) return { ok: false };
      const plan = paidPlanFromMeta(obj.metadata);
      const custId = refId(obj.customer);

      if (obj.mode === 'subscription') {
        const subId = refId(obj.subscription);
        await query(
          `UPDATE companies SET plan = $1, subscription_status = 'active', pending_plan = NULL,
             trial_ends_at = NULL, access_until = NULL,
             stripe_customer_id = COALESCE($2, stripe_customer_id),
             stripe_subscription_id = COALESCE($3, stripe_subscription_id),
             renewal_at = now() + interval '1 month'
           WHERE id = $4`, [plan, custId, subId, companyId]);
        return { ok: true, companyId };
      }
      if (obj.payment_status === 'paid') {
        await activateOneTime(companyId, plan, custId, query);
        await recordPaymentAndInvoice({
          eventId: event.id, companyId, kind: 'one_time', plan,
          amountCents: obj.amount_total ?? grossCents(plan),
        }, query);
      }
      return { ok: true, companyId };
    }

    case 'checkout.session.async_payment_succeeded': {
      const obj = event.data.object;
      const companyId = await findCompanyId(obj, query);
      if (!companyId) return { ok: false };
      const plan = paidPlanFromMeta(obj.metadata);
      const custId = refId(obj.customer);
      await activateOneTime(companyId, plan, custId, query);
      await recordPaymentAndInvoice({
        eventId: event.id, companyId, kind: 'one_time', plan,
        amountCents: obj.amount_total ?? grossCents(plan),
      }, query);
      return { ok: true, companyId };
    }

    case 'invoice.paid': {
      const obj = event.data.object;
      const companyId = await findCompanyId(obj, query);
      if (!companyId) return { ok: false };
      const { rows } = await query('SELECT plan FROM companies WHERE id = $1', [companyId]);
      const plan = normalizePlan(rows[0]?.plan ?? 'pro') as Plan;
      const periodEnd = obj.period_end;
      await query(
        `UPDATE companies SET subscription_status = 'active', access_until = NULL,
           renewal_at = COALESCE($2, now() + interval '1 month') WHERE id = $1`,
        [companyId, Number.isFinite(periodEnd) ? new Date(periodEnd * 1000).toISOString() : null]);
      await recordPaymentAndInvoice({
        eventId: event.id, companyId, kind: 'subscription', plan,
        amountCents: obj.amount_paid ?? 0,
      }, query);
      return { ok: true, companyId };
    }

    case 'invoice.payment_failed': {
      const obj = event.data.object;
      const companyId = await findCompanyId(obj, query);
      if (companyId) await query(`UPDATE companies SET subscription_status = 'past_due' WHERE id = $1`, [companyId]);
      return { ok: !!companyId, companyId: companyId ?? undefined };
    }

    case 'customer.subscription.updated': {
      const obj = event.data.object;
      const companyId = await findCompanyId(obj, query);
      if (!companyId) return { ok: false };
      const mapped = mapStripeSubscriptionStatus(obj.status);
      const plan = planFromSubscription(obj);
      if (mapped && plan) {
        await query('UPDATE companies SET subscription_status = $1, plan = $2 WHERE id = $3', [mapped, plan, companyId]);
      } else if (mapped) {
        await query('UPDATE companies SET subscription_status = $1 WHERE id = $2', [mapped, companyId]);
      }
      return { ok: true, companyId };
    }

    case 'customer.subscription.deleted': {
      const obj = event.data.object;
      const companyId = await findCompanyId(obj, query);
      if (companyId) {
        await query(
          `UPDATE companies
              SET plan = 'free',
                  subscription_status = 'canceled',
                  stripe_subscription_id = NULL,
                  access_until = NULL,
                  renewal_at = NULL
            WHERE id = $1`,
          [companyId]);
      }
      return { ok: !!companyId, companyId: companyId ?? undefined };
    }

    default:
      return { ok: true };
  }
}

/* ---------- Provisionamento assistido (apenas modo teste) ---------- */

export async function provisionPrices(): Promise<{
  pro: { price_id: string; amount_cents: number };
  business: { price_id: string; amount_cents: number };
}> {
  if (!stripeConfigured()) throw new Error('Falta STRIPE_SECRET_KEY.');
  if (isLiveStripeKey(config.stripe.secretKey)) {
    throw new Error('Recusado: não criar produtos/preços com chave live. Crie-os no Dashboard de teste e defina STRIPE_PRICE_PRO / STRIPE_PRICE_BUSINESS.');
  }

  const stripe = getStripeClient();
  const ensure = async (plan: 'pro' | 'business') => {
    const label = plan === 'business' ? 'Business' : 'Pro';
    const lookupKey = `baseradar_${plan}_mensal`;
    const amount = grossCents(plan);

    const found = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 10 });
    const existing = found.data.find((p) => p.unit_amount === amount && p.currency === 'eur');
    if (existing) return { price_id: existing.id, amount_cents: amount };

    const product = await stripe.products.create({
      name: `${config.planName} ${label}`,
      description: `Subscrição mensal do plano ${label} do ${config.planName}.`,
      metadata: { plan },
    });
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'eur',
      unit_amount: amount,
      recurring: { interval: 'month' },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      metadata: { plan },
    });
    return { price_id: price.id, amount_cents: amount };
  };

  return { pro: await ensure('pro'), business: await ensure('business') };
}

export async function provisionWebhook(): Promise<{ url: string; secret?: string; created: boolean; id: string }> {
  if (!stripeConfigured()) throw new Error('Falta STRIPE_SECRET_KEY.');
  if (!config.appBaseUrl) throw new Error('Falta APP_URL.');
  const url = `${config.appBaseUrl}/api/billing/webhook`;
  const stripe = getStripeClient();

  const existingList = await stripe.webhookEndpoints.list({ limit: 100 });
  const already = existingList.data.find((w) => w.url === url);
  if (already) return { url, created: false, id: already.id };

  const created = await stripe.webhookEndpoints.create({
    url,
    description: `${config.planName} — webhook de faturação`,
    enabled_events: WEBHOOK_EVENTS,
    api_version: STRIPE_API_VERSION,
  });
  return { url, created: true, id: created.id, secret: created.secret ?? undefined };
}

export async function stripeStatus(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    secret_key: Boolean(config.stripe.secretKey),
    publishable_key: Boolean(config.stripe.publishableKey),
    webhook_secret: Boolean(config.stripe.webhookSecret),
    price_pro: config.stripe.pricePro || null,
    price_business: config.stripe.priceBusiness || null,
    app_url: config.appBaseUrl || null,
    api_version: STRIPE_API_VERSION,
    automatic_tax: false,
  };
  if (!stripeConfigured()) return { ...out, ready: false };
  try {
    const cfg = await getStripeClient().paymentMethodConfigurations.list({ limit: 1 });
    const first = cfg.data[0] ?? {};
    const active = Object.entries(first)
      .filter(([, v]) => v && typeof v === 'object' && (v as { display_preference?: unknown }).display_preference)
      .filter(([, v]) => {
        const d = (v as { display_preference?: { value?: string; preference?: string } }).display_preference;
        return d && String(d.value ?? d.preference ?? '') !== 'off';
      })
      .map(([k]) => k);
    out.payment_methods_active = active;
    out.mbway_active = active.includes('mb_way');
    out.multibanco_active = active.includes('multibanco');
  } catch (err) {
    out.payment_methods_error = String(err).slice(0, 200);
  }
  return {
    ...out,
    ready: Boolean(
      config.stripe.secretKey
      && config.stripe.webhookSecret
      && config.stripe.pricePro
      && config.stripe.priceBusiness
      && config.appBaseUrl,
    ),
  };
}
