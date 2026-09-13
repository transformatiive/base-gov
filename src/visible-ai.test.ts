import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAiModelId, stripAiModelIds } from './visible-ai.js';

test('stripAiModelIds remove anthropic/claude e gpt da cópia visível', () => {
  assert.equal(stripAiModelIds('Análise nova · anthropic/claude-sonnet-5'), 'Análise nova');
  assert.equal(stripAiModelIds('Fit com gpt-4o-mini'), 'Fit com');
  assert.equal(isAiModelId('anthropic/claude-haiku-4.5'), true);
  assert.equal(isAiModelId('Análise nova'), false);
});

test('a SPA não mostra o id do modelo nem o toggle de PDF', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /anthropic\/claude/);
  assert.doesNotMatch(app, /Análise nova.*\$\{esc\(model\)\}/);
  assert.doesNotMatch(app, /Active «Descarregar documentos PDF»/);
  assert.doesNotMatch(app, /name="docs"> Descarregar documentos PDF/);
  assert.match(app, /id: 'proposta', label: 'Proposta'/);
  assert.match(app, /mountProposalPanel\(document\.getElementById\('proposal-panel'\), 'contract'/);
  assert.match(app, /cache_only: true/);
});
