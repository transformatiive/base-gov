import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchOrigin, shouldLiveScrape, LOCAL_MATCH_LIMIT, pendingSearchOrderSql, formatKpiCount, noveltyCounts, searchHitLocalLimit } from './profile-run-policy.js';

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
  assert.equal(searchHitLocalLimit(LOCAL_MATCH_LIMIT), true);
  assert.equal(searchHitLocalLimit(LOCAL_MATCH_LIMIT - 1), false);
});

test('KPI truncado mostra 2 000+, sem tecto parece o universo', () => {
  assert.equal(formatKpiCount(2000, true), '2\u00a0000+');
  assert.equal(formatKpiCount(2000, false), '2\u00a0000');
  assert.equal(formatKpiCount(0, true), '0');
});

test('novidades: profile_run local usa o total cruzado; manual só o criado depois do início', () => {
  assert.deepEqual(
    noveltyCounts({
      origin: 'profile_run',
      matchedContracts: 547,
      matchedAnnouncements: 55,
      createdAfterStartContracts: 0,
      createdAfterStartAnnouncements: 0,
    }),
    { new_contracts: 547, new_announcements: 55 },
  );
  assert.deepEqual(
    noveltyCounts({
      origin: 'manual',
      matchedContracts: 100,
      matchedAnnouncements: 10,
      createdAfterStartContracts: 3,
      createdAfterStartAnnouncements: 1,
    }),
    { new_contracts: 3, new_announcements: 1 },
  );
});
