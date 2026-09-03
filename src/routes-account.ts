import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { config } from './config.js';
import { SESSION_COOKIE, requireAuth, auth } from './auth.js';
import { createProfileRun } from './profiles.js';
import { normalize } from './cpv.js';
import { stripeConfigured, createCheckout, createBillingPortal, classifyPortalError,
         constructStripeEvent, handleStripeEvent, grossCents,
         provisionPrices, provisionWebhook, stripeStatus } from './stripe.js';
import { discoverMoloniConfig, getMoloniInvoicePdf, moloniStatus, MoloniPdfError } from './moloni.js';
import { storageEnabled, putDocument, storageUsage } from './storage.js';
import { sendMail, layout, esc, mailEnabled } from './mail.js';
import { normalizePlan, Plan } from './plans.js';
import {
  billingSnapshot, invoiceDownloadable, invoicePdfUnavailableMessage,
  mapPaymentToInvoice, pdfFilename,
} from './billing.js';

/** IP do cliente, respeitando o proxy à frente da aplicação. */
function clientIp(req: { headers: Record<string, unknown>; ip?: string }): string {
  const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return (fwd || req.ip || '').slice(0, 60);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIF_RE = /^\d{9}$/;
const CPV_RE = /^\d{4,8}(-\d)?$/;

function setSession(reply: import('fastify').FastifyReply, username: string): void {
  reply.setCookie(SESSION_COOKIE, username, {
    path: '/', httpOnly: true, sameSite: 'lax', signed: true, maxAge: 60 * 60 * 24 * 7,
  });
}

export async function registerAccountRoutes(app: FastifyInstance): Promise<void> {
  // ---------- Inscrição pública (cria empresa + utilizador + perfil inicial) ----------
  app.post('/api/auth/register', async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const firstName = String(b.first_name ?? '').trim();
    const lastName = String(b.last_name ?? '').trim();
    const phone = String(b.phone ?? '').trim() || null;
    const email = String(b.email ?? '').trim().toLowerCase();
    const companyName = String(b.company_name ?? '').trim();
    const nif = String(b.nif ?? '').trim();
    const password = String(b.password ?? '');
    const terms = (Array.isArray(b.terms) ? b.terms : []).map((t) => String(t).trim()).filter(Boolean);
    const cpvCodes = (Array.isArray(b.cpv_codes) ? b.cpv_codes : [])
      .map((c) => String(c).trim()).filter((c) => CPV_RE.test(c));

    // Validação
    if (!firstName) return reply.code(400).send({ error: { code: 'invalid', message: 'Indique o primeiro nome.' } });
    if (!EMAIL_RE.test(email)) return reply.code(400).send({ error: { code: 'invalid_email', message: 'Email inválido.' } });
    if (!companyName) return reply.code(400).send({ error: { code: 'invalid', message: 'Indique o nome da empresa.' } });
    if (!NIF_RE.test(nif)) return reply.code(400).send({ error: { code: 'invalid_nif', message: 'NIF inválido (9 dígitos).' } });
    if (password.length < 8) return reply.code(400).send({ error: { code: 'weak_password', message: 'A password deve ter pelo menos 8 caracteres.' } });
    if (terms.length === 0 && cpvCodes.length === 0) {
      return reply.code(400).send({ error: { code: 'no_activity', message: 'Escolha pelo menos uma palavra-chave ou código CPV da sua atividade.' } });
    }

    // Unicidade
    const { rows: dupE } = await pool.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
    if (dupE.length) return reply.code(409).send({ error: { code: 'email_taken', message: 'Já existe uma conta com este email.' } });
    const { rows: dupN } = await pool.query('SELECT 1 FROM companies WHERE nif = $1', [nif]);
    if (dupN.length) return reply.code(409).send({ error: { code: 'nif_taken', message: 'Já existe uma conta para este NIF.' } });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // R1: todo o novo registo começa no plano FREE (nunca pago por omissão).
      // O trial Pro de 7 dias é opt-in, ativado no ecrã de planos (R6).
      const { rows: [company] } = await client.query(
        `INSERT INTO companies (name, nif, plan, subscription_status)
         VALUES ($1, $2, 'free', 'active') RETURNING id`,
        [companyName, nif]
      );
      const hash = await bcrypt.hash(password, 10);
      // Guarda a prova de aceitação dos Termos e da Privacidade (versão, momento
      // e IP): o ecrã de registo declara a aceitação, aqui fica o registo dela.
      await client.query(
        `INSERT INTO users (username, email, password_hash, company_id, first_name, last_name, phone,
                            terms_accepted_at, terms_version, terms_ip)
         VALUES ($1, $1, $2, $3, $4, $5, $6, now(), $7, $8)`,
        [email, hash, company.id, firstName, lastName || null, phone, config.termsVersion, clientIp(req)]
      );
      // Perfil inicial pré-configurado com a atividade escolhida.
      const profileTerms = terms.length ? terms : [companyName];
      const { rows: [profile] } = await client.query(
        `INSERT INTO profiles (name, terms, cpv_codes, schedule, include_announcements, company_id)
         VALUES ($1, $2, $3, 'daily', true, $4) RETURNING id`,
        ['A minha atividade', profileTerms, cpvCodes, company.id]
      );
      await client.query('COMMIT');
      // Popula o radar do perfil a partir do corpus já recolhido (fora da transação).
      createProfileRun(profile.id, null).catch((e) => console.error('[register] run inicial falhou:', e));
      setSession(reply, email);
      return reply.code(201).send({ ok: true, username: email, company_id: company.id, profile_id: profile.id });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  // ---------- Pesquisa de CPV pública (para o formulário de inscrição) ----------
  app.get('/api/public/cpv', async (req) => {
    const q = String((req.query as Record<string, unknown>).q ?? '').trim();
    if (!q) {
      const { rows } = await pool.query(
        `SELECT code, designation, n_contracts FROM cpv_catalog ORDER BY n_contracts DESC LIMIT 30`);
      return { items: rows };
    }
    if (/^\d{2,}/.test(q)) {
      const { rows } = await pool.query(
        `SELECT code, designation, n_contracts FROM cpv_catalog WHERE code LIKE $1 ORDER BY n_contracts DESC LIMIT 30`,
        [`${q.split('-')[0]}%`]);
      return { items: rows };
    }
    const words = normalize(q).split(/\s+/).filter((w) => w.length >= 2);
    const params: unknown[] = [];
    const where = words.map((w) => { params.push(`%${w}%`); return `designation_norm LIKE $${params.length}`; }).join(' AND ');
    const { rows } = await pool.query(
      `SELECT code, designation, n_contracts FROM cpv_catalog ${where ? `WHERE ${where}` : ''} ORDER BY n_contracts DESC LIMIT 30`,
      params);
    return { items: rows };
  });

  // ---------- Planos ----------
  // Catálogo de planos (preços/limites) para o ecrã de subscrição.
  app.get('/api/plans', { preHandler: requireAuth }, async () => {
    const p = config.plans;
    const plan = (key: Plan) => ({
      key,
      name: key === 'free' ? 'Grátis' : key === 'pro' ? 'Pro' : 'Business',
      price_cents: p.priceCents[key] ?? 0,
      ai_cap: p.aiCap[key] ?? 0,
      seats: p.seats[key] ?? 1,
    });
    return {
      billing_enabled: stripeConfigured(),
      trial_days: config.trialDays,
      // Cartão → subscrição automática; MB WAY / Multibanco / transferência → pontual.
      pay_modes: ['subscription', 'payment'],
      plans: (p.order as readonly Plan[]).map(plan),
    };
  });

  // ---------- Faturação ----------
  app.get('/api/billing/summary', { preHandler: requireAuth }, async (req) => {
    const { companyId, plan } = auth(req);
    const payPlan: Plan = plan === 'business' ? 'business' : 'pro';
    const priceEur = (grossCents(payPlan) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2 });
    let company = null;
    if (companyId != null) {
      const { rows } = await pool.query(
        `SELECT name, nif, plan, subscription_status, trial_ends_at, renewal_at, access_until,
           (stripe_customer_id IS NOT NULL) AS has_stripe_customer,
           (stripe_subscription_id IS NOT NULL) AS has_stripe_subscription,
           CASE WHEN subscription_status = 'trialing' AND trial_ends_at IS NOT NULL
                THEN GREATEST(0, ceil(extract(epoch FROM (trial_ends_at - now())) / 86400)::int) END AS trial_days_left
         FROM companies WHERE id = $1`, [companyId]);
      company = rows[0] ?? null;
    }
    const billing = billingSnapshot(company, { billingEnabled: stripeConfigured() });
    if (company) {
      delete company.has_stripe_customer;
      delete company.has_stripe_subscription;
    }
    return {
      plan,   // plano efetivo
      plan_name: config.planName,
      price: `${priceEur} € (c/ IVA) / mês`,
      billing_enabled: stripeConfigured(),
      company,
      billing,
    };
  });

  // Faturas Moloni da empresa (uma por pagamento Stripe).
  app.get('/api/billing/invoices', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    const { rows } = await pool.query(
      `SELECT id, created_at, kind, plan, amount_cents, currency,
              moloni_document_id, moloni_status, moloni_number
         FROM payments WHERE company_id = $1
         ORDER BY created_at DESC LIMIT 100`,
      [companyId]);
    return { items: rows.map(mapPaymentToInvoice) };
  });

  app.get('/api/billing/invoices/:id/pdf', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    const id = Number((req.params as { id: string }).id);
    if (!Number.isFinite(id) || id <= 0) {
      return reply.code(400).send({ error: { code: 'invalid', message: 'Fatura inválida.' } });
    }
    const { rows } = await pool.query(
      `SELECT id, moloni_document_id, moloni_status, moloni_number
         FROM payments WHERE id = $1 AND company_id = $2`,
      [id, companyId]);
    const row = rows[0] as {
      id: number; moloni_document_id: number | string | null; moloni_status: string | null; moloni_number: string | null;
    } | undefined;
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Fatura não encontrada.' } });
    const docId = row.moloni_document_id == null ? null : Number(row.moloni_document_id);
    if (docId == null || !invoiceDownloadable(row.moloni_status, docId)) {
      return reply.code(409).send({
        error: { code: 'pdf_unavailable', message: invoicePdfUnavailableMessage(row.moloni_status) },
      });
    }
    try {
      const { bytes } = await getMoloniInvoicePdf(docId);
      const filename = pdfFilename(row.moloni_number, row.id);
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('Cache-Control', 'private, no-store')
        .send(bytes);
    } catch (err) {
      if (err instanceof MoloniPdfError) {
        const http = err.code === 'skipped' ? 503 : err.code === 'fetch_failed' ? 502 : 409;
        return reply.code(http).send({ error: { code: err.code, message: err.message } });
      }
      console.error('[billing] pdf:', err);
      return reply.code(502).send({ error: { code: 'pdf_failed', message: 'Não foi possível descarregar a fatura.' } });
    }
  });

  // Customer Portal Stripe: cartão, cancelar, método de pagamento.
  app.post('/api/billing/portal', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    if (!stripeConfigured()) {
      return reply.code(503).send({ error: { code: 'billing_disabled', message: 'Pagamentos ainda não configurados. Contacte o suporte.' } });
    }
    const { rows } = await pool.query('SELECT stripe_customer_id FROM companies WHERE id = $1', [companyId]);
    const customerId = rows[0]?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      return reply.code(409).send({
        error: { code: 'no_customer', message: 'Ainda não há um método de pagamento associado a esta conta.' },
      });
    }
    try {
      return { ok: true, ...(await createBillingPortal(customerId)) };
    } catch (err) {
      const mapped = classifyPortalError(err);
      return reply.code(mapped.http).send({ error: { code: mapped.code, message: mapped.message } });
    }
  });

  // Inicia o trial Pro de 7 dias, sem cartão (R6). Só a partir do free e uma vez.
  app.post('/api/billing/trial', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    const { rows } = await pool.query('SELECT plan, subscription_status, trial_ends_at FROM companies WHERE id = $1', [companyId]);
    const c = rows[0];
    if (!c) return reply.code(404).send({ error: { code: 'not_found', message: 'Empresa não encontrada.' } });
    // Trial só é oferecido a quem nunca teve um (evita renovar trial indefinidamente).
    if (c.trial_ends_at != null || normalizePlan(c.plan) !== 'free') {
      return reply.code(409).send({ error: { code: 'trial_unavailable', message: 'O período de teste já foi utilizado ou já tem um plano ativo.' } });
    }
    await pool.query(
      `UPDATE companies SET plan = 'pro', subscription_status = 'trialing',
         trial_ends_at = now() + ($2 || ' days')::interval WHERE id = $1`,
      [companyId, String(config.trialDays)]
    );
    return { ok: true, plan: 'pro', trial_days: config.trialDays };
  });

  // Cria uma sessão de Checkout Stripe. mode: 'subscription' (cartão, recorrente)
  // ou 'payment' (MB WAY / Multibanco / transferência, pontual de 1 mês).
  app.post('/api/billing/checkout', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId, username } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    if (!stripeConfigured()) {
      return reply.code(503).send({ error: { code: 'billing_disabled', message: 'Pagamentos ainda não configurados. Contacte o suporte.' } });
    }
    const body = (req.body ?? {}) as { mode?: string; plan?: string };
    const mode = body.mode === 'payment' ? 'payment' : 'subscription';
    const targetPlan = normalizePlan(body.plan ?? 'pro');
    if (targetPlan !== 'pro' && targetPlan !== 'business') {
      return reply.code(400).send({ error: { code: 'invalid_plan', message: 'Plano inválido.' } });
    }
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.nif, c.stripe_customer_id, u.first_name, u.last_name, u.email
       FROM companies c JOIN users u ON u.company_id = c.id AND u.username = $1 WHERE c.id = $2`,
      [username, companyId]);
    if (rows.length === 0) return reply.code(404).send({ error: { code: 'not_found', message: 'Empresa não encontrada.' } });
    const r = rows[0];
    try {
      const result = await createCheckout({
        company: { id: r.id, name: r.name, nif: r.nif, stripeCustomerId: r.stripe_customer_id },
        customer: { email: r.email, name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.email },
        plan: targetPlan, mode,
      });
      return { ok: true, url: result.url, plan: targetPlan, mode };
    } catch (err) {
      return reply.code(502).send({ error: { code: 'billing_failed', message: String(err).slice(0, 300) } });
    }
  });

  // Webhook do Stripe (público). Regra inviolável: a assinatura é verificada
  // ANTES de qualquer mutação de estado; sem verificação, nada muda.
  app.post('/api/billing/webhook', async (req, reply) => {
    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});
    const sig = req.headers['stripe-signature'] as string | undefined;
    let event;
    try {
      event = constructStripeEvent(rawBody, sig);
    } catch {
      return reply.code(400).send({ ok: false, error: 'invalid_signature' });
    }
    try {
      const result = await handleStripeEvent(event);
      return reply.code(200).send(result);
    } catch (err) {
      console.error('[stripe] webhook erro:', err);
      return reply.code(500).send({ ok: false });
    }
  });

  // ---------- Admin: gestão manual de subscrições ----------
  app.post('/api/admin/companies/:id/subscription', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    const id = Number((req.params as { id: string }).id);
    const body = (req.body ?? {}) as { status?: string; plan?: string };
    const status = String(body.status ?? '');
    if (!['trialing', 'active', 'past_due', 'canceled'].includes(status)) {
      return reply.code(400).send({ error: { code: 'invalid_status', message: 'Estado inválido.' } });
    }
    // Permite (opcionalmente) definir o plano em simultâneo — gestão manual.
    const plan = body.plan != null ? normalizePlan(body.plan) : null;
    const { rowCount } = plan
      ? await pool.query('UPDATE companies SET subscription_status = $1, plan = $2 WHERE id = $3', [status, plan, id])
      : await pool.query('UPDATE companies SET subscription_status = $1 WHERE id = $2', [status, id]);
    if (!rowCount) return reply.code(404).send({ error: { code: 'not_found', message: 'Empresa não encontrada.' } });
    return { ok: true, id, status, plan };
  });

  app.get('/api/admin/companies', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.nif, c.plan, c.subscription_status, c.trial_ends_at, c.renewal_at, c.created_at,
         (SELECT count(*) FROM users u WHERE u.company_id = c.id) AS n_users,
         (SELECT count(*) FROM profiles p WHERE p.company_id = c.id) AS n_profiles,
         (SELECT count(*) FROM ai_usage_events ae WHERE ae.company_id = c.id
            AND ae.created_at >= date_trunc('month', now())) AS ai_month,
         (SELECT json_agg(json_build_object('id', u.id, 'email', u.email, 'username', u.username, 'is_admin', u.is_admin, 'terms_accepted_at', u.terms_accepted_at, 'terms_version', u.terms_version) ORDER BY u.id)
            FROM users u WHERE u.company_id = c.id) AS users
       FROM companies c ORDER BY c.created_at DESC LIMIT 500`);
    return { items: rows };
  });

  // Repor a password de um utilizador (por email ou id). Reservado a admins —
  // é a via de recuperação de acesso enquanto não há "esqueci-me da password".
  app.post('/api/admin/users/reset-password', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    const b = (req.body ?? {}) as { email?: string; user_id?: number; new_password?: string };
    const newPassword = String(b.new_password ?? '');
    if (newPassword.length < 8) {
      return reply.code(400).send({ error: { code: 'weak_password', message: 'A password deve ter pelo menos 8 caracteres.' } });
    }
    const email = String(b.email ?? '').trim().toLowerCase();
    const { rows } = b.user_id != null
      ? await pool.query('SELECT id, username FROM users WHERE id = $1', [Number(b.user_id)])
      : await pool.query('SELECT id, username FROM users WHERE lower(email) = $1 OR lower(username) = $1', [email]);
    if (rows.length === 0) return reply.code(404).send({ error: { code: 'not_found', message: 'Utilizador não encontrado.' } });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, rows[0].id]);
    return { ok: true, user_id: rows[0].id, username: rows[0].username };
  });

  // Envia um email de teste, para validar chave e remetente sem esperar por um
  // evento real. Reservado a admins.
  app.post('/api/admin/test-email', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    if (!mailEnabled()) {
      return reply.code(503).send({ error: { code: 'mail_disabled', message: 'Email não configurado (falta RESEND_API_KEY ou MAIL_FROM).' } });
    }
    const body = (req.body ?? {}) as { to?: string };
    const to = String(body.to ?? config.mail.supportEmail ?? '').trim();
    if (!to) return reply.code(400).send({ error: { code: 'no_recipient', message: 'Indique o destinatário.' } });
    const r = await sendMail({
      to,
      subject: 'BaseRadar — teste de configuração de email',
      html: layout({
        title: 'Configuração de email validada',
        body: `<p>Se está a ler isto, o envio de email do BaseRadar está a funcionar.</p>
               <p>Remetente: <strong>${esc(config.mail.from)}</strong></p>
               <p>Ficam operacionais os convites de equipa, a recuperação de password e as confirmações de pagamento.</p>`,
      }),
      text: 'Teste de configuração de email do BaseRadar — está a funcionar.',
    });
    if (!r.ok) return reply.code(502).send({ error: { code: 'send_failed', message: r.error ?? 'Falha no envio.' } });
    return { ok: true, id: r.id, from: config.mail.from, to };
  });

  // ---------- Admin: configuração assistida de pagamentos e faturação ----------
  // Mostra o que já está configurado e o que falta, sem revelar segredos.
  app.get('/api/admin/setup', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    return {
      stripe: await stripeStatus(),
      moloni: moloniStatus(),
      mail: { enabled: mailEnabled(), from: config.mail.from || null },
      app_base_url: config.appBaseUrl || null,
    };
  });

  // Cria no Stripe os produtos e preços mensais dos planos e devolve os price
  // IDs. Idempotente: correr duas vezes reaproveita o que já existe.
  app.post('/api/admin/setup/stripe-prices', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    try {
      return { ok: true, prices: await provisionPrices() };
    } catch (err) {
      return reply.code(502).send({ error: { code: 'stripe_failed', message: String(err).slice(0, 300) } });
    }
  });

  // Regista o endpoint de webhook no Stripe e devolve o segredo de assinatura.
  app.post('/api/admin/setup/stripe-webhook', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    try {
      return { ok: true, webhook: await provisionWebhook() };
    } catch (err) {
      return reply.code(502).send({ error: { code: 'stripe_failed', message: String(err).slice(0, 300) } });
    }
  });

  // Lê da conta Moloni as taxas de IVA e as séries de documentos disponíveis.
  app.post('/api/admin/setup/moloni-discover', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    try {
      return { ok: true, ...(await discoverMoloniConfig()) };
    } catch (err) {
      return reply.code(502).send({ error: { code: 'moloni_failed', message: String(err).slice(0, 300) } });
    }
  });

  // ---------- Admin: diagnóstico de armazenamento ----------
  // Onde está o espaço em disco (o Postgres é o principal custo de infraestrutura).
  // Só leitura, reservado a admins.
  app.get('/api/admin/db-stats', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });

    // Tamanho por tabela: dados, índices e TOAST (onde vivem JSONB e BYTEA grandes).
    const tables = await pool.query(
      `SELECT c.relname AS name,
              pg_total_relation_size(c.oid)                        AS total_bytes,
              pg_relation_size(c.oid)                              AS table_bytes,
              pg_indexes_size(c.oid)                               AS index_bytes,
              COALESCE(pg_total_relation_size(c.reltoastrelid), 0) AS toast_bytes,
              c.reltuples::bigint                                  AS row_estimate
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC`);

    // Peso médio das colunas JSON brutas (amostra), para estimar quanto se
    // recupera ao deixar de as guardar. pg_column_size já reflete a compressão.
    const jsonSample = await pool.query(
      `SELECT count(*)::int                                  AS sampled,
              COALESCE(avg(pg_column_size(raw_list_json)), 0)::bigint   AS avg_list_json,
              COALESCE(avg(pg_column_size(raw_detail_json)), 0)::bigint AS avg_detail_json,
              count(raw_detail_json)::int                    AS with_detail
         FROM (SELECT raw_list_json, raw_detail_json FROM contracts TABLESAMPLE SYSTEM (0.2)) s`);

    const docs = await pool.query(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE content IS NOT NULL)::int AS with_content,
              COALESCE(sum(size_bytes), 0)::bigint            AS declared_bytes
         FROM documents`);

    const contractYears = await pool.query(
      `SELECT date_part('year', publication_date)::int AS year, count(*)::int AS n
         FROM contracts WHERE publication_date IS NOT NULL
        GROUP BY 1 ORDER BY 1`);

    const dbSize = await pool.query('SELECT pg_database_size(current_database())::bigint AS bytes');

    const s = jsonSample.rows[0];
    const nContracts = Number(tables.rows.find((t) => t.name === 'contracts')?.row_estimate ?? 0);
    return {
      database_bytes: Number(dbSize.rows[0].bytes),
      tables: tables.rows.map((t) => ({
        name: t.name,
        total_bytes: Number(t.total_bytes),
        table_bytes: Number(t.table_bytes),
        index_bytes: Number(t.index_bytes),
        toast_bytes: Number(t.toast_bytes),
        row_estimate: Number(t.row_estimate),
      })),
      // Projeção: peso médio × nº de contratos = espaço recuperável ao largar a coluna.
      raw_json: {
        sampled: s.sampled,
        with_detail: s.with_detail,
        avg_list_json_bytes: Number(s.avg_list_json),
        avg_detail_json_bytes: Number(s.avg_detail_json),
        projected_list_bytes: Number(s.avg_list_json) * nContracts,
        projected_detail_bytes: Number(s.avg_detail_json) * nContracts,
      },
      documents: {
        n: docs.rows[0].n,
        with_content: docs.rows[0].with_content,
        declared_bytes: Number(docs.rows[0].declared_bytes),
      },
      contracts_by_year: contractYears.rows,
    };
  });

  // Migra os binários dos documentos da coluna BYTEA para o volume de disco.
  // Corre por lotes (idempotente e retomável): cada chamada move até `batch`
  // documentos e devolve quantos faltam. Só liberta a linha depois de o
  // ficheiro estar gravado, por isso é seguro interromper a meio.
  app.post('/api/admin/documents/migrate-to-volume', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    if (!(await storageEnabled())) {
      return reply.code(503).send({ error: { code: 'no_volume', message: 'Volume de disco indisponível — nada foi migrado.' } });
    }
    const body = (req.body ?? {}) as { batch?: number };
    const batch = Math.min(Math.max(Number(body.batch ?? 200), 1), 1000);

    const { rows } = await pool.query(
      'SELECT id, content FROM documents WHERE content IS NOT NULL ORDER BY id LIMIT $1', [batch]);

    let moved = 0, failed = 0, bytes = 0;
    for (const d of rows) {
      const buf = d.content as Buffer;
      if (await putDocument(d.id, buf)) {
        await pool.query('UPDATE documents SET content = NULL WHERE id = $1', [d.id]);
        moved++; bytes += buf.length;
      } else {
        failed++;
      }
    }
    const left = await pool.query('SELECT count(*)::int AS n FROM documents WHERE content IS NOT NULL');
    return { ok: true, moved, failed, bytes, remaining: left.rows[0].n, usage: await storageUsage() };
  });

  // Recupera espaço em disco depois de apagar dados (o Postgres só devolve o
  // espaço ao sistema com VACUUM FULL — apagar linhas apenas as marca mortas).
  // ATENÇÃO: bloqueia a tabela enquanto corre. Tabelas restritas a uma lista.
  app.post('/api/admin/db/vacuum', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    const body = (req.body ?? {}) as { table?: string };
    const table = String(body.table ?? '');
    const allowed = ['documents', 'contracts', 'contract_entities', 'entities', 'search_results'];
    if (!allowed.includes(table)) {
      return reply.code(400).send({ error: { code: 'invalid_table', message: `Tabela não permitida. Use uma de: ${allowed.join(', ')}.` } });
    }
    const sizeSql = 'SELECT pg_total_relation_size($1)::bigint AS bytes';
    const before = await pool.query(sizeSql, [table]);
    const t0 = Date.now();
    // O nome da tabela vem de uma lista fechada, por isso a interpolação é segura.
    await pool.query(`VACUUM FULL ${table}`);
    await pool.query(`ANALYZE ${table}`);
    const after = await pool.query(sizeSql, [table]);
    return {
      ok: true, table,
      before_bytes: Number(before.rows[0].bytes),
      after_bytes: Number(after.rows[0].bytes),
      freed_bytes: Number(before.rows[0].bytes) - Number(after.rows[0].bytes),
      seconds: Math.round((Date.now() - t0) / 1000),
    };
  });

  // Constrói o resumo histórico dos contratos anteriores ao ano de corte.
  // NÃO apaga nada — é a etapa reversível, executada e verificada antes de
  // qualquer remoção de dados detalhados.
  app.post('/api/admin/db/aggregate-history', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    const body = (req.body ?? {}) as { before_year?: number };
    const beforeYear = Math.min(Math.max(Number(body.before_year ?? 2019), 2013), 2026);
    const t0 = Date.now();

    // (contract_id, entity_id, role) é chave primária de contract_entities, por
    // isso cada contrato entra uma só vez em cada grupo — a soma não duplica.
    const ins = await pool.query(
      `INSERT INTO contract_history_agg (year, entity_id, role, cpv_division, district, n_contracts, total_value)
       SELECT date_part('year', c.publication_date)::int,
              ce.entity_id, ce.role,
              coalesce(substring(btrim(split_part(c.cpvs, ',', 1)) from '^[0-9]{2}'), ''),
              coalesce(NULLIF(btrim(split_part(split_part(c.execution_place, '|', 1), ',', 2)), ''), ''),
              count(*), coalesce(sum(c.initial_contractual_price), 0)
         FROM contracts c
         JOIN contract_entities ce ON ce.contract_id = c.id
        WHERE c.publication_date IS NOT NULL
          AND c.publication_date < make_date($1, 1, 1)
        GROUP BY 1, 2, 3, 4, 5
       ON CONFLICT (year, entity_id, role, cpv_division, district) DO UPDATE
         SET n_contracts = EXCLUDED.n_contracts, total_value = EXCLUDED.total_value`,
      [beforeYear]);

    const stats = await pool.query(
      `SELECT (SELECT count(*)::int FROM contract_history_agg)                       AS agg_rows,
              (SELECT pg_total_relation_size('contract_history_agg')::bigint)        AS agg_bytes,
              (SELECT count(*)::int FROM contracts
                WHERE publication_date IS NOT NULL AND publication_date < make_date($1,1,1)) AS contracts_covered`,
      [beforeYear]);

    // Verificação de fidelidade: para CADA entidade adjudicatária, o total no
    // agregado tem de bater certo com o total calculado a partir dos contratos.
    // (Comparar o somatório global não serve: contratos em consórcio creditam o
    // valor a cada membro, tal como faz a página de concorrentes.)
    const check = await pool.query(
      `WITH live AS (
         SELECT ce.entity_id, coalesce(sum(c.initial_contractual_price),0) AS v
           FROM contracts c
           JOIN contract_entities ce ON ce.contract_id = c.id AND ce.role = 'contracted'
          WHERE c.publication_date IS NOT NULL AND c.publication_date < make_date($1,1,1)
          GROUP BY ce.entity_id
       ),
       agg AS (
         SELECT entity_id, coalesce(sum(total_value),0) AS v
           FROM contract_history_agg WHERE role = 'contracted' GROUP BY entity_id
       )
       SELECT count(*)::int                                                       AS entities_checked,
              count(*) FILTER (WHERE coalesce(live.v,-1) <> coalesce(agg.v,-2))::int AS mismatches
         FROM live FULL JOIN agg ON agg.entity_id = live.entity_id`,
      [beforeYear]);
    const r = stats.rows[0], c = check.rows[0];
    return {
      ok: true, before_year: beforeYear, rows_written: ins.rowCount,
      agg_rows: r.agg_rows, agg_bytes: Number(r.agg_bytes),
      contracts_covered: r.contracts_covered,
      verification: {
        entities_checked: c.entities_checked,
        mismatches: c.mismatches,
        faithful: c.mismatches === 0,
      },
      seconds: Math.round((Date.now() - t0) / 1000),
    };
  });

  // Estado do armazenamento em volume (quantos ficheiros, que espaço).
  app.get('/api/admin/storage', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    const inDb = await pool.query(
      `SELECT count(*) FILTER (WHERE content IS NOT NULL)::int AS in_db,
              count(*) FILTER (WHERE download_ok)::int        AS downloaded,
              count(*)::int                                    AS total FROM documents`);
    return { volume: await storageUsage(), documents: inDb.rows[0] };
  });

  // ---------- Admin: estatísticas de utilização ----------
  app.get('/api/admin/stats', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    const [byPlan, byStatus, totals, split, aiByKind, aiTotals, searchesByKind, runs] = await Promise.all([
      pool.query(`SELECT plan, count(*)::int AS n FROM companies GROUP BY plan`),
      pool.query(`SELECT subscription_status AS status, count(*)::int AS n FROM companies GROUP BY subscription_status`),
      pool.query(`SELECT
          (SELECT count(*) FROM companies)::int AS companies,
          (SELECT count(*) FROM users)::int AS users,
          (SELECT count(*) FROM profiles)::int AS profiles`),
      pool.query(`SELECT
          count(*) FILTER (WHERE plan <> 'free' AND subscription_status = 'active')::int AS paying,
          count(*) FILTER (WHERE plan <> 'free' AND subscription_status = 'trialing')::int AS trialing,
          count(*) FILTER (WHERE plan = 'free' OR subscription_status IN ('canceled','past_due'))::int AS free_inactive
        FROM companies`),
      pool.query(`SELECT kind, count(*)::int AS n FROM ai_usage_events
          WHERE created_at >= date_trunc('month', now()) GROUP BY kind ORDER BY n DESC`),
      pool.query(`SELECT count(*)::int AS n_month, coalesce(sum(cost_estimate),0)::float AS cost_month,
          (SELECT count(*)::int FROM ai_usage_events) AS n_total
        FROM ai_usage_events WHERE created_at >= date_trunc('month', now())`),
      pool.query(`SELECT coalesce(kind,'contratos') AS kind, count(*)::int AS n FROM searches GROUP BY kind ORDER BY n DESC`),
      pool.query(`SELECT count(*)::int AS total,
          count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS last30 FROM profile_runs`),
    ]);
    const signups = await pool.query(
      `SELECT count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS last30,
              count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last7 FROM companies`);
    const payments = await pool.query(
      `SELECT count(*)::int AS n_month,
              coalesce(sum(amount_cents),0)::int AS cents_month,
              count(*) FILTER (WHERE moloni_status IN ('ok','draft'))::int AS invoiced,
              count(*) FILTER (WHERE moloni_status = 'error')::int AS invoice_errors
       FROM payments WHERE created_at >= date_trunc('month', now())`);
    return {
      totals: totals.rows[0],
      subscriptions: split.rows[0],
      companies_by_plan: byPlan.rows,
      companies_by_status: byStatus.rows,
      ai_usage: { by_kind: aiByKind.rows, ...aiTotals.rows[0] },
      searches_by_kind: searchesByKind.rows,
      profile_runs: runs.rows[0],
      signups: signups.rows[0],
      payments: payments.rows[0],
    };
  });

  app.get('/api/admin/feedback', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    const { rows } = await pool.query(
      `SELECT f.id, f.kind, f.message, f.email, f.handled, f.created_at,
         c.name AS company_name, u.username
       FROM feedback f
       LEFT JOIN companies c ON c.id = f.company_id
       LEFT JOIN users u ON u.id = f.user_id
       ORDER BY f.created_at DESC LIMIT 200`);
    return { items: rows };
  });

  app.post('/api/admin/feedback/:id/handled', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    const id = Number((req.params as { id: string }).id);
    const handled = (req.body as { handled?: boolean })?.handled !== false;
    const { rowCount } = await pool.query('UPDATE feedback SET handled = $1 WHERE id = $2', [handled, id]);
    if (!rowCount) return reply.code(404).send({ error: { code: 'not_found', message: 'Não encontrado.' } });
    return { ok: true, id, handled };
  });

  // ---------- Feedback / ajuda (qualquer utilizador autenticado) ----------
  app.post('/api/feedback', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId, userId, username } = auth(req);
    const b = (req.body ?? {}) as { kind?: string; message?: string; email?: string };
    const kind = b.kind === 'help' ? 'help' : 'feedback';
    const message = String(b.message ?? '').trim();
    if (message.length < 3) return reply.code(400).send({ error: { code: 'empty', message: 'Escreva a sua mensagem.' } });
    const email = String(b.email ?? '').trim() || username || null;
    const { rows } = await pool.query(
      `INSERT INTO feedback (company_id, user_id, kind, message, email) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [companyId, userId, kind, message.slice(0, 4000), email]);
    // Envio por email para o suporte: a implementar. Por agora fica sempre o
    // registo interno; se SUPPORT_EMAIL estiver definido, deixamos o rasto no log.
    if (config.supportEmail) {
      console.log(`[feedback] #${rows[0].id} (${kind}) de ${email ?? 'n/d'} → notificar ${config.supportEmail}`);
    }
    return reply.code(201).send({ ok: true, id: rows[0].id });
  });
}
