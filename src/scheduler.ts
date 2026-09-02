import { checklistForItem, type ItemType } from './pipeline.js';
import { pool } from './db.js';
import { config } from './config.js';
import { sendMail } from './mail.js';
import { hasCapability, effectivePlan } from './plans.js';
import {
  claimNotification, markNotification, isoWeekRef, lisbonNow,
  unsubscribeUrl, renderDigestEmail, renderReminderEmail, digestData,
} from './notifications.js';
const END_DATE = `(c.signing_date + (substring(c.execution_deadline from '(\\d+)')::int))`;

export async function runSchedulerTick(now = new Date()): Promise<{
  hour: number; digests: number; reminders: number; retries: number;
}> {
  const { weekday, hour, ymd } = lisbonNow(now);
  const digestHour = config.digestHour;
  if (hour !== digestHour) {
    const retries = await retryFailed();
    return { hour, digests: 0, reminders: 0, retries };
  }

  let digests = 0;
  if (weekday === 1) {
    digests = await dueDigests(now);
  }
  const reminders = await dueReminders(ymd);
  const retries = await retryFailed();
  return { hour, digests, reminders, retries };
}

async function dueDigests(now: Date): Promise<number> {
  const week = isoWeekRef(now);
  const { rows: pairs } = await pool.query(
    `SELECT p.id AS profile_id, p.name AS profile_name, u.id AS user_id, u.email, u.notify_version
       FROM profiles p
       JOIN users u ON u.company_id = p.company_id
      WHERE u.email IS NOT NULL AND u.notify_digest IS NOT FALSE`
  );
  let sent = 0;
  for (const row of pairs) {
    const ref = `profile:${row.profile_id}:${week}`;
    const claimed = await claimNotification('digest', row.user_id, ref);
    if (!claimed) continue;
    try {
      const data = await digestData(row.profile_id);
      if (!data) {
        await markNotification('digest', row.user_id, ref, false, undefined, 'perfil em falta');
        continue;
      }
      const opt = unsubscribeUrl(row.user_id, 'digest', Number(row.notify_version ?? 1));
      const mail = await renderDigestEmail(row.profile_name, data, opt);
      const r = await sendMail({ to: row.email, subject: mail.subject, html: mail.html, text: mail.text });
      await markNotification('digest', row.user_id, ref, r.ok, r.id, r.error);
      if (r.ok) sent++;
    } catch (err) {
      await markNotification('digest', row.user_id, ref, false, undefined, String(err).slice(0, 300));
    }
  }
  return sent;
}

