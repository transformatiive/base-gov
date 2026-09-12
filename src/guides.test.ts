import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GUIDE_SEED,
  GUIDE_AGENT_SPEC,
  parseGuidePayload,
  parseGuideTags,
  markdownToHtml,
  publicSiteOrigin,
  robotsTxt,
  sitemapXml,
  renderGuideIndexHtml,
  renderGuideArticleHtml,
  resolveGuideAgent,
  formatGuidePublishedAt,
  inferGuideTags,
  guideRecordFromRow,
  PUBLIC_SITE_FALLBACK,
  type GuideRecord,
} from './guides.js';

test('parseGuidePayload exige slug, título, descrição, lead e markdown com H2', () => {
  const ok = parseGuidePayload('ajuste-direto-e-concurso-publico', {
    title: 'Ajuste direto e concurso público: a diferença na prática',
    description: 'Quando a entidade pode adjudicar sem concurso aberto e o que muda para quem quer apresentar proposta em Portugal.',
    lede: 'No concurso público qualquer interessado pode apresentar proposta. No ajuste direto a entidade convida um ou poucos operadores.',
    intent: 'informativa',
    markdown: '## O que distingue os dois?\n\nO tipo de procedimento no anúncio do DR.\n\n## O que muda na proposta?\n\nPeças, prazo e quem pode concorrer.',
    faq: [{ question: 'Posso concorrer a um ajuste direto sem convite?', answer: 'Não. Só o operador convidado apresenta proposta.' }],
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.slug, 'ajuste-direto-e-concurso-publico');
    assert.equal(ok.value.intent, 'informativa');
    assert.equal(ok.value.status, 'draft');
    assert.deepEqual(ok.value.tags, []);
  }
});

test('parseGuidePayload recusa slug inválido e javascript: em ligações', () => {
  const badSlug = parseGuidePayload('O que é', { title: 'Título suficientemente longo para passar', description: 'Descrição com mais de oitenta caracteres para a meta description de motores de busca e de LLMs.', lede: 'Resposta directa à pergunta do título com facto verificável.', intent: 'informativa', markdown: '## Uma pergunta?\n\nTexto.\n\n## Outra pergunta?\n\nTexto.' });
  assert.equal(badSlug.ok, false);

  const reserved = parseGuidePayload('o-que-e-o-base-gov', { title: 'Título suficientemente longo para passar', description: 'Descrição com mais de oitenta caracteres para a meta description de motores de busca e de LLMs.', lede: 'Resposta directa à pergunta do título com facto verificável.', intent: 'informativa', markdown: '## Uma pergunta?\n\nTexto.\n\n## Outra pergunta?\n\nTexto.' });
  assert.equal(reserved.ok, false);

  const badLink = parseGuidePayload('um-guia-valido', {
    title: 'Título suficientemente longo para passar',
    description: 'Descrição com mais de oitenta caracteres para a meta description de motores de busca e de LLMs.',
    lede: 'Resposta directa à pergunta do título com facto verificável.',
    intent: 'comercial',
    markdown: '## Uma pergunta?\n\n[x](javascript:alert(1))\n\n## Outra pergunta?\n\nOk.',
  });
  assert.equal(badLink.ok, false);
});

