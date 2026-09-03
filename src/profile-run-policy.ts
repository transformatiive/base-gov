/** Política da recolha inicial de um perfil: corpus local, sem scrape ao vivo. */

export type SearchOrigin = 'profile_run' | 'manual';

/** Tecto do INSERT de match local — evita varrer milhões de linhas num tick. */
export const LOCAL_MATCH_LIMIT = 2000;

export function searchHitLocalLimit(matched: number, limit = LOCAL_MATCH_LIMIT): boolean {
  return matched >= limit;
}

/** KPI honesto quando o match bateu o tecto — «2 000+», não o universo. */
export function formatKpiCount(n: number, truncated: boolean): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  const s = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return truncated && v > 0 ? `${s}+` : s;
}

export type NoveltyInput = {
  origin: SearchOrigin;
  matchedContracts: number;
  matchedAnnouncements: number;
  createdAfterStartContracts: number;
  createdAfterStartAnnouncements: number;
};

/**
 * Novidades do run: no match local de um profile_run o corpus já existia, por isso
 * created_at >= started_at fica 0 — usa-se o total cruzado. Scrapes manuais
 * continuam a contar só linhas criadas depois do início.
 */
export function noveltyCounts(input: NoveltyInput): { new_contracts: number; new_announcements: number } {
  switch (input.origin) {
    case 'profile_run':
      return {
        new_contracts: input.matchedContracts,
        new_announcements: input.matchedAnnouncements,
      };
    case 'manual':
      return {
        new_contracts: input.createdAfterStartContracts,
        new_announcements: input.createdAfterStartAnnouncements,
      };
    default: {
      const _exhaustive: never = input.origin;
      return _exhaustive;
    }
  }
}

export function searchOrigin(profileRunId: number | null | undefined): SearchOrigin {
  return profileRunId == null ? 'manual' : 'profile_run';
}

/** Scrapes ao BASE.gov ficam para pesquisas manuais (novidades / pedidos explícitos). */
export function shouldLiveScrape(origin: SearchOrigin): boolean {
  switch (origin) {
    case 'profile_run':
      return false;
    case 'manual':
      return true;
    default: {
      const _exhaustive: never = origin;
      return _exhaustive;
    }
  }
}

/** Perfis primeiro (corpus local, segundos) para o worker não ficar preso num scrape manual. */
export function pendingSearchOrderSql(): string {
  return '(profile_run_id IS NULL), created_at';
}
