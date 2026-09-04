import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occupiedSeatCount, seatsAtLimit } from './seat-occupancy.js';

test('lugar pendente conta para o tecto — Pro 1 membro + 1 convite = 2/2', () => {
  assert.equal(occupiedSeatCount(1, 1), 2);
  assert.equal(seatsAtLimit(occupiedSeatCount(1, 1), 2), true);
  assert.equal(seatsAtLimit(occupiedSeatCount(1, 0), 2), false);
});

test('Grátis: 1 membro, 0 convites — no tecto; Business 2+1 ainda cabe em 10', () => {
  assert.equal(seatsAtLimit(occupiedSeatCount(1, 0), 1), true);
  assert.equal(seatsAtLimit(occupiedSeatCount(2, 1), 10), false);
  assert.equal(occupiedSeatCount(9, 1), 10);
  assert.equal(seatsAtLimit(10, 10), true);
});
