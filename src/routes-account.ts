import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { config } from './config.js';
import { SESSION_COOKIE, requireAuth, auth } from './auth.js';
import { createProfileRun } from './profiles.js';
import { normalize } from './cpv.js';
import { billingConfigured, createSubscription, applyWebhook } from './billing.js';

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
      const { rows: [company] } = await client.query(
        `INSERT INTO companies (name, nif, subscription_status, trial_ends_at)
         VALUES ($1, $2, 'trialing', now() + ($3 || ' days')::interval) RETURNING id`,
        [companyName, nif, String(config.trialDays)]
      );
      const hash = await bcrypt.hash(password, 10);
      await client.query(
        `INSERT INTO users (username, email, password_hash, company_id, first_name, last_name, phone)
         VALUES ($1, $1, $2, $3, $4, $5, $6)`,
        [email, hash, company.id, firstName, lastName || null, phone]
      );
      // Perfil inicial pré-configurado com a atividade escolhida.
      const profileTerms = terms.length ? terms : [companyName];
      const { rows: [profile] } = await client.query(
        `INSERT INTO profiles (name, terms, cpv_codes, schedule, include_announcements, company_id)
         VALUES ($1, $2, $3, 'weekly', true, $4) RETURNING id`,
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

  // ---------- Faturação ----------
  app.get('/api/billing/summary', { preHandler: requireAuth }, async (req) => {
    const { companyId } = auth(req);
    const priceEur = (config.planPriceCents / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2 });
    let company = null;
    if (companyId != null) {
      const { rows } = await pool.query(
        `SELECT name, nif, subscription_status, trial_ends_at,
           CASE WHEN subscription_status = 'trialing' AND trial_ends_at IS NOT NULL
                THEN GREATEST(0, ceil(extract(epoch FROM (trial_ends_at - now())) / 86400)::int) END AS trial_days_left
         FROM companies WHERE id = $1`, [companyId]);
      company = rows[0] ?? null;
    }
    return {
      plan: config.planName,
      price: `${priceEur} € + IVA / mês`,
      price_cents: config.planPriceCents,
      billing_enabled: billingConfigured(),
      methods: ['mb', 'mbw', 'cc'],
      company,
    };
  });

  app.post('/api/billing/checkout', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId, username } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    if (!billingConfigured()) {
      return reply.code(503).send({ error: { code: 'billing_disabled', message: 'Pagamentos ainda não configurados. Contacte o suporte.' } });
    }
    const method = String((req.body as { method?: string })?.method ?? 'mb');
    if (!['mb', 'mbw', 'cc', 'dd'].includes(method)) {
      return reply.code(400).send({ error: { code: 'invalid_method', message: 'Método de pagamento inválido.' } });
    }
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.nif, u.first_name, u.last_name, u.email, u.phone
       FROM companies c JOIN users u ON u.company_id = c.id AND u.username = $1 WHERE c.id = $2`,
      [username, companyId]);
    if (rows.length === 0) return reply.code(404).send({ error: { code: 'not_found', message: 'Empresa não encontrada.' } });
    const r = rows[0];
    try {
      const result = await createSubscription(
        { id: r.id, name: r.name, nif: r.nif },
        { name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.email, email: r.email, phone: r.phone },
        method);
      return { ok: true, method: result.method, payment: result.payment, subscription_id: result.id };
    } catch (err) {
      return reply.code(502).send({ error: { code: 'billing_failed', message: String(err).slice(0, 300) } });
    }
  });

  // Webhook do Easypay (público — validado por segredo partilhado se configurado).
  app.post('/api/billing/webhook', async (req, reply) => {
    if (config.easypay.webhookSecret) {
      const sig = req.headers['x-easypay-signature'] ?? (req.query as Record<string, unknown>)?.secret;
      if (sig !== config.easypay.webhookSecret) return reply.code(401).send({ ok: false });
    }
    try {
      const result = await applyWebhook((req.body ?? {}) as Record<string, unknown>);
      return reply.code(200).send(result);
    } catch (err) {
      console.error('[billing] webhook erro:', err);
      return reply.code(200).send({ ok: false });   // 200 para o Easypay não repetir indefinidamente
    }
  });

  // ---------- Admin: gestão manual de subscrições ----------
  app.post('/api/admin/companies/:id/subscription', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    const id = Number((req.params as { id: string }).id);
    const status = String((req.body as { status?: string })?.status ?? '');
    if (!['trialing', 'active', 'past_due', 'canceled'].includes(status)) {
      return reply.code(400).send({ error: { code: 'invalid_status', message: 'Estado inválido.' } });
    }
    const { rowCount } = await pool.query('UPDATE companies SET subscription_status = $1 WHERE id = $2', [status, id]);
    if (!rowCount) return reply.code(404).send({ error: { code: 'not_found', message: 'Empresa não encontrada.' } });
    return { ok: true, id, status };
  });

  app.get('/api/admin/companies', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.nif, c.subscription_status, c.trial_ends_at, c.created_at,
         (SELECT count(*) FROM users u WHERE u.company_id = c.id) AS n_users,
         (SELECT count(*) FROM profiles p WHERE p.company_id = c.id) AS n_profiles
       FROM companies c ORDER BY c.created_at DESC LIMIT 500`);
    return { items: rows };
  });
}
