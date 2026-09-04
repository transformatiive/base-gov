# Onboarding, guias por ecrã e manual de utilizador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Do not start coding until the product owner approves this plan.** The manual workstream can start in parallel as soon as Task 1 (catálogo-contrato) is merged, without waiting for the tour engine.

**Goal:** After first signup, show a product splash with examples and an optional guided menu tour; on the first visit to each screen, show skippable spotlights of the main zones; in Ajuda, ship a user manual with screenshots and how-to copy.

**Architecture:** Keep the existing 4-step company-profile wizard. Add a vanilla tour engine (overlay + popover, no npm deps) driven by a single copy catalog. Persist progress in `localStorage` keyed by user id. Help FAB gains a Manual tab and the SPA gains `#/ajuda` / `#/ajuda/:slug`. Manual chapters are HTML files that parallel agents can write independently.

**Tech Stack:** Fastify static files from `public/`; vanilla SPA (`public/app.js`); new `public/guide.js` + `public/help/catalog.js`; CSS in `public/style.css`; Node `node:test` + `node:vm` (same pattern as `src/ficha-title.test.ts`). No Shepherd, Intro.js, or other new npm packages.

## Global Constraints

- Copy: **PT-PT** (utilizador, demonstração, ecrã, secção — never Brazilian variants in UI).
- No new npm dependencies. SPA has no bundler; extra JS is a `<script>` in `public/index.html` with cache-bust `?v=`.
- Imports stay at the top of each module. TypeScript `switch` over unions/enums must have a `never` default.
- Do not replace `maybeOnboarding()` (company profile). Sequence: profile wizard → product splash → optional menu tour → per-screen coaches.
- `app.js` is already ~4200 lines. Tour logic, catalog, and manual renderer stay out of it; `app.js` only calls hooks.
- After UI changes, bump `style.css?v=` / `app.js?v=` / `guide.js?v=` / `catalog.js?v=` in `public/index.html`.
- New test files must be listed in the `test` script in `package.json`.
- Locked Pro nav items remain clickable (403 → upgrade panel). Tours must not pretend they are unlocked.
- Do not commit QA passwords. Screenshot capture uses env vars.

---

## Locked product decisions

These are the decisions an implementer must not reopen unless the owner revises the plan.

1. **Who sees the splash.** Only the session that just registered (`sessionStorage br_onboard === '1'`), after the company-profile modal closes or is skipped. Invited users (aceitar convite) and existing accounts never see the splash. They still get per-screen coaches on first visit, and can start the menu tour from Ajuda.

2. **Existing users after ship.** Per-screen coaches run for everyone the first time they open each screen after this feature exists (`screens[id]` missing in `localStorage`). Splash stays signup-only. Ajuda has «Não voltar a mostrar guias» (sets a global `optOut: true`) and «Repetir demonstração».

3. **Company profile vs product splash.** Keep the 4 questions (distritos, certificações, valor, exclusões). Promisify `maybeOnboarding()` so splash waits until it is gone. Never stack two modals.

4. **Menu tour vs per-screen coaches.** Different jobs. Menu tour = one popover per **nav item** (what that menu opens). Screen coach = zones **inside** the current view. Completing the menu tour **does not** mark screens as seen. After the tour, the current screen (Hoje) may show its coach.

5. **Stacking.** Never two overlays at once. Priority: company profile > splash > menu tour > screen coach. If a menu tour is running, skip screen coaches until `stop()`.

6. **Menu tour navigation.** The tour **navigates** (`location.hash = step.href`) so the user sees each screen, then shows a popover on the nav link (and a short sentence about the page). On mobile, open the nav drawer for nav-targeted steps. Locked screens: still navigate; if the upgrade panel appears, the popover explains what the screen would show and that it is a plano Pro/Business.

7. **Skip always wins.** Every overlay has Sair / Agora não / × / Escape. Skip on splash = no menu tour, still eligible for per-screen coaches. Skip on a screen coach = mark that screen seen. Skip on menu tour = `menuTourDone: true` (do not resume mid-tour later unless they ask from Ajuda).

8. **Replay.** Ajuda: «Ver demonstração dos menus» (starts menu tour), «Explicar este ecrã» (replays current screen coach), «Não voltar a mostrar guias», «Repor guias» (clears `screens` + `menuTourDone` + `optOut`, not `splashDone`).

9. **Manual home.** New hash routes `#/ajuda` and `#/ajuda/:slug`. Help FAB keeps Pedir ajuda / Sugestão and adds a third tab **Manual** with the TOC (links to `#/ajuda/:slug`). Deep link from a coach: button «Saber mais» → `#/ajuda/<screenId>`.

10. **Screenshots.** Committed under `public/help/shots/`. Capture from a Pro-trial account with data (not empty states), desktop ~1280×800. WebP or PNG, max ~200 KB each. Alt text in the catalog. Splash **does not** wait for radar data — it uses illustrated cards (CSS/SVG), not live screenshots.

11. **No backend v1.** Progress is `localStorage` only. Clearing the browser repeats coaches; that is acceptable. Server prefs are out of scope.

12. **Languages.** Manual and tours are PT-PT only.

---

## File map

