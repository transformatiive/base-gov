/** Pistas CPV baratas no registo — não substituem o FTS. */

export const MEDICAL_DEVICES_CPV = '33100000-1';

const MEDICAL_DEVICE_RE = /dispositiv[oa]s?\s+m[eé]dic/i;
const GENERIC_HEALTH_RE = /^(sa[uú]de|saude|health)$/i;

export function termsNeedMedicalDeviceCpv(terms: string[]): boolean {
  return terms.some((t) => MEDICAL_DEVICE_RE.test(t)) || MEDICAL_DEVICE_RE.test(terms.join(' '));
}

/** Se o utilizador escreveu «dispositivos médicos», o termo genérico «saúde» enche o radar de obras hospitalares. */
export function refineActivityTerms(terms: string[]): string[] {
  const t = terms.map((x) => x.trim()).filter(Boolean);
  if (!termsNeedMedicalDeviceCpv(t)) return t;
  return t.filter((x) => !GENERIC_HEALTH_RE.test(x));
}

export function mergeCpvHints(terms: string[], cpvCodes: string[]): string[] {
  const out = [...cpvCodes];
  const has331 = out.some((c) => c.replace(/\D/g, '').startsWith('331'));
  if (termsNeedMedicalDeviceCpv(terms) && !has331) out.push(MEDICAL_DEVICES_CPV);
  return [...new Set(out)];
}
