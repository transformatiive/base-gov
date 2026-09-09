import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertTransition, itemTextHash } from './pipeline.js';

test('Nova → Interessa permitida', () => {
  assert.doesNotThrow(() => assertTransition(null, 'interessa'));
});

test('submetida → interessa recusada com a mensagem exacta', () => {
  try {
    assertTransition('submetida', 'interessa');
    assert.fail('esperava 409');
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    assert.equal(e.statusCode, 409);
    assert.equal(e.message, 'Uma proposta submetida só pode passar a Ganha, Perdida ou Descartada');
  }
});

test('descartada → interessa é reversível', () => {
  assert.doesNotThrow(() => assertTransition('descartada', 'interessa'));
});

test('ganha é terminal para não-admin (assertTransition)', () => {
  try {
    assertTransition('ganha', 'interessa');
    assert.fail('esperava 409');
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    assert.equal(e.statusCode, 409);
  }
});

test('hash da checklist é estável a acentos e maiúsculas', () => {
  assert.equal(itemTextHash('Alvará Classe 4'), itemTextHash('alvara classe 4'));
});
