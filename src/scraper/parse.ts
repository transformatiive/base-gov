/** Converte "03-07-2026" (DD-MM-YYYY) em "2026-07-03"; devolve null se inválida. */
export function parseBaseDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Converte "35.760,00 €" em 35760.00; devolve null se não parseável. */
export function parseBasePrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
