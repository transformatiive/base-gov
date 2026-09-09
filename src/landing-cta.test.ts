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
  status: 'published',
  published_at: '2026-09-08T12:00:00.000Z',
  updated_at: '2026-09-08T12:00:00.000Z',
  author_agent: 'claude',
};

test('a SPA parseia: um } a mais em app.js impede Entrar e o registo', () => {
  execFileSync('node', ['--check', join(root, 'public/app.js')], { stdio: 'pipe' });
  execFileSync('node', ['--check', join(root, 'public/guide.js')], { stdio: 'pipe' });
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
  assert.match(landing, /m9 14 2 2 4-4/);
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