| File | Responsibility |
|------|----------------|
| `public/help/catalog.js` | **Contract.** Splash copy, menu-tour steps, per-screen coaches, manual TOC + chapter metadata. Parallel agents edit this and chapter HTML, not the engine. |
| `public/help/manual/<slug>.html` | Long-form how-to for one chapter. One file per chapter so git merges stay clean. |
| `public/help/shots/<file>.webp` | Screenshots referenced by catalog `src`. |
| `public/guide.js` | Engine: progress I/O, splash DOM, overlay/popover tour, `maybeScreenCoach`, `startMenuTour`, `stop`. Exposes `window.BRGuide`. |
| `public/style.css` | `.guide-root`, splash, spotlight, popover, manual layout. z-index: splash/tour `1100` > existing `.modal-backdrop` `1000` > `#help-fab` `900`. |
| `public/index.html` | `<script src="/help/catalog.js?v=1">` then `/guide.js?v=1` then `/app.js`. |
| `public/app.js` | Promisify `maybeOnboarding`; call `BRGuide.afterView(id)` at the end of each `render*`; route `#/ajuda`; third FAB tab; `data-guide` attributes on landmarks. |
| `src/guide-progress.test.ts` | Persistence merge, catalog completeness, screenshot files exist, every nav href has a menu step. |
| `scripts/capture-help-shots.md` | How to capture shots (Chrome in the VM / local). No puppeteer added to `package.json`. |

Do **not** put tour step copy inside `app.js`.

---

## Persistence

Key: `br_guide:${userId}` where `userId` is `window._me.user_id`. Fallback `'anon'` only if `_me` is missing (should not happen on authenticated views).

```js
/** @typedef {'hoje'|'oportunidades'|'carteira'|'renovacoes'|'concursos'|'mapa'|'sazonalidade'|'concorrentes'|'entidades'|'config'|'ficha'|'conta'} GuideScreenId */

/** @typedef {{
 *   v: 1,
 *   splashDone: boolean,
 *   splashChoice: 'tour'|'skip'|null,
 *   menuTourDone: boolean,
 *   optOut: boolean,
 *   screens: Record<string, boolean>
 * }} GuideProgress */

const EMPTY_PROGRESS = {
  v: 1,
  splashDone: false,
  splashChoice: null,
  menuTourDone: false,
  optOut: false,
  screens: {},
};
```

`loadProgress` must JSON.parse inside try/catch and merge onto `EMPTY_PROGRESS` so a partial object never crashes. `saveProgress(patch)` Object.assigns onto loaded state and writes.

Logout (`clearClientSession`) does **not** delete guide progress (it is keyed by user id; the next login of the same user should not repeat).

`br_onboard` / `br_onboard_done` stay as they are (company profile only).

---

## First-login sequence

```
POST /api/auth/register
  → sessionStorage br_onboard=1
  → #/hoje
renderHoje
  → await maybeOnboarding()     // existing 4 steps; skip/X/save all resolve the promise
  → await BRGuide.maybeSplash() // only if br_onboard was 1 this session AND !splashDone
       [Sim, demonstração] → startMenuTour() then maybeScreenCoach('hoje')
       [Explorar sozinho]  → splashDone, splashChoice=skip, maybeScreenCoach('hoje')
  → if splash not shown      → maybeScreenCoach('hoje')
```

`maybeOnboarding` today returns immediately after appending the modal. **Change:** return a Promise that resolves in `finish()`. If the early-return guards fire, resolve immediately.

`maybeSplash` returns a Promise that resolves when the user chooses. If splash should not show, resolve immediately.

---

## Engine API (`window.BRGuide`)

Implementers must use these names (later tasks depend on them):

```js
window.BRGuide = {
  loadProgress: function () {},
  saveProgress: function (patch) {},
  /** @returns {Promise<void>} */
  maybeSplash: function () {},
  /** @returns {Promise<void>} */
  startMenuTour: function () {},
  /**
   * @param {GuideScreenId} id
   * @returns {Promise<void>}
   */
  maybeScreenCoach: function (id) {},
  /** Stop overlay; do not mark progress unless `opts.complete`. */
  stop: function (opts) {},
  afterView: function (id) {},
  replayMenuTour: function () {},
  replayScreen: function (id) {},
  setOptOut: function (value) {},
  resetGuides: function () {},
  isRunning: function () { return false; },
};
```

`afterView(id)` is what `app.js` calls:

```js
function afterView(id) {
  if (this.isRunning()) return;
  const p = this.loadProgress();
  if (p.optOut) return;
  this.maybeScreenCoach(id);
}
```

Call `afterView` in a `requestAnimationFrame` (double rAF) after innerHTML is set, so `data-guide` nodes exist. If the target selector is missing (empty state, upgrade panel), skip that step and continue; if **all** steps miss, do not mark the screen seen (retry next visit). Exception: upgrade panel — use fallback selector `.upgrade-card` with copy from `catalog.screens[id].lockedFallback`.

Spotlight: a full-viewport `position:fixed` layer with a cutout (`box-shadow: 0 0 0 9999px rgba(15,25,20,.55)` on a clone rect, or four dim panels). Popover is a `role="dialog"` with title, body, step `i/n`, **Seguinte** / **Sair**. Focus trap inside the popover. Highlighted element gets `outline` + `border-radius` and `scrollIntoView({ block: 'center' })`.

Popover placement: `placement: 'right'|'left'|'bottom'|'top'` from the step; flip if it would overflow. On viewports ≤900px, always `bottom` and pad for the help FAB.

Do not use `z-index` below 1100. Company-profile modal stays 1000; splash/tour must wait until that modal is removed.

---

## Catalog schema (`window.BRHelpCatalog`)

`public/help/catalog.js` assigns a frozen object. Tests assert this shape.

