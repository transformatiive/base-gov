import { pool } from './db.js';

/** Limiar mínimo de concursos comparáveis para mostrar uma estimativa (spec §2.5). */
export const MIN_FORECAST_SAMPLE = 5;
export const FORECAST_LOOKBACK_MONTHS = 24;

export type ForecastConfidence = 'alta' | 'media' | 'baixa' | 'insuficiente';

export interface ForecastInput {
  basePrice: number;
  cpv: string | null;
  entity: string | null;
  district: string | null;
  procedureType: string | null;
}

export interface ComparableAward {
  id: number;
  basegov_id: number;
  title: string | null;
  entity: string | null;
  awarded: number;
  historical_base: number | null;
  publication_date: string | null;
  cpv: string | null;
  district: string | null;
  procedure_type: string | null;
  ratio: number;
  ratio_source: 'pair' | 'scale';
}

export interface StatisticalForecast {
  available: boolean;
  confidence: ForecastConfidence;
  sample_size: number;
  entity_sample_size: number;
  months: number;
  match_level: 'cpv' | 'cpv_class' | 'cpv_division' | 'none';
  low_pct: number | null;
  high_pct: number | null;
  mid_pct: number | null;
  low_value: number | null;
  high_value: number | null;
  mid_value: number | null;
  note: string;
  used: ComparableAward[];
}

export function cpvDigits(cpv: string | null | undefined): string {
  const m = String(cpv ?? '').match(/\d{2,8}/);
  return m ? m[0].slice(0, 8) : '';
}

