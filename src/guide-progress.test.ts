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
        screens: Record<string, boolean>;
      };
    };
    BRQaChecklist?: { groups: { id: string; items: { id: string; href: string }[] }[] };
  };
}

const NAV = [
  '#/hoje', '#/radar/opportunities', '#/pipeline', '#/radar/renewals',
  '#/radar/announcements', '#/radar/map', '#/radar/seasonality',
  '#/radar/competitors', '#/entities', '#/config',
];

test('catálogo: cada item da nav tem passo de menu tour', () => {
  const w = loadBrowserJs('public/help/catalog.js', 'public/help/manual/toc.js');
  const hrefs = new Set(w.BRHelpCatalog.menuTour.steps.map((s) => s.href));
  for (const h of NAV) assert.equal(hrefs.has(h), true, `menu tour em falta: ${h}`);
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