```js
window.BRHelpCatalog = {
  splash: {
    eyebrow: 'Primeiros passos',
    title: 'O seu radar de contratos públicos',
    lead: 'Em dois minutos vê o que o BaseRadar faz por si. Depois pode pedir uma visita guiada pelos menus — ou explorar sozinho.',
    examples: [
      { id: 'hoje', title: 'Hoje', body: 'O que exige atenção hoje: concursos a fechar, carteira com prazo e valor em jogo nos próximos 90 dias.' },
      { id: 'oportunidades', title: 'Oportunidades', body: 'Concursos abertos e renovações, ordenados por score. Adequação IA à sua atividade no plano Pro.', pro: true },
      { id: 'carteira', title: 'Carteira', body: 'Kanban da empresa: Interessa → Em preparação → Submetida. Estados partilhados com a equipa.', pro: true },
      { id: 'mapa', title: 'Mapa e sazonalidade', body: 'Onde as entidades compram na sua atividade, e em que meses o mercado se mexe.' },
    ],
    ctaTour: 'Quero a demonstração',
    ctaSkip: 'Explorar sozinho',
    footnote: 'Pode sair a qualquer momento. Os guias de cada ecrã aparecem só na primeira visita.',
  },
  menuTour: {
    steps: [
      /* see copy table below — href must match #topbar nav */
    ],
  },
  screens: {
    /* id -> { title, lockedFallback, steps: [{ sel, title, body, placement, moreSlug }] } */
  },
  manual: {
    title: 'Manual de utilizador',
    intro: 'Como usar cada zona do BaseRadar. As imagens correspondem ao ecrã em ambiente de trabalho.',
    chapters: [
      /* { slug, title, group, href, html: '/help/manual/<slug>.html', shots: [...] } */
    ],
  },
};
```

`sel` is a CSS selector. Prefer `[data-guide="hoje-ctx"]` over classes that styling may change.

`moreSlug` is the manual chapter slug for «Saber mais».

---

## `data-guide` landmarks to add in `app.js`

Add attributes while touching each renderer. Selectors below are the contract for coaches and for screenshot captions.

| Screen id | Hash | Attributes to add |
|-----------|------|-------------------|
| `hoje` | `#/hoje` | `hoje-head` on `.hoje-head`; `hoje-ctx` on `#ctx-select` wrapper; `hoje-agir` on the Agir block; `hoje-pipe` on `.hoje-pipe` (optional if empty); `hoje-injogo` on `.injogo-card`; `hoje-mapa` on `.mini-card` «Onde está o dinheiro» |
| `oportunidades` | `#/radar/opportunities` | `opp-title` on the h1 toolbar; `opp-filters` on `.filter-bar`; `opp-matrix` on the matrix card; `opp-table` on `.opp-t`; `opp-pipeline` on the first `.pl-dd` |
| `carteira` | `#/pipeline` | `pl-board` on `.pl-board`; `pl-col-interessa` on `[data-status="interessa"]`; `pl-closed` on `.pl-closed` |
| `renovacoes` | `#/radar/renewals` | `ren-title`; `ren-filters`; `ren-table` (reuse filter-bar + list root — add `data-guide` in `renderInsightTab`) |
| `concursos` | `#/radar/announcements` | `ann-title`; `ann-filters`; `ann-table` |
| `mapa` | `#/radar/map` | `map-canvas` on the map container; `map-legend` if present |
| `sazonalidade` | `#/radar/seasonality` | `sea-chart` on the seasonality card |
| `concorrentes` | `#/radar/competitors` | `cmp-table` on the ranking table |
| `entidades` | `#/entities` | `ent-tabs` on contracting/contracted toggle; `ent-search` on the search input; `ent-table` |
| `config` | `#/config` | `cfg-tabs` on `.tabs`; `cfg-profiles` on the profiles card |
| `ficha` | `#/announcements/:id`, `#/contracts/:id` | `ficha-tabs` on `.ficha-tabs`; `ficha-ia` on `#pane-ia` or `.ai-verdict`; `ficha-carteira` on `#pl-ficha` / carteira pane; `ficha-enq` on Enquadramento |
| `conta` | `#/conta` | `acct-plan` on the plan block; `acct-seats` on the seats table |

Nav tour targets: `#topbar nav a[href="<hash>"]`. Whoami is not in the menu tour (Conta is a screen coach only).

---

## Copy — menu tour (PT-PT)

Use this text. Do not invent parallel wording.

| href | title | body | `pro` |
|------|-------|------|-------|
| `#/hoje` | Hoje | O painel do dia: o que tem prazo, o que está na carteira e o valor em jogo. Comece sempre aqui. | no |
| `#/radar/opportunities` | Oportunidades | Concursos abertos e renovações da sua atividade, ordenados por score (valor, urgência, recorrência). A adequação IA aparece no plano Pro. | yes (`score_fit`) |
| `#/pipeline` | Carteira | Mesa de trabalho da empresa. Arraste cartas entre Interessa, Em preparação e Submetida. Os estados são partilhados. | yes (`pipeline`) |
| `#/radar/renewals` | Renovações | Contratos a terminar — a janela para contactar o cliente antes do novo procedimento. | yes (`renovacoes`) |
| `#/radar/announcements` | Concursos | Anúncios do BASE/DRE na sua atividade, incluindo no plano Grátis. Abra a ficha para prazos, peças e análise IA. | no |
| `#/radar/map` | Mapa | Onde as entidades adjudicantes compram na sua área. Clique num distrito para o detalhe. | no |
| `#/radar/seasonality` | Sazonalidade | Em que meses o mercado da sua atividade costuma abrir procedimentos. | no |
| `#/radar/competitors` | Concorrentes | Quem ganha os contratos no seu perfil: quota, volume e entidades em comum. | yes (`concorrentes`) |
| `#/entities` | Entidades | Ficha de adjudicantes e adjudicatários: histórico, CPV e ligações. | yes (`entidades`) |
| `#/config` | Configuração | Perfis de atividade (termos e CPV), recolhas e dados abertos. É isto que alimenta o radar. | no |

When `pro` is true and `!can(feature)`, append: ` Neste plano o menu aparece com cadeado — o conteúdo exige Pro ou Business.`

Tour chrome: eyebrow `Demonstração {i} de {n}`; buttons `Seguinte` / `Sair`; last step button `Concluir`.

---

## Copy — per-screen coaches (PT-PT)

Each screen: 3–5 steps max. Always skippable.

### hoje

