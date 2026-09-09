/** Eventos de utilização (páginas, módulos, acções, origem). Sem PII no path. */

export const VISITOR_COOKIE = 'br_vid';

export type UsageKind = 'page_view' | 'action';

export type UsageModule =
  | 'hoje'
  | 'oportunidades'
  | 'carteira'
  | 'renovacoes'
  | 'concursos'
  | 'mapa'
  | 'sazonalidade'
  | 'concorrentes'
  | 'entidades'
  | 'ficha_anuncio'
  | 'ficha_contrato'
  | 'config'
  | 'pesquisas'
  | 'opendata'
  | 'conta'
  | 'planos'
  | 'digest'
  | 'ajuda'
  | 'login'
  | 'registo'
  | 'auth'
  | 'landing'
  | 'guias'
  | 'termos'
  | 'privacidade'
  | 'outro';

export interface UsageEventInput {
  kind: UsageKind;
  path: string;
  module: UsageModule;
  action: string | null;
  origin: string;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  visitor_id: string | null;
  landing: string | null;
}

export type ParseUsageResult =
  | { ok: true; value: UsageEventInput }
  | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INTERNAL_HOSTS = new Set([
  'concursivo.com',
  'www.concursivo.com',
  'basegov-robot-production.up.railway.app',
  'localhost',
  '127.0.0.1',
]);

const SEARCH_HOSTS = ['google.', 'bing.com', 'duckduckgo.com', 'yahoo.', 'ecosia.org', 'search.brave.com'];
const SOCIAL_HOSTS = ['linkedin.com', 'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com', 't.co', 'whatsapp.com'];

export function parseDays(raw: string | undefined): 7 | 30 | 90 {
  if (raw === '7' || raw === '90' || raw === '30') return Number(raw) as 7 | 30 | 90;
  return 30;
}

export function shouldSkipPath(path: string): boolean {
  const p = path.split('?')[0] || '';
  if (p.startsWith('/api')) return true;
  if (p === '#/admin' || p.startsWith('#/admin/')) return true;
  if (p === '#/qa' || p.startsWith('#/qa/')) return true;
  return false;
}

export function moduleFromPath(rawPath: string): UsageModule {
  const path = (rawPath.split('?')[0] || '').replace(/\/$/, '') || '/';
  if (path === '/' || path === '') return 'landing';
  if (path === '/guias' || path.startsWith('/guias/')) return 'guias';
  if (path === '/termos') return 'termos';
  if (path === '/privacidade') return 'privacidade';

  const hash = path.startsWith('#') ? path : '';
  const h = hash === '#/' || hash === '#' ? '#/hoje' : hash;

  if (h === '#/hoje') return 'hoje';
  if (h === '#/pipeline') return 'carteira';
  if (h === '#/radar/opportunities' || h === '#/insights/opportunities') return 'oportunidades';
  if (h === '#/radar/renewals' || h === '#/insights/renewals') return 'renovacoes';
  if (h === '#/radar/announcements' || h === '#/insights/announcements') return 'concursos';
  if (h === '#/radar/map' || h === '#/insights/map') return 'mapa';
  if (h === '#/radar/seasonality' || h === '#/insights/seasonality') return 'sazonalidade';
  if (h === '#/radar/competitors' || h === '#/insights/competitors') return 'concorrentes';
  if (h === '#/entities' || h.startsWith('#/entities/')) return 'entidades';
  if (h.startsWith('#/announcements/')) return 'ficha_anuncio';
  if (h.startsWith('#/contracts/')) return 'ficha_contrato';
  if (h === '#/config/searches' || h.startsWith('#/searches/')) return 'pesquisas';
  if (h === '#/config/opendata' || h === '#/opendata') return 'opendata';
  if (h === '#/config' || h === '#/config/profiles' || h === '#/profiles' || h.startsWith('#/profiles/')) return 'config';
  if (h === '#/conta') return 'conta';
  if (h === '#/planos' || h === '#/subscrever') return 'planos';
  if (h === '#/digest') return 'digest';
  if (h === '#/ajuda' || h.startsWith('#/ajuda/')) return 'ajuda';
  if (h === '#/login') return 'login';
  if (h === '#/registo') return 'registo';
  if (h === '#/recuperar' || h === '#/repor-password' || h.startsWith('#/aceitar-convite')) return 'auth';
  return 'outro';
}

