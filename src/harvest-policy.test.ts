import assert from 'node:assert/strict';
import test from 'node:test';
import {
  announcementNeedsDetail,
  harvestPageLimit,
  harvestShouldFetchNextPage,
  profileScheduleDue,
} from './harvest-policy.js';

const now = new Date('2026-09-10T12:00:00Z');

test('perfil diário: sem run anterior agenda; com run há 1 h não', () => {
  assert.equal(
    profileScheduleDue({ schedule: 'daily', hasInFlight: false, lastFinishedAt: null, now }),
    true,
  );
  assert.equal(
    profileScheduleDue({
      schedule: 'daily',
      hasInFlight: false,
      lastFinishedAt: new Date('2026-09-10T11:00:00Z'),
      now,
    }),
    false,
  );
  assert.equal(
    profileScheduleDue({
      schedule: 'daily',
      hasInFlight: false,
      lastFinishedAt: new Date('2026-09-09T11:00:00Z'),
      now,
    }),
    true,
  );
});

test('perfil com run preso não recebe outro enquanto o anterior não fechar', () => {
  assert.equal(
    profileScheduleDue({
      schedule: 'daily',
      hasInFlight: true,
      lastFinishedAt: new Date('2026-04-01T00:00:00Z'),
      now,
    }),
    false,
  );
});

test('manual nunca agenda; semanal só após 7 dias', () => {
  assert.equal(
    profileScheduleDue({ schedule: 'manual', hasInFlight: false, lastFinishedAt: null, now }),
    false,
  );
  assert.equal(
    profileScheduleDue({
      schedule: 'weekly',
      hasInFlight: false,
      lastFinishedAt: new Date('2026-09-08T12:00:00Z'),
      now,
    }),
    false,
  );
  assert.equal(
    profileScheduleDue({
      schedule: 'weekly',
      hasInFlight: false,
      lastFinishedAt: new Date('2026-09-02T12:00:00Z'),
      now,
    }),
    true,
  );
});

test('colheita inaugural pede mais páginas do que o ritmo de 6 h', () => {
  assert.equal(harvestPageLimit(null, now), 200);
  assert.equal(harvestPageLimit(new Date('2026-09-10T08:00:00Z'), now), 40);
  assert.equal(harvestPageLimit(new Date('2026-08-01T00:00:00Z'), now), 120);
});

test('páginas ordenadas por data DR: pára quando o lote já é anterior ao lookback', () => {
  assert.equal(harvestShouldFetchNextPage(['2026-09-10', '2026-09-01'], '2026-08-20'), true);
  assert.equal(harvestShouldFetchNextPage(['2026-08-01', '2026-07-15'], '2026-08-20'), false);
  assert.equal(harvestShouldFetchNextPage([], '2026-08-20'), false);
});

test('detalhe só para concursos ainda sem ficha e com prazo em aberto ou desconhecido', () => {
  assert.equal(
    announcementNeedsDetail({ detailScraped: true, proposalDeadlineYmd: '2026-12-01', todayYmd: '2026-09-10' }),
    false,
  );
  assert.equal(
    announcementNeedsDetail({ detailScraped: false, proposalDeadlineYmd: '2026-09-01', todayYmd: '2026-09-10' }),
    false,
  );
  assert.equal(
    announcementNeedsDetail({ detailScraped: false, proposalDeadlineYmd: null, todayYmd: '2026-09-10' }),
    true,
  );
  assert.equal(
    announcementNeedsDetail({ detailScraped: false, proposalDeadlineYmd: '2026-09-20', todayYmd: '2026-09-10' }),
    true,
  );
});