1. `hoje-head` — **O seu dia.** Cumprimento, prazos a agir e a actividade seleccionada. Se a primeira recolha ainda corre, os números vão aparecendo.
2. `hoje-ctx` — **Actividade.** Troque o perfil (termos/CPV) sem sair do Hoje. Cada perfil tem o seu radar.
3. `hoje-agir` — **Agir.** Concursos e renovações com prazo ≤ 30 dias. Abra a ficha ou as peças do procedimento.
4. `hoje-injogo` — **Em jogo.** Valor dos procedimentos nos próximos 90 dias. O mapa ao lado mostra onde está o dinheiro.

If `hoje-agir` is missing (empty): use `hoje-head` only + injogo. Do not block.

### oportunidades

1. `opp-filters` — **Filtros.** Objecto, entidade, distrito, valor. O filtro de valor é Pro.
2. `opp-matrix` — **Matriz.** Cima-esquerda = agir já (valor alto, prazo curto). Cor = fit IA quando existir.
3. `opp-table` — **Lista.** Score, fit, data-chave. Clique a linha para a ficha.
4. `opp-pipeline` — **Estado.** Passe para a carteira sem sair da lista.

### carteira

1. `pl-board` — **Kanban.** Três colunas abertas. Arraste a carta para mudar o estado (partilhado na empresa).
2. `pl-col-interessa` — **Interessa.** Caixa de entrada. Daqui passa a Em preparação quando for avançar.
3. `pl-closed` — **Fechadas.** Ganha, perdida, descartada e outras — fora do quadro principal.

Empty carteira: one step on `h1` — **Ainda vazia.** Marque um concurso ou renovação como Interessa a partir da lista.

### renovacoes / concursos / mapa / sazonalidade / concorrentes / entidades

Same pattern: title (what the list is), primary control (filters/search/map), then the result surface. Exact sentences:

- Renovações: «Contratos do seu perfil a aproximar-se do fim. Use a data de contactar e abra a ficha do contrato.»
- Concursos: «Anúncios abertos e encerrados. O prazo de propostas está na ficha. Plano Grátis inclui esta lista.»
- Mapa: «Cada distrito soma contratos da actividade. Clique para entidades e procedimentos desse território.»
- Sazonalidade: «Distribuição mensal. Serve para planear capacidade, não para prever um concurso concreto.»
- Concorrentes: «Ranking de adjudicatários no seu perfil. Quota e volume — não é uma lista de «inimigos», é o mercado.»
- Entidades: «Adjudicantes vs adjudicatários. Pesquise pelo nome ou NIF e abra o histórico.»

### config

1. `cfg-tabs` — Perfis, recolhas do site, dados abertos.
2. `cfg-profiles` — Um perfil = uma actividade (palavras-chave + CPV). Sem perfil não há radar no Hoje.

### ficha

1. `ficha-tabs` — Análise IA, Enquadramento, Carteira, Cronologia.
2. `ficha-ia` — Go / no-go, fit, habilitação, checklist. A checklist precisa das peças; o anúncio DRE sozinho não chega.
3. `ficha-carteira` — Estado na carteira da empresa e responsável.

### conta

1. `acct-plan` — Plano, trial, faturas.
2. `acct-seats` — Lugares e convites. O tecto conta membros **e** convites pendentes.

### lockedFallback (all Pro screens)

Title: **Funcionalidade do plano Pro.** Body: **Este ecrã está incluído no Pro e no Business. Pode ver os planos ou voltar ao Hoje e aos Concursos, que estão no Grátis.** Selector: `.upgrade-card`.

---

## Workstream split (multitasking)

```
Task 1  Catalog contract + empty manual shells + tests that fail on missing chapters
   ├─ Workstream A (serial): engine, CSS, splash, menu tour, app.js hooks   [Tasks 2–7]
   ├─ Workstream B (after data-guide attrs): per-screen coaches              [Task 8]
   └─ Workstream C (parallel, many agents): one chapter + shots per agent  [Tasks 9–20]
Merge C into main only after A has #/ajuda renderer (Task 6), or land chapters as HTML
files that Task 6 already lists in the TOC — they can exist before the renderer.
```

**Workstream C rule:** one agent = one `public/help/manual/<slug>.html` + the matching `shots` listed in that chapter + the `manual.chapters[]` entry. Do not edit `guide.js`. Do not edit other chapters. If two agents need `catalog.js`, prefer editing only the `chapters` array line for that slug (minimize merge conflicts) **or** keep TOC in `public/help/manual/toc.js` exporting `BRHelpManualToc` so catalog.js stays engine-owned.

**Decision for merge safety:** split TOC to `public/help/manual/toc.js` (`window.BRHelpManualToc = { chapters: [...] }`). `catalog.js` holds splash, menuTour, screens. Manual agents never touch `catalog.js` or `guide.js`.

---

### Task 1: Freeze the catalog contract and completeness tests

**Files:**
- Create: `public/help/catalog.js`
- Create: `public/help/manual/toc.js`
- Create: `src/guide-progress.test.ts`
- Modify: `package.json` (`test` script — append `src/guide-progress.test.ts`)

**Produces:** `window.BRHelpCatalog`, `window.BRHelpManualToc`, test file that loads both via `node:vm`.

- [ ] **Step 1: Write `public/help/catalog.js`** with splash + menuTour + screens as specified above (all PT-PT strings in this plan). Wrap in IIFE; assign `window.BRHelpCatalog`. Use `'use strict'`. No inline imports.

- [ ] **Step 2: Write `public/help/manual/toc.js`**

