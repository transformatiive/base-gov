#!/usr/bin/env node
/**
 * Regista prepbid.com na Cloudflare (Registrar API) e activa Email Routing
 * + tenta o onboard de Email Sending. Requer:
 *   CLOUDFLARE_API_TOKEN  (Registrar Write + Zone DNS + Email Routing + Email Sending)
 *   CLOUDFLARE_ACCOUNT_ID
 *
 * Uso:
 *   node scripts/setup-concursivo-cloudflare.mjs            # só verifica disponibilidade
 *   node scripts/setup-concursivo-cloudflare.mjs --register # compra + DNS + email
 */

const DOMAIN = process.env.PREPBID_DOMAIN || process.env.CONCURSIVO_DOMAIN || 'prepbid.com';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const FORWARD_TO = process.env.MAIL_FORWARD_TO || 'nbarreto@transformatiive.com';
const APP_ORIGIN = process.env.RAILWAY_APP_HOST || 'basegov-robot-production.up.railway.app';
const REGISTER = process.argv.includes('--register');
const API = 'https://api.cloudflare.com/client/v4';

if (!ACCOUNT_ID || !TOKEN) {
  console.error('Falta CLOUDFLARE_ACCOUNT_ID ou CLOUDFLARE_API_TOKEN.');
  process.exit(1);
}

async function cf(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function fail(step, res) {
  const err = res.json?.errors?.[0]?.message || res.json?.messages?.[0]?.message || `HTTP ${res.status}`;
  throw new Error(`${step}: ${err}`);
}

async function checkDomain() {
  const res = await cf('POST', `/accounts/${ACCOUNT_ID}/registrar/domain-check`, { domains: [DOMAIN] });
  if (!res.json?.success) fail('domain-check', res);
  const row = res.json.result?.domains?.[0];
  if (!row) throw new Error('domain-check: resposta sem domínio');
  console.log(JSON.stringify({ check: row }, null, 2));
  return row;
}

async function registerDomain() {
  const res = await cf('POST', `/accounts/${ACCOUNT_ID}/registrar/registrations`, {
    domain_name: DOMAIN,
    auto_renew: true,
    privacy_mode: 'redaction',
  });
  if (res.status !== 201 && res.status !== 202 && !res.json?.success) fail('register', res);
  console.log(JSON.stringify({ register: { status: res.status, result: res.json.result } }, null, 2));
  const links = res.json.result?.links;
  if (res.status === 202 && links?.self) {
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const st = await cf('GET', links.self.startsWith('/') ? links.self : `/accounts/${ACCOUNT_ID}/registrar/registrations/${DOMAIN}/registration-status`);
      const state = st.json?.result?.state;
      console.log('registration state:', state);
      if (state === 'succeeded') return st.json.result;
      if (state === 'failed' || state === 'action_required' || state === 'blocked') fail('register-poll', st);
    }
  }
  return res.json.result;
}

async function findZone() {
  for (let i = 0; i < 18; i++) {
    const res = await cf('GET', `/zones?name=${encodeURIComponent(DOMAIN)}`);
    const zone = res.json?.result?.[0];
    if (zone?.id) return zone;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`zona ${DOMAIN} ainda não existe na conta`);
}

async function ensureDnsCname(zoneId, name, target) {
  const list = await cf('GET', `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(name)}`);
  const existing = list.json?.result?.[0];
  if (existing) {
    console.log('DNS já existe:', name, existing.content);
    return existing;
  }
  const res = await cf('POST', `/zones/${zoneId}/dns_records`, {
    type: 'CNAME',
    name,
    content: target,
    proxied: true,
    ttl: 1,
  });
  if (!res.json?.success) fail(`dns ${name}`, res);
  console.log('CNAME criado:', name, '→', target);
  return res.json.result;
}

async function enableRouting(zoneId) {
  const res = await cf('POST', `/zones/${zoneId}/email/routing/dns`, { name: DOMAIN });
  if (!res.json?.success && res.status !== 409) {
    console.warn('email routing dns:', res.status, JSON.stringify(res.json.errors || res.json));
  } else {
    console.log('Email Routing DNS:', res.json.result?.status || res.status);
  }
}

