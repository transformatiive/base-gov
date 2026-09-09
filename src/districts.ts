/** Distritos de Portugal (continente + RA), nomes canónicos usados em filtros e regras. */
export const DISTRICTS = [
  'Aveiro', 'Beja', 'Braga', 'Bragança', 'Castelo Branco', 'Coimbra', 'Évora', 'Faro',
  'Guarda', 'Leiria', 'Lisboa', 'Portalegre', 'Porto', 'Santarém', 'Setúbal',
  'Viana do Castelo', 'Vila Real', 'Viseu', 'Açores', 'Madeira',
] as const;

export type District = (typeof DISTRICTS)[number];

/** Nomes mais longos primeiro para o ILIKE não apanhar «Braga» dentro de «Bragança». */
export const DISTRICTS_MATCH_ORDER = [...DISTRICTS].sort((a, b) => b.length - a.length);

/** Expressão SQL: primeiro distrito cujo nome aparece na entidade / local. `alias` = coluna texto. */
export function announcementDistrictSql(alias: string): string {
  const cases = DISTRICTS_MATCH_ORDER.map(
    (d) => `WHEN ${alias} ILIKE ${sqlLit('%' + d + '%')} THEN ${sqlLit(d)}`
  ).join(' ');
  return `(CASE ${cases} ELSE NULL END)`;
}

function sqlLit(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/** Distrito de contratos — mesma expressão do mapa em routes-v2. */
export const CONTRACT_DISTRICT_SQL =
  `NULLIF(btrim(split_part(split_part(c.execution_place, '|', 1), ',', 2)), '')`;

/** Primeiro distrito cujo nome aparece no texto (entidade / local). */
export function inferDistrict(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  for (const d of DISTRICTS_MATCH_ORDER) {
    const needle = d.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    if (t.includes(needle)) return d;
  }
  return null;
}
