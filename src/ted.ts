/**
 * TED (Tenders Electronic Daily) — concursos europeus acima dos limiares,
 * obrigatoriamente publicados na UE. Integração read-through (sem persistência):
 * consulta a API aberta v3 ao vivo pelos CPV/termos do perfil e devolve os
 * anúncios normalizados. Não toca no pipeline do BASE nem no schema.
 * Docs: https://api.ted.europa.eu/ (v3 /notices/search, expert query language)
 */
const TED_URL = 'https://api.ted.europa.eu/v3/notices/search';

// Excluímos adjudicações (can-*) e correções; ficam as oportunidades ainda
// acionáveis (contract notices cn-*, sistemas de qualificação qu-sy, PIN…).
const AWARD_OR_NOISE = /^(can-|corr-)/;

export interface TedNotice {
  id: string;
  title: string;
  buyer: string;
  publication_date: string | null;
  deadline: string | null;
  days_left: number | null;
  cpvs: string[];
  notice_type: string;
  url: string;
}

const firstStr = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return firstStr(v[0]);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return firstStr(o.por ?? o.eng ?? Object.values(o)[0]);
  }
  return null;
};

const parseDate = (v: unknown): string | null => {
  const s = firstStr(v);
  if (!s) return null;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

const cpv8 = (code: string) => String(code).replace(/\D/g, '').slice(0, 8);

/** Pesquisa concursos TED em Portugal pelos CPV do perfil (fallback: termos). */
export async function searchTed(cpvCodes: string[], terms: string[], limit = 25): Promise<TedNotice[]> {
  const cpvs = [...new Set((cpvCodes ?? []).map(cpv8).filter((c) => c.length === 8))];
  let expr: string;
  if (cpvs.length) {
    expr = `classification-cpv IN (${cpvs.join(' ')}) AND place-of-performance=PRT`;
  } else if ((terms ?? []).length) {
    const t = terms.slice(0, 4).map((x) => `FT~"${String(x).replace(/["\\]/g, '')}"`).join(' OR ');
    expr = `(${t}) AND place-of-performance=PRT`;
  } else {
    return [];
  }

  const body = {
    query: expr,
    fields: ['publication-number', 'title-proc', 'notice-title', 'buyer-name', 'organisation-name-buyer', 'publication-date', 'deadline-receipt-request', 'classification-cpv', 'notice-type'],
    limit: Math.min(50, Math.max(1, limit)),
    page: 1,
    scope: 'ACTIVE',
    paginationMode: 'PAGE_NUMBER',
  };

  const res = await fetch(TED_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`TED HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = (await res.json()) as { notices?: Record<string, unknown>[] };
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();

  return (data.notices ?? [])
    .map((n): TedNotice => {
      const id = String(n['publication-number'] ?? '');
      const deadline = parseDate(n['deadline-receipt-request']);
      const cpvArr = [...new Set(((n['classification-cpv'] as string[] | undefined) ?? []).map(String))];
      return {
        id,
        title: firstStr(n['title-proc']) ?? firstStr(n['notice-title']) ?? '(sem título)',
        buyer: firstStr(n['buyer-name']) ?? firstStr(n['organisation-name-buyer']) ?? '—',
        publication_date: parseDate(n['publication-date']),
        deadline,
        days_left: deadline ? Math.round((new Date(deadline).getTime() - today) / 86400000) : null,
        cpvs: cpvArr,
        notice_type: String(n['notice-type'] ?? ''),
        url: `https://ted.europa.eu/pt/notice/-/detail/${id}`,
      };
    })
    .filter((n) => n.id && !AWARD_OR_NOISE.test(n.notice_type))
    // prazo por decorrer (ou sem prazo indicado), mais próximos primeiro
    .filter((n) => n.days_left == null || n.days_left >= 0)
    .sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999));
}
