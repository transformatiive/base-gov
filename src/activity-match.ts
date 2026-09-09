/** Match local: «dispositivos médicos» não deve puxar empreitadas hospitalares. */

export type LocalTextMatch = 'default' | 'medical_devices' | 'generic_health';

const MEDICAL_DEVICE_RE = /dispositiv[oa]s?\s+m[eé]dic/i;
const GENERIC_HEALTH_RE = /^(sa[uú]de|saude|health)$/i;

/** Obras/empreitadas que o FTS de «médico»/«saúde» mistura com fornecimento. */
export const WORKS_NOISE_SQL =
  `'empreitada|obras p[uú]blicas|reabilita[cç][aã]o (de |do |da )?(edif|hospital|pavilh[aã]o|escola|arruamento|bloco)|constru[cç][aã]o (de |do |da )?(hospital|centro hospitalar)|ppp hospital'`;

export function isMedicalDeviceQuery(term: string): boolean {
  return MEDICAL_DEVICE_RE.test(term.trim());
}

export function isGenericHealthQuery(term: string): boolean {
  return GENERIC_HEALTH_RE.test(term.trim());
}

export function localTextMatchMode(term: string): LocalTextMatch {
  if (isMedicalDeviceQuery(term)) return 'medical_devices';
  if (isGenericHealthQuery(term)) return 'generic_health';
  return 'default';
}

/** CPV 331 ou texto de fornecimento de equipamento — nunca empreitada. */
export function medicalDeviceMatchSql(designationCol: string, cpvsCol: string): string {
  return `(
    (
      ${cpvsCol} ~ '(^|[^0-9])331'
      OR (
        ${designationCol} ~* 'dispositiv' AND ${designationCol} ~* 'm[eé]dic'
      )
    )
    AND ${designationCol} !~* ${WORKS_NOISE_SQL}
  )`;
}

export function notWorksNoiseSql(designationCol: string): string {
  return `${designationCol} !~* ${WORKS_NOISE_SQL}`;
}

/** Passos da barra de progresso da ficha: por tempo, não ao acaso (QA-13). */
export function aiProgressStepIndex(elapsedSec: number, nSteps: number): number {
  if (nSteps <= 1) return 0;
  const last = nSteps - 1;
  if (elapsedSec < 4) return 0;
  if (elapsedSec < 9) return Math.min(1, last);
  if (elapsedSec < 16) return Math.min(2, last);
  if (elapsedSec < 24) return Math.min(3, last);
  return last;
}

export function aiProgressPct(elapsedSec: number): number {
  return Math.min(88, 8 + elapsedSec * 2.1);
}
