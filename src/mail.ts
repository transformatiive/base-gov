import { config } from './config.js';

/**
 * Envio de email transacional via Cloudflare Email Service (REST).
 *
 * Cobre o que um produto self-serve não pode fazer à mão: convites de equipa,
 * recuperação de password, confirmação de pagamento e o digest semanal
 * (segunda-feira, hora de Lisboa — ver scheduler).
 *
 * É best-effort por desenho: uma falha de email nunca faz falhar a operação de
 * negócio que a originou (um convite fica registado mesmo que o email não saia).
 * O resultado é devolvido para quem chama poder avisar o utilizador.
 *
 * Fallback: se ainda existir RESEND_API_KEY e não houver credenciais Cloudflare,
 * o envio usa a API Resend. Preferir Cloudflare quando ambos estão definidos.
 */

const RESEND_API = 'https://api.resend.com/emails';

export type MailProvider = 'cloudflare' | 'resend';

export function cloudflareSendUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`;
}

export function mailProvider(): MailProvider | null {
  if (config.mail.cloudflareAccountId && config.mail.cloudflareApiToken && config.mail.from) {
    return 'cloudflare';
  }
  if (config.mail.resendApiKey && config.mail.from) return 'resend';
  return null;
}

export function mailEnabled(): boolean {
  return mailProvider() !== null;
}

export function mailDisabledHint(): string {
  if (!config.mail.from) {
    return 'Email não configurado (falta MAIL_FROM).';
  }
  if (config.mail.cloudflareApiToken && !config.mail.cloudflareAccountId) {
    return 'Email não configurado (falta CLOUDFLARE_ACCOUNT_ID).';
  }
  if (config.mail.cloudflareAccountId && !config.mail.cloudflareApiToken) {
    return 'Email não configurado (falta CLOUDFLARE_API_TOKEN).';
  }
  return 'Email não configurado (falta CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID, ou MAIL_FROM).';
}

export interface SendResult { ok: boolean; id?: string; error?: string; skipped?: boolean }

export function cloudflareSendBody(msg: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}, from: string): Record<string, unknown> {
  return {
    from,
    to: Array.isArray(msg.to) ? msg.to : [msg.to],
    subject: msg.subject,
    html: msg.html,
    ...(msg.text ? { text: msg.text } : {}),
    ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
  };
}

function cfErrorMessage(json: {
  errors?: { message?: string }[];
  messages?: { message?: string }[];
}): string {
  return json.errors?.[0]?.message || json.messages?.[0]?.message || 'cloudflare_send_failed';
}

function cfResultId(json: {
  result?: { delivered?: string[]; queued?: string[]; messageId?: string };
}): string | undefined {
  const r = json.result;
  if (!r) return undefined;
  if (r.messageId) return r.messageId;
  if (r.delivered?.[0]) return `cf:${r.delivered[0]}`;
  if (r.queued?.[0]) return `cf-queued:${r.queued[0]}`;
  return undefined;
}

export async function sendMail(msg: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const provider = mailProvider();
  if (!provider) {
    console.warn('[mail] envio desativado:', mailDisabledHint(), msg.subject);
    return { ok: false, skipped: true, error: 'mail_disabled' };
  }
  const replyTo = (msg.replyTo && String(msg.replyTo).trim()) || config.mail.supportEmail || undefined;
  const payload = replyTo ? { ...msg, replyTo } : msg;
  try {
    if (provider === 'cloudflare') return await sendViaCloudflare(payload);
    return await sendViaResend(payload);
  } catch (err) {
    console.error('[mail] erro de rede:', String(err).slice(0, 200));
    return { ok: false, error: String(err).slice(0, 200) };
  }
}

async function sendViaCloudflare(msg: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const res = await fetch(cloudflareSendUrl(config.mail.cloudflareAccountId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.mail.cloudflareApiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cloudflareSendBody(msg, config.mail.from)),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    errors?: { message?: string }[];
    messages?: { message?: string }[];
    result?: { delivered?: string[]; queued?: string[]; permanent_bounces?: string[]; messageId?: string };
  };
  if (!res.ok || json.success === false) {
    const error = cfErrorMessage(json) || `HTTP ${res.status}`;
    console.error('[mail] envio Cloudflare falhou:', error);
    return { ok: false, error };
  }
  if (json.result?.permanent_bounces?.length && !json.result.delivered?.length && !json.result.queued?.length) {
    const error = `bounce:${json.result.permanent_bounces.join(',')}`;
    console.error('[mail] envio Cloudflare recusado:', error);
    return { ok: false, error };
  }
  return { ok: true, id: cfResultId(json) };
}

async function sendViaResend(msg: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.mail.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.mail.from,
      to: Array.isArray(msg.to) ? msg.to : [msg.to],
      subject: msg.subject,
      html: msg.html,
      ...(msg.text ? { text: msg.text } : {}),
      ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok) {
    const error = json.message || json.name || `HTTP ${res.status}`;
    console.error('[mail] envio Resend falhou:', error);
    return { ok: false, error };
  }
  return { ok: true, id: json.id };
}

/* ---------- Modelo visual partilhado (mesma linguagem da marca) ---------- */

const BRAND = '#173f35';

/** Escapa texto que vem de dados do utilizador antes de entrar no HTML do email. */
/** Aceita Date | string (incl. o Date do driver pg) e devolve DD/MM/AAAA. */
export function fmtDatePT(value: unknown): string {
  if (value == null || value === '') return '—';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const dd = String(value.getUTCDate()).padStart(2, '0');
    const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = value.getUTCFullYear();
    // Datas DATE do Postgres vêm à meia-noite UTC; usar UTC evita o salto de fuso.
    return `${dd}/${mm}/${yyyy}`;
  }
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  }
  return s.slice(0, 10);
}

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Envolve o conteúdo num email HTML consistente com a identidade do PrepBid. */
export function layout(opts: { title: string; body: string; cta?: { label: string; url: string }; footnote?: string }): string {
  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
         <tr><td style="background:${BRAND};border-radius:10px">
           <a href="${opts.cta.url}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none">${opts.cta.label}</a>
         </td></tr>
       </table>
       <p style="font-size:12px;color:#8a938e;margin:0 0 4px">Se o botão não funcionar, copie este endereço para o navegador:</p>
       <p style="font-size:12px;color:#4c5551;word-break:break-all;margin:0">${opts.cta.url}</p>`
    : '';
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f5f4;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e6e8e6;border-radius:12px">
  <tr><td style="padding:22px 28px;border-bottom:1px solid #e6e8e6">
    <span style="font-size:19px;font-weight:800;color:#191c1e;letter-spacing:-0.5px">Prep<span style="color:${BRAND}">Bid</span></span>
  </td></tr>
  <tr><td style="padding:26px 28px">
    <h1 style="font-size:19px;color:#191c1e;margin:0 0 12px">${opts.title}</h1>
    <div style="font-size:14.5px;line-height:1.6;color:#4c5551">${opts.body}</div>
    ${cta}
    ${opts.footnote ? `<p style="font-size:12.5px;color:#8a938e;margin:22px 0 0">${opts.footnote}</p>` : ''}
  </td></tr>
  <tr><td style="padding:16px 28px;border-top:1px solid #e6e8e6">
    <p style="font-size:11.5px;color:#9aa6a0;margin:0">PrepBid — um produto da Transformatiive, Lda. · Fonte: Portal BASE — IMPIC / dados.gov.pt</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}