async function addDestination() {
  const res = await cf('POST', `/accounts/${ACCOUNT_ID}/email/routing/addresses`, { email: FORWARD_TO });
  if (res.json?.success) {
    console.log('Destino de reencaminhamento criado. Verifique o email:', FORWARD_TO);
    return;
  }
  const msg = res.json?.errors?.[0]?.message || '';
  if (res.status === 409 || /already exists|duplicate/i.test(msg)) {
    console.log('Destino já existia:', FORWARD_TO);
    return;
  }
  console.warn('destino:', res.status, JSON.stringify(res.json.errors || res.json));
}

async function addRule(zoneId, localPart) {
  const matcher = `${localPart}@${DOMAIN}`;
  const res = await cf('POST', `/zones/${zoneId}/email/routing/rules`, {
    name: localPart,
    enabled: true,
    matchers: [{ type: 'literal', field: 'to', value: matcher }],
    actions: [{ type: 'forward', value: [FORWARD_TO] }],
  });
  if (res.json?.success) {
    console.log('Regra:', matcher, '→', FORWARD_TO);
    return;
  }
  const msg = res.json?.errors?.[0]?.message || '';
  if (res.status === 409 || /already exists|duplicate/i.test(msg)) {
    console.log('Regra já existia:', matcher);
    return;
  }
  console.warn('regra', matcher, res.status, JSON.stringify(res.json.errors || res.json));
}

async function addCatchAll(zoneId) {
  const res = await cf('PUT', `/zones/${zoneId}/email/routing/rules/catch_all`, {
    enabled: true,
    matchers: [{ type: 'all' }],
    actions: [{ type: 'forward', value: [FORWARD_TO] }],
  });
  if (!res.json?.success) {
    console.warn('catch-all:', res.status, JSON.stringify(res.json.errors || res.json));
    return;
  }
  console.log('Catch-all →', FORWARD_TO);
}

async function onboardSending(zoneId) {
  const attempts = [
    { method: 'POST', path: `/accounts/${ACCOUNT_ID}/email/sending/domains`, body: { domain: DOMAIN } },
    { method: 'POST', path: `/zones/${zoneId}/email/sending/dns`, body: { name: DOMAIN } },
  ];
  for (const a of attempts) {
    const res = await cf(a.method, a.path, a.body);
    if (res.json?.success) {
      console.log('Email Sending onboard:', a.path, res.json.result || res.status);
      return;
    }
    console.warn('Email Sending', a.path, res.status, JSON.stringify(res.json.errors || res.json).slice(0, 400));
  }
  console.warn('Onboard de Email Sending: faça Compute → Email Service → Email Sending → Onboard Domain no dashboard.');
}

const check = await checkDomain();
if (!REGISTER) {
  if (!check.registrable) {
    console.error(`${DOMAIN} não está registável via API:`, check.reason || check);
    process.exit(2);
  }
  console.log(`${DOMAIN} está disponível. Preço:`, check.pricing || '(ver dashboard)');
  console.log('Para comprar: node scripts/setup-concursivo-cloudflare.mjs --register');
  process.exit(0);
}

if (!check.registrable && check.reason !== 'domain_unavailable') {
  // Se já for nosso, seguimos para email/DNS. Se estiver tomado por outro, paramos.
  if (check.reason && check.reason !== 'already_registered') {
    console.error('Não registável:', check);
    process.exit(2);
  }
}

if (check.registrable) {
  await registerDomain();
} else {
  console.log(`${DOMAIN} não está livre na Check; a tentar configurar a zona existente.`);
}

const zone = await findZone();
console.log('Zona:', zone.id, zone.status);
await ensureDnsCname(zone.id, DOMAIN, APP_ORIGIN);
await ensureDnsCname(zone.id, `www.${DOMAIN}`, APP_ORIGIN);
await enableRouting(zone.id);
await addDestination();
await addRule(zone.id, 'suporte');
await addRule(zone.id, 'privacidade');
await addRule(zone.id, 'noreply');
await addCatchAll(zone.id);
await onboardSending(zone.id);
console.log('Concluído. Confirme o destino', FORWARD_TO, 'e as variáveis Railway:');
console.log('  CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN');
console.log('  MAIL_FROM="PrepBid <noreply@prepbid.com>"');
console.log('  SUPPORT_EMAIL=suporte@prepbid.com');
console.log('  APP_URL=https://prepbid.com');
