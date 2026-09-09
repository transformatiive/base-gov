import assert from 'node:assert/strict';
import test from 'node:test';
import {
  actionFromApi,
  classifyOrigin,
  fillDailySeries,
  moduleFromPath,
  moduleLabel,
  parseDays,
  parseUsageEvent,
  shouldSkipPath,
  svgTrend,
  VISITOR_COOKIE,
} from './usage.js';

test('moduleFromPath mapeia hashes da SPA e páginas públicas', () => {
  assert.equal(moduleFromPath('#/hoje'), 'hoje');
  assert.equal(moduleFromPath('#/'), 'hoje');
  assert.equal(moduleFromPath('#/radar/opportunities'), 'oportunidades');
  assert.equal(moduleFromPath('#/insights/renewals'), 'renovacoes');
  assert.equal(moduleFromPath('#/pipeline'), 'carteira');
  assert.equal(moduleFromPath('#/radar/announcements'), 'concursos');
  assert.equal(moduleFromPath('#/radar/map'), 'mapa');
  assert.equal(moduleFromPath('#/radar/seasonality'), 'sazonalidade');
  assert.equal(moduleFromPath('#/radar/competitors'), 'concorrentes');
  assert.equal(moduleFromPath('#/entities/12'), 'entidades');
  assert.equal(moduleFromPath('#/announcements/99'), 'ficha_anuncio');
  assert.equal(moduleFromPath('#/contracts/3'), 'ficha_contrato');
  assert.equal(moduleFromPath('#/config/searches'), 'pesquisas');
  assert.equal(moduleFromPath('#/planos'), 'planos');
  assert.equal(moduleFromPath('#/registo'), 'registo');
  assert.equal(moduleFromPath('/'), 'landing');
  assert.equal(moduleFromPath('/guias/ajuste-direto-e-concurso-publico'), 'guias');
  assert.equal(moduleFromPath('/privacidade'), 'privacidade');
});

test('shouldSkipPath ignora admin, QA e API', () => {
  assert.equal(shouldSkipPath('#/admin'), true);
  assert.equal(shouldSkipPath('#/admin/uso'), true);
  assert.equal(shouldSkipPath('#/qa'), true);
  assert.equal(shouldSkipPath('/api/usage'), true);
  assert.equal(shouldSkipPath('#/hoje'), false);
  assert.equal(shouldSkipPath('/guias'), false);
});

test('classifyOrigin: UTM ganha, senão referrer, senão directo', () => {
  assert.equal(classifyOrigin({ utmSource: 'linkedin', referrer: 'https://google.com/x' }), 'linkedin');
  assert.equal(classifyOrigin({ referrer: 'https://www.google.com/search?q=x' }), 'search');
  assert.equal(classifyOrigin({ referrer: 'https://www.linkedin.com/feed' }), 'social');
  assert.equal(classifyOrigin({ referrer: 'https://www.base.gov.pt/foo' }), 'portal_base');
  assert.equal(classifyOrigin({ referrer: 'https://basegov-robot-production.up.railway.app/guias' }), 'internal');
  assert.equal(classifyOrigin({ referrer: 'https://prepbid.com/guias' }), 'internal');
  assert.equal(classifyOrigin({ referrer: 'https://concursivo.com/guias' }), 'internal');
  assert.equal(classifyOrigin({ referrer: 'https://news.ycombinator.com/item?id=1' }), 'news.ycombinator.com');
  assert.equal(classifyOrigin({}), 'direct');
});

test('parseUsageEvent valida kind, path e visitor; recusa javascript', () => {
  const ok = parseUsageEvent({
    kind: 'page_view',
    path: '#/pipeline',
    visitor_id: '11111111-1111-4111-8111-111111111111',
    referrer: 'https://www.google.pt/',
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.module, 'carteira');
    assert.equal(ok.value.origin, 'search');
    assert.equal(ok.value.kind, 'page_view');
  }

  const bad = parseUsageEvent({ kind: 'page_view', path: 'javascript:alert(1)' });
  assert.equal(bad.ok, false);

  const skip = parseUsageEvent({ kind: 'page_view', path: '#/admin/uso' });
  assert.equal(skip.ok, false);
});

test('actionFromApi traduz POSTs da API em acções', () => {
  assert.equal(actionFromApi('POST', '/api/announcements/12/analyze'), 'analise_anuncio');
  assert.equal(actionFromApi('POST', '/api/announcements/12/proposals/generate'), 'proposta');
  assert.equal(actionFromApi('PUT', '/api/pipeline/announcement/3'), 'carteira');
  assert.equal(actionFromApi('POST', '/api/billing/checkout'), 'checkout');
  assert.equal(actionFromApi('POST', '/api/profiles'), 'criar_perfil');
  assert.equal(actionFromApi('GET', '/api/announcements'), null);
  assert.equal(actionFromApi('POST', '/api/usage'), null);
});

test('parseDays só aceita 7, 30 ou 90', () => {
  assert.equal(parseDays('7'), 7);
  assert.equal(parseDays('30'), 30);
  assert.equal(parseDays('90'), 90);
  assert.equal(parseDays('15'), 30);
  assert.equal(parseDays(undefined), 30);
});

test('fillDailySeries preenche dias sem eventos com zero', () => {
  const series = fillDailySeries('2026-09-01', '2026-09-04', [{ day: '2026-09-02', n: 4 }]);
  assert.deepEqual(series.map((r) => r.n), [0, 4, 0, 0]);
  assert.equal(series[0].day, '2026-09-01');
});

test('svgTrend gera um SVG com path e sem script', () => {
  const svg = svgTrend([
    { day: '2026-09-01', n: 1 },
    { day: '2026-09-02', n: 5 },
    { day: '2026-09-03', n: 2 },
  ]);
  assert.match(svg, /<svg /);
  assert.match(svg, /<path /);
  assert.doesNotMatch(svg, /<script/);
});

test('moduleLabel é português e exaustivo nos módulos conhecidos', () => {
  assert.equal(moduleLabel('hoje'), 'Hoje');
  assert.equal(moduleLabel('carteira'), 'Carteira');
  assert.equal(moduleLabel('landing'), 'Landing');
  assert.equal(moduleLabel('guias'), 'Guias');
});

test('cookie do visitante tem nome estável', () => {
  assert.equal(VISITOR_COOKIE, 'br_vid');
});
