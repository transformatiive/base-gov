import { FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { config } from './config.js';
import { effectivePlan, Plan } from './plans.js';

export const SESSION_COOKIE = 'basegov_session';

export interface AuthUser {
  userId: number | null;
  username: string;
  companyId: number | null;   // null = acesso global (chave de API / integrações)
  isAdmin: boolean;
  accessOk: boolean;          // subscrição ativa ou trial a decorrer
  plan: Plan;                 // plano efetivo (free|pro|business) — fonte de gating
}

type AuthedRequest = FastifyRequest & { auth?: AuthUser };

// SQL: a conta tem acesso se a subscrição está ativa OU o trial ainda não terminou.
const ACCESS_OK_SQL = `(c.subscription_status = 'active'
  OR (c.subscription_status = 'trialing' AND (c.trial_ends_at IS NULL OR c.trial_ends_at > now())))`;

const USER_COLS = `u.id, u.username, u.company_id, u.is_admin,
  c.plan, c.subscription_status, c.trial_ends_at,
  COALESCE(${ACCESS_OK_SQL}, true) AS access_ok`;
const USER_FROM = `FROM users u LEFT JOIN companies c ON c.id = u.company_id`;

function toUser(row: Record<string, unknown>): AuthUser {
  return {
    userId: row.id as number,
    username: row.username as string,
    companyId: (row.company_id as number) ?? null,
    isAdmin: row.is_admin === true,
    accessOk: row.access_ok !== false,
    // Plano efetivo resolvido no backend — fonte única de verdade do gating.
    plan: effectivePlan({
      plan: row.plan,
      subscription_status: row.subscription_status,
      trial_ends_at: row.trial_ends_at,
    }),
  };
}

/** Devolve o utilizador (por username OU email) se as credenciais baterem certo. */
export async function verifyCredentials(identifier: string, password: string): Promise<AuthUser | null> {
  const { rows } = await pool.query(
    `SELECT ${USER_COLS}, u.password_hash ${USER_FROM}
     WHERE u.username = $1 OR lower(u.email) = lower($1) LIMIT 1`,
    [identifier]
  );
  if (rows.length === 0) return null;
  if (!(await bcrypt.compare(password, rows[0].password_hash))) return null;
  return toUser(rows[0]);
}

/** Carrega o utilizador da sessão (cookie guarda o username) com a sua empresa. */
async function loadByUsername(username: string): Promise<AuthUser | null> {
  const { rows } = await pool.query(`SELECT ${USER_COLS} ${USER_FROM} WHERE u.username = $1`, [username]);
  return rows.length ? toUser(rows[0]) : null;
}

async function checkBasicAuth(header: string): Promise<AuthUser | null> {
  const [scheme, encoded] = header.split(' ');
  if (scheme?.toLowerCase() !== 'basic' || !encoded) return null;
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const sep = decoded.indexOf(':');
  if (sep < 0) return null;
  return verifyCredentials(decoded.slice(0, sep), decoded.slice(sep + 1));
}

/** Aceita: cookie de sessão assinado (UI), X-API-Key (integrações) ou HTTP Basic. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  let user: AuthUser | null = null;

  const raw = req.cookies[SESSION_COOKIE];
  if (raw) {
    const unsigned = req.unsignCookie(raw);
    if (unsigned.valid && unsigned.value) user = await loadByUsername(unsigned.value);
  }

  if (!user) {
    const apiKey = req.headers['x-api-key'];
    if (config.appApiKey && typeof apiKey === 'string' && apiKey === config.appApiKey) {
      // Integrações têm acesso global (sem empresa) — para uso interno/administrativo.
      user = { userId: null, username: 'api-key', companyId: null, isAdmin: true, accessOk: true, plan: 'business' };
    }
  }

  if (!user) {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string') user = await checkBasicAuth(authHeader);
  }

  if (!user) {
    reply.code(401).send({ error: { code: 'unauthorized', message: 'Autenticação necessária' } });
    return;
  }

  (req as AuthedRequest).auth = user;

  // O acesso depende do PLANO, não de um estado ativo/inativo único (R10):
  // toda a conta autenticada tem o plano free como base; as features Pro/Business
  // são bloqueadas com 403 por requirePlan() nas rotas respetivas. Sem 402 global.
}

/** Contexto autenticado do pedido (após requireAuth). */
export function auth(req: FastifyRequest): AuthUser {
  const a = (req as AuthedRequest).auth;
  if (!a) throw new Error('auth() chamado sem requireAuth');
  return a;
}

/**
 * Cláusula SQL de isolamento por empresa. Empresas normais só veem as suas
 * linhas; acesso global (api-key) não filtra. `col` é a coluna company_id
 * qualificada (ex.: 'p.company_id'). Devolve o SQL e o parâmetro a juntar.
 */
export function companyFilter(req: FastifyRequest, col: string, params: unknown[]): string {
  const { companyId } = auth(req);
  if (companyId == null) return '';           // acesso global
  params.push(companyId);
  return `${col} = $${params.length}`;
}
