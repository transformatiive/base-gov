import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchOrigin, shouldLiveScrape, LOCAL_MATCH_LIMIT, pendingSearchOrderSql } from './profile-run-policy.js';

test('pesquisa de profile_run não vai ao BASE.gov — o match é no corpus local', () => {
  assert.equal(searchOrigin(42), 'profile_run');
  assert.equal(shouldLiveScrape('profile_run'), false);
});

test('pesquisa manual (sem profile_run_id) mantém o scrape ao vivo', () => {
  assert.equal(searchOrigin(null), 'manual');
  assert.equal(searchOrigin(undefined), 'manual');
  assert.equal(shouldLiveScrape('manual'), true);
});

test('a fila trata primeiro as pesquisas de perfil (match local), depois as manuais', () => {
  assert.match(pendingSearchOrderSql(), /profile_run_id IS NULL/);
});

test('match local tem tecto para o tick do worker não varrer 2 M de contratos', () => {
  assert.ok(LOCAL_MATCH_LIMIT >= 100);
  assert.ok(LOCAL_MATCH_LIMIT <= 5000);
});