```js
(function (w) {
  'use strict';
  w.BRHelpManualToc = {
    title: 'Manual de utilizador',
    intro: 'Como usar cada zona do BaseRadar. As imagens correspondem ao ecrã em ambiente de trabalho.',
    chapters: [
      /* Task 1: shots: [] em todos. Workstream C preenche os filenames da tabela de capítulos. */
      { slug: 'hoje', title: 'Hoje', group: 'Dia a dia', href: '#/hoje', html: '/help/manual/hoje.html', shots: [] },
      { slug: 'oportunidades', title: 'Oportunidades', group: 'Radar', href: '#/radar/opportunities', html: '/help/manual/oportunidades.html', shots: [], pro: true },
      { slug: 'carteira', title: 'Carteira', group: 'Dia a dia', href: '#/pipeline', html: '/help/manual/carteira.html', shots: [], pro: true },
      { slug: 'renovacoes', title: 'Renovações', group: 'Radar', href: '#/radar/renewals', html: '/help/manual/renovacoes.html', shots: [], pro: true },
      { slug: 'concursos', title: 'Concursos', group: 'Radar', href: '#/radar/announcements', html: '/help/manual/concursos.html', shots: [] },
      { slug: 'mapa', title: 'Mapa', group: 'Radar', href: '#/radar/map', html: '/help/manual/mapa.html', shots: [] },
      { slug: 'sazonalidade', title: 'Sazonalidade', group: 'Radar', href: '#/radar/seasonality', html: '/help/manual/sazonalidade.html', shots: [] },
      { slug: 'concorrentes', title: 'Concorrentes', group: 'Radar', href: '#/radar/competitors', html: '/help/manual/concorrentes.html', shots: [], pro: true },
      { slug: 'entidades', title: 'Entidades', group: 'Radar', href: '#/entities', html: '/help/manual/entidades.html', shots: [], pro: true },
      { slug: 'ficha', title: 'Ficha do procedimento', group: 'Dia a dia', href: null, html: '/help/manual/ficha.html', shots: [] },
      { slug: 'config', title: 'Configuração e perfis', group: 'Conta', href: '#/config', html: '/help/manual/config.html', shots: [] },
      { slug: 'conta', title: 'Conta, planos e equipa', group: 'Conta', href: '#/conta', html: '/help/manual/conta.html', shots: [] },
      { slug: 'guias', title: 'Demonstração e guias', group: 'Ajuda', href: '#/ajuda', html: '/help/manual/guias.html', shots: [] },
    ],
  };
})(window);
```

- [ ] **Step 3: Write failing test** `src/guide-progress.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadBrowserJs(...rel: string[]) {
  const ctx = createContext({ window: {} as Record<string, unknown>, console });
  (ctx as { window: { window?: unknown } }).window = ctx.window;
  for (const r of rel) {
    runInContext(readFileSync(join(root, r), 'utf8'), ctx, { filename: r });
  }
  return ctx.window as {
    BRHelpCatalog: { splash: { examples: unknown[] }; menuTour: { steps: { href: string }[] }; screens: Record<string, { steps: unknown[] }> };
    BRHelpManualToc: { chapters: { slug: string; html: string; shots: string[] }[] };
    BRGuide?: { loadProgress: (raw: string | null) => unknown };
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

test('catálogo: ecrãs obrigatórios têm passos', () => {
  const w = loadBrowserJs('public/help/catalog.js', 'public/help/manual/toc.js');
  for (const id of ['hoje', 'oportunidades', 'carteira', 'ficha', 'config', 'conta']) {
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
```

Task 1 also creates **stub** HTML for every slug (`<article lang="pt"><h1>…</h1><p>A redigir.</p></article>`) with `shots: []` in the TOC. Workstream C replaces the stub copy and then adds filenames to `shots` — CI fails until those image files are committed. **Do not** commit fake screenshots.

- [ ] **Step 4: Add the test file to `package.json` `test` script** (space-separated, same style as `src/seat-occupancy.test.ts`).

- [ ] **Step 5: Run** `npm test` — catalog/nav tests pass; html stubs pass; shots test passes because stubs list `shots: []` until C fills them. When a chapter adds a filename to `shots`, CI fails until the image is committed (intentional).

- [ ] **Step 6: Commit** `catalog: contrato de onboarding, guias e TOC do manual`

---

### Task 2: Progress helper + unit tests (TDD)

**Files:**
- Create: `public/guide.js` (progress functions first)
- Modify: `src/guide-progress.test.ts`

**Produces:** `BRGuide.loadProgress` / `saveProgress` using a injected storage in tests.

Implement progress in `guide.js` so tests can run:

```js
(function (w) {
  'use strict';
  var EMPTY = { v: 1, splashDone: false, splashChoice: null, menuTourDone: false, optOut: false, screens: {} };
  function key(uid) { return 'br_guide:' + String(uid == null ? 'anon' : uid); }
  function parse(raw) {
    var base = { v: 1, splashDone: false, splashChoice: null, menuTourDone: false, optOut: false, screens: {} };
    if (!raw) return base;
    try {
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return base;
      return {
        v: 1,
        splashDone: !!o.splashDone,
        splashChoice: o.splashChoice === 'tour' || o.splashChoice === 'skip' ? o.splashChoice : null,
        menuTourDone: !!o.menuTourDone,
        optOut: !!o.optOut,
        screens: o.screens && typeof o.screens === 'object' ? Object.assign({}, o.screens) : {},
      };
    } catch (e) { return base; }
  }
  w.BRGuideProgress = { key: key, parse: parse, EMPTY: EMPTY };
})(window);
```

Tests (add to `src/guide-progress.test.ts`):

```ts
test('parse: JSON lixo devolve EMPTY', () => {
  const w = loadBrowserJs('public/guide.js');
  const p = (w as { BRGuideProgress: { parse: (s: string) => { splashDone: boolean } } }).BRGuideProgress.parse('{');
  assert.equal(p.splashDone, false);
});
test('parse: merge parcial', () => {
  const w = loadBrowserJs('public/guide.js');
  const p = (w as { BRGuideProgress: { parse: (s: string) => { screens: Record<string, boolean>; optOut: boolean } } })
    .BRGuideProgress.parse('{"screens":{"hoje":true}}');
  assert.equal(p.screens.hoje, true);
  assert.equal(p.optOut, false);
});
```

