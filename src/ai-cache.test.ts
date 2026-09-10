import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asParts, buildChatBody, cached, plain, userWithCachedPrefix } from './ai-cache.js';

test('string no system fica em cache; string no user não', () => {
  const body = buildChatBody({
    model: 'anthropic/claude-sonnet-5',
    system: 'instruções estáveis',
    user: 'contrato único',
    maxTokens: 900,
    sessionId: 'analise-split',
  });
  assert.equal(body.session_id, 'analise-split');
  const sys = (body.messages as { content: { text: string; cache_control?: { type: string } }[] }[])[0].content;
  const usr = (body.messages as { content: { text: string; cache_control?: { type: string } }[] }[])[1].content;
  assert.deepEqual(sys, [{ type: 'text', text: 'instruções estáveis', cache_control: { type: 'ephemeral' } }]);
  assert.deepEqual(usr, [{ type: 'text', text: 'contrato único' }]);
  assert.equal(usr[0]?.cache_control, undefined);
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
});
