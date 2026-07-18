import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { SESSION_COOKIE, requireAuth, auth } from './auth.js';
import { seatLimit, effectivePlan } from './plans.js';

/**
 * Seats (multi-utilizador por empresa) — R8 da spec de planos.
 *  - cada empresa pode ter utilizadores até ao limite do seu plano
 *    (free:1, pro:2, business:10);
 *  - convite acima do limite é recusado (403);
 *  - isolamento total por empresa: um utilizador só vê/gere a SUA empresa.
 * O limite é a fonte da restrição — o plano free (limite 1) não consegue
 * convidar ninguém, pelo que a gestão de equipa fica naturalmente reservada
 * aos planos pagos.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lugares ocupados = utilizadores + convites pendentes. */
async function seatsUsed(companyId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*) FROM users WHERE company_id = $1)
          + (SELECT count(*) FROM company_invites WHERE company_id = $1 AND accepted_at IS NULL) AS n`,
    [companyId]
  );
  return Number(rows[0]?.n ?? 0);
}

export async function registerSeatRoutes(app: FastifyInstance): Promise<void> {
  // Membros da equipa + convites pendentes + limite do plano.
  app.get('/api/seats', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId, plan } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    const { rows: members } = await pool.query(
      `SELECT id, username, email, first_name, last_name, is_admin, created_at
       FROM users WHERE company_id = $1 ORDER BY created_at`, [companyId]);
    const { rows: invites } = await pool.query(
      `SELECT id, email, created_at FROM company_invites
       WHERE company_id = $1 AND accepted_at IS NULL ORDER BY created_at`, [companyId]);
    return {
      members,
      invites,
      seats: { used: members.length + invites.length, max: seatLimit(plan) },
    };
  });

  // Convidar um utilizador para a empresa (dentro do limite do plano).
  app.post('/api/seats/invite', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId, plan, userId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    const email = String((req.body as { email?: string })?.email ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return reply.code(400).send({ error: { code: 'invalid_email', message: 'Email inválido.' } });

    const max = seatLimit(plan);
    if (await seatsUsed(companyId) >= max) {
      return reply.code(403).send({
        error: {
          code: 'seat_limit',
          message: `O plano ${plan.toUpperCase()} permite ${max} utilizador(es). Faça upgrade para adicionar mais.`,
          seats_max: max,
        },
      });
    }
    // Não convidar quem já é utilizador (em qualquer empresa) nem duplicar convite.
    const { rows: existsUser } = await pool.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
    if (existsUser.length) return reply.code(409).send({ error: { code: 'email_taken', message: 'Este email já tem conta.' } });

    const token = crypto.randomBytes(24).toString('base64url');
    try {
      await pool.query(
        `INSERT INTO company_invites (company_id, email, token, invited_by) VALUES ($1, $2, $3, $4)`,
        [companyId, email, token, userId]);
    } catch (err) {
      if (String(err).includes('duplicate key')) {
        return reply.code(409).send({ error: { code: 'invite_exists', message: 'Já existe um convite pendente para este email.' } });
      }
      throw err;
    }
    // O envio do email está fora do âmbito; devolvemos a hiperligação de aceitação.
    return reply.code(201).send({ ok: true, email, token, accept_url: `/app#/aceitar-convite?token=${token}` });
  });

  // Remover um membro da equipa (isolado à própria empresa; não remove o último).
  app.delete('/api/seats/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    const targetId = Number((req.params as { userId: string }).userId);
    const { rows: members } = await pool.query('SELECT id FROM users WHERE company_id = $1', [companyId]);
    if (!members.some((m) => m.id === targetId)) {
      return reply.code(404).send({ error: { code: 'not_found', message: 'Utilizador não encontrado nesta empresa.' } });
    }
    if (members.length <= 1) {
      return reply.code(409).send({ error: { code: 'last_member', message: 'Não é possível remover o único utilizador da empresa.' } });
    }
    await pool.query('DELETE FROM users WHERE id = $1 AND company_id = $2', [targetId, companyId]);
    return { ok: true, removed: targetId };
  });

  // Cancelar um convite pendente.
  app.delete('/api/seats/invites/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    const id = Number((req.params as { id: string }).id);
    const { rowCount } = await pool.query(
      'DELETE FROM company_invites WHERE id = $1 AND company_id = $2 AND accepted_at IS NULL', [id, companyId]);
    if (!rowCount) return reply.code(404).send({ error: { code: 'not_found', message: 'Convite não encontrado.' } });
    return { ok: true };
  });

  // Detalhe público de um convite (para o ecrã de aceitação mostrar a empresa).
  app.get('/api/public/invite/:token', async (req, reply) => {
    const token = String((req.params as { token: string }).token);
    const { rows } = await pool.query(
      `SELECT ci.email, ci.accepted_at, c.name AS company_name
       FROM company_invites ci JOIN companies c ON c.id = ci.company_id
       WHERE ci.token = $1`, [token]);
    if (rows.length === 0) return reply.code(404).send({ error: { code: 'not_found', message: 'Convite inválido.' } });
    if (rows[0].accepted_at) return reply.code(409).send({ error: { code: 'already_accepted', message: 'Este convite já foi utilizado.' } });
    return { email: rows[0].email, company_name: rows[0].company_name };
  });

  // Aceitar um convite: cria o utilizador na empresa (público — o utilizador ainda não existe).
  app.post('/api/public/invite/accept', async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const token = String(b.token ?? '');
    const password = String(b.password ?? '');
    const firstName = String(b.first_name ?? '').trim();
    const lastName = String(b.last_name ?? '').trim() || null;
    const phone = String(b.phone ?? '').trim() || null;
    if (!token) return reply.code(400).send({ error: { code: 'invalid', message: 'Convite em falta.' } });
    if (password.length < 8) return reply.code(400).send({ error: { code: 'weak_password', message: 'A password deve ter pelo menos 8 caracteres.' } });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Bloqueia a linha do convite para validar o limite sem corridas.
      const { rows } = await client.query(
        `SELECT ci.id, ci.company_id, ci.email, ci.accepted_at, c.plan, c.subscription_status, c.trial_ends_at
         FROM company_invites ci JOIN companies c ON c.id = ci.company_id
         WHERE ci.token = $1 FOR UPDATE OF ci`, [token]);
      if (rows.length === 0) { await client.query('ROLLBACK'); return reply.code(404).send({ error: { code: 'not_found', message: 'Convite inválido.' } }); }
      const inv = rows[0];
      if (inv.accepted_at) { await client.query('ROLLBACK'); return reply.code(409).send({ error: { code: 'already_accepted', message: 'Este convite já foi utilizado.' } }); }

      const { rows: dup } = await client.query('SELECT 1 FROM users WHERE lower(email) = $1', [inv.email]);
      if (dup.length) { await client.query('ROLLBACK'); return reply.code(409).send({ error: { code: 'email_taken', message: 'Este email já tem conta.' } }); }

      // Revalida o limite no momento da aceitação (o plano pode ter mudado entretanto).
      const effPlan = effectivePlan({ plan: inv.plan, subscription_status: inv.subscription_status, trial_ends_at: inv.trial_ends_at });
      const { rows: cnt } = await client.query('SELECT count(*)::int AS n FROM users WHERE company_id = $1', [inv.company_id]);
      if (Number(cnt[0].n) >= seatLimit(effPlan)) {
        await client.query('ROLLBACK');
        return reply.code(403).send({ error: { code: 'seat_limit', message: 'A empresa atingiu o limite de utilizadores do plano.' } });
      }

      const hash = await bcrypt.hash(password, 10);
      await client.query(
        `INSERT INTO users (username, email, password_hash, company_id, first_name, last_name, phone)
         VALUES ($1, $1, $2, $3, $4, $5, $6)`,
        [inv.email, hash, inv.company_id, firstName || null, lastName, phone]);
      await client.query('UPDATE company_invites SET accepted_at = now() WHERE id = $1', [inv.id]);
      await client.query('COMMIT');

      reply.setCookie(SESSION_COOKIE, inv.email, {
        path: '/', httpOnly: true, sameSite: 'lax', signed: true, maxAge: 60 * 60 * 24 * 7,
      });
      return reply.code(201).send({ ok: true, username: inv.email });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });
}
