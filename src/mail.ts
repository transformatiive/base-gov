import { config } from './config.js';

/**
 * Envio de email transacional via Resend (API HTTP, sem dependências extra).
 *
 * Cobre o que um produto self-serve não pode fazer à mão: convites de equipa,
 * recuperação de password, confirmação de pagamento e o digest semanal.
 *
 * É best-effort por desenho: uma falha de email nunca faz falhar a operação de
 * negócio que a originou (um convite fica registado mesmo que o email não saia).
 * O resultado é devolvido para quem chama poder avisar o utilizador.
 */

const API = 'https://api.resend.com/emails';

export function mailEnabled(): boolean {
  return Boolean(config.mail.apiKey && config.mail.from);
}

export interface SendResult { ok: boolean; id?: string; error?: string; skipped?: boolean }

export async function sendMail(msg: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<SendResult> {
  if (!mailEnabled()) {
    console.warn('[mail] envio desativado (falta RESEND_API_KEY ou MAIL_FROM):', msg.subject);
    return { ok: false, skipped: true, error: 'mail_disabled' };
  }
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.mail.apiKey}`,
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
      console.error('[mail] envio falhou:', error);
      return { ok: false, error };
    }
    return { ok: true, id: json.id };
  } catch (err) {
    console.error('[mail] erro de rede:', String(err).slice(0, 200));
    return { ok: false, error: String(err).slice(0, 200) };
  }
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

/** Envolve o conteúdo num email HTML consistente com a identidade do BaseRadar. */
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
    <span style="font-size:19px;font-weight:800;color:#191c1e;letter-spacing:-0.5px">Base<span style="color:${BRAND}">Radar</span></span>
  </td></tr>
  <tr><td style="padding:26px 28px">
    <h1 style="font-size:19px;color:#191c1e;margin:0 0 12px">${opts.title}</h1>
    <div style="font-size:14.5px;line-height:1.6;color:#4c5551">${opts.body}</div>
    ${cta}
    ${opts.footnote ? `<p style="font-size:12.5px;color:#8a938e;margin:22px 0 0">${opts.footnote}</p>` : ''}
  </td></tr>
  <tr><td style="padding:16px 28px;border-top:1px solid #e6e8e6">
    <p style="font-size:11.5px;color:#9aa6a0;margin:0">BaseRadar — um produto da Transformatiive, Lda. · Fonte: Portal BASE — IMPIC / dados.gov.pt</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}
