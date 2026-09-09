import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEDICAL_DEVICES_CPV,
  mergeCpvHints,
  refineActivityTerms,
  termsNeedMedicalDeviceCpv,
} from './cpv-hints.js';

test('detecta «dispositivos médicos» e não o termo genérico saúde sozinho', () => {
  assert.equal(termsNeedMedicalDeviceCpv(['dispositivos médicos', 'saúde']), true);
  assert.equal(termsNeedMedicalDeviceCpv(['reabilitação']), false);
  assert.equal(termsNeedMedicalDeviceCpv(['saúde']), false);
  assert.equal(termsNeedMedicalDeviceCpv(['iluminação LED']), false);
});

test('refine: tira saúde genérico quando há dispositivos médicos; LED/reabilitação intactos', () => {
  assert.deepEqual(
    refineActivityTerms(['dispositivos médicos', 'saúde']),
    ['dispositivos médicos'],
  );
  assert.deepEqual(refineActivityTerms(['reabilitação', 'fachadas']), ['reabilitação', 'fachadas']);
  assert.deepEqual(refineActivityTerms(['iluminação LED', 'energia']), ['iluminação LED', 'energia']);
});

test('merge CPV 33100000-1 se ainda não houver divisão 331', () => {
  assert.deepEqual(mergeCpvHints(['dispositivos médicos'], []), [MEDICAL_DEVICES_CPV]);
  assert.deepEqual(mergeCpvHints(['dispositivos médicos'], ['33140000-3']), ['33140000-3']);
  assert.deepEqual(mergeCpvHints(['reabilitação'], []), []);
});
