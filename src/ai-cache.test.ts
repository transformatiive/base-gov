import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asParts, buildChatBody, cached, cachedBlocks, plain, userWithCachedPrefix } from './ai-cache.js';

type Msg = { content: { text: string; cache_control?: { type: string } }[] };

function msgs(body: Record<string, unknown>): Msg[] {
  return body.messages as Msg[];
}

test('string no system fica em cache; string no user não', () => {
  const body = buildChatBody({
    model: 'anthropic/claude-sonnet-5',
    system: 'instruções estáveis',
    user: 'contrato único',
    maxTokens: 900,
    sessionId: 'analise-split',
  });
  assert.equal(body.session_id, 'analise-split');
  assert.deepEqual(body.usage, { include: true });
  const sys = msgs(body)[0].content;
  const usr = msgs(body)[1].content;
  assert.deepEqual(sys, [{ type: 'text', text: 'instruções estáveis', cache_control: { type: 'ephemeral' } }]);
  assert.deepEqual(usr, [{ type: 'text', text: 'contrato único' }]);
  assert.equal(usr[0]?.cache_control, undefined);
});

test('Fit IA: rubrica global + perfil em dois breakpoints; lote único fora do cache', () => {
  const body = buildChatBody({
    model: 'anthropic/claude-haiku-4.5',
    system: cachedBlocks('rubrica FIT estável', 'perfil empresa X + few-shot'),
    user: 'key=anuncio:1 | CONCURSO | granito',
    maxTokens: 1800,
    sessionId: 'fit:42',
  });
  assert.equal(body.session_id, 'fit:42');
  const sys = msgs(body)[0].content;
  const usr = msgs(body)[1].content;
  assert.equal(sys.length, 2);
  assert.equal(sys[0]?.cache_control?.type, 'ephemeral');
  assert.equal(sys[1]?.cache_control?.type, 'ephemeral');
  assert.equal(sys[1]?.text, 'perfil empresa X + few-shot');
  assert.equal(usr[0]?.cache_control, undefined);
});

test('system já em Part[] plain não ganha cache_control (digest curto)', () => {
  const body = buildChatBody({
    model: 'anthropic/claude-haiku-4.5',
    system: [plain('parágrafo único da semana')],
    user: '12 concursos, 3 renovações',
    maxTokens: 400,
  });
  assert.equal(body.session_id, undefined);
  assert.equal(msgs(body)[0].content[0]?.cache_control, undefined);
});

test('Part[] já marcadas não são reembrulhadas', () => {
  const user = userWithCachedPrefix('caderno…', 'Responde com o schema X');
  const body = buildChatBody({
    model: 'm',
    system: [cached('lead')],
    user,
    maxTokens: 100,
  });
  const usr = (body.messages as { content: ReturnType<typeof cached>[] }[])[1].content;
  assert.equal(usr[0]?.cache_control?.type, 'ephemeral');
  assert.equal(usr[1]?.cache_control, undefined);
  assert.equal(usr[1]?.text, 'Responde com o schema X');
});

test('asParts ignora blocos vazios', () => {
  assert.deepEqual(asParts('', true), []);
  assert.deepEqual(asParts([plain('ok'), plain('')], false), [plain('ok')]);
  assert.deepEqual(cachedBlocks(' a ', '', 'b'), [cached('a'), cached('b')]);
});
