import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_FORECAST_SAMPLE,
  buildStatisticalForecast,
  clampForecastPct,
  cpvDigits,
  discountRatio,
  forecastConfidence,
  formatPctRange,
  llmFingerprint,
  percentile,
  type ForecastInput,
} from './closeForecast.js';

const base: ForecastInput = {
  basePrice: 100_000,
  cpv: '45233120-6',
  entity: 'Município de Sintra',
  district: 'Lisboa',
  procedureType: 'Concurso público',
};

function row(over: Partial<{
  id: number; awarded: number; historical_base: number | null; entity: string | null; cpv: string | null;
}>) {
  const id = over.id ?? 1;
  return {
    id,
    basegov_id: 1000 + id,
    title: `Contrato ${id}`,
    entity: over.entity ?? 'Município de Sintra',
    awarded: over.awarded ?? 75_000,
    historical_base: over.historical_base === undefined ? 100_000 : over.historical_base,
    publication_date: '2025-03-01',
    cpv: over.cpv ?? '45233120-6 — Estradas',
    district: 'Lisboa',
    procedure_type: 'Concurso público',
  };
}

test('cpvDigits keeps the first 2–8 digit code', () => {
  assert.equal(cpvDigits('45233120-6 — Estradas'), '45233120');
  assert.equal(cpvDigits('45.23'), '45');
  assert.equal(cpvDigits(null), '');
});

test('discountRatio drops outliers', () => {
  assert.equal(discountRatio(75_000, 100_000), 0.75);
  assert.equal(discountRatio(10_000, 100_000), null);
  assert.equal(discountRatio(130_000, 100_000), null);
  assert.equal(discountRatio(50, 0), null);
});

test('percentile interpolates', () => {
  assert.equal(percentile([1], 0.5), 1);
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(percentile([10, 20], 0.25), 12.5);
});

test('forecastConfidence thresholds match the spec', () => {
  assert.equal(forecastConfidence(4, 4), 'insuficiente');
  assert.equal(forecastConfidence(5, 0), 'baixa');
  assert.equal(forecastConfidence(8, 2), 'media');
  assert.equal(forecastConfidence(20, 5), 'alta');
  assert.equal(forecastConfidence(20, 2), 'media');
});

test('buildStatisticalForecast hides estimate below min sample', () => {
  const rows = Array.from({ length: MIN_FORECAST_SAMPLE - 1 }, (_, i) => row({ id: i + 1 }));
  const f = buildStatisticalForecast(base, rows);
  assert.equal(f.available, false);
  assert.equal(f.confidence, 'insuficiente');
  assert.equal(f.low_pct, null);
  assert.match(f.note, /insuficiente/);
});

test('buildStatisticalForecast uses pair ratios and entity subsample', () => {
  const rows = Array.from({ length: 14 }, (_, i) => row({
    id: i + 1,
    awarded: 70_000 + i * 500,
    historical_base: 100_000,
  }));
  const f = buildStatisticalForecast(base, rows);
  assert.equal(f.available, true);
  assert.equal(f.sample_size, 14);
  assert.equal(f.entity_sample_size, 14);
  assert.equal(f.confidence, 'media');
  assert.ok(f.low_pct != null && f.low_pct >= 0.7 && f.low_pct <= 0.8);
  assert.ok(f.high_pct != null && f.high_pct >= f.low_pct!);
  assert.equal(f.low_value, Math.round(100_000 * f.low_pct! * 100) / 100);
  assert.match(f.note, /14 concursos/);
  assert.match(f.note, /histórico/);
  assert.equal(f.used.length, 14);
});

test('buildStatisticalForecast prefers entity sample when n>=5', () => {
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => row({ id: i + 1, awarded: 80_000, entity: 'Município de Sintra' })),
    ...Array.from({ length: 10 }, (_, i) => row({ id: 20 + i, awarded: 50_000, entity: 'Outro Município', historical_base: 100_000 })),
  ];
  const f = buildStatisticalForecast(base, rows);
  assert.equal(f.sample_size, 6);
  assert.equal(f.entity_sample_size, 6);
  assert.ok(f.mid_pct != null && f.mid_pct > 0.75);
});

test('buildStatisticalForecast widens from 8-digit CPV to class when needed', () => {
  const rows = Array.from({ length: 6 }, (_, i) => row({
    id: i + 1,
    cpv: '45233210-4 — Pavimentos',
    awarded: 72_000,
  }));
  const f = buildStatisticalForecast(base, rows);
  assert.equal(f.available, true);
  assert.equal(f.match_level, 'cpv_class');
});

test('formatPctRange and clampForecastPct', () => {
  assert.equal(formatPctRange(0.701, 0.824), '70%–82%');
  assert.equal(clampForecastPct(0.1), 0.3);
  assert.equal(clampForecastPct(1.4), 1.05);
});

test('llmFingerprint changes when sample changes', () => {
  const a = buildStatisticalForecast(base, Array.from({ length: 8 }, (_, i) => row({ id: i + 1 })));
  const b = buildStatisticalForecast(base, Array.from({ length: 12 }, (_, i) => row({ id: i + 1 })));
  assert.notEqual(llmFingerprint(a), llmFingerprint(b));
});
