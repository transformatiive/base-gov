import { createHmac, timingSafeEqual } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { pool } from './db.js';
import { config } from './config.js';
import { requireAuth, auth } from './auth.js';
import { sendMail, layout, esc, fmtDatePT } from './mail.js';
import { digestData, digestIsEmpty, type DigestData } from './digest.js';

function signUnsubscribe(userId: number, kind: 'digest' | 'reminders', version: number): string {
  const payload = `${userId}|${kind}|${version}`;
  const mac = createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');
  return Buffer.from(JSON.stringify({ u: userId, k: kind, v: version, m: mac })).toString('base64url');
}

function verifyUnsubscribe(token: string): { userId: number; kind: 'digest' | 'reminders'; version: number } | null {
  try {
    const raw = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as { u: number; k: string; v: number; m: string };
    if (raw.k !== 'digest' && raw.k !== 'reminders') return null;
    const payload = `${raw.u}|${raw.k}|${raw.v}`;
    const mac = createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');
    const a = Buffer.from(mac);
    const b = Buffer.from(String(raw.m));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { userId: raw.u, kind: raw.k, version: raw.v };
  } catch {
    return null;
  }
}

export function unsubscribeUrl(userId: number, kind: 'digest' | 'reminders', version: number): string {
  const base = config.appBaseUrl || '';
  return `${base}/api/notifications/unsubscribe?t=${signUnsubscribe(userId, kind, version)}`;
}

export function isoWeekRef(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const date = new Date(Date.UTC(y, m - 1, day));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function lisbonNow(d = new Date()): { weekday: number; hour: number; ymd: string } {
  const weekdayName = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', weekday: 'short' }).format(d);
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', hourCycle: 'h23' }).format(d)
  );
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  return { weekday: map[weekdayName] ?? 0, hour, ymd };
}

export async function claimNotification(kind: string, userId: number, ref: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO notification_log (kind, user_id, ref, status) VALUES ($1,$2,$3,'pending')
     ON CONFLICT (kind, user_id, ref) DO NOTHING`,
    [kind, userId, ref]
  );
  return (rowCount ?? 0) > 0;
}

export async function markNotification(
  kind: string, userId: number, ref: string, ok: boolean, providerId?: string, error?: string
): Promise<void> {
  if (ok) {
    await pool.query(
      `UPDATE notification_log SET status = 'sent', provider_id = $4, sent_at = now(), error = NULL
        WHERE kind = $1 AND user_id = $2 AND ref = $3`,
      [kind, userId, ref, providerId ?? null]
    );
  } else {
    await pool.query(
      `UPDATE notification_log SET status = 'failed', error = $4, attempts = attempts + 1
        WHERE kind = $1 AND user_id = $2 AND ref = $3`,
      [kind, userId, ref, (error ?? 'erro').slice(0, 500)]
    );
  }
}

export async function renderDigestEmail(
  profileName: string,
  d: DigestData,
  optOutUrl: string
): Promise<{ subject: string; html: string; text: string }> {
  const today = fmtDatePT(new Date());
  const subject = `BaseRadar — Resumo semanal · ${profileName} · ${today}`;
  const empty = digestIsEmpty(d);
  const fmtEur = (v: unknown) =>
    v == null ? '—' : Number(v).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  const openRows = d.openAnns.slice(0, 10).map((a) =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #e6e8e6">${esc(fmtDatePT(a.proposal_deadline_date))}</td>
         <td style="padding:6px 8px;border-bottom:1px solid #e6e8e6">${esc(String(a.contract_designation ?? '').slice(0, 90))}</td>
         <td style="padding:6px 8px;border-bottom:1px solid #e6e8e6">${esc(a.contracting_entity)}</td>
         <td style="padding:6px 8px;border-bottom:1px solid #e6e8e6">${esc(fmtEur(a.base_price))}</td></tr>`
  ).join('');
  const renRows = d.renewals.map((r) =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #e6e8e6">${esc(fmtDatePT(r.end_date))} (${esc(r.days_left)}d)</td>
         <td style="padding:6px 8px;border-bottom:1px solid #e6e8e6">${esc(r.contracting)}</td>
         <td style="padding:6px 8px;border-bottom:1px solid #e6e8e6">${esc(String(r.object_brief_description ?? '').slice(0, 80))}</td>
         <td style="padding:6px 8px;border-bottom:1px solid #e6e8e6">${esc(fmtEur(r.initial_contractual_price))}</td></tr>`
  ).join('');

  const body = empty
    ? `<p><strong>Semana sem novidades na sua atividade</strong> — 0 concursos novos, 0 abertos, 0 renovações a 90 dias. O radar está a vigiar.</p>`
    : `<p>Novos (7 dias): <strong>${d.newAnns.length}</strong> · Abertos: <strong>${d.openAnns.length}</strong> · Renovações 90 dias: <strong>${d.renewals.length}</strong></p>
       ${d.openAnns.length ? `<h3>Concursos com prazo a decorrer</h3>
         <table width="100%" cellpadding="0" cellspacing="0">${openRows}</table>` : ''}
       ${d.renewals.length ? `<h3>Renovações a preparar</h3>
         <table width="100%" cellpadding="0" cellspacing="0">${renRows}</table>` : ''}`;

  const html = layout({
    title: `Resumo semanal · ${esc(profileName)}`,
    body,
    cta: { label: 'Abrir a mesa de concursos', url: `${config.appBaseUrl || ''}/app#/hoje` },
    footnote: `<a href="${optOutUrl}">Deixar de receber o digest</a>`,
  });
  return {
    subject,
    html,
    text: `Digest BaseRadar — ${profileName}. ${empty ? 'Semana sem novidades na sua atividade.' : `${d.openAnns.length} concursos abertos.`}`,
  };
}

