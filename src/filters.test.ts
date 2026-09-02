import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listFilters, PlanRequiredError } from './filters.js';

test('filtros básicos (distrito, prazo, texto) no plano grátis', () => {
  const r = listFilters({ q: 'reabilitação', district: 'Lisboa', deadline: '30' }, 'free', 'announcements', 'a', 0);
  assert.ok(r.where.length >= 3);
  assert.match(r.orderBy, /proposal_deadline_date/);
});

test('filtro de valor no plano grátis → PlanRequiredError', () => {
  assert.throws(
    () => listFilters({ value_min: '20000', value_max: '200000' }, 'free', 'announcements', 'a', 0),
    PlanRequiredError,
  );
});

test('filtro de valor no Pro gera SQL e exclui sem valor', () => {
  const r = listFilters({ value_min: '20000', value_max: '200000', procedure: 'Concurso público' }, 'pro', 'announcements', 'a', 0);
  assert.equal(r.excludedNoValue, true);
  assert.ok(r.where.some((w) => w.includes('base_price')));
  assert.ok(r.where.some((w) => w.includes('contracting_procedure_type')));
});

test('ordenar por valor põe NULLS LAST', () => {
  const r = listFilters({ sort: 'value', order: 'desc' }, 'pro', 'announcements', 'a', 0);
  assert.match(r.orderBy, /base_price DESC NULLS LAST/);
});

test('Sem localização usa IS NULL no distrito', () => {
  const r = listFilters({ district: '__unknown__' }, 'free', 'announcements', 'a', 0);
  assert.ok(r.where.some((w) => w.includes('IS NULL')));
});
