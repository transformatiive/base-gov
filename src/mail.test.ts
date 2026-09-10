import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cloudflareSendBody, cloudflareSendUrl } from './mail.js';

test('cloudflareSendUrl aponta para a API de Email Sending da conta', () => {
  assert.equal(
    cloudflareSendUrl('abc123'),
    'https://api.cloudflare.com/client/v4/accounts/abc123/email/sending/send',
  );
});

test('cloudflareSendBody mapeia destinatários, HTML e reply-to', () => {
  const body = cloudflareSendBody(
    {
      to: 'ana@empresa.pt',
      subject: 'PrepBid — Resumo semanal',
      html: '<p>Olá</p>',
      text: 'Olá',
      replyTo: 'suporte@prepbid.com',
    },
    'PrepBid <noreply@prepbid.com>',
  );
  assert.deepEqual(body, {
    from: 'PrepBid <noreply@prepbid.com>',
    to: ['ana@empresa.pt'],
    subject: 'PrepBid — Resumo semanal',
    html: '<p>Olá</p>',
    text: 'Olá',
    reply_to: 'suporte@prepbid.com',
  });
});

test('cloudflareSendBody aceita vários destinatários', () => {
  const body = cloudflareSendBody(
    { to: ['a@x.pt', 'b@x.pt'], subject: 'x', html: '<p>x</p>' },
    'noreply@prepbid.com',
  );
  assert.deepEqual(body.to, ['a@x.pt', 'b@x.pt']);
  assert.equal(body.reply_to, undefined);
});

test('o reencaminhamento de @prepbid.com aponta para info@transformatiive.com', () => {
  const script = readFileSync(new URL('../scripts/setup-concursivo-cloudflare.mjs', import.meta.url), 'utf8');
  assert.match(script, /MAIL_FORWARD_TO \|\| 'info@transformatiive\.com'/);
  assert.match(script, /--route/);
  assert.match(script, /addRule\(zoneId, 'info'\)/);
});