export function discountRatio(awarded: number, base: number): number | null {
  if (!(base > 0) || !(awarded > 0)) return null;
  const r = awarded / base;
  if (r < 0.2 || r > 1.15) return null;
  return r;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function forecastConfidence(sampleSize: number, entitySampleSize: number): ForecastConfidence {
  if (sampleSize < MIN_FORECAST_SAMPLE) return 'insuficiente';
  if (sampleSize >= 20 && entitySampleSize >= 5) return 'alta';
  if (sampleSize >= 8) return 'media';
  return 'baixa';
}

export function formatPctRange(low: number, high: number): string {
  const a = Math.round(low * 100);
  const b = Math.round(high * 100);
  return `${a}%–${b}%`;
}

function normName(s: string | null | undefined): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function matchLevelForPrefix(prefixLen: number): StatisticalForecast['match_level'] {
  if (prefixLen >= 8) return 'cpv';
  if (prefixLen >= 4) return 'cpv_class';
  if (prefixLen >= 2) return 'cpv_division';
  return 'none';
}

export function buildStatisticalForecast(
  input: ForecastInput,
  rows: Omit<ComparableAward, 'ratio' | 'ratio_source'>[],
  months = FORECAST_LOOKBACK_MONTHS,
): StatisticalForecast {
  const empty = (note: string, match: StatisticalForecast['match_level'] = 'none'): StatisticalForecast => ({
    available: false,
    confidence: 'insuficiente',
    sample_size: 0,
    entity_sample_size: 0,
    months,
    match_level: match,
    low_pct: null,
    high_pct: null,
    mid_pct: null,
    low_value: null,
    high_value: null,
    mid_value: null,
    note,
    used: [],
  });

  if (!(input.basePrice > 0)) {
    return empty('Sem preço base oficial — não é possível estimar o fecho.');
  }

  const scored: ComparableAward[] = [];
  for (const row of rows) {
    const pair = row.historical_base != null ? discountRatio(row.awarded, row.historical_base) : null;
    const scale = discountRatio(row.awarded, input.basePrice);
    const ratio = pair ?? scale;
    if (ratio == null) continue;
    scored.push({
      ...row,
      ratio,
      ratio_source: pair != null ? 'pair' : 'scale',
    });
  }

  const digits = cpvDigits(input.cpv);
  let pool = scored;
  let matchLevel: StatisticalForecast['match_level'] = 'none';
  for (const len of [8, 4, 2] as const) {
    if (digits.length < len) continue;
    const prefix = digits.slice(0, len);
    const subset = scored.filter((r) => cpvDigits(r.cpv).startsWith(prefix));
    if (subset.length >= MIN_FORECAST_SAMPLE || (len === 2 && subset.length > 0)) {
      pool = subset;
      matchLevel = matchLevelForPrefix(len);
      if (subset.length >= MIN_FORECAST_SAMPLE) break;
    }
  }

  const entityName = normName(input.entity);
  const entityPool = entityName
    ? pool.filter((r) => normName(r.entity) === entityName)
    : [];
  const primary = entityPool.length >= MIN_FORECAST_SAMPLE ? entityPool : pool;
  const entitySample = entityPool.length;

  if (primary.length < MIN_FORECAST_SAMPLE) {
    return {
      ...empty(
        `Amostra histórica insuficiente para estimar o fecho (${primary.length} concurso(s) semelhante(s); mínimo ${MIN_FORECAST_SAMPLE}).`,
        matchLevel,
      ),
      sample_size: primary.length,
      entity_sample_size: entitySample,
    };
  }

  const ratios = primary.map((r) => r.ratio).sort((a, b) => a - b);
  const low = percentile(ratios, 0.25);
  const high = percentile(ratios, 0.75);
  const mid = percentile(ratios, 0.5);
  const confidence = forecastConfidence(primary.length, entitySample);
  const used = [...primary]
    .sort((a, b) => String(b.publication_date ?? '').localeCompare(String(a.publication_date ?? '')))
    .slice(0, 25);

  const matchLabel = matchLevel === 'cpv'
    ? 'CPV igual'
    : matchLevel === 'cpv_class'
      ? 'classe CPV semelhante'
      : 'divisão CPV semelhante';
  const entityNote = entityPool.length >= MIN_FORECAST_SAMPLE
    ? `, incluindo ${entityPool.length} da mesma entidade adjudicante`
    : '';
  const pairCount = used.filter((u) => u.ratio_source === 'pair').length;
  const methodNote = pairCount >= MIN_FORECAST_SAMPLE
    ? 'rácio preço adjudicado ÷ preço base do procedimento original'
    : 'rácio entre o preço adjudicado de concursos semelhantes e o preço base deste concurso';

  return {
    available: true,
    confidence,
    sample_size: primary.length,
    entity_sample_size: entitySample,
    months,
    match_level: matchLevel,
    low_pct: low,
    high_pct: high,
    mid_pct: mid,
    low_value: Math.round(input.basePrice * low * 100) / 100,
    high_value: Math.round(input.basePrice * high * 100) / 100,
    mid_value: Math.round(input.basePrice * mid * 100) / 100,
    note: `${formatPctRange(low, high)} do preço base, com base em ${primary.length} concursos semelhantes (${matchLabel}${entityNote}) nos últimos ${months} meses. Estimativa baseada em histórico (${methodNote}) — não é um modelo de machine learning calibrado.`,
    used,
  };
}

const DISTRICT_SQL = `NULLIF(btrim(split_part(split_part(c.execution_place, '|', 1), ',', 2)), '')`;

interface AwardRow {
  id: number;
  basegov_id: string | number;
  object_brief_description: string | null;
  awarded: string | number;
  historical_base: string | number | null;
  publication_date: Date | string | null;
  cpvs: string | null;
  district: string | null;
  contracting_procedure_type: string | null;
  entity: string | null;
}

async function loadComparableAwards(prefix: string, months: number): Promise<Omit<ComparableAward, 'ratio' | 'ratio_source'>[]> {
  const { rows } = await pool.query(
    `SELECT c.id, c.basegov_id, c.object_brief_description, c.initial_contractual_price AS awarded,
            CASE
              WHEN (c.raw_detail_json->>'announcementId') ~ '^\\d+$'
                THEN (SELECT a.base_price FROM announcements a
                      WHERE a.basegov_id = (c.raw_detail_json->>'announcementId')::bigint
                      LIMIT 1)
              ELSE NULL
            END AS historical_base,
            c.publication_date, c.cpvs, ${DISTRICT_SQL} AS district,
            c.contracting_procedure_type,
            (SELECT string_agg(e.name, '; ' ORDER BY e.name)
               FROM contract_entities ce JOIN entities e ON e.id = ce.entity_id
              WHERE ce.contract_id = c.id AND ce.role = 'contracting') AS entity
       FROM contracts c
      WHERE c.publication_date >= CURRENT_DATE - ($2 || ' months')::interval
        AND c.initial_contractual_price IS NOT NULL
        AND c.initial_contractual_price > 0
        AND c.cpvs IS NOT NULL
        AND c.cpvs ~ ('(?:^|[,;][[:space:]]*)' || $1)
      ORDER BY c.publication_date DESC NULLS LAST
      LIMIT 400`,
    [prefix, String(months)]
  ) as { rows: AwardRow[] };
  return rows.map((r) => ({
    id: r.id,
    basegov_id: Number(r.basegov_id),
    title: r.object_brief_description,
    entity: r.entity,
    awarded: Number(r.awarded),
    historical_base: r.historical_base != null ? Number(r.historical_base) : null,
    publication_date: r.publication_date ? String(r.publication_date).slice(0, 10) : null,
    cpv: r.cpvs,
    district: r.district,
    procedure_type: r.contracting_procedure_type,
  }));
}

export async function statisticalForecastForAnnouncement(announcementId: number): Promise<{
  announcement: {
    id: number;
    designation: string | null;
    entity: string | null;
    base_price: number | null;
    cpvs: string | null;
    procedure_type: string | null;
    contract_type: string | null;
  };
  statistical: StatisticalForecast;
}> {
  const { rows } = await pool.query(
    `SELECT id, contract_designation, contracting_entity, base_price, cpvs,
            coalesce(model_type, contracting_procedure_type) AS procedure_type, contract_type
       FROM announcements WHERE id = $1`,
    [announcementId]
  );
  if (rows.length === 0) throw Object.assign(new Error('Anúncio não encontrado'), { statusCode: 404 });
  const a = rows[0];
  const basePrice = a.base_price != null ? Number(a.base_price) : 0;
  const digits = cpvDigits(a.cpvs);
  const input: ForecastInput = {
    basePrice,
    cpv: a.cpvs,
    entity: a.contracting_entity,
    district: null,
    procedureType: a.procedure_type,
  };
  const announcement = {
    id: a.id as number,
    designation: a.contract_designation as string | null,
    entity: a.contracting_entity as string | null,
    base_price: basePrice || null,
    cpvs: a.cpvs as string | null,
    procedure_type: a.procedure_type as string | null,
    contract_type: a.contract_type as string | null,
  };
  if (!digits) {
    return {
      announcement,
      statistical: buildStatisticalForecast(input, []),
    };
  }
  const prefix = digits.slice(0, Math.min(4, digits.length));
  const awards = await loadComparableAwards(prefix, FORECAST_LOOKBACK_MONTHS);
  return {
    announcement,
    statistical: buildStatisticalForecast(input, awards, FORECAST_LOOKBACK_MONTHS),
  };
}

export function llmFingerprint(stat: StatisticalForecast): string {
  return [
    stat.sample_size,
    stat.entity_sample_size,
    stat.match_level,
    stat.low_pct != null ? stat.low_pct.toFixed(4) : '',
    stat.high_pct != null ? stat.high_pct.toFixed(4) : '',
  ].join('|');
}

export function clampForecastPct(n: number): number {
  if (!Number.isFinite(n)) return 0.7;
  return Math.min(1.05, Math.max(0.3, n));
}

export function confidenceLabel(c: ForecastConfidence): string {
  switch (c) {
    case 'alta': return 'Alta';
    case 'media': return 'Média';
    case 'baixa': return 'Baixa';
    case 'insuficiente': return 'Insuficiente';
    default: {
      const _x: never = c;
      return _x;
    }
  }
}
