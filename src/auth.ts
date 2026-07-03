import { FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { config } from './config.js';

export const SESSION_COOKIE = 'basegov_session';

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE username = $1', [username]);
  if (rows.length === 0) return false;
  return bcrypt.compare(password, rows[0].password_hash);
}

async function checkBasicAuth(header: string): Promise<string | null> {
  const [scheme, encoded] = header.split(' ');
  if (scheme?.toLowerCase() !== 'basic' || !encoded) return null;
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const sep = decoded.indexOf(':');
  if (sep < 0) return null;
  const username = decoded.slice(0, sep);
  const password = decoded.slice(sep + 1);
  return (await verifyCredentials(username, password)) ? username : null;
}

/** Aceita: cookie de sessão assinado (UI), X-API-Key (integrações) ou HTTP Basic. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const raw = req.cookies[SESSION_COOKIE];
  if (raw) {
    const unsigned = req.unsignCookie(raw);
    if (unsigned.valid && unsigned.value) {
      (req as FastifyRequest & { username?: string }).username = unsigned.value;
      return;
    }
  }

  const apiKey = req.headers['x-api-key'];
  if (config.appApiKey && typeof apiKey === 'string' && apiKey === config.appApiKey) {
    (req as FastifyRequest & { username?: string }).username = 'api-key';
    return;
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string') {
    const user = await checkBasicAuth(authHeader);
    if (user) {
      (req as FastifyRequest & { username?: string }).username = user;
      return;
    }
  }

  reply.code(401).send({ error: { code: 'unauthorized', message: 'Autenticação necessária' } });
}
