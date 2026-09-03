import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmRequested,
  downgradeCompanyToFree,
  deleteCompanyAccount,
  INTERNAL_COMPANY_NAME,
  type LifecycleDeps,
} from './account-lifecycle.js';
import type { SqlQuery } from './stripe.js';

test('confirmRequested só aceita confirm: true', () => {
  assert.equal(confirmRequested(undefined), false);
  assert.equal(confirmRequested({}), false);
  assert.equal(confirmRequested({ confirm: 'yes' }), false);
  assert.equal(confirmRequested({ confirm: true }), true);
});

function lifecycleMock(opts: {
  name?: string;
  plan?: string;
  subId?: string | null;
  members?: number;
}): { deps: LifecycleDeps; canceled: string[]; sql: string[] } {
  const canceled: string[] = [];
  const sql: string[] = [];
  const company = {
    name: opts.name ?? 'Acme Lda',
    plan: opts.plan ?? 'pro',
    stripe_subscription_id: opts.subId === undefined ? 'sub_live' : opts.subId,
  };
  const query: SqlQuery = async (text, _params = []) => {
    sql.push(text);
    if (text.includes('FROM companies')) {
      return { rows: [company], rowCount: 1 };
    }
    if (text.includes('count(*)') && text.includes('users')) {
      return { rows: [{ n: opts.members ?? 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  };
  return {
    canceled,
    sql,
    deps: {
      query,
      billingReady: true,
      cancelSubscription: async (id) => { canceled.push(id); },
    },
  };
}

test('downgrade recusa mais do que 1 utilizador e não toca no Stripe', async () => {
  const { deps, canceled } = lifecycleMock({ members: 2 });
  const r = await downgradeCompanyToFree(3, deps);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'seat_limit');
  assert.equal(r.http, 409);
  assert.deepEqual(canceled, []);
});

test('downgrade recusa quem já está no Grátis sem subscrição Stripe', async () => {
  const { deps, canceled } = lifecycleMock({ plan: 'free', subId: null });
  const r = await downgradeCompanyToFree(3, deps);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'already_free');
  assert.deepEqual(canceled, []);
});

test('downgrade cancela Stripe e passa a empresa a free/active', async () => {
  const { deps, canceled, sql } = lifecycleMock({ plan: 'business', subId: 'sub_99' });
  const r = await downgradeCompanyToFree(8, deps);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.plan, 'free');
  assert.deepEqual(canceled, ['sub_99']);
  assert.ok(sql.some((s) => s.includes('DELETE FROM company_invites')));
  const update = sql.find((s) => s.includes('UPDATE companies'));
  assert.ok(update);
  assert.match(update!, /plan = 'free'/);
  assert.match(update!, /subscription_status = 'active'/);
  assert.match(update!, /stripe_subscription_id = NULL/);
});

test('downgrade em trial (sem Stripe) só actualiza o plano', async () => {
  const { deps, canceled } = lifecycleMock({ plan: 'pro', subId: null });
  const r = await downgradeCompanyToFree(4, deps);
  assert.equal(r.ok, true);
  assert.deepEqual(canceled, []);
});

test('downgrade com subscrição Stripe e billing desligado falha fechado', async () => {
  const { deps } = lifecycleMock({ subId: 'sub_x' });
  deps.billingReady = false;
  const r = await downgradeCompanyToFree(1, deps);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'billing_disabled');
  assert.equal(r.http, 503);
});

test('apagar conta recusa a empresa interna de seed', async () => {
  const { deps, canceled, sql } = lifecycleMock({ name: INTERNAL_COMPANY_NAME, subId: 'sub_admin' });
  const r = await deleteCompanyAccount(1, deps);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'protected_account');
  assert.deepEqual(canceled, []);
  assert.equal(sql.some((s) => s.includes('DELETE FROM companies')), false);
});

test('apagar conta cancela Stripe e apaga empresa, utilizadores e perfis', async () => {
  const { deps, canceled, sql } = lifecycleMock({ name: 'Obra Sul', subId: 'sub_del' });
  const r = await deleteCompanyAccount(12, deps);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.deleted, true);
  assert.deepEqual(canceled, ['sub_del']);
  assert.ok(sql.some((s) => s.includes('DELETE FROM profiles')));
  assert.ok(sql.some((s) => s.includes('DELETE FROM users')));
  assert.ok(sql.some((s) => s.includes('DELETE FROM companies')));
});
