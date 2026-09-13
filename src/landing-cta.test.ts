import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderGuideArticleHtml, renderGuideIndexHtml, type GuideRecord } from './guides.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const landing = readFileSync(join(root, 'public/landing.html'), 'utf8');
const termos = readFileSync(join(root, 'public/termos.html'), 'utf8');
const privacidade = readFileSync(join(root, 'public/privacidade.html'), 'utf8');
const legalCss = readFileSync(join(root, 'public/legal.css'), 'utf8');

const sample: GuideRecord = {
  slug: 'como-prever-o-valor-de-adjudicacao',
  title: 'Como prever o valor de adjudicação num concurso público',
  description: 'Estimar o valor de fecho a partir do histórico público, para não âncorar a proposta no preço base.',
  lede: 'O valor adjudicado costuma ficar abaixo do preço base; estima-se com rácios de concursos comparáveis.',
  intent: 'comercial',
  markdown: '## Porque o preço base engana?\n\nÉ o teto, não o mercado.\n\n## Qual é o método?\n\nHistórico de 24 meses no mesmo CPV.',
  body_html: '<h2>Porque o preço base engana?</h2><p>É o teto, não o mercado.</p>',
  faq: [{ question: 'Isto substitui a proposta?', answer: 'Não. É uma estimativa estatística com dados públicos.' }],
  tags: ['preco', 'historico'],
  status: 'published',
  published_at: '2026-09-08T12:00:00.000Z',
  updated_at: '2026-09-08T12:00:00.000Z',
  author_agent: 'claude',
};

test('a SPA parseia: um } a mais em app.js impede Entrar e o registo', () => {
  execFileSync('node', ['--check', join(root, 'public/app.js')], { stdio: 'pipe' });
  execFileSync('node', ['--check', join(root, 'public/guide.js')], { stdio: 'pipe' });
});

