import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileAnalysisParts, sumUsage } from './ai-compile.js';

test('compileAnalysisParts junta ficha, requisitos e decisão', () => {
  const out = compileAnalysisParts(
    {
      resumo: 'Reabilitação de cobertura escolar',
      criterios_adjudicacao: '70% preço, 30% qualidade',
      prazos: { propostas: '12 dias', execucao: '90 dias' },
      preco_base: '287 000 €',
      caucao_garantias: '5%',
    },
    {
      requisitos_habilitacao: ['Alvará classe 4', 'ISO 9001'],
      red_flags: ['Prazo apertado'],
      checklist: ['Ler caderno', 'Confirmar alvará'],
    },
    {
      go_no_go: { recomendacao: 'go', justificacao: 'Fit alto e habilitação coberta' },
      fit_atividade: { score: 82.4, razao: 'Obra de reabilitação no núcleo' },
    },
  );
  assert.equal(out.resumo, 'Reabilitação de cobertura escolar');
  assert.equal((out.prazos as { propostas: string }).propostas, '12 dias');
  assert.deepEqual(out.requisitos_habilitacao, ['Alvará classe 4', 'ISO 9001']);
  assert.equal((out.go_no_go as { recomendacao: string }).recomendacao, 'go');
  assert.equal((out.fit_atividade as { score: number }).score, 82);
});

test('compileAnalysisParts preenche omissões e normaliza go/score', () => {
  const out = compileAnalysisParts(
    { resumo: '  ' },
    { requisitos_habilitacao: 'não é lista', red_flags: [42, '  ok  '] },
    { go_no_go: { recomendacao: 'AVANÇAR', justificacao: null }, fit_atividade: { score: 140 } },
  );
  assert.equal(out.resumo, '');
  assert.equal(out.criterios_adjudicacao, 'não especificado');
  assert.equal((out.prazos as { propostas: string; execucao: string }).propostas, 'n/d');
  assert.deepEqual(out.requisitos_habilitacao, []);
  assert.deepEqual(out.red_flags, ['42', 'ok']);
  assert.equal((out.go_no_go as { recomendacao: string }).recomendacao, 'condicional');
  assert.equal((out.fit_atividade as { score: number }).score, 100);
});

test('compileAnalysisParts sobrevive a partes vazias (falha parcial em paralelo)', () => {
  const out = compileAnalysisParts(
    { resumo: 'Só a ficha chegou' },
    undefined,
    { go_no_go: { recomendacao: 'no-go', justificacao: 'Fora da atividade' } },
  );
  assert.equal(out.resumo, 'Só a ficha chegou');
  assert.deepEqual(out.checklist, []);
  assert.equal((out.go_no_go as { recomendacao: string }).recomendacao, 'no-go');
  assert.equal((out.fit_atividade as { score: number }).score, 0);
});

test('sumUsage soma tokens das partes paralelas', () => {
  assert.deepEqual(
    sumUsage({ tokens_in: 10, tokens_out: 2 }, { tokens_in: 5, tokens_out: 3 }, { tokens_in: 1, tokens_out: 1 }),
    { tokens_in: 16, tokens_out: 6 },
  );
  assert.deepEqual(sumUsage(), { tokens_in: 0, tokens_out: 0 });
});
