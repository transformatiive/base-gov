import { FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { config } from './config.js';

export const SESSION_COOKIE = 'basegov_session';

export interface AuthUser {
  userId: number | null;
  username: string;
  companyId: number | null;   // null = acesso global (chave de API / integrações)
  isAdmin: boolean;
}

type AuthedRequest = FastifyRequest & { auth?: AuthUser };

/** Devolve o utilizador (por username OU email) se as credenciais baterem certo. */
export async function verifyCredentials(identifier: string, password: string): Promise<AuthUser | null> {
  const { rows } = await pool.query(
    `SELECT id, username, password_hash, company_id, is_admin
     FROM users WHERE username = $1 OR lower(email) = lower($1) LIMIT 1`,
    [identifier]
  );
  if (rows.length === 0) return null;
  if (!(await bcrypt.compare(password, rows[0].password_hash))) return null;
  return {
    userId: rows[0].id,
    username: rows[0].username,
    companyId: rows[0].company_id ?? null,
    isAdmin: rows[0].is_admin === true,
  };
}

/** Carrega o utilizador da sessão (cookie guarda o username) com a sua empresa. */
async function loadByUsername(username: string): Promise<AuthUser | null> {
  const { rows } = await pool.query(
    `SELECT id, username, company_id, is_admin FROM users WHERE username = $1`,
    [username]
  );
  if (rows.length === 0) return null;
  return {
    userId: rows[0].id,
    username: rows[0].username,
    companyId: rows[0].company_id ?? null,
    isAdmin: rows[0].is_admin === true,
  };
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
  const raw = req.cookies[SESSION_COOKIE];
  if (raw) {
    const unsigned = req.unsignCookie(raw);
    if (unsigned.valid && unsigned.value) {
      const user = await loadByUsername(unsigned.value);
      if (user) { (req as AuthedRequest).auth = user; return; }
    }
  }

  const apiKey = req.headers['x-api-key'];
  if (config.appApiKey && typeof apiKey === 'string' && apiKey === config.appApiKey) {
    // Integrações têm acesso global (sem empresa) — para uso interno/administrativo.
    (req as AuthedRequest).auth = { userId: null, username: 'api-key', companyId: null, isAdmin: true };
    return;
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string') {
    const user = await checkBasicAuth(authHeader);
    if (user) { (req as AuthedRequest).auth = user; return; }
  }

  reply.code(401).send({ error: { code: 'unauthorized', message: 'Autenticação necessária' } });
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
