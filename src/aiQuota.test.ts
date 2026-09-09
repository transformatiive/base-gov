import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addCalendarDays,
  lisbonMidnight,
  lisbonYmd,
  quotaLevel,
  quotaPeriod,
  resetLabel,
} from './aiQuota.js';

test('addCalendarDays atravessa meses e anos', () => {
  assert.equal(addCalendarDays('2026-09-09', 30), '2026-10-09');
  assert.equal(addCalendarDays('2026-01-31', 30), '2026-03-02');
  assert.equal(addCalendarDays('2025-12-20', 30), '2026-01-19');
});

test('lisbonMidnight é 00:00 em Lisboa (inverno UTC+0)', () => {
  const d = lisbonMidnight('2026-01-15');
  assert.equal(d.toISOString(), '2026-01-15T00:00:00.000Z');
  assert.equal(lisbonYmd(d), '2026-01-15');
});

test('lisbonMidnight é 00:00 em Lisboa (verão UTC+1)', () => {
  const d = lisbonMidnight('2026-07-15');
  assert.equal(d.toISOString(), '2026-07-14T23:00:00.000Z');
  assert.equal(lisbonYmd(d), '2026-07-15');
});

test('quotaPeriod: inscrição a 9 Set 15:30 Lisboa reseta a 9 Out 00:00', () => {
  const enrolled = new Date('2026-09-09T14:30:00.000Z'); // 15:30 WEST
  const now = new Date('2026-09-20T10:00:00.000Z');
  const p = quotaPeriod(enrolled, now);
  assert.equal(p.start.toISOString(), lisbonMidnight('2026-09-09').toISOString());
  assert.equal(p.end.toISOString(), lisbonMidnight('2026-10-09').toISOString());
  assert.equal(resetLabel(p.end), '9 de outubro de 2026, 00:00');
});

test('quotaPeriod avança exactamente às 00:00 do dia de reset', () => {
  const enrolled = new Date('2026-09-09T10:00:00.000Z');
  const justBefore = new Date(lisbonMidnight('2026-10-09').getTime() - 1);
  const atReset = lisbonMidnight('2026-10-09');
  const before = quotaPeriod(enrolled, justBefore);
  const after = quotaPeriod(enrolled, atReset);
  assert.equal(lisbonYmd(before.end), '2026-10-09');
  assert.equal(lisbonYmd(after.start), '2026-10-09');
  assert.equal(lisbonYmd(after.end), '2026-11-08');
});

test('quotaPeriod atravessa o salto de hora de março', () => {
  const enrolled = new Date('2026-02-27T12:00:00.000Z');
  const now = new Date('2026-03-10T12:00:00.000Z');
  const p = quotaPeriod(enrolled, now);
  assert.equal(lisbonYmd(p.start), '2026-02-27');
  assert.equal(lisbonYmd(p.end), '2026-03-29');
  assert.equal(lisbonYmd(p.end), lisbonYmd(lisbonMidnight('2026-03-29')));
});

test('quotaLevel: 80% amarelo, 90% vermelho, 100% teto', () => {
  assert.equal(quotaLevel(0, 40), 'ok');
  assert.equal(quotaLevel(31, 40), 'ok');
  assert.equal(quotaLevel(32, 40), 'warn');
  assert.equal(quotaLevel(35, 40), 'warn');
  assert.equal(quotaLevel(36, 40), 'alert');
  assert.equal(quotaLevel(40, 40), 'capped');
  assert.equal(quotaLevel(41, 40), 'capped');
  assert.equal(quotaLevel(199, 250), 'ok');
  assert.equal(quotaLevel(200, 250), 'warn');
  assert.equal(quotaLevel(225, 250), 'alert');
});
