/** Política da recolha inicial de um perfil: corpus local, sem scrape ao vivo. */

export type SearchOrigin = 'profile_run' | 'manual';

/** Tecto do INSERT de match local — evita varrer milhões de linhas num tick. */
export const LOCAL_MATCH_LIMIT = 2000;

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