export async function renderReminderEmail(
  kind: 'reminder7' | 'reminder2',
  items: { title: string; deadline: unknown; assignee?: string | null; progress?: string | null }[],
  optOutUrl: string
): Promise<{ subject: string; html: string; text: string }> {
  const n = items.length;
  const days = kind === 'reminder7' ? 7 : 2;
  const subject = n === 1 ? `1 prazo daqui a ${days} dias` : `${n} prazos daqui a ${days} dias`;
  const rows = items.map((it) =>
    `<li><strong>${esc(it.title)}</strong> — ${esc(fmtDatePT(it.deadline))}${it.assignee ? ` · ${esc(it.assignee)}` : ''}${it.progress ? ` · ${esc(it.progress)}` : ''}</li>`
  ).join('');
  const html = layout({
    title: subject,
    body: `<p>Oportunidades em Interessa ou Em preparação com prazo próximo:</p><ul>${rows}</ul>`,
    cta: { label: 'Abrir o pipeline', url: `${config.appBaseUrl || ''}/app#/pipeline` },
    footnote: `<a href="${optOutUrl}">Deixar de receber lembretes</a>`,
  });
  return { subject: `BaseRadar — ${subject}`, html, text: subject };
}

export { digestData };

export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/me/notifications', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = auth(req);
    if (userId == null) return reply.code(400).send({ error: { code: 'no_user', message: 'Sem utilizador.' } });
    const { rows } = await pool.query(
      'SELECT notify_digest, notify_reminders FROM users WHERE id = $1',
      [userId]
    );
    return {
      notify_digest: rows[0]?.notify_digest !== false,
      notify_reminders: rows[0]?.notify_reminders !== false,
    };
  });

  app.put('/api/me/notifications', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = auth(req);
    if (userId == null) return reply.code(400).send({ error: { code: 'no_user', message: 'Sem utilizador.' } });
    const b = (req.body ?? {}) as { notify_digest?: boolean; notify_reminders?: boolean };
    const { rows: cur } = await pool.query(
      'SELECT notify_digest, notify_reminders FROM users WHERE id = $1', [userId]);
    const digest = b.notify_digest ?? cur[0]?.notify_digest ?? true;
    const reminders = b.notify_reminders ?? cur[0]?.notify_reminders ?? true;
    const bump = (digest && cur[0] && cur[0].notify_digest === false) ||
      (reminders && cur[0] && cur[0].notify_reminders === false);
    await pool.query(
      `UPDATE users SET notify_digest = $2, notify_reminders = $3,
              notify_version = notify_version + CASE WHEN $4 THEN 1 ELSE 0 END
        WHERE id = $1`,
      [userId, digest, reminders, bump]
    );
    return { notify_digest: digest, notify_reminders: reminders };
  });

  app.get('/api/notifications/unsubscribe', async (req, reply) => {
    const t = String((req.query as { t?: string }).t ?? '');
    const parsed = verifyUnsubscribe(t);
    const htmlFail = (msg: string) => {
      reply.header('Content-Type', 'text/html; charset=utf-8');
      return reply.send(`<!doctype html><html lang="pt"><meta charset="utf-8"><title>BaseRadar</title>
        <body style="font-family:sans-serif;padding:40px;max-width:480px"><p>${esc(msg)}</p>
        <p><a href="${esc(config.appBaseUrl || '/')}/app#/login">Entrar</a></p></body></html>`);
    };
    if (!parsed) return htmlFail('Ligação inválida ou expirada.');
    const { rows } = await pool.query('SELECT notify_version FROM users WHERE id = $1', [parsed.userId]);
    if (!rows.length || Number(rows[0].notify_version) !== parsed.version) {
      return htmlFail('Esta ligação já não é válida. Entre na conta para gerir as notificações.');
    }
    if (parsed.kind === 'digest') {
      await pool.query('UPDATE users SET notify_digest = false WHERE id = $1', [parsed.userId]);
    } else {
      await pool.query('UPDATE users SET notify_reminders = false WHERE id = $1', [parsed.userId]);
    }
    reply.header('Content-Type', 'text/html; charset=utf-8');
    const login = `${config.appBaseUrl || ''}/app#/login`;
    return reply.send(`<!doctype html><html lang="pt"><meta charset="utf-8"><title>BaseRadar</title>
      <body style="font-family:sans-serif;padding:40px;max-width:520px">
        <h1 style="font-size:1.2rem">Preferência actualizada</h1>
        <p>Deixou de receber ${parsed.kind === 'digest' ? 'o digest semanal' : 'os lembretes de prazo'}.</p>
        <p><a href="${esc(login)}">Voltar a ligar (exige início de sessão)</a></p>
      </body></html>`);
  });

  app.get('/api/admin/notifications', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    const { rows } = await pool.query(
      `SELECT n.*, u.email, u.username
         FROM notification_log n LEFT JOIN users u ON u.id = n.user_id
        ORDER BY n.created_at DESC LIMIT 200`
    );
    return { items: rows };
  });

  app.post('/api/admin/notifications/run', { preHandler: requireAuth }, async (req, reply) => {
    if (!auth(req).isAdmin) return reply.code(403).send({ error: { code: 'forbidden', message: 'Reservado a administradores.' } });
    // Import dinâmico para evitar ciclo notifications ↔ scheduler.
    const { runSchedulerTick } = await import('./scheduler.js');
    const body = (req.body ?? {}) as { now?: string };
    const now = body.now ? new Date(body.now) : new Date();
    const result = await runSchedulerTick(now);
    return { ok: true, ...result };
  });
}
