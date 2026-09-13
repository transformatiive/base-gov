import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkFitItems, FIT_AI_BATCH_SIZE, FIT_CACHE_LOOKUP_LIMIT } from './fit-batch.js';

test('Fit IA: lotes pequenos — 100 oportunidades não vão numa só chamada', () => {
  assert.equal(FIT_AI_BATCH_SIZE, 8);
  assert.ok(FIT_AI_BATCH_SIZE < 20);
  const items = Array.from({ length: 100 }, (_, i) => i);
  const chunks = chunkFitItems(items);
  assert.equal(chunks.length, 13);
  assert.equal(chunks[0]?.length, 8);
  assert.equal(chunks.at(-1)?.length, 4);
  assert.equal(chunks.flat().length, 100);
  assert.ok(FIT_CACHE_LOOKUP_LIMIT >= 100);
});
