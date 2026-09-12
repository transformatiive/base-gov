import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aiProgressMessage,
  aiProgressPct,
  aiProgressStepIndex,
  isGenericHealthQuery,
  isMedicalDeviceQuery,
  localTextMatchMode,
  medicalDeviceMatchSql,
  notWorksNoiseSql,
} from './activity-match.js';

test('modo: dispositivos médicos vs saúde genérico vs obras', () => {
  assert.equal(localTextMatchMode('dispositivos médicos'), 'medical_devices');
  assert.equal(localTextMatchMode('Dispositivo médico'), 'medical_devices');
  assert.equal(localTextMatchMode('saúde'), 'generic_health');
  assert.equal(localTextMatchMode('Saude'), 'generic_health');
  assert.equal(localTextMatchMode('reabilitação'), 'default');
  assert.equal(localTextMatchMode('iluminação LED'), 'default');
  assert.equal(isMedicalDeviceQuery('reabilitação'), false);
  assert.equal(isGenericHealthQuery('saúde ocupacional'), false);
});

test('SQL de dispositivos exige 331 ou dispositivo+médic e exclui empreitada', () => {
  const sql = medicalDeviceMatchSql('a.contract_designation', 'coalesce(a.cpvs,\'\')');
  assert.match(sql, /331/);
  assert.match(sql, /dispositiv/);
  assert.match(sql, /empreitada/);
  assert.match(sql, /!~\*/);
  assert.doesNotMatch(sql, /contracting_entity/);
  assert.match(sql, /AND a\.contract_designation !~\*/);
});

test('saúde genérico só acrescenta exclusão de empreitadas', () => {
  assert.match(notWorksNoiseSql('c.object_brief_description'), /empreitada/);
});

test('progresso IA: último passo só depois de ~24 s', () => {
  assert.equal(aiProgressStepIndex(0, 5), 0);
  assert.equal(aiProgressStepIndex(5, 5), 1);
  assert.equal(aiProgressStepIndex(10, 5), 2);
  assert.equal(aiProgressStepIndex(17, 5), 3);
  assert.equal(aiProgressStepIndex(25, 5), 4);
  assert.ok(aiProgressPct(0) < 20);
  assert.ok(aiProgressPct(40) < aiProgressPct(70));
  assert.ok(aiProgressPct(60) <= 94);
});

test('progresso IA: depois do último passo, a cada 4 s avisa que continua', () => {
  const steps = ['um', 'dois', 'três', 'quatro', 'cinco'];
  assert.equal(aiProgressMessage(steps, 2), 'um');
  assert.equal(aiProgressMessage(steps, 25), 'cinco');
  assert.match(aiProgressMessage(steps, 30), /não ficou preso|cerca de um minuto|aguarde mais/);
  assert.notEqual(aiProgressMessage(steps, 30), aiProgressMessage(steps, 34));
});
