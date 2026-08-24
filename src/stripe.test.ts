import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {
  STRIPE_API_VERSION,
  verifyStripeSignature,
  constructStripeEvent,
  handleStripeEvent,
  newIntegrationIdentifier,
  buildCheckoutSessionParams,
  mapStripeSubscriptionStatus,
  type SqlQuery,
} from './stripe.js';
import { config } from './config.js';

const WEBHOOK_SECRET = 'whsec_test_baseradar_signature';

function signedEvent(body: Record<string, unknown>, secret = WEBHOOK_SECRET): { payload: string; header: string } {
  const payload = JSON.stringify(body);
  const stripe = new Stripe('rk_test_placeholder', { apiVersion: STRIPE_API_VERSION, typescript: true });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { payload, header };
}

test('newIntegrationIdentifier is label + 8 random letters', () => {
  const id = newIntegrationIdentifier();
  assert.match(id, /^baseradar-[a-z]{8}$/);
  assert.notEqual(newIntegrationIdentifier(), id);
});

test('mapStripeSubscriptionStatus maps Billing statuses', () => {
  assert.equal(mapStripeSubscriptionStatus('active'), 'active');
  assert.equal(mapStripeSubscriptionStatus('trialing'), 'active');
  assert.equal(mapStripeSubscriptionStatus('past_due'), 'past_due');
  assert.equal(mapStripeSubscriptionStatus('unpaid'), 'past_due');
  assert.equal(mapStripeSubscriptionStatus('canceled'), 'canceled');
  assert.equal(mapStripeSubscriptionStatus('incomplete_expired'), 'canceled');
  assert.equal(mapStripeSubscriptionStatus('incomplete'), null);
});

test('webhook signature failure (missing, garbage, wrong secret)', () => {
  const { payload, header } = signedEvent({
    id: 'evt_sig_1',
    object: 'event',
    type: 'ping',
    data: { object: {} },
  });
  assert.equal(verifyStripeSignature(payload, undefined, WEBHOOK_SECRET), false);
  assert.equal(verifyStripeSignature(payload, 't=1,v1=deadbeef', WEBHOOK_SECRET), false);
  assert.equal(verifyStripeSignature(payload, header, 'whsec_other'), false);
  assert.throws(() => constructStripeEvent(payload, header, 'whsec_other'));
});

test('webhook signature success constructs the event', () => {
  const { payload, header } = signedEvent({
    id: 'evt_sig_ok',
    object: 'event',
    type: 'ping',
    data: { object: {} },
  });
  assert.equal(verifyStripeSignature(payload, header, WEBHOOK_SECRET), true);
  const event = constructStripeEvent(payload, header, WEBHOOK_SECRET);
  assert.equal(event.id, 'evt_sig_ok');
});

function mockQuery(): { query: SqlQuery; calls: { sql: string; params: unknown[] }[] } {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query: SqlQuery = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('INSERT INTO stripe_events')) {
      return { rows: [{ id: params[0] as string }], rowCount: 1 };
    }
    if (sql.includes('UPDATE companies')) return { rows: [], rowCount: 1 };
    if (sql.includes('SELECT plan FROM companies')) return { rows: [{ plan: 'pro' }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  };
  return { query, calls };
}

test('checkout.session.completed maps subscription to company plan + Stripe ids', async () => {
  const { query, calls } = mockQuery();
  const event = {
    id: 'evt_sub_map',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        object: 'checkout.session',
        mode: 'subscription',
        customer: 'cus_abc',
        subscription: 'sub_xyz',
        client_reference_id: '42',
        metadata: { company_id: '42', plan: 'pro' },
        payment_status: 'paid',
      },
    },
  } as Stripe.Event;

  const result = await handleStripeEvent(event, query);
  assert.equal(result.ok, true);
  assert.equal(result.companyId, 42);

  const update = calls.find((c) => c.sql.includes('UPDATE companies SET plan'));
  assert.ok(update, 'expected companies UPDATE');
  assert.equal(update!.params[0], 'pro');
  assert.equal(update!.params[1], 'cus_abc');
  assert.equal(update!.params[2], 'sub_xyz');
  assert.equal(update!.params[3], 42);
  assert.match(update!.sql, /subscription_status = 'active'/);
});

test('duplicate webhook event is idempotent', async () => {
  let inserts = 0;
  const query: SqlQuery = async (sql, params = []) => {
    if (sql.includes('INSERT INTO stripe_events')) {
      inserts += 1;
      return { rows: inserts === 1 ? [{ id: params[0] }] : [], rowCount: inserts === 1 ? 1 : 0 };
    }
    if (sql.includes('UPDATE companies')) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  };
  const event = {
    id: 'evt_dup',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_dup',
        object: 'checkout.session',
        mode: 'subscription',
        customer: 'cus_1',
        subscription: 'sub_1',
        metadata: { company_id: '7', plan: 'business' },
      },
    },
  } as Stripe.Event;

  const first = await handleStripeEvent(event, query);
  const second = await handleStripeEvent(event, query);
  assert.equal(first.ok, true);
  assert.equal(first.companyId, 7);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
});

test('customer.subscription.deleted maps to canceled', async () => {
  const { query, calls } = mockQuery();
  const event = {
    id: 'evt_sub_del',
    object: 'event',
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: 'sub_gone',
        object: 'subscription',
        status: 'canceled',
        customer: 'cus_abc',
        metadata: { company_id: '9', plan: 'pro' },
      },
    },
  } as Stripe.Event;

  const result = await handleStripeEvent(event, query);
  assert.equal(result.ok, true);
  assert.equal(result.companyId, 9);
  const update = calls.find((c) => c.sql.includes("subscription_status = 'canceled'"));
  assert.ok(update);
  assert.equal(update!.params[0], 9);
});

test('Checkout session params: subscription, dynamic PMs, no tax, integration_identifier', () => {
  const prevUrl = config.appBaseUrl;
  const prevPro = config.stripe.pricePro;
  config.appBaseUrl = 'https://app.baseradar.test';
  config.stripe.pricePro = 'price_pro_test';
  try {
    const integrationId = 'baseradar-abcdefgh';
    const params = buildCheckoutSessionParams({
      company: { id: 3, name: 'Acme', nif: '123456789', stripeCustomerId: null },
      customer: { email: 'ana@acme.pt', name: 'Ana' },
      plan: 'pro',
      mode: 'subscription',
    }, integrationId);

    assert.equal(params.mode, 'subscription');
    assert.equal(params.success_url, 'https://app.baseradar.test/app#/conta?pago=1');
    assert.equal(params.cancel_url, 'https://app.baseradar.test/app#/planos');
    assert.equal(params.integration_identifier, integrationId);
    assert.equal(params.customer_email, 'ana@acme.pt');
    assert.deepEqual(params.line_items, [{ price: 'price_pro_test', quantity: 1 }]);
    assert.equal('payment_method_types' in params, false);
    assert.equal('automatic_tax' in params, false);
  } finally {
    config.appBaseUrl = prevUrl;
    config.stripe.pricePro = prevPro;
  }
});

test('Free plan has no Checkout price id and buildCheckout rejects it', () => {
  const prevUrl = config.appBaseUrl;
  config.appBaseUrl = 'https://app.baseradar.test';
  try {
    assert.throws(() => buildCheckoutSessionParams({
      company: { id: 1, name: 'X', nif: null },
      customer: { email: 'x@y.z' },
      plan: 'free',
      mode: 'subscription',
    }));
  } finally {
    config.appBaseUrl = prevUrl;
  }
});
