/** Regras puras do refresh do corpus (anúncios no BASE.gov + agenda dos perfis). */

export const ANNOUNCEMENT_HARVEST_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const ANNOUNCEMENT_HARVEST_LOOKBACK_DAYS = 21;
export const ANNOUNCEMENT_DETAIL_BATCH = 40;
export const PROFILE_RUN_STALE_HOURS = 6;

export type ProfileSchedule = 'manual' | 'daily' | 'weekly';

export function profileScheduleDue(opts: {
  schedule: string;
  hasInFlight: boolean;
  lastFinishedAt: Date | null;
  now: Date;
}): boolean {
  if (opts.hasInFlight) return false;
  switch (opts.schedule) {
    case 'manual':
      return false;
    case 'daily':
      return isOlderThan(opts.lastFinishedAt, opts.now, 24 * 3600 * 1000);
    case 'weekly':
      return isOlderThan(opts.lastFinishedAt, opts.now, 7 * 24 * 3600 * 1000);
    default:
      return false;
  }
}

function isOlderThan(last: Date | null, now: Date, ms: number): boolean {
  if (!last) return true;
  return now.getTime() - last.getTime() >= ms;
}

/** Primeira colheita (ou lacuna longa) vai mais fundo; o ritmo normal só cobre os dias recentes. */
export function harvestPageLimit(lastOkAt: Date | null, now: Date): number {
  if (!lastOkAt) return 200;
  const days = (now.getTime() - lastOkAt.getTime()) / 86_400_000;
  if (days > 14) return 120;
  return 40;
}

export function harvestLookbackYmd(now: Date, days = ANNOUNCEMENT_HARVEST_LOOKBACK_DAYS): string {
  const d = new Date(now.getTime() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Página já está toda antes do lookback → não vale a pena pedir a seguinte (ordenado por data DR desc). */
export function harvestShouldFetchNextPage(
  publicationYmds: (string | null)[],
  lookbackYmd: string,
): boolean {
  if (publicationYmds.length === 0) return false;
  return publicationYmds.some((ymd) => ymd != null && ymd >= lookbackYmd);
}

export function announcementNeedsDetail(opts: {
  detailScraped: boolean;
  proposalDeadlineYmd: string | null;
  todayYmd: string;
}): boolean {
  if (opts.detailScraped) return false;
  if (!opts.proposalDeadlineYmd) return true;
  return opts.proposalDeadlineYmd >= opts.todayYmd;
}