test('landing, legais e SPA: SEO público vs app noindex', () => {
  assert.match(landing, /<html lang="pt-PT">/);
  assert.match(landing, /og:url" content="https:\/\/prepbid.com\/"/);
  assert.match(landing, /og:locale" content="pt_PT"/);
  assert.match(landing, /twitter:card" content="summary"/);
  assert.match(landing, /application\/ld\+json/);
  assert.match(landing, /FAQPage/);
  assert.match(landing, /SoftwareApplication/);
  assert.match(landing, /href="https:\/\/prepbid.com\/llms.txt"/);
  assert.match(termos, /rel="canonical" href="https:\/\/prepbid.com\/termos"/);
  assert.match(privacidade, /rel="canonical" href="https:\/\/prepbid.com\/privacidade"/);
  assert.match(termos, /<html lang="pt-PT">/);
  const index = readFileSync(join(root, 'public/index.html'), 'utf8');
  assert.match(index, /<html lang="pt-PT">/);
  assert.match(index, /name="robots" content="noindex, nofollow"/);
  for (const json of landing.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)) {
    JSON.parse(json[1]);
  }
});

test('CTAs da landing abrem a app e o teste grátis é uma ligação', () => {
  assert.equal([...landing.matchAll(/href="\/app#\//g)].length, 0);
  assert.match(landing, /class="enter"[^>]*href="\/app\/#\/login">Entrar/);
  assert.match(landing, /href="\/app\/#\/registo">Começar grátis/);
  assert.match(landing, /href="\/app\/#\/registo">Experimentar 7 dias grátis/);
  assert.match(
    landing,
    /<div class="pfine"><a href="\/app\/#\/registo">Experimente o Pro 7 dias grátis, sem cartão<\/a><\/div>/,
  );
  assert.match(landing, /id="land-nav-links"[\s\S]*href="\/app\/#\/login">Entrar/);
  assert.match(landing, /id="land-nav-links"[\s\S]*href="\/app\/#\/registo">Começar grátis/);
  assert.doesNotMatch(landing, /html,body\{[^}]*overflow-x:hidden/);
  assert.doesNotMatch(landing, /var sel = '[^']*\.hero-cta/);
  assert.doesNotMatch(landing, /M4\.5 12a7\.5/);
  assert.doesNotMatch(landing, /m9 14 2 2 4-4/);
  assert.match(landing, /class="pb-wordmark">PrepBid</);
  assert.match(landing, /class="brand-rule"/);
  assert.match(landing, /<span class="pb-lockup-tag">Contratos<br>públicos<\/span>/);
  assert.match(landing, /band band--paper/);
  assert.match(landing, /band band--surface/);
  assert.match(landing, /pb-wordmark pb-wordmark--reverse">PrepBid</);
  assert.match(landing, /band--ink/);
  assert.doesNotMatch(landing, /Prep<em>Bid<\/em>/);
  assert.doesNotMatch(landing, /family=Fraunces/);
  assert.match(landing, /Assistente para ganhar concursos/);
});

test('páginas legais e guias usam o mesmo destino /app/#/…', () => {
  assert.match(termos, /href="\/app\/#\/login">Entrar/);
  assert.match(privacidade, /href="\/app\/#\/login">Entrar/);
  assert.doesNotMatch(legalCss, /html,body\{[^}]*overflow-x:hidden/);

  const article = renderGuideArticleHtml('https://prepbid.example', sample);
  const index = renderGuideIndexHtml('https://prepbid.example', [sample]);
  assert.match(article, /href="\/app\/#\/registo"/);
  assert.match(index, /href="\/app\/#\/login"/);
  assert.match(index, /href="\/app\/#\/registo"/);
});

test('route() declara results antes de o usar — senão Hoje/Radar rebentam', () => {
  const appJs = readFileSync(join(root, 'public/app.js'), 'utf8');
  const decl = appJs.search(/const results = hash\.match\(\/\^#\\\/searches\\/);
  const use = appJs.indexOf('if (results) return await renderResults');
  assert.ok(decl >= 0, 'falta const results = hash.match(#/searches/…)');
  assert.ok(use > decl, 'if (results) aparece antes da declaração');
});

test('Carteira usa copy em português, não mesa de trabalho', () => {
  const appJs = readFileSync(join(root, 'public/app.js'), 'utf8');
  const catalog = readFileSync(join(root, 'public/help/catalog.js'), 'utf8');
  const index = readFileSync(join(root, 'public/index.html'), 'utf8');
  assert.doesNotMatch(appJs, /[Mm]esa de trabalho/);
  assert.doesNotMatch(catalog, /[Mm]esa de trabalho/);
  assert.match(appJs, /A carteira da empresa — arraste as cartas entre colunas/);
  assert.match(catalog, /A carteira da empresa\. Arraste as cartas entre Interessa/);
  assert.match(index, /catalog\.js\?v=6/);
  assert.match(index, /app\.js\?v=85/);
});

test('dossier de resposta descarrega .docx, não markdown HTML', () => {
  const appJs = readFileSync(join(root, 'public/app.js'), 'utf8');
  assert.match(appJs, /Descarregar \.docx/);
  assert.match(appJs, /response-template\.docx/);
  assert.match(appJs, /não ficou preso/);
  assert.doesNotMatch(appJs, /application\/msword/);
  assert.doesNotMatch(appJs, /dossier-resposta\.doc"/);
  assert.doesNotMatch(appJs, /t\.markdown/);
});

test('ficha IA mostra achados; a lista final só tem o que a empresa ainda faz fora da app', () => {
  const appJs = readFileSync(join(root, 'public/app.js'), 'utf8');
  assert.match(appJs, /O que a empresa ainda tem de fazer/);
  assert.match(appJs, /especificacoes_tecnicas/);
  assert.match(appJs, /janela_renovacao/);
  assert.match(appJs, /precos_referencia/);
  assert.doesNotMatch(appJs, /checklist de preparação precisa das peças/);
});

test('tokens.css em public/ é cópia de src/styles/tokens.css', () => {
  const src = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
  const pub = readFileSync(join(root, 'public/tokens.css'), 'utf8');
  assert.equal(pub, src);
  assert.match(src, /--pb-wordmark-size:\s*21px/);
});

test('wordmark da app e dos guias é texto PrepBid, sem SVG nem itálico', () => {
  const appJs = readFileSync(join(root, 'public/app.js'), 'utf8');
  const index = readFileSync(join(root, 'public/index.html'), 'utf8');
  const article = renderGuideArticleHtml('https://prepbid.example', sample);
  assert.match(appJs, /class="pb-wordmark">PrepBid</);
  assert.doesNotMatch(appJs, /MARK_SVG/);
  assert.match(index, /class="pb-wordmark">PrepBid</);
  assert.match(index, /class="brand-rule"/);
  assert.match(index, /pb-lockup-tag">Contratos<br>públicos/);
  assert.match(article, /class="pb-wordmark">PrepBid</);
  assert.doesNotMatch(article, /Prep<em>Bid<\/em>/);
  assert.doesNotMatch(article, /family=Fraunces/);
});

test('SPA não carrega MapLibre nem a checklist QA no arranque', () => {
  const index = readFileSync(join(root, 'public/index.html'), 'utf8');
  const appJs = readFileSync(join(root, 'public/app.js'), 'utf8');
  assert.doesNotMatch(index, /maplibre-gl\.(js|css)/);
  assert.doesNotMatch(index, /qa-checklist\.js/);
  assert.match(appJs, /function loadMapLibre\(/);
  assert.match(appJs, /qa-checklist\.js\?v=2/);
});

test('landing HTML não espera pelo INSERT de analytics', () => {
  const indexTs = readFileSync(join(root, 'src/index.ts'), 'utf8');
  const index = readFileSync(join(root, 'public/index.html'), 'utf8');
  assert.doesNotMatch(indexTs, /await ingestPublicPage/);
  assert.match(landing, /media="print" onload="this\.media='all'"/);
  assert.match(index, /media="print" onload="this\.media='all'"/);
  assert.match(landing, /tokens\.css\?v=3/);
});

test('cartão Business: o verde fica no ribbon, não no plano inteiro', () => {
  const hi = landing.match(/\.plan\.hi\{[^}]+\}/)?.[0] ?? '';
  const ribbon = landing.match(/\.plan \.ribbon\{[^}]+\}/)?.[0] ?? '';
  assert.match(hi, /border-color:var\(--brand\)/);
  assert.doesNotMatch(hi, /transform:translateX/);
  assert.doesNotMatch(hi, /background:var\(--brand\)/);
  assert.doesNotMatch(hi, /white-space:nowrap/);
  assert.match(ribbon, /transform:translateX\(-50%\)/);
  assert.match(ribbon, /background:var\(--brand\)/);
  assert.match(landing, /<div class="ribbon">PARA A EQUIPA<\/div>/);
  assert.match(
    landing,
    /<div class="plan hi">[\s\S]*?href="\/app\/#\/registo">Experimentar 7 dias grátis/,
  );
  assert.match(
    landing,
    /<div class="pfine"><a href="\/app\/#\/registo">Experimente o Business 7 dias grátis, sem cartão<\/a><\/div>/,
  );
  assert.match(landing, /\.plan \.ptag\{[^}]*min-height:4\.5em/);
  assert.match(landing, /\.plan ul\{[^}]*margin:auto 0 0/);
});

test('admin lista inscritos com nome e email', () => {
  const appJs = readFileSync(join(root, 'public/app.js'), 'utf8');
  const account = readFileSync(join(root, 'src/routes-account.ts'), 'utf8');
  assert.match(appJs, /Utilizadores inscritos/);
  assert.match(appJs, /api\('\/api\/admin\/users'/);
  assert.match(appJs, /function adminPersonMail/);
  assert.match(account, /app.get\('\/api\/admin\/users'/);
  assert.match(account, /u.first_name, u.last_name, u.is_admin/);
});