test('markdownToHtml converte subtítulos, listas e negrito e escapa HTML cru', () => {
  const html = markdownToHtml('## Qual é a diferença?\n\nÉ **isto**.\n\n- um\n- dois\n\n<script>alert(1)</script>');
  assert.match(html, /<h2>Qual é a diferença\?<\/h2>/);
  assert.match(html, /<strong>isto<\/strong>/);
  assert.match(html, /<li>um<\/li>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('markdownToHtml só aceita ligações http(s) ou caminhos do site', () => {
  const html = markdownToHtml('## A?\n\n[ok](https://base.gov.pt/x) e [in](/guias/y) e [no](javascript:alert(1))\n\n## B?\n\nFim.');
  assert.match(html, /href="https:\/\/base\.gov\.pt\/x"/);
  assert.match(html, /href="\/guias\/y"/);
  assert.doesNotMatch(html, /javascript:/);
});

test('robots.txt e sitemap.xml: só guias publicados, sem \/app', () => {
  const origin = publicSiteOrigin('https://baseradar.example/');
  assert.equal(origin, 'https://baseradar.example');
  assert.equal(publicSiteOrigin(''), PUBLIC_SITE_FALLBACK);
  const robots = robotsTxt(origin);
  assert.match(robots, /Disallow: \/app/);
  assert.match(robots, /Sitemap: https:\/\/baseradar\.example\/sitemap\.xml/);
  const xml = sitemapXml(origin, [
    { slug: 'ajuste-direto-e-concurso-publico', updated_at: '2026-09-08T12:00:00.000Z' },
  ]);
  assert.match(xml, /<loc>https:\/\/baseradar\.example\/guias<\/loc>/);
  assert.match(xml, /<loc>https:\/\/baseradar\.example\/guias\/ajuste-direto-e-concurso-publico<\/loc>/);
  assert.doesNotMatch(xml, /o-que-e-o-base-gov/);
  assert.doesNotMatch(xml, /\/app</);
});

test('o seed inicial não inclui o artigo do BASE.gov', () => {
  assert.equal(GUIDE_SEED.some((g) => g.slug.includes('base-gov')), false);
  assert.ok(GUIDE_SEED.length >= 3);
});

test('resolveGuideAgent aceita claude, grok e grok-bot', () => {
  assert.equal(resolveGuideAgent('Claude', undefined), 'claude');
  assert.equal(resolveGuideAgent('grok-bot', undefined), 'grok-bot');
  assert.equal(resolveGuideAgent(undefined, 'grok'), 'grok');
  assert.equal(resolveGuideAgent(undefined, undefined), 'human');
  assert.equal(resolveGuideAgent('chatgpt', undefined), null);
});

const sample: GuideRecord = {
  slug: 'como-prever-o-valor-de-adjudicacao',
  title: 'Como prever o valor de adjudicação de um concurso público',
  description: 'O preço base raramente é o valor adjudicado. Intervalo a partir do histórico do mesmo CPV no Portal BASE.',
  lede: 'O valor adjudicado costuma ficar abaixo do preço base; estima-se com rácios de concursos comparáveis.',
  intent: 'comercial',
  markdown: '## Porque o preço base engana?\n\nÉ o teto, não o mercado.\n\n## Qual é o método?\n\nHistórico de 24 meses no mesmo CPV.',
  body_html: '<h2>Porque o preço base engana?</h2><p>É o teto, não o mercado.</p>',
  faq: [{ question: 'Isto substitui a proposta?', answer: 'Não. É uma estimativa estatística com dados públicos.' }],
  tags: ['ccp'],
  status: 'published',
  published_at: '2026-09-08T12:00:00.000Z',
  updated_at: '2026-09-08T12:00:00.000Z',
  author_agent: 'claude',
};

test('HTML público responde na primeira frase e inclui JSON-LD FAQ', () => {
  const page = renderGuideArticleHtml('https://baseradar.example', sample);
  assert.match(page, /<link rel="canonical" href="https:\/\/baseradar\.example\/guias\/como-prever-o-valor-de-adjudicacao">/);
  assert.match(page, /application\/ld\+json/);
  assert.match(page, /FAQPage/);
  assert.match(page, /datePublished":"2026-09-08T12:00:00.000Z"/);
  assert.match(page, /<time datetime="2026-09-08">Publicado em 8 de setembro de 2026<\/time>/);
  assert.match(page, /<span class="guide-tag">ccp<\/span>/);
  assert.match(page, /O valor adjudicado costuma ficar abaixo/);
  assert.match(page, /Começar grátis/);
  assert.match(page, /href="\/app\/#\/registo"/);
  assert.doesNotMatch(page, /<script src=/);
});

test('índice agrupa por intenção e omite rascunhos', () => {
  const html = renderGuideIndexHtml('https://baseradar.example', [
    sample,
    { ...sample, slug: 'rascunho', status: 'draft', title: 'Rascunho invisível' },
  ]);
  assert.match(html, /como-prever-o-valor-de-adjudicacao/);
  assert.doesNotMatch(html, /rascunho/);
  assert.match(html, /Ferramenta/);
  assert.match(html, /<time datetime="2026-09-08">Publicado em 8 de setembro de 2026<\/time>/);
  assert.match(html, /<span class="guide-tag">ccp<\/span>/);
});

test('cada artigo do seed passa a validação SEO e não aponta para o BASE.gov', () => {
  for (const seed of GUIDE_SEED) {
    const parsed = parseGuidePayload(seed.slug, seed);
    assert.equal(parsed.ok, true, parsed.ok ? seed.slug : parsed.error);
    if (parsed.ok) {
      assert.ok(parsed.value.tags.length >= 1, seed.slug);
      assert.ok(parsed.value.tags.length <= 5);
    }
    assert.doesNotMatch(seed.markdown, /o-que-e-o-base-gov/);
    assert.ok(countH2ForTest(seed.markdown) >= 2);
  }
});

function countH2ForTest(markdown: string): number {
  return markdown.split('\n').filter((line) => /^## /.test(line)).length;
}

test('parseGuideTags aceita 0–5 kebab-case e recusa inválidas', () => {
  assert.deepEqual(parseGuideTags(undefined), { ok: true, value: [] });
  assert.deepEqual(parseGuideTags(null), { ok: true, value: [] });
  assert.deepEqual(parseGuideTags(['ccp', 'Empreitadas', 'ccp']), { ok: true, value: ['ccp', 'empreitadas'] });
  const tooMany = parseGuideTags(['a', 'b', 'c', 'd', 'e', 'f']);
  assert.equal(tooMany.ok, false);
  const bad = parseGuideTags(['CCP_OBRAS']);
  assert.equal(bad.ok, false);
  const notList = parseGuideTags('ccp');
  assert.equal(notList.ok, false);
  const ok = parseGuidePayload('guia-com-tags-validas', {
    title: 'Título suficientemente longo para passar',
    description: 'Descrição com mais de oitenta caracteres para a meta description de motores de busca e de LLMs.',
    lede: 'Resposta directa à pergunta do título com facto verificável.',
    intent: 'informativa',
    markdown: '## Uma pergunta?\n\nTexto.\n\n## Outra pergunta?\n\nTexto.',
    tags: ['habilitacao', 'pme'],
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.value.tags, ['habilitacao', 'pme']);
});

test('formatGuidePublishedAt usa pt-PT e não inventa data se published_at for null', () => {
  assert.equal(formatGuidePublishedAt('2026-09-08T12:00:00.000Z'), 'Publicado em 8 de setembro de 2026');
  assert.equal(formatGuidePublishedAt(null), null);
  const draftPage = renderGuideArticleHtml('https://baseradar.example', {
    ...sample,
    published_at: null,
    tags: [],
  });
  assert.doesNotMatch(draftPage, /Publicado em/);
  assert.doesNotMatch(draftPage, /<time /);
  assert.doesNotMatch(draftPage, /datePublished/);
  assert.doesNotMatch(draftPage, /guide-tag/);
});

test('GUIDE_AGENT_SPEC enquadra filtragem no PrepBid e documenta tags', () => {
  assert.equal(GUIDE_AGENT_SPEC.constraints.filterInPrepBid, true);
  assert.equal(GUIDE_AGENT_SPEC.constraints.baseGovIsDataSourceOnly, true);
  assert.match(GUIDE_AGENT_SPEC.constraints.productFraming, /PrepBid/);
  assert.match(GUIDE_AGENT_SPEC.constraints.productFraming, /filtre no BASE/);
  assert.match(GUIDE_AGENT_SPEC.payload.tags, /0–5/);
  assert.match(GUIDE_AGENT_SPEC.payload.published_at, /Não enviar/);
});

test('inferGuideTags lê o tema a partir do slug e do título', () => {
  assert.deepEqual(inferGuideTags('ajuste-direto-e-concurso-publico'), ['ccp']);
  assert.ok(inferGuideTags('como-habilitar-pme-saude', 'Habilitação de PME na saúde').includes('habilitacao'));
  assert.ok(inferGuideTags('obras-energia', 'Empreitadas de energia').includes('empreitadas'));
  assert.ok(inferGuideTags('obras-energia', 'Empreitadas de energia').includes('energia'));
});

test('guideRecordFromRow devolve tags e published_at da linha', () => {
  const rec = guideRecordFromRow({
    slug: 'guia-tags',
    title: 'Título da linha',
    description: 'Descrição',
    lede: 'Lede',
    intent: 'comercial',
    markdown: '## A?\n\n## B?',
    body_html: '<p>x</p>',
    faq: [],
    tags: ['saude', 'SAUDE', 'nope_bad', 'energia'],
    status: 'published',
    published_at: new Date('2026-01-15T00:00:00.000Z'),
    updated_at: new Date('2026-01-16T00:00:00.000Z'),
    author_agent: 'grok',
  });
  assert.deepEqual(rec.tags, ['saude', 'energia']);
  assert.equal(rec.published_at, '2026-01-15T00:00:00.000Z');
});