export const USAGE_MODULES: UsageModule[] = [
  'hoje', 'oportunidades', 'carteira', 'renovacoes', 'concursos', 'mapa',
  'sazonalidade', 'concorrentes', 'entidades', 'ficha_anuncio', 'ficha_contrato',
  'config', 'pesquisas', 'opendata', 'conta', 'planos', 'digest', 'ajuda',
  'login', 'registo', 'auth', 'landing', 'guias', 'termos', 'privacidade', 'outro',
];

export function labelModule(m: string): string {
  if ((USAGE_MODULES as string[]).includes(m)) return moduleLabel(m as UsageModule);
  return m || 'Outro';
}

export function moduleLabel(mod: UsageModule): string {
  switch (mod) {
    case 'hoje': return 'Hoje';
    case 'oportunidades': return 'Oportunidades';
    case 'carteira': return 'Carteira';
    case 'renovacoes': return 'Renovações';
    case 'concursos': return 'Concursos';
    case 'mapa': return 'Mapa';
    case 'sazonalidade': return 'Sazonalidade';
    case 'concorrentes': return 'Concorrentes';
    case 'entidades': return 'Entidades';
    case 'ficha_anuncio': return 'Ficha de anúncio';
    case 'ficha_contrato': return 'Ficha de contrato';
    case 'config': return 'Configuração';
    case 'pesquisas': return 'Pesquisas';
    case 'opendata': return 'Open data';
    case 'conta': return 'Conta';
    case 'planos': return 'Planos';
    case 'digest': return 'Resumo';
    case 'ajuda': return 'Ajuda';
    case 'login': return 'Entrar';
    case 'registo': return 'Registo';
    case 'auth': return 'Autenticação';
    case 'landing': return 'Landing';
    case 'guias': return 'Guias';
    case 'termos': return 'Termos';
    case 'privacidade': return 'Privacidade';
    case 'outro': return 'Outro';
    default: {
      const _never: never = mod;
      return _never;
    }
  }
}

export function classifyOrigin(opts: {
  utmSource?: string | null;
  referrer?: string | null;
  extraInternalHosts?: string[];
}): string {
  const utm = cleanToken(opts.utmSource);
  if (utm) return utm.slice(0, 40);

  const host = referrerHost(opts.referrer);
  if (!host) return 'direct';

  const internals = new Set(INTERNAL_HOSTS);
  for (const h of opts.extraInternalHosts ?? []) internals.add(h.toLowerCase());
  if (internals.has(host) || [...internals].some((h) => host === h || host.endsWith(`.${h}`))) return 'internal';

  if (host === 'base.gov.pt' || host.endsWith('.base.gov.pt')) return 'portal_base';
  if (SEARCH_HOSTS.some((s) => host === s.replace(/\.$/, '') || host.includes(s))) return 'search';
  if (SOCIAL_HOSTS.some((s) => host === s || host.endsWith(`.${s}`))) return 'social';
  return host.slice(0, 80);
}

export function actionFromApi(method: string, apiPath: string): string | null {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return null;
  const p = apiPath.split('?')[0] || '';
  if (p === '/api/usage' || p.startsWith('/api/usage/')) return null;
  if (p.startsWith('/api/admin')) return null;
  if (m === 'POST' && /\/api\/announcements\/\d+\/analyze$/.test(p)) return 'analise_anuncio';
  if (m === 'POST' && /\/api\/contracts\/\d+\/analyze$/.test(p)) return 'analise_contrato';
  if (m === 'POST' && /\/api\/announcements\/\d+\/proposals\/generate$/.test(p)) return 'proposta';
  if (m === 'POST' && /\/api\/announcements\/\d+\/close-forecast/.test(p)) return 'previsao_fecho';
  if (m === 'PUT' && p.startsWith('/api/pipeline/')) return 'carteira';
  if (m === 'POST' && p === '/api/billing/checkout') return 'checkout';
  if (m === 'POST' && p === '/api/billing/trial') return 'activar_trial';
  if (m === 'POST' && p === '/api/profiles') return 'criar_perfil';
  if (m === 'POST' && p === '/api/searches') return 'pesquisa';
  if (m === 'POST' && p === '/api/feedback') return 'feedback';
  if (m === 'POST' && /\/api\/profiles\/\d+\/run$/.test(p)) return 'recolha';
  return null;
}

