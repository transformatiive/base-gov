import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  billingMode,
  billingSnapshot,
  invoiceDownloadable,
  mapPaymentToInvoice,
  moloniDocumentLabel,
  moloniPdfUrlFromResponse,
  pdfFilename,
  invoicePdfUnavailableMessage,
} from './billing.js';

test('billingMode: cartão com stripe_subscription_id é subscription', () => {
  assert.equal(billingMode({
    plan: 'pro', subscription_status: 'active', has_stripe_subscription: true,
  }), 'subscription');
});

test('billingMode: pagamento pontual (access_until, sem subscrição Stripe)', () => {
  assert.equal(billingMode({
    plan: 'pro',
    subscription_status: 'active',
    has_stripe_subscription: false,
    access_until: '2026-10-01T00:00:00.000Z',
  }), 'one_time');
});

test('billingMode: trial / past_due / canceled / free', () => {
  assert.equal(billingMode({ plan: 'pro', subscription_status: 'trialing' }), 'trial');
  assert.equal(billingMode({ plan: 'pro', subscription_status: 'past_due' }), 'past_due');
  assert.equal(billingMode({ plan: 'business', subscription_status: 'canceled' }), 'canceled');
  assert.equal(billingMode({ plan: 'free', subscription_status: 'active' }), 'free');
});

test('billingSnapshot: cartão expõe renews_at, não access_until', () => {
  const snap = billingSnapshot({
    plan: 'pro',
    subscription_status: 'active',
    has_stripe_customer: true,
    has_stripe_subscription: true,
    renewal_at: '2026-10-03T12:00:00.000Z',
    access_until: '2026-10-03T12:00:00.000Z',
  }, { billingEnabled: true });
  assert.equal(snap.mode, 'subscription');
  assert.equal(snap.renews_at, '2026-10-03T12:00:00.000Z');
  assert.equal(snap.access_until, null);
  assert.equal(snap.can_manage_payment, true);
});

test('billingSnapshot: pontual expõe access_until e esconde «renova a»', () => {
  const snap = billingSnapshot({
    plan: 'business',
    subscription_status: 'active',
    has_stripe_customer: true,
    has_stripe_subscription: false,
    renewal_at: '2026-10-03T12:00:00.000Z',
    access_until: '2026-10-03T12:00:00.000Z',
  }, { billingEnabled: true });
  assert.equal(snap.mode, 'one_time');
  assert.equal(snap.renews_at, null);
  assert.equal(snap.access_until, '2026-10-03T12:00:00.000Z');
});

test('billingSnapshot: sem Stripe configurado não abre portal', () => {
  const snap = billingSnapshot({
    plan: 'pro',
    subscription_status: 'active',
    has_stripe_customer: true,
    has_stripe_subscription: true,
  }, { billingEnabled: false });
  assert.equal(snap.can_manage_payment, false);
});

test('invoiceDownloadable só com Moloni ok + document_id', () => {
  assert.equal(invoiceDownloadable('ok', 99), true);
  assert.equal(invoiceDownloadable('draft', 99), false);
  assert.equal(invoiceDownloadable('ok', null), false);
  assert.equal(invoiceDownloadable('error', 1), false);
});

test('mapPaymentToInvoice marca downloadable e normaliza kind', () => {
  const inv = mapPaymentToInvoice({
    id: 7,
    created_at: '2026-09-01T10:00:00.000Z',
    kind: 'one_time',
    plan: 'pro',
    amount_cents: 3567,
    currency: 'eur',
    moloni_document_id: 123,
    moloni_status: 'ok',
    moloni_number: 'IVCX 12',
  });
  assert.equal(inv.downloadable, true);
  assert.equal(inv.kind, 'one_time');
  assert.equal(inv.moloni_number, 'IVCX 12');
  assert.equal(inv.amount_cents, 3567);
});

test('moloniDocumentLabel junta série e número', () => {
  assert.equal(moloniDocumentLabel({ number: 12, document_set: { name: 'IVCX' } }), 'IVCX 12');
  assert.equal(moloniDocumentLabel({ number: 0, document_set: { name: 'IVCX' } }), null);
  assert.equal(moloniDocumentLabel({ number: 4 }), '4');
});

test('moloniPdfUrlFromResponse lê url em objeto ou lista', () => {
  assert.equal(moloniPdfUrlFromResponse({ url: 'https://www.moloni.pt/downloads/x.pdf' }), 'https://www.moloni.pt/downloads/x.pdf');
  assert.equal(moloniPdfUrlFromResponse([{ url: 'https://files.example/a.pdf' }]), 'https://files.example/a.pdf');
  assert.equal(moloniPdfUrlFromResponse({ error: 1 }), null);
});

test('pdfFilename sanitiza o número do documento', () => {
  assert.equal(pdfFilename('IVCX 12/2026', 3), 'baseradar-IVCX-12-2026.pdf');
  assert.equal(pdfFilename(null, 9), 'baseradar-fatura-9.pdf');
});

test('invoicePdfUnavailableMessage cobre rascunho e erro', () => {
  assert.match(invoicePdfUnavailableMessage('draft'), /rascunho/i);
  assert.match(invoicePdfUnavailableMessage('error'), /suporte/i);
});