- [ ] **Step 1: Write the parse tests first, run, expect FAIL** (`BRGuideProgress` missing).
- [ ] **Step 2: Add the IIFE above to `public/guide.js`.**
- [ ] **Step 3: Run `npx tsx --test src/guide-progress.test.ts` — PASS.**
- [ ] **Step 4: Commit** `guide: persistência localStorage br_guide`

---

### Task 3: Overlay + popover engine (no copy)

**Files:**
- Modify: `public/guide.js`
- Modify: `public/style.css` (append a `/* Guide overlay */` block)

**Produces:** `BRGuide.startSteps(steps, { onComplete, onSkip })` where `steps` is `{ sel, title, body, placement?, href? }[]`.

Behaviour:

- Create `#guide-root.guide-root` (fixed, inset 0, z-index 1100, pointer-events none on the dim, pointer-events auto on popover).
- For each step: if `href` and `location.hash` is not that href, set hash and **wait** for `window.BRGuide._viewReady` (app.js will set this; see Task 5) with a 4s timeout, then query `sel`.
- Missing `sel`: skip step.
- Buttons: Seguinte → next; Sair → `onSkip`; last Seguinte → `onComplete`.
- Escape → `onSkip`.
- `stop()` removes `#guide-root`.
- `aria-modal="true"` on `.guide-pop`.

CSS essentials:

```css
.guide-root { position: fixed; inset: 0; z-index: 1100; pointer-events: none; }
.guide-spot { position: absolute; pointer-events: none; border-radius: 12px; box-shadow: 0 0 0 9999px rgba(15, 25, 20, 0.55); outline: 2px solid #cfe8df; }
.guide-pop { pointer-events: auto; position: absolute; max-width: 340px; background: #fff; border-radius: 16px; padding: 16px 18px 14px; box-shadow: 0 24px 60px rgba(20, 30, 25, 0.28); }
.guide-pop h3 { margin: 0 0 0.35rem; font-size: 1.05rem; }
.guide-pop .guide-n { font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.guide-actions { display: flex; justify-content: space-between; gap: 8px; margin-top: 12px; }
.guide-splash { pointer-events: auto; position: relative; margin: auto; max-width: 760px; width: calc(100% - 32px); background: #fff; border-radius: 20px; padding: 28px 28px 22px; }
.guide-ex { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 1.1rem 0 1.2rem; }
@media (max-width: 700px) { .guide-ex { grid-template-columns: 1fr; } .guide-splash { padding: 18px; } }
.guide-ex article { border: 1px solid var(--line, #e2e8f0); border-radius: 14px; padding: 12px 14px; }
.guide-ex article .pro { font-size: 0.68rem; font-weight: 700; color: #8a6a1e; }
```

- [ ] Implement `startSteps` / `stop` / `isRunning`.
- [ ] Commit `guide: overlay e popover sem dependências`

---

### Task 4: Product splash

**Files:** `public/guide.js`, `public/style.css`

`maybeSplash()`:

```js
function maybeSplash() {
  return new Promise(function (resolve) {
    var onboard = false;
    try { onboard = sessionStorage.getItem('br_onboard') === '1'; } catch (e) {}
    var p = load();
    if (p.splashDone || p.optOut || !onboard) { resolve(); return; }
    var cat = w.BRHelpCatalog.splash;
    /* render .guide-splash inside #guide-root */
    /* CTA tour → save { splashDone:true, splashChoice:'tour' }; startMenuTour().then(resolve) */
    /* CTA skip → save { splashDone:true, splashChoice:'skip' }; resolve() */
  });
}
```

Illustrated examples: CSS-only icon row (reuse the wordmark green), not screenshots. Mark `pro: true` examples with the word `Pro` in the card.

- [ ] Commit `onboarding: splash após o perfil da empresa`

---

### Task 5: Hook `app.js` — promisify onboarding, `afterView`, `_viewReady`

**Files:** `public/app.js`, `public/index.html`

- [ ] In `index.html`, before `app.js`:

```html
<script src="/help/catalog.js?v=1"></script>
<script src="/help/manual/toc.js?v=1"></script>
<script src="/guide.js?v=1"></script>
```

Bump `app.js?v=` by +1 from current (at plan time `v=63` → `v=64` if no other bump landed).

- [ ] Change `maybeOnboarding` to `return new Promise((resolve) => { ... finish() { ... resolve(); } })`. Early returns: `return Promise.resolve()`.

- [ ] At end of `renderHoje`, after `maybeOnboarding()`:

```js
  const g = window.BRGuide;
  if (g && !opts.silent) {
    await maybeOnboarding();
    if (g.maybeSplash) await g.maybeSplash();
    g.afterView('hoje');
  } else {
    maybeOnboarding();
  }
```

Today `maybeOnboarding()` is fire-and-forget after DOM paint. Replace that call with the block above. Keep the poll timer logic unchanged.

- [ ] At the end of `renderPipeline`, `renderRadar` (map tab id from argument), `renderEntities`, `renderProfiles`/`renderSearches`/`renderOpendata` (config), `renderAnnouncement`, `renderContract`, `renderAccount`:

```js
window.BRGuide?._viewReady?.();
window.BRGuide?.afterView('<id>');
```

Map tab → screen id:

```js
const RADAR_GUIDE = {
  opportunities: 'oportunidades',
  renewals: 'renovacoes',
  announcements: 'concursos',
  map: 'mapa',
  seasonality: 'sazonalidade',
  competitors: 'concorrentes',
};
function radarGuideId(tab) { return RADAR_GUIDE[tab] || 'oportunidades'; }
```

