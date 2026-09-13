import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadBrowserJs(...rel: string[]) {
  const ctx = createContext({ window: {} as Record<string, unknown>, console });
  (ctx.window as { window?: unknown }).window = ctx.window;
  for (const r of rel) {
    runInContext(readFileSync(join(root, r), 'utf8'), ctx, { filename: r });
  }
  return ctx.window as {
    BRHelpCatalog: {
      splash: { examples: { id: string }[]; ctaTour: string; ctaSkip: string };
      menuTour: { steps: { href: string; title: string }[] };
      screens: Record<string, { steps: { sel: string }[]; lockedFallback: { title: string } | null }>;
    };
    BRHelpManualToc: { chapters: { slug: string; html: string; shots: string[] }[] };
    BRGuideProgress: {
      key: (uid: unknown) => string;
      parse: (raw: string | null) => {
        splashDone: boolean;
        splashChoice: string | null;
        menuTourDone: boolean;
        optOut: boolean;
        autoDone: boolean;
        screens: Record<string, boolean>;
      };
    };
    BRQaChecklist?: { groups: { id: string; items: { id: string; href: string }[] }[] };
  };
}

const NAV = [
  '#/hoje', '#/pipeline', '#/radar/opportunities',
  '#/radar/announcements', '#/radar/renewals', '#/radar/map', '#/radar/seasonality',
  '#/radar/competitors', '#/entities', '#/config',
];
const NAV_ADMIN = ['#/admin', '#/admin/uso'];

test('catálogo: cada item da nav tem passo de menu tour', () => {
  const w = loadBrowserJs('public/help/catalog.js', 'public/help/manual/toc.js');
  const hrefs = w.BRHelpCatalog.menuTour.steps.map((s) => String(s.href));
  assert.equal(hrefs.join('\n'), NAV.join('\n'));
});

