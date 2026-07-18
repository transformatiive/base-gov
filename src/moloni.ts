import { config } from './config.js';
import { Plan } from './plans.js';

/**
 * Faturação certificada via Moloni. Emite uma fatura por cada pagamento Stripe
 * confirmado. É best-effort: nunca lança para o fluxo de pagamento — se falhar,
 * regista o erro e segue. Por segurança, cria a fatura em RASCUNHO (status=0)
 * salvo MOLONI_FINALIZE=true (aí é finalizada e comunicada à AT).
 *
 * Padrão da API (igual ao usado internamente):
 *  - Auth: GET /v1/grant/?grant_type=password&client_id&client_secret&username&password
 *  - Chamadas: POST /v1/{endpoint}/?access_token=…  com corpo form-encoded
 *
 * Nenhuma credencial em código — tudo em variáveis de ambiente (config.moloni).
 */

const BASE = 'https://api.moloni.pt/v1';

export function moloniConfigured(): boolean {
  const m = config.moloni;
  return Boolean(m.clientId && m.clientSecret && m.username && m.password && m.companyId && m.documentSetId && m.taxId);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;
  const m = config.moloni;
  const url = `${BASE}/grant/?grant_type=password&client_id=${encodeURIComponent(m.clientId)}`
    + `&client_secret=${encodeURIComponent(m.clientSecret)}`
    + `&username=${encodeURIComponent(m.username)}&password=${encodeURIComponent(m.password)}`;
  const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(20_000) });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) throw new Error(`Moloni auth falhou: ${JSON.stringify(json).slice(0, 200)}`);
  cachedToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

function encodeForm(obj: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') parts.push(encodeForm(v as Record<string, unknown>, key));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.filter(Boolean).join('&');
}

async function moloniPost(endpoint: string, data: Record<string, unknown>): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${BASE}/${endpoint}/?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeForm(data),
    signal: AbortSignal.timeout(25_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Moloni ${endpoint} ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

const digits = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');

/** Procura o cliente pelo NIF; cria-o com defaults se não existir. Devolve o customer_id. */
async function findOrCreateCustomer(company: { name: string; nif: string | null }): Promise<number> {
  const companyId = config.moloni.companyId;
  const vat = digits(company.nif) || '999999990';   // consumidor final se sem NIF

  const search = (await moloniPost('customers/getBySearch', { company_id: companyId, search: vat })) as unknown;
  if (Array.isArray(search) && search.length > 0) {
    const found = search.find((c) => digits((c as Record<string, unknown>).vat as string) === vat) ?? search[0];
    return Number((found as Record<string, unknown>).customer_id);
  }

  // Número de cliente seguinte.
  let number = `C${Date.now().toString().slice(-8)}`;
  try {
    const next = (await moloniPost('customers/getNextNumber', { company_id: companyId })) as Record<string, unknown>;
    if (next?.number) number = String(next.number);
  } catch { /* usa o fallback acima */ }

  const created = (await moloniPost('customers/insert', {
    company_id: companyId,
    vat,
    number,
    name: company.name || 'Cliente',
    language_id: 1,
    address: 'Desconhecida',
    city: 'Desconhecida',
    zip_code: '1000-001',
    country_id: 1,           // Portugal
    email: '',
    maturity_date_id: 0,
    payment_day: 0,
    discount: 0,
    credit_limit: 0,
    payment_method_id: 0,
    salesman_id: 0,
    field_notes: 'Criado automaticamente pelo BaseRadar',
  })) as Record<string, unknown>;
  if (!created?.customer_id) throw new Error(`customers/insert sem customer_id: ${JSON.stringify(created).slice(0, 160)}`);
  return Number(created.customer_id);
}

/** Emite (ou cria em rascunho) uma fatura no Moloni para um pagamento. */
export async function createMoloniInvoice(input: {
  company: { name: string; nif: string | null };
  plan: Plan;
  netCents: number;    // preço unitário SEM IVA (o Moloni adiciona o imposto)
}): Promise<{ documentId?: number; status: 'ok' | 'draft' | 'skipped' | 'error' }> {
  if (!moloniConfigured()) return { status: 'skipped' };

  const companyId = config.moloni.companyId;
  const customerId = await findOrCreateCustomer(input.company);
  const today = new Date().toISOString().slice(0, 10);
  const planLabel = input.plan === 'business' ? 'Business' : 'Pro';
  const finalize = config.moloni.finalize;

  const doc = (await moloniPost('invoices/insert', {
    company_id: companyId,
    date: today,
    expiration_date: today,
    document_set_id: config.moloni.documentSetId,
    customer_id: customerId,
    status: finalize ? 1 : 0,     // 1 = finalizada (AT); 0 = rascunho
    products: {
      0: {
        name: `${config.planName} ${planLabel} — subscrição mensal`,
        qty: 1,
        price: (input.netCents / 100).toFixed(2),   // preço unitário sem IVA
        order: 0,
        taxes: { 0: { tax_id: config.moloni.taxId, order: 0, cumulative: 0 } },
      },
    },
  })) as Record<string, unknown>;

  const documentId = doc?.document_id ? Number(doc.document_id) : undefined;
  if (!documentId) throw new Error(`invoices/insert sem document_id: ${JSON.stringify(doc).slice(0, 160)}`);
  return { documentId, status: finalize ? 'ok' : 'draft' };
}