- [ ] In `route()`, before rendering, `window.BRGuide?.stop({ navigated: true })` **only if** a tour is running **and** the hash change was **not** initiated by the tour (`BRGuide._navigating === true`). Otherwise the user clicking nav mid-tour exits the tour (mark `menuTourDone`).

- [ ] `startMenuTour` sets `_navigating = true` before hash change, clears it after `_viewReady`.

- [ ] Commit `app: ganchos de guia após cada vista`

---

### Task 6: Ajuda — rota `#/ajuda` + tab Manual no FAB

**Files:** `public/app.js`, `public/style.css`

- [ ] In `route()`:

```js
const ajuda = hashBase.match(/^#\/ajuda(?:\/([\w-]+))?$/);
if (ajuda) return renderAjuda(ajuda[1] || '');
```

- [ ] `renderAjuda(slug)`:

  - Sidebar from `BRHelpManualToc.chapters` grouped by `group`.
  - Main: `fetch(chapter.html)` → inject HTML (sanitize: only insert as `innerHTML` from **our** static files, never from user input).
  - If slug empty, show intro + TOC cards.
  - Unknown slug: «Capítulo não encontrado» + link to `#/ajuda`.
  - Footer actions: buttons calling `BRGuide.replayMenuTour()`, `BRGuide.replayScreen(currentId)`, `BRGuide.setOptOut(true)`, `BRGuide.resetGuides()`.

- [ ] `openFeedbackModal`: add tab `data-kind="manual"` **Manual**. Active panel lists the same TOC as links `#/ajuda/${slug}` and a button «Ver o manual completo». Keep Pedir ajuda / Sugestão posting to `/api/feedback`.

- [ ] FAB `onclick`: if `hash` already `#/ajuda`, still allow the modal (feedback). Fine.

- [ ] Commit `ajuda: manual em #/ajuda e tab no FAB`

---

### Task 7: Menu tour wiring

**Files:** `public/guide.js`

`startMenuTour`:

```js
function startMenuTour() {
  var steps = (w.BRHelpCatalog.menuTour.steps || []).map(function (s) {
    var locked = s.feature && w.can && !w.can(s.feature);
    return {
      href: s.href,
      sel: '#topbar nav a[href="' + s.href + '"]',
      title: s.title,
      body: s.body + (locked ? ' Neste plano o menu aparece com cadeado — o conteúdo exige Pro ou Business.' : ''),
      placement: 'right',
    };
  });
  if (window.matchMedia('(max-width: 900px)').matches) {
    document.getElementById('nav-toggle')?.click?.();
    /* or window.setAppNavOpen(true) if exposed */
  }
  return startSteps(steps, {
    onComplete: function () { save({ menuTourDone: true }); },
    onSkip: function () { save({ menuTourDone: true }); },
  });
}
```

Expose `window.can` is already a function in `app.js` (same scope as other top-level fns — it is not on `window`). **In Task 5**, add `window.can = can;` next to other globals, or pass `can` into `BRGuide.bind({ can: can })`. Prefer:

```js
window.BRGuide.bind({ can: can, getUserId: function () { return window._me?.user_id; } });
```

called once from `route()` after `_me` is set.

Mobile: Task 5 should export `window.setAppNavOpen` (function already exists) so the tour can open the drawer. Today `setAppNavOpen` is file-private — assign `window.setAppNavOpen = setAppNavOpen`.

- [ ] Commit `guide: demonstração guiada dos menus`

---

### Task 8: Per-screen coaches + `data-guide` attributes

**Files:** `public/app.js` (attributes in render HTML strings), `public/guide.js` (`maybeScreenCoach`)

```js
function maybeScreenCoach(id) {
  var p = load();
  if (p.optOut || p.screens[id] || this.isRunning()) return Promise.resolve();
  var spec = w.BRHelpCatalog.screens[id];
  if (!spec) return Promise.resolve();
  var locked = document.querySelector('.upgrade-card');
  var steps = locked && spec.lockedFallback
    ? [{ sel: '.upgrade-card', title: spec.lockedFallback.title, body: spec.lockedFallback.body, placement: 'bottom' }]
    : spec.steps.map(function (st) {
        return { sel: '[data-guide="' + st.sel + '"]', title: st.title, body: st.body, placement: st.placement || 'bottom' };
      });
  return startSteps(steps, {
    onComplete: function () { var s = load().screens; s[id] = true; save({ screens: s }); },
    onSkip: function () { var s = load().screens; s[id] = true; save({ screens: s }); },
  });
}
```

Catalog `steps[].sel` is the **token** (`hoje-ctx`), not a full CSS selector.

If every query returns null, **do not** mark seen.

- [ ] Add `data-guide="..."` in the HTML templates listed in the landmarks table.
- [ ] Commit `guide: coaches na primeira visita a cada ecrã`

---

### Task 9–20: Manual chapters (parallel)

Each task is one chapter. **Files:** `public/help/manual/<slug>.html`, `public/help/shots/<files>`, `public/help/manual/toc.js` (fill `shots` array).

**Shared article skeleton** (every chapter):

```html
<article class="help-article" lang="pt">
  <h1>…</h1>
  <p class="lead">…</p>
  <h2>Para que serve</h2>
  <p>…</p>
  <h2>Como usar</h2>
  <ol>
    <li>…</li>
  </ol>
  <figure>
    <img src="/help/shots/FILE.webp" alt="… descrição concreta em PT-PT …" width="1280" height="800">
    <figcaption>…</figcaption>
  </figure>
  <h2>Dicas</h2>
  <ul>
    <li>…</li>
  </ul>
  <p class="help-related">Ver também: <a href="#/ajuda/SLUG">…</a></p>
</article>
```

**Screenshot capture (same for all C agents):**