test('sidebar: grupos, ordem e ícone em cada opção', () => {
  const html = readFileSync(join(root, 'public/index.html'), 'utf8');
  const appJs = readFileSync(join(root, 'public/app.js'), 'utf8');
  const nav = html.match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? '';
  assert.match(nav, /aria-label="Secções da aplicação"/);
  const labels = [...nav.matchAll(/class="nav-group-label"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Dia a dia', 'Radar', 'Mercado', 'Conta', 'Admin']);
  const hrefs = [...nav.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, [...NAV, ...NAV_ADMIN]);
  const icons = [...nav.matchAll(/data-nav-icon="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(icons.length, hrefs.length);
  for (const name of icons) {
    assert.match(appJs, new RegExp(`^\\s+${name}:`, 'm'), `ICON_PATHS em falta: ${name}`);
  }
  assert.match(nav, /id="nav-admin"[^>]*hidden/);
  assert.match(html, /style\.css\?v=52/);
  assert.match(html, /guide\.js\?v=4/);
  assert.match(appJs, /A pesquisar concursos abertos/);
  assert.match(html, /class="pb-wordmark">PrepBid</);
});

test('manual: grupos alinhados com a nav', () => {
  const w = loadBrowserJs('public/help/catalog.js', 'public/help/manual/toc.js');
  const bySlug = Object.fromEntries(w.BRHelpManualToc.chapters.map((c) => [c.slug, c.group]));
  assert.equal(bySlug.hoje, 'Dia a dia');
  assert.equal(bySlug.carteira, 'Dia a dia');
  assert.equal(bySlug.oportunidades, 'Dia a dia');
  assert.equal(bySlug.concursos, 'Radar');
  assert.equal(bySlug.concorrentes, 'Mercado');
  assert.equal(bySlug.entidades, 'Mercado');
  assert.equal(bySlug.config, 'Conta');
});

test('catálogo: splash tem onboarding vs entrar na app', () => {
  const w = loadBrowserJs('public/help/catalog.js');
  assert.match(w.BRHelpCatalog.splash.ctaTour, /onboarding/i);
  assert.match(w.BRHelpCatalog.splash.ctaSkip, /aplicação/i);
  assert.ok(w.BRHelpCatalog.splash.examples.length >= 4);
});

test('catálogo: ecrãs obrigatórios têm passos', () => {
  const w = loadBrowserJs('public/help/catalog.js');
  for (const id of ['hoje', 'oportunidades', 'carteira', 'ficha', 'config', 'conta', 'concursos']) {
    assert.ok((w.BRHelpCatalog.screens[id]?.steps?.length ?? 0) >= 1, id);
  }
});

test('manual: capítulos html existem', () => {
  const w = loadBrowserJs('public/help/catalog.js', 'public/help/manual/toc.js');
  for (const ch of w.BRHelpManualToc.chapters) {
    assert.equal(existsSync(join(root, 'public', ch.html.replace(/^\//, ''))), true, ch.html);
  }
});

test('manual: se o capítulo lista shots, os ficheiros existem', () => {
  const w = loadBrowserJs('public/help/catalog.js', 'public/help/manual/toc.js');
  for (const ch of w.BRHelpManualToc.chapters) {
    for (const shot of ch.shots) {
      assert.equal(existsSync(join(root, 'public/help/shots', shot)), true, shot);
    }
  }
});

test('parse: JSON lixo devolve EMPTY', () => {
  const w = loadBrowserJs('public/guide.js');
  const p = w.BRGuideProgress.parse('{');
  assert.equal(p.splashDone, false);
  assert.equal(p.optOut, false);
});

test('parse: merge parcial', () => {
  const w = loadBrowserJs('public/guide.js');
  const p = w.BRGuideProgress.parse('{"screens":{"hoje":true}}');
  assert.equal(p.screens.hoje, true);
  assert.equal(p.optOut, false);
  assert.equal(p.splashChoice, null);
});

test('progress key inclui o utilizador', () => {
  const w = loadBrowserJs('public/guide.js');
  assert.equal(w.BRGuideProgress.key(12), 'br_guide:12');
  assert.equal(w.BRGuideProgress.key(null), 'br_guide:anon');
});

type GuideRuntime = {
  bind: (opts: { getUserId?: () => unknown }) => void;
  afterView: (id: string) => void;
  maybeScreenCoach: (id: string) => Promise<void>;
  replayScreen: (id: string) => Promise<void>;
  replayMenuTour: () => Promise<void>;
  stop: (opts?: { navigated?: boolean }) => void;
  isRunning: () => boolean;
  loadProgress: () => { autoDone: boolean; screens: Record<string, boolean> };
};

function loadGuideRuntime(opts: {
  session?: Record<string, string>;
  local?: Record<string, string>;
  userId?: unknown;
  mobile?: boolean;
}) {
  const appended: unknown[] = [];
  const session: Record<string, string> = { ...(opts.session || {}) };
  const local: Record<string, string> = { ...(opts.local || {}) };
  const sessionStorage = {
    getItem: (k: string) => session[k] ?? null,
    setItem: (k: string, v: string) => { session[k] = v; },
    removeItem: (k: string) => { delete session[k]; },
  };
  const localStorage = {
    getItem: (k: string) => local[k] ?? null,
    setItem: (k: string, v: string) => { local[k] = v; },
    removeItem: (k: string) => { delete local[k]; },
  };
  const windowObj: Record<string, unknown> = {
    matchMedia: (q: string) => ({
      matches: !!opts.mobile && /max-width:\s*900px/.test(String(q)),
      addEventListener() { /* noop */ },
      addListener() { /* noop */ },
      media: q,
    }),
    addEventListener() { /* noop */ },
    removeEventListener() { /* noop */ },
    location: { hash: '#/pipeline' },
    sessionStorage,
    localStorage,
    BRHelpCatalog: {
      splash: {
        eyebrow: 'x', title: 't', lead: 'l', footnote: 'f',
        ctaSkip: 's', ctaTour: 'c',
        examples: [{ id: 'a', title: 'A', body: 'b' }],
      },
      menuTour: { steps: [{ href: '#/hoje', title: 'Hoje', body: 'x' }] },
      screens: {
        carteira: {
          steps: [
            { sel: 'pl-title', title: 'Carteira', body: 'b' },
            { sel: 'pl-board', title: 'Kanban', body: 'b' },
            { sel: 'pl-col-interessa', title: 'Interessa', body: 'b' },
            { sel: 'pl-closed', title: 'Fechadas', body: 'b' },
          ],
        },
      },
    },
  };
  const documentStub = {
    createElement() {
      const style: Record<string, string> = {};
      const el: Record<string, unknown> = {
        id: '',
        className: '',
        innerHTML: '',
        style,
        offsetWidth: 340,
        offsetHeight: 180,
        onclick: null,
        focus() { /* noop */ },
        querySelector() { return el; },
        querySelectorAll() { return []; },
        remove() { /* noop */ },
      };
      return el;
    },
    body: { appendChild(el: unknown) { appended.push(el); } },
    addEventListener() { /* noop */ },
    removeEventListener() { /* noop */ },
    querySelector() {
      return {
        getBoundingClientRect() { return { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }; },
        scrollIntoView() { /* noop */ },
      };
    },
  };
  const ctx = createContext({
    window: windowObj,
    document: documentStub,
    console,
    localStorage,
    sessionStorage,
    setTimeout,
    clearTimeout,
  });
  (windowObj as { window?: unknown }).window = windowObj;
  runInContext(readFileSync(join(root, 'public/guide.js'), 'utf8'), ctx, { filename: 'public/guide.js' });
  const g = windowObj.BRGuide as GuideRuntime;
  g.bind({ getUserId: () => (opts.userId === undefined ? 7 : opts.userId) });
  return { g, appended, local, session };
}

test('parse: login seguinte marca autoDone e alias pipeline→carteira', () => {
  const w = loadBrowserJs('public/guide.js');
  const p = w.BRGuideProgress.parse('{"screens":{"pipeline":true,"hoje":true}}');
  assert.equal(p.screens.carteira, true);
  assert.equal(p.screens.hoje, true);
  assert.equal(p.autoDone, false);
  const done = w.BRGuideProgress.parse('{"autoDone":true}');
  assert.equal(done.autoDone, true);
});

test('guia: login seguinte não abre o tour da Carteira', () => {
  const { g, appended, local } = loadGuideRuntime({ userId: 7 });
  g.afterView('carteira');
  assert.equal(g.isRunning(), false);
  assert.equal(appended.length, 0);
  const stored = JSON.parse(local['br_guide:7'] || '{}');
  assert.equal(stored.autoDone, true);
  assert.equal(stored.screens?.carteira, undefined);
});

test('guia: primeiro login (br_onboard) abre o coach da Carteira', () => {
  const { g, appended } = loadGuideRuntime({
    session: { br_onboard: '1', br_guide_auto: '1' },
    userId: 7,
  });
  void g.maybeScreenCoach('carteira');
  assert.equal(g.isRunning(), true);
  assert.ok(appended.length >= 1);
  g.stop();
});

test('guia: Ajuda replay abre o tour mesmo após login seguinte', () => {
  const { g, appended, local } = loadGuideRuntime({
    userId: 7,
    local: { 'br_guide:7': JSON.stringify({ autoDone: true, screens: { carteira: true } }) },
  });
  g.afterView('carteira');
  assert.equal(appended.length, 0);
  void g.replayScreen('carteira');
  assert.equal(g.isRunning(), true);
  assert.ok(appended.length >= 1);
  const stored = JSON.parse(local['br_guide:7']);
  assert.equal(stored.autoDone, true);
  g.stop();
});

test('guia: sair pelo menu persiste o ecrã para não repetir no reload', () => {
  const { g, local } = loadGuideRuntime({
    session: { br_onboard: '1', br_guide_auto: '1' },
    userId: 7,
  });
  void g.maybeScreenCoach('carteira');
  assert.equal(g.isRunning(), true);
  g.stop({ navigated: true });
  const stored = JSON.parse(local['br_guide:7'] || '{}');
  assert.equal(stored.screens.carteira, true);
});

test('app: login seguinte limpa br_onboard; o registo liga o auto-tour', () => {
  const app = readFileSync(join(root, 'public/app.js'), 'utf8');
  const login = app.slice(app.indexOf("'/api/auth/login'"), app.indexOf("'/api/auth/register'"));
  const register = app.slice(app.indexOf("'/api/auth/register'"), app.indexOf('Banner de trial'));
  assert.match(register, /sessionStorage\.setItem\('br_onboard', '1'\)/);
  assert.match(register, /sessionStorage\.setItem\('br_guide_auto', '1'\)/);
  assert.match(register, /sessionStorage\.removeItem\('br_guide_returning'\)/);
  assert.match(login, /sessionStorage\.removeItem\('br_onboard'\)/);
  assert.match(login, /sessionStorage\.removeItem\('br_guide_auto'\)/);
  assert.match(login, /sessionStorage\.setItem\('br_guide_returning', '1'\)/);
});

test('catálogo: cada sel de ecrã existe em app.js', () => {
  const app = readFileSync(join(root, 'public/app.js'), 'utf8');
  const w = loadBrowserJs('public/help/catalog.js');
  for (const [id, spec] of Object.entries(w.BRHelpCatalog.screens)) {
    for (const st of spec.steps) {
      assert.equal(app.includes(st.sel), true, `${id}.${st.sel}`);
    }
  }
});

test('checklist QA: itens têm âncora da app', () => {
  const w = loadBrowserJs('public/help/qa-checklist.js');
  assert.ok(w.BRQaChecklist);
  const ids = new Set<string>();
  for (const g of w.BRQaChecklist.groups) {
    for (const it of g.items) {
      assert.ok(it.href.startsWith('#/'), it.id);
      assert.equal(ids.has(it.id), false, `id duplicado ${it.id}`);
      ids.add(it.id);
    }
  }
  assert.ok(ids.size >= 12);
});

test('guia: em viewport mobile não monta splash nem tour', async () => {
  const appended: unknown[] = [];
  const session: Record<string, string> = { br_onboard: '1' };
  const local: Record<string, string> = {};
  const windowObj: Record<string, unknown> = {
    matchMedia: (q: string) => ({
      matches: /max-width:\s*900px/.test(String(q)),
      addEventListener() { /* noop */ },
      addListener() { /* noop */ },
      media: q,
    }),
    location: { hash: '#/hoje' },
    sessionStorage: {
      getItem: (k: string) => session[k] ?? null,
      setItem: (k: string, v: string) => { session[k] = v; },
      removeItem: (k: string) => { delete session[k]; },
    },
    localStorage: {
      getItem: (k: string) => local[k] ?? null,
      setItem: (k: string, v: string) => { local[k] = v; },
      removeItem: (k: string) => { delete local[k]; },
    },
    BRHelpCatalog: {
      splash: {
        eyebrow: 'x', title: 't', lead: 'l', footnote: 'f',
        ctaSkip: 's', ctaTour: 'c',
        examples: [{ id: 'a', title: 'A', body: 'b' }],
      },
      menuTour: { steps: [{ href: '#/hoje', title: 'Hoje', body: 'x' }] },
      screens: { hoje: { steps: [{ sel: 'hoje-head', title: 't', body: 'b' }] } },
    },
  };
  const documentStub = {
    createElement() {
      return {
        id: '',
        className: '',
        innerHTML: '',
        style: {},
        querySelector() { return { onclick: null, focus() { /* noop */ } }; },
        querySelectorAll() { return []; },
        remove() { /* noop */ },
      };
    },
    body: { appendChild(el: unknown) { appended.push(el); } },
    addEventListener() { /* noop */ },
    removeEventListener() { /* noop */ },
    querySelector() {
      return { getBoundingClientRect() { return { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }; } };
    },
  };
  const ctx = createContext({ window: windowObj, document: documentStub, console });
  (windowObj as { window?: unknown }).window = windowObj;
  runInContext(readFileSync(join(root, 'public/guide.js'), 'utf8'), ctx, { filename: 'public/guide.js' });
  const g = windowObj.BRGuide as {
    maybeSplash: () => Promise<void>;
    startMenuTour: () => Promise<void>;
    maybeScreenCoach: (id: string) => Promise<void>;
    replayMenuTour: () => Promise<void>;
    replayScreen: (id: string) => Promise<void>;
    afterView: (id: string) => void;
    isRunning: () => boolean;
    isMobileLayout: () => boolean;
  };
  assert.equal(g.isMobileLayout(), true);
  await g.maybeSplash();
  await g.startMenuTour();
  await g.maybeScreenCoach('hoje');
  await g.replayMenuTour();
  await g.replayScreen('hoje');
  g.afterView('hoje');
  assert.equal(g.isRunning(), false);
  assert.equal(appended.length, 0);
  assert.equal(Object.keys(local).length, 0);
});