export function parseUsageEvent(body: unknown, extraInternalHosts?: string[]): ParseUsageResult {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Corpo inválido.' };
  }
  const b = body as Record<string, unknown>;
  const kind = b.kind === 'action' ? 'action' : b.kind === 'page_view' ? 'page_view' : null;
  if (!kind) return { ok: false, error: 'kind deve ser page_view ou action.' };
  const path = typeof b.path === 'string' ? b.path.trim().slice(0, 200) : '';
  if (!path || !(path.startsWith('/') || path.startsWith('#'))) {
    return { ok: false, error: 'path inválido.' };
  }
  if (/javascript:/i.test(path) || path.includes('://') && !path.startsWith('/')) {
    return { ok: false, error: 'path inválido.' };
  }
  if (shouldSkipPath(path)) return { ok: false, error: 'path fora do radar.' };

  let action: string | null = typeof b.action === 'string' ? cleanToken(b.action) : null;
  if (kind === 'action' && !action) return { ok: false, error: 'action obrigatória.' };
  if (action) action = action.slice(0, 60);

  const visitorRaw = typeof b.visitor_id === 'string' ? b.visitor_id.trim() : '';
  const visitor_id = UUID_RE.test(visitorRaw) ? visitorRaw.toLowerCase() : null;

  const referrer = typeof b.referrer === 'string' ? b.referrer.slice(0, 300) : null;
  const utm_source = cleanToken(typeof b.utm_source === 'string' ? b.utm_source : null);
  const utm_medium = cleanToken(typeof b.utm_medium === 'string' ? b.utm_medium : null);
  const utm_campaign = cleanToken(typeof b.utm_campaign === 'string' ? b.utm_campaign : null);
  const landing = typeof b.landing === 'string' ? b.landing.trim().slice(0, 200) : null;

  return {
    ok: true,
    value: {
      kind,
      path: path.split('?')[0],
      module: moduleFromPath(path),
      action: kind === 'action' ? action : action,
      origin: classifyOrigin({ utmSource: utm_source, referrer, extraInternalHosts }),
      referrer_host: referrerHost(referrer),
      utm_source,
      utm_medium,
      utm_campaign,
      visitor_id,
      landing: landing && (landing.startsWith('/') || landing.startsWith('#')) ? landing.split('?')[0] : null,
    },
  };
}

export function fillDailySeries(
  fromDay: string,
  toDay: string,
  rows: { day: string; n: number }[],
): { day: string; n: number }[] {
  const map = new Map(rows.map((r) => [r.day.slice(0, 10), Number(r.n) || 0]));
  const out: { day: string; n: number }[] = [];
  const cur = parseUtcDay(fromDay);
  const end = parseUtcDay(toDay);
  while (cur.getTime() <= end.getTime()) {
    const key = cur.toISOString().slice(0, 10);
    out.push({ day: key, n: map.get(key) ?? 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function svgTrend(points: { day: string; n: number }[], width = 640, height = 160): string {
  if (points.length === 0) {
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Sem dados"></svg>`;
  }
  const max = Math.max(1, ...points.map((p) => p.n));
  const pad = 8;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = points.length === 1 ? 0 : innerW / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = pad + innerH - (p.n / max) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lastX = pad + (points.length - 1) * step;
  const baseY = pad + innerH;
  const area = `M${pad},${baseY} L${coords.join(' L')} L${lastX.toFixed(1)},${baseY} Z`;
  const line = `M${coords.join(' L')}`;
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Eventos por dia">
  <path d="${area}" fill="#173f35" fill-opacity="0.12"/>
  <path d="${line}" fill="none" stroke="#173f35" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;
}

export function originLabel(origin: string): string {
  switch (origin) {
    case 'direct': return 'Directo';
    case 'search': return 'Pesquisa (Google, Bing…)';
    case 'social': return 'Redes sociais';
    case 'portal_base': return 'Portal BASE';
    case 'internal': return 'Interno (site)';
    default: return origin;
  }
}

export function actionLabel(action: string): string {
  switch (action) {
    case 'analise_anuncio': return 'Análise de anúncio';
    case 'analise_contrato': return 'Análise de contrato';
    case 'proposta': return 'Gerar proposta';
    case 'previsao_fecho': return 'Previsão de fecho';
    case 'carteira': return 'Alterar carteira';
    case 'checkout': return 'Checkout';
    case 'activar_trial': return 'Activar trial';
    case 'criar_perfil': return 'Criar perfil';
    case 'pesquisa': return 'Nova pesquisa';
    case 'feedback': return 'Feedback';
    case 'recolha': return 'Recolha de perfil';
    default: return action;
  }
}

export function newVisitorId(): string {
  return crypto.randomUUID();
}

function cleanToken(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '').slice(0, 40);
  return t || null;
}

function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const u = new URL(referrer);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

function parseUtcDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}