1. Use a Pro-trial QA account (password from the vault, never commit).
2. Desktop viewport 1280×800, logged-in `/app`.
3. Avoid personal data if possible; blur NIF/email in the shot if it appears (Conta).
4. Prefer WebP. If the pipeline has no encoder, PNG is fine under 250 KB.
5. Record the hash and a one-line caption in `figcaption`.
6. Instructions live in `scripts/capture-help-shots.md` (Task 1 or first C agent creates it).

**Chapter briefs (write the full PT-PT article, not “TBD”):**

| Task | slug | Must explain | Shots |
|------|------|----------------|-------|
| 9 | `hoje` | Cumprimento, ctx perfil, Agir / pipeline do dia, Em jogo, poll da primeira recolha, atalho para Oportunidades | `hoje-painel.webp`, `hoje-injogo.webp` |
| 10 | `oportunidades` | Score, fit IA, matriz, filtros (valor=Pro), chip de carteira | `opp-lista.webp`, `opp-matriz.webp` |
| 11 | `carteira` | Drag and drop, colunas, fechadas, partilha Business, vazio | `carteira-kanban.webp` |
| 12 | `renovacoes` | Data de fim, contactar até, ficha de contrato vs anúncio | `renovacoes-lista.webp` |
| 13 | `concursos` | Lista Grátis, prazo, abrir ficha, peças | `concursos-lista.webp` |
| 14 | `mapa` | Clique distrito, cor=volume, Desconhecido | `mapa-distritos.webp` |
| 15 | `sazonalidade` | Leitura do gráfico, não é previsão | `sazonalidade.webp` |
| 16 | `concorrentes` | Quota, volume, «ver análise» | `concorrentes.webp` |
| 17 | `entidades` | Adjudicante vs adjudicatário, pesquisa | `entidades.webp` |
| 18 | `ficha` | Separadores IA / Enquadramento / Carteira / Cronologia; checklist precisa de peças; spinner da IA | `ficha-ia.webp`, `ficha-separadores.webp` |
| 19 | `config` | Criar perfil, termos+CPV, dispositivos médicos CPV 331, recolhas, dados abertos | `config-perfis.webp` |
| 20 | `conta` | Planos, 7 dias Pro, lugares vs convites pendentes, faturas, cancelar | `conta-equipa.webp` |

**Also write `guias.html` (can fold into Task 6):** how splash, menu tour, per-screen, Sair, opt-out, and replay work. No screenshot required.

Each C commit message: `manual: capítulo <slug>`

**Empty-state note in articles:** one short paragraph «Se a lista estiver vazia…» (perfil sem recolha, carteira vazia).

**Gating note in Pro chapters:** first paragraph «Disponível no Pro e Business. No Grátis o menu mostra um cadeado e um painel de atualização.»

---

### Task 21: Manual CSS + empty/error states for `#/ajuda`

**Files:** `public/style.css`

```css
.help-layout { display: grid; grid-template-columns: 220px 1fr; gap: 24px; align-items: start; }
.help-toc a { display: block; padding: 6px 8px; border-radius: 8px; }
.help-toc a.active { background: var(--panel-2, #eef2f7); font-weight: 600; }
.help-article img { width: 100%; height: auto; border: 1px solid var(--line); border-radius: 12px; }
.help-article .lead { font-size: 1.05rem; color: var(--ink2); }
@media (max-width: 900px) { .help-layout { grid-template-columns: 1fr; } }
```

- [ ] Commit `ajuda: layout do manual`

---

### Task 22: Browser / smoke verification

**Not optional for Workstream A.** Workstream C verifies its own chapter at `#/ajuda/<slug>` (image loads, no broken alt).

A agent checklist:

1. Incognito register (new email) → company wizard → splash appears with 4 examples → Sair/Explorar sozinho → Hoje coach → Sair → reload Hoje → **no** coach.
2. New register → splash → Quero a demonstração → walk all 10 nav items → locked items show cadeado sentence on free plan → Concluir → Hoje coach.
3. Existing session: open Carteira first time → coach; second time → none.
4. `#/ajuda`, `#/ajuda/hoje`, FAB Manual tab, Pedir ajuda still posts.
5. Escape and × dismiss overlays.
6. Mobile 390px: splash stacks 1 column; menu tour opens drawer; FAB not covering popover buttons.
7. `npm test` and `npx tsc --noEmit`.

- [ ] Commit only if verification found fixes.

---

## What this plan explicitly does not do

- Server-side guide progress / cross-device sync.
- Video or audio tour.
- English locale.
- In-app changelog.
- Rewriting the company-profile wizard.
- Highlighting Admin.
- Auto-starting coaches on `#/login` or landing.html.
- Adding Shepherd/Intro.js/npm tour libraries.

---

## Execution after approval

1. Land Task 1 on a branch `cursor/guide-catalog-3855` so Workstream C can fork from it.
2. Workstream A: Tasks 2–8 + 21–22 on `cursor/guide-engine-3855` (or sequential on one branch).
3. Workstream C: one branch per chapter `cursor/manual-<slug>-3855` **or** a single `cursor/manual-help-3855` if one agent writes all copy after shots exist.
4. Screenshot capture can be one agent with Chrome, then chapters fill `shots` filenames.

**Recommended execution:** Subagent-driven for A (engine is sequential). Dispatch **parallel** agents for C once Task 1 stubs exist, one chapter each.

If implementing in this repo after approval: bump cache-bust, do not squash C and A into one unreviewable PR — engine PR first, then manual PRs.

---

## Context already checked

- Granola: no BaseRadar meetings on onboarding/help; this plan is not contradicting a recorded decision.
- Mobbin: design-reference search is not available on the current plan; visual language follows existing `.modal-box`, brand green `#173f35`, Schibsted Grotesk.
- Existing `maybeOnboarding` + Help FAB (`ensureHelpButton` / `openFeedbackModal`) are the integration points; do not remove feedback.
