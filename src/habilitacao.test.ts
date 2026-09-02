import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confrontHabilitacao, overlayHabilitacao } from './habilitacao.js';

test('perfil vazio → não determinável + hint Complete o perfil', () => {
  const r = confrontHabilitacao(['Alvará classe 4'], []);
  assert.equal(r.profileEmpty, true);
  assert.equal(r.items[0]?.status, 'indeterminavel');
  const over = overlayHabilitacao({ requisitos_habilitacao: ['Alvará classe 4'], go_no_go: { recomendacao: 'go' } }, []) as {
    habilitacao_hint?: string;
  };
  assert.equal(over.habilitacao_hint, 'Complete o perfil da empresa');
});

test('sem alvará classe 4 quando o caderno exige → não tem, go condicional, red flag', () => {
  const over = overlayHabilitacao(
    {
      requisitos_habilitacao: ['Alvará classe 4'],
      go_no_go: { recomendacao: 'go', justificacao: 'fit alto' },
      red_flags: [],
    },
    ['Alvará classe 3', 'ISO 9001']
  ) as {
    habilitacao: { status: string }[];
    go_no_go: { recomendacao: string };
    red_flags: string[];
  };
  assert.equal(over.habilitacao[0]?.status, 'nao_tem');
  assert.equal(over.go_no_go.recomendacao, 'condicional');
  assert.ok(over.red_flags.some((f) => /Habilitação não coberta pelo perfil/.test(f)));
});

test('certificação coberta → tem, não rebaixa go', () => {
  const over = overlayHabilitacao(
    { requisitos_habilitacao: ['ISO 9001'], go_no_go: { recomendacao: 'go' }, red_flags: [] },
    ['ISO 9001']
  ) as { habilitacao: { status: string }[]; go_no_go: { recomendacao: string } };
  assert.equal(over.habilitacao[0]?.status, 'tem');
  assert.equal(over.go_no_go.recomendacao, 'go');
});
