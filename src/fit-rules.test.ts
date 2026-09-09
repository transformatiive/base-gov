import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFitRules, type CompanyProfileRules } from './fit-rules.js';

const base: CompanyProfileRules = {
  districts: [],
  value_min: null,
  value_max: null,
  excluded_terms: [],
  excluded_entities: [],
};

test('perfil vazio não aplica regras', () => {
  const r = applyFitRules({ title: 'Manutenção de espaços verdes', value: 50_000, district: 'Porto' }, base);
  assert.equal(r.skipAi, false);
  assert.equal(r.cap, null);
  assert.equal(r.hits.length, 0);
});

test('sem perfil (null) não aplica regras — regressão do fit actual', () => {
  const r = applyFitRules({ title: 'Obra', value: 1, district: 'Faro' }, null);
  assert.deepEqual(r, { skipAi: false, cap: null, hits: [] });
});

test('exclusão por termo no título, sem acentos/maiúsculas', () => {
  const r = applyFitRules(
    { title: 'Manutenção de espaços verdes' },
    { ...base, excluded_terms: ['manutencao'] }
  );
  assert.equal(r.skipAi, true);
  assert.equal(r.cap, 0);
  assert.match(r.hits[0]?.text ?? '', /contém/i);
});

test('exclusão por termo na descrição', () => {
  const r = applyFitRules(
    { title: 'Empreitada', description: 'Inclui manutenção predial' },
    { ...base, excluded_terms: ['manutenção'] }
  );
  assert.equal(r.skipAi, true);
});

test('entidade excluída — skip IA', () => {
  const r = applyFitRules(
    { title: 'Obra', entity: 'Município de Lisboa' },
    { ...base, excluded_entities: ['municipio de lisboa'] }
  );
  assert.equal(r.skipAi, true);
  assert.equal(r.hits[0]?.code, 'exclusao_entidade');
});

test('geografia limita a 20 e não eleva', () => {
  const r = applyFitRules(
    { title: 'Reabilitação', district: 'Porto' },
    { ...base, districts: ['Lisboa', 'Setúbal'] }
  );
  assert.equal(r.skipAi, false);
  assert.equal(r.cap, 20);
  assert.match(r.hits[0]?.text ?? '', /Porto/);
});

test('distrito desconhecido não penaliza', () => {
  const r = applyFitRules(
    { title: 'Obra', district: null },
    { ...base, districts: ['Lisboa'] }
  );
  assert.equal(r.cap, null);
  assert.equal(r.hits.length, 0);
});

test('valor fora do intervalo limita a 35', () => {
  const r = applyFitRules(
    { title: 'Obra', value: 500_000 },
    { ...base, value_min: 20_000, value_max: 200_000 }
  );
  assert.equal(r.cap, 35);
  assert.equal(r.skipAi, false);
});

test('valor desconhecido não penaliza', () => {
  const r = applyFitRules(
    { title: 'Obra', value: null },
    { ...base, value_min: 10_000, value_max: 80_000 }
  );
  assert.equal(r.cap, null);
  assert.equal(r.hits.length, 0);
});
