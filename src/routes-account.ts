import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { config } from './config.js';
import { SESSION_COOKIE, requireAuth, auth } from './auth.js';
import { createProfileRun } from './profiles.js';
import { normalize } from './cpv.js';
import { stripeConfigured, createCheckout, verifyStripeSignature, handleStripeEvent, grossCents } from './stripe.js';
import { normalizePlan, Plan } from './plans.js';

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
           CASE WHEN subscription_status = 'trialing' AND trial_ends_at IS NOT NULL
                THEN GREATEST(0, ceil(extract(epoch FROM (trial_ends_at - now())) / 86400)::int) END AS trial_days_left
         FROM companies WHERE id = $1`, [companyId]);
      company = rows[0] ?? null;
    }
    return {
      plan,   // plano efetivo
      plan_name: config.planName,
      price: `${priceEur} € (c/ IVA) / mês`,
      billing_enabled: stripeConfigured(),
      company,
    };
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
    if (!verifyStripeSignature(rawBody, sig)) {
      return reply.code(401).send({ ok: false, error: 'invalid_signature' });
    }
    try {
      const event = JSON.parse(rawBody) as Record<string, unknown>;
      const result = await handleStripeEvent(event);
      return reply.code(200).send(result);
    } catch (err) {
      console.error('[stripe] webhook erro:', err);
      return reply.code(200).send({ ok: false });   // 200 para o Stripe não repetir indefinidamente
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
         (SELECT json_agg(json_build_object('id', u.id, 'email', u.email, 'username', u.username, 'is_admin', u.is_admin) ORDER BY u.id)
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
