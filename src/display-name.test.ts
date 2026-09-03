import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greetingName } from './display-name.js';

test('greeting usa first_name quando existe', () => {
  assert.equal(greetingName({ first_name: 'Ana', username: 'qa.f-obras@x.test' }), 'Ana');
});

test('greeting ignora espaços no first_name e fica só com o primeiro nome', () => {
  assert.equal(greetingName({ first_name: '  Ana Coelho  ', username: 'ana' }), 'Ana');
});

test('sem first_name, usa a parte local do email/username — não o domínio', () => {
  assert.equal(greetingName({ first_name: null, username: 'qa.f-obras.09030848@transformatiive.test' }), 'qa.f-obras.09030848');
});

test('sem nome nem username devolve Olá', () => {
  assert.equal(greetingName({}), 'Olá');
});