async function dueReminders(ymd: string): Promise<number> {
  const days = config.reminderDays;
  const { rows: companies } = await pool.query(
    `SELECT c.id, c.plan, c.subscription_status, c.trial_ends_at, c.access_until
       FROM companies c`
  );
  const eligible = companies.filter((c) => hasCapability(effectivePlan(c), 'lembretes'));
  let sent = 0;

  for (const co of eligible) {
    for (const d of days) {
      const kind = d === 2 ? 'reminder2' : 'reminder7';
      const items = await reminderItems(co.id, d);
      if (items.length === 0) continue;

      const { rows: users } = await pool.query(
        `SELECT id, email, notify_version FROM users
          WHERE company_id = $1 AND email IS NOT NULL AND notify_reminders IS NOT FALSE`,
        [co.id]
      );
      for (const u of users) {
        const ref = `user-day:${ymd}:${kind}`;
        const claimed = await claimNotification(kind, u.id, ref);
        if (!claimed) continue;
        try {
          const opt = unsubscribeUrl(u.id, 'reminders', Number(u.notify_version ?? 1));
          const mail = await renderReminderEmail(kind, items, opt);
          const r = await sendMail({ to: u.email, subject: mail.subject, html: mail.html, text: mail.text });
          await markNotification(kind, u.id, ref, r.ok, r.id, r.error);
          if (r.ok) {
            sent++;
            for (const it of items) {
              await pool.query(
                `INSERT INTO reminder_log (company_id, item_type, item_id, kind, deadline)
                 VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
                [co.id, it.item_type, it.item_id, kind, it.deadline]
              );
            }
          }
        } catch (err) {
          await markNotification(kind, u.id, ref, false, undefined, String(err).slice(0, 300));
        }
      }
    }
  }
  return sent;
}

async function reminderItems(companyId: number, days: number): Promise<{
  item_type: string; item_id: number; title: string; deadline: unknown;
  assignee?: string | null; progress?: string | null;
}[]> {
  const kind = days === 2 ? 'reminder2' : 'reminder7';
  const { rows: anns } = await pool.query(
    `SELECT os.item_type, os.item_id, a.contract_designation AS title, a.proposal_deadline_date AS deadline,
            os.assigned_user_id,
            (SELECT string_agg(first_name, ' ') FROM users u WHERE u.id = os.assigned_user_id) AS assignee
       FROM opportunity_status os
       JOIN announcements a ON a.id = os.item_id
      WHERE os.company_id = $1 AND os.item_type = 'anuncio_aberto'
        AND os.status IN ('interessa','preparacao')
        AND a.proposal_deadline_date = CURRENT_DATE + $2::int
        AND NOT EXISTS (
          SELECT 1 FROM reminder_log rl
           WHERE rl.company_id = os.company_id AND rl.item_type = os.item_type AND rl.item_id = os.item_id
             AND rl.kind = $3 AND rl.deadline = a.proposal_deadline_date
        )`,
    [companyId, days, kind]
  );
  const { rows: cons } = await pool.query(
    `SELECT os.item_type, os.item_id, c.object_brief_description AS title,
            ${END_DATE} AS deadline, os.assigned_user_id,
            (SELECT u.first_name FROM users u WHERE u.id = os.assigned_user_id) AS assignee
       FROM opportunity_status os
       JOIN contracts c ON c.id = os.item_id
      WHERE os.company_id = $1 AND os.item_type = 'renovacao'
        AND os.status IN ('interessa','preparacao')
        AND c.signing_date IS NOT NULL AND c.execution_deadline ~ '\\d+'
        AND ${END_DATE} = CURRENT_DATE + $2::int
        AND NOT EXISTS (
          SELECT 1 FROM reminder_log rl
           WHERE rl.company_id = os.company_id AND rl.item_type = os.item_type AND rl.item_id = os.item_id
             AND rl.kind = $3 AND rl.deadline = ${END_DATE}
        )`,
    [companyId, days, kind]
  );
  const all = [...anns, ...cons];
  const out = [];
  for (const r of all) {
    const ck = await checklistForItem(companyId, r.item_type as ItemType, r.item_id);
    const done = ck.filter((i) => i.checked).length;
    out.push({
      item_type: r.item_type,
      item_id: r.item_id,
      title: r.title ?? 'Oportunidade',
      deadline: r.deadline,
      assignee: r.assignee ?? null,
      progress: ck.length ? `${done}/${ck.length} · ${Math.round((done / ck.length) * 100)} %` : null,
    });
  }
  return out;
}

async function retryFailed(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT kind, user_id, ref FROM notification_log
      WHERE status = 'failed' AND attempts < 3
      ORDER BY created_at LIMIT 50`
  );
  let n = 0;
  for (const row of rows) {
    // Reclamação já existe — reenvia o mesmo ref.
    await pool.query(
      `UPDATE notification_log SET status = 'pending' WHERE kind = $1 AND user_id = $2 AND ref = $3 AND status = 'failed'`,
      [row.kind, row.user_id, row.ref]
    );
    n++;
  }
  // Reprocess: if digest refs, send again
  for (const row of rows) {
    try {
      if (row.kind === 'digest') {
        const m = String(row.ref).match(/^profile:(\d+):/);
        if (!m) continue;
        const { rows: u } = await pool.query('SELECT email, notify_version FROM users WHERE id = $1', [row.user_id]);
        if (!u[0]?.email) continue;
        const data = await digestData(Number(m[1]));
        if (!data) continue;
        const { rows: p } = await pool.query('SELECT name FROM profiles WHERE id = $1', [Number(m[1])]);
        const opt = unsubscribeUrl(row.user_id, 'digest', Number(u[0].notify_version ?? 1));
        const mail = await renderDigestEmail(p[0]?.name ?? 'Atividade', data, opt);
        const r = await sendMail({ to: u[0].email, subject: mail.subject, html: mail.html, text: mail.text });
        await markNotification(row.kind, row.user_id, row.ref, r.ok, r.id, r.error);
      }
    } catch (err) {
      await markNotification(row.kind, row.user_id, row.ref, false, undefined, String(err).slice(0, 300));
    }
  }
  return n;
}

export function startScheduler(): void {
  setInterval(() => {
    void runSchedulerTick().catch((e) => console.error('[scheduler]', e));
  }, 60_000);
  void runSchedulerTick().catch((e) => console.error('[scheduler]', e));
}
