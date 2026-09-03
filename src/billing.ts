import { normalizePlan } from './plans.js';

/**
 * Vista de faturação para a área de conta: distingue cartão (renovação)
 * de pagamento pontual (acesso até) e diz se o cliente pode abrir o
 * Customer Portal do Stripe.
 */

export type BillingMode = 'free' | 'trial' | 'subscription' | 'one_time' | 'past_due' | 'canceled';

type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'other';

export interface CompanyBillingInput {
  plan?: unknown;
  subscription_status?: unknown;
  trial_ends_at?: Date | string | null;
  trial_days_left?: number | null;
  renewal_at?: Date | string | null;
  access_until?: Date | string | null;
  has_stripe_customer?: boolean;
  has_stripe_subscription?: boolean;
}

export interface BillingSnapshot {
  mode: BillingMode;
  renews_at: string | null;
  access_until: string | null;
  trial_ends_at: string | null;
  trial_days_left: number | null;
  can_manage_payment: boolean;
}

export interface PaymentRow {
  id: number;
  created_at: Date | string;
  kind: string;
  plan: string | null;
  amount_cents: number;
  currency: string;
  moloni_document_id: number | string | null;
  moloni_status: string | null;
  moloni_number: string | null;
}

export interface InvoiceDto {
  id: number;
  created_at: string;
  kind: 'subscription' | 'one_time';
  plan: string | null;
  amount_cents: number;
  currency: string;
  moloni_status: string | null;
  moloni_number: string | null;
  downloadable: boolean;
}

function subStatus(raw: unknown): SubStatus {
  const s = String(raw ?? '').toLowerCase();
  switch (s) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'canceled':
      return s;
    default:
      return 'other';
  }
}

export function isoOrNull(v: Date | string | null | undefined): string | null {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Como o cliente paga / em que fase está a subscrição. */
export function billingMode(c: CompanyBillingInput): BillingMode {
  const status = subStatus(c.subscription_status);
  const plan = normalizePlan(c.plan);
  switch (status) {
    case 'trialing':
      return 'trial';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'active':
      if (plan === 'free') return 'free';
      if (c.has_stripe_subscription) return 'subscription';
      if (c.access_until) return 'one_time';
      return 'subscription';
    case 'other':
      return 'free';
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function billingSnapshot(
  c: CompanyBillingInput | null | undefined,
  opts: { billingEnabled: boolean },
): BillingSnapshot {
  if (!c) {
    return {
      mode: 'free',
      renews_at: null,
      access_until: null,
      trial_ends_at: null,
      trial_days_left: null,
      can_manage_payment: false,
    };
  }
  const mode = billingMode(c);
  const days = c.trial_days_left;
  const trialDays = typeof days === 'number' && Number.isFinite(days) ? days : (days != null ? Number(days) : null);
  return {
    mode,
    renews_at: mode === 'subscription' || mode === 'past_due' ? isoOrNull(c.renewal_at) : null,
    access_until: mode === 'one_time' || mode === 'canceled' ? isoOrNull(c.access_until) : null,
    trial_ends_at: mode === 'trial' ? isoOrNull(c.trial_ends_at) : null,
    trial_days_left: mode === 'trial' && trialDays != null && Number.isFinite(trialDays) ? trialDays : null,
    can_manage_payment: Boolean(opts.billingEnabled && c.has_stripe_customer),
  };
}

export function invoiceDownloadable(
  status: string | null | undefined,
  documentId: number | string | null | undefined,
): boolean {
  const id = documentId == null || documentId === '' ? NaN : Number(documentId);
  return status === 'ok' && Number.isFinite(id) && id > 0;
}

export function mapPaymentToInvoice(row: PaymentRow): InvoiceDto {
  const kind = row.kind === 'one_time' ? 'one_time' : 'subscription';
  return {
    id: Number(row.id),
    created_at: isoOrNull(row.created_at) ?? new Date(0).toISOString(),
    kind,
    plan: row.plan,
    amount_cents: Number(row.amount_cents) || 0,
    currency: row.currency || 'eur',
    moloni_status: row.moloni_status,
    moloni_number: row.moloni_number,
    downloadable: invoiceDownloadable(row.moloni_status, row.moloni_document_id),
  };
}

/** Número de documento Moloni (série + número) a partir de insert/getOne. */
export function moloniDocumentLabel(doc: Record<string, unknown> | null | undefined): string | null {
  if (!doc) return null;
  const number = doc.number ?? doc.document_number;
  const setObj = doc.document_set;
  const set = (setObj && typeof setObj === 'object')
    ? (setObj as Record<string, unknown>).name
    : doc.document_set_name;
  const hasNum = number != null && String(number).trim() !== '' && String(number) !== '0';
  if (hasNum && set) return `${set} ${number}`;
  if (hasNum) return String(number);
  return null;
}

export function moloniPdfUrlFromResponse(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const url = moloniPdfUrlFromResponse(item);
      if (url) return url;
    }
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const url = rec.url ?? rec.link;
  if (typeof url === 'string' && /^https?:\/\//i.test(url.trim())) return url.trim();
  return null;
}

export function pdfFilename(number: string | null | undefined, id: number): string {
  const raw = (number && String(number).trim()) ? String(number).trim() : `fatura-${id}`;
  const safe = raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `baseradar-${safe || id}.pdf`;
}

export function invoicePdfUnavailableMessage(status: string | null | undefined): string {
  switch (status) {
    case 'draft':
      return 'Esta fatura ainda está em rascunho. O PDF só fica disponível depois de ser emitida.';
    case 'skipped':
      return 'Não há documento Moloni para este pagamento.';
    case 'error':
      return 'Houve um problema a emitir esta fatura. Contacte o suporte.';
    case 'ok':
      return 'Não foi possível obter o PDF desta fatura.';
    default:
      return 'Esta fatura ainda não está disponível para descarregar.';
  }
}
