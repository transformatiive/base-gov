/** Ciclo de teto de IA: 30 dias a contar da data de inscrição, a resetar às 00:00 em Lisboa. */

export const AI_QUOTA_PERIOD_DAYS = 30;
export const AI_QUOTA_TZ = 'Europe/Lisbon';
export const AI_QUOTA_WARN_RATIO = 0.8;
export const AI_QUOTA_ALERT_RATIO = 0.9;

export type AiQuotaLevel = 'ok' | 'warn' | 'alert' | 'capped';

export interface AiQuotaPeriod {
  start: Date;
  end: Date;
}

export function lisbonYmd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AI_QUOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function addCalendarDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Instante UTC em que são 00:00 em Lisboa na data civil `ymd`. */
export function lisbonMidnight(ymd: string): Date {
  const [y, mo, d] = ymd.split('-').map(Number);
  let guess = Date.UTC(y, mo - 1, d, 0, 0, 0);
  for (let i = 0; i < 8; i++) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: AI_QUOTA_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(guess));
    const num = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const actual = Date.UTC(num('year'), num('month') - 1, num('day'), num('hour'), num('minute'));
    const desired = Date.UTC(y, mo - 1, d, 0, 0);
    const delta = desired - actual;
    if (delta === 0) return new Date(guess);
    guess += delta;
  }
  return new Date(guess);
}

/**
 * Janela actual: começa às 00:00 de Lisboa no dia da inscrição e avança
 * de 30 em 30 dias. `end` é o instante do reset (00:00 do dia de reset) e
 * é exclusivo — a essa hora a contagem volta a zero.
 */
export function quotaPeriod(enrolledAt: Date, now: Date, periodDays = AI_QUOTA_PERIOD_DAYS): AiQuotaPeriod {
  let startYmd = lisbonYmd(enrolledAt);
  let start = lisbonMidnight(startYmd);
  let end = lisbonMidnight(addCalendarDays(startYmd, periodDays));
  let guard = 0;
  while (end.getTime() <= now.getTime() && guard < 400) {
    start = end;
    startYmd = lisbonYmd(start);
    end = lisbonMidnight(addCalendarDays(startYmd, periodDays));
    guard++;
  }
  return { start, end };
}

export function quotaLevel(used: number, cap: number): AiQuotaLevel {
  if (cap <= 0) return used > 0 ? 'capped' : 'ok';
  if (used >= cap) return 'capped';
  const ratio = used / cap;
  if (ratio >= AI_QUOTA_ALERT_RATIO) return 'alert';
  if (ratio >= AI_QUOTA_WARN_RATIO) return 'warn';
  return 'ok';
}

export function resetLabel(resetAt: Date): string {
  const date = new Intl.DateTimeFormat('pt-PT', {
    timeZone: AI_QUOTA_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(resetAt);
  return `${date}, 00:00`;
}
