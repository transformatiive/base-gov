/** Guias públicos (SEO / LLMs) persistidos em Postgres. Não é o manual autenticado em /app. */

export const PUBLIC_SITE_FALLBACK = 'https://prepbid.com';

export type GuideIntent = 'informativa' | 'comercial';
export type GuideStatus = 'draft' | 'published';
export type GuideAgent = 'claude' | 'grok' | 'grok-bot' | 'human';

export interface GuideFaq {
  question: string;
  answer: string;
}

export interface GuidePayload {
  slug: string;
  title: string;
  description: string;
  lede: string;
  intent: GuideIntent;
  markdown: string;
  faq: GuideFaq[];
  status: GuideStatus;
}

export interface GuideRecord extends GuidePayload {
  body_html: string;
  published_at: string | null;
  updated_at: string;
  author_agent: GuideAgent;
  created_at?: string;
}

export type ParseGuideResult =
  | { ok: true; value: GuidePayload }
  | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AGENTS: GuideAgent[] = ['claude', 'grok', 'grok-bot', 'human'];

export interface GuideSeed {
  slug: string;
  title: string;
  description: string;
  lede: string;
  intent: GuideIntent;
  markdown: string;
  faq: GuideFaq[];
}

export const GUIDE_SEED: GuideSeed[] = [
  {
    slug: 'ajuste-direto-e-concurso-publico',
    title: 'Ajuste direto e concurso público: a diferença na prática',
    description:
      'Quando a entidade pode adjudicar sem concurso aberto e o que muda para quem quer apresentar proposta em Portugal: concurso público, consulta prévia e ajuste direto.',
    lede:
      'No concurso público qualquer interessado pode apresentar proposta. No ajuste direto a entidade convida um ou poucos operadores.',
    intent: 'informativa',
    markdown: `## O que distingue os dois?

O tipo de procedimento no anúncio do Diário da República e no Portal BASE determina se a sua empresa sequer pode concorrer. No **concurso público** (e equivalentes abertos) qualquer operador que cumpra o programa apresenta proposta. No **ajuste direto** a entidade escolhe um operador, sem abertura geral. Entre os dois existe a **consulta prévia**: convite a vários operadores, ainda sem anúncio aberto a todos.

## Porque a entidade escolhe um tipo e não outro?

O Código dos Contratos Públicos fixa limiares de valor e regras de fundamentação. De forma simplificada, usada no dia a dia das mesas:

- **Concurso público:** qualquer operador que cumpra os requisitos. O anúncio é o convite; há prazo, peças e critérios publicados.
- **Consulta prévia:** só os convidados (em regra, pelo menos três). Se não foi convidado, não concorre a este procedimento.
- **Ajuste direto:** o operador escolhido pela entidade. Não há fase pública de propostas; o contrato aparece depois no BASE, com valor e fundamentação.

Há exceções (urgência, exclusividade técnica, contratos de muito baixo valor, acordos-quadro). O campo «fundamentação» no contrato do BASE é o sítio onde a entidade justifica o ajuste direto — vale a pena lê-lo quando está a estudar um comprador.

## O que muda na proposta?

- **Concurso público:** programa do concurso e caderno de encargos. Habilitação, caução, critérios (preço só, ou preço e qualidade) e prazo estão nas peças. Uma falha formal (DEUCP, declaração de honra, formato do ficheiro) exclui mesmo com bom preço.
- **Consulta prévia / ajuste direto:** o convite substitui o anúncio aberto. Os documentos pedem-se na mesma; o calendário é mais curto e a relação com a entidade pesa mais.

Os **acordos-quadro** são um caso à parte: o concurso inicial é aberto (ou restrito), e depois as segundas fases correm entre os aderentes. Ignorá-los é perder um canal de contratação centralizada.

## Como usar o histórico para não chegar tarde?

Se uma câmara faz ajuste direto repetido no mesmo CPV, o próximo procedimento aberto — quando o valor ou a regra o obrigar — vai provavelmente ao mesmo objeto. Um radar de renovações não adivinha o tipo de procedimento futuro; estima **quando** o contrato em curso acaba, para contactar a entidade **antes** de o anúncio sair.

Os limiares legais mudam. Confirme o CCP em vigor e o anúncio concreto. Isto explica a lógica; não substitui o jurista da proposta.`,
    faq: [
      {
        question: 'Posso concorrer a um ajuste direto sem convite?',
        answer: 'Não. Só o operador convidado apresenta proposta. O contrato aparece depois no Portal BASE, já adjudicado.',
      },
      {
        question: 'Qual é a diferença entre consulta prévia e concurso público?',
        answer:
          'No concurso público qualquer interessado que cumpra o programa pode propor. Na consulta prévia só os operadores convidados (em regra três ou mais) apresentam proposta.',
      },
      {
        question: 'Onde vejo o tipo de procedimento?',
        answer: 'No anúncio do Diário da República e na ficha do procedimento no Portal BASE. É esse campo que diz se ainda está a tempo de concorrer.',
      },
    ],
  },
  {
    slug: 'como-saber-quais-concursos-sao-relevantes',
    title: 'Como saber quais concursos públicos são relevantes para a sua empresa',
    description:
      'Filtrar o ruído do Portal BASE com CPV, distritos, valor e o histórico de contratos que se repetem — em vez de abrir o portal todas as manhãs.',
    lede:
      'Um concurso é relevante quando coincide com o que faz, onde executa, o valor em que consegue habilitar-se — e quando ainda há prazo.',
    intent: 'comercial',
    markdown: `## Porque as palavras no título não bastam?

Palavras como «obras» ou «serviços» misturam objectos diferentes. O **CPV**, o **distrito**, o **preço base** e o **histórico da entidade** filtram melhor do que texto livre. Isto aplica-se a empreitadas, energia e saúde — os objectos em que o PrepBid se foca — não a um dump nacional de limpezas e papelaria.

## Como começar pelo CPV?

O Vocabulário Comum para Contratos Públicos (CPV) é o código de oito dígitos do objeto. Uma reabilitação de cobertura e um fornecimento de lâmpadas podem ter títulos parecidos e CPV diferentes.

- Guarde os códigos em que já foi adjudicatário (estão nos contratos do BASE, no seu NIF).
- Acrescente a divisão (2 dígitos) e a classe (4 dígitos) da atividade principal — muita entidade classifica mal o código de 8 dígitos.
- Não use só a palavra «construção»: empreitadas de especialidades, reabilitação municipal e espaços verdes misturam-se no texto e não na sua carteira.

## Como cortar geografia e valor antes de ler o caderno?

Uma construtora de classe média no Centro não precisa da lista nacional completa. Distritos onde tem alvará e logística, mais um intervalo de valor alinhado com a classe do alvará, eliminam a maior parte do ruído **antes** de gastar tempo a ler peças. No PrepBid isto fica no perfil (distritos, valor mínimo/máximo, termos e entidades a excluir) e aplica-se às listas sem esperar por uma análise de IA.

## Porque olhar para o que se repete, não só para o que abriu hoje?

Grande parte do negócio público é o mesmo objeto, a mesma entidade, daqui a um, dois ou três anos. O contrato em curso tem data de assinatura e prazo de execução no BASE; a janela de contacto útil é cerca de quatro meses antes do fim estimado. Quando o anúncio sai no DR, o incumbente já está a trabalhar a proposta.

## Quando a habilitação mata o concurso?

Alvará (classe e categorias), ISO, certidões, volume de negócios mínimo: se o caderno pede classe 4 e a empresa tem classe 2, o concurso deixou de ser relevante, por muito que o CPV bata certo. Filtrar não substitui ler as peças. Um CPV certo com um critério de adjudicação que a empresa não consegue evidenciar continua a ser um não.

O ecrã útil é «o que agir esta semana» — prazo a menos de 30 dias, e as linhas da carteira já em preparação. Conta grátis, sem cartão e sem reunião comercial. O teste Pro de 7 dias activa-se nos planos.`,
    faq: [
      {
        question: 'Como filtrar concursos públicos relevantes em Portugal?',
        answer:
          'Comece pelo CPV da atividade, corte distritos e intervalo de valor alinhados com o alvará, e cruze com o histórico da entidade. Palavras no título não bastam.',
      },
      {
        question: 'O Portal BASE já faz este filtro?',
        answer:
          'Não. O portal lista o que foi publicado. Não cruza o seu alvará, a geografia da empresa nem os contratos que se repetem daqui a um ou dois anos.',
      },
      {
        question: 'Quando um concurso deixa de ser relevante?',
        answer:
          'Quando o prazo já passou, quando a habilitação (classe de alvará, ISO, volume de negócios) não chega, ou quando o valor está fora do que a empresa consegue executar.',
      },
    ],
  },
  {
    slug: 'como-prever-o-valor-de-adjudicacao',
    title: 'Como prever o valor de adjudicação de um concurso público',
    description:
      'O preço base raramente é o valor adjudicado. Intervalo a partir do histórico do mesmo CPV no Portal BASE, sem fingir uma percentagem de confiança de modelo.',
    lede:
      'O valor adjudicado costuma ficar abaixo do preço base; estima-se com rácios de concursos comparáveis.',
    intent: 'comercial',
    markdown: `## Porque o preço base engana?

O preço base é o teto do procedimento, não o preço de mercado. Em empreitadas e fornecimentos com concorrência real, o desconto de 10–30 % é comum; em procedimentos pouco concorridos ou com especificações fechadas, o adjudicado cola-se ao base. Sem o histórico daquele CPV e daquela entidade, qualquer número é palpite.

## Qual é o método?

A forma honesta de estimar o fecho é olhar para concursos comparáveis já publicados no Portal BASE — mesmo CPV, de preferência a mesma entidade — e ver o rácio entre o preço adjudicado e o preço base da altura.

1. Recolhe contratos comparáveis dos últimos 24 meses no mesmo CPV, alargando 8→4→2 dígitos só se a amostra for curta.
2. Prefere o rácio *adjudicado / preço base histórico* quando o anúncio original ainda está no corpus; senão, escala o adjudicado contra o preço base atual, deitando fora rácios absurdos (fora de cerca de 0,2–1,15).
3. Se existirem pelo menos 5 contratos da mesma entidade, usa essa subamostra; caso contrário, usa o CPV.
4. Com menos de 5 pontos, **não mostra intervalo** — mostra a nota de amostra insuficiente.
5. A confiança apresentada é alta / média / baixa em função do tamanho da amostra e da dispersão, não um score de um modelo treinado.

O PrepBid não apresenta uma «percentagem de confiança» de machine learning.

## O que isto não é?

- Não é o preço a escrever na proposta. Critérios de qualidade, erros de CPV e procedimentos sem histórico válido partem o padrão.
- Não substitui a memória descritiva nem o mapa de quantidades.
- Não usa dados privados de outras empresas: só o que o BASE já tornou público.

## Como usar o intervalo na decisão go / no-go?

Se o intervalo histórico fecha 18–24 % abaixo do base e a sua estrutura de custos só aguenta 8 %, o concurso pode ser «relevante» em CPV e mesmo assim um não comercial. É o mesmo raciocínio da habilitação: filtrar cedo, antes de gastar a semana no caderno.

Estimativa estatística com dados públicos. Confirme sempre as peças e a sua própria conta de custos. Não é aconselhamento financeiro nem jurídico.`,
    faq: [
      {
        question: 'Isto substitui a proposta?',
        answer: 'Não. É uma estimativa estatística com dados públicos.',
      },
      {
        question: 'Porque o preço base do concurso não chega?',
        answer:
          'O preço base é o teto do procedimento. O valor adjudicado costuma ficar abaixo; o intervalo lê-se no histórico do mesmo CPV, de preferência da mesma entidade.',
      },
      {
        question: 'Quando é que não há previsão?',
        answer:
          'Quando há menos de cinco contratos comparáveis depois de alargar o CPV. Nesse caso não se inventa um intervalo.',
      },
    ],
  },
];

export const GUIDE_AGENT_SPEC = {
  name: 'PrepBid guias',
  purpose:
    'Publicar e actualizar guias públicos em português (pt-PT) sobre contratação pública. Não é um blog. Copy para motores de busca e para LLMs: resposta na primeira frase, H2 em forma de pergunta, FAQ factual.',
  language: 'pt-PT',
  auth: {
    header: 'X-API-Key',
    agentHeader: 'X-Agent',
    agents: ['claude', 'grok', 'grok-bot'] as const,
    note: 'A chave de API (APP_API_KEY) autentica o agente como administrador. Sessão admin no browser também serve.',
  },
  endpoints: {
    spec: { method: 'GET', path: '/api/agent/guides/spec' },
    list: { method: 'GET', path: '/api/agent/guides' },
    get: { method: 'GET', path: '/api/agent/guides/:slug' },
    upsert: { method: 'PUT', path: '/api/agent/guides/:slug', statusDefault: 'draft' },
    publish: { method: 'POST', path: '/api/agent/guides/:slug/publish' },
    unpublish: { method: 'POST', path: '/api/agent/guides/:slug/unpublish' },
    remove: { method: 'DELETE', path: '/api/agent/guides/:slug' },
  },
  payload: {
    title: 'string, ≥12 caracteres',
    description: 'meta description, ≥80 caracteres',
    lede: 'primeira resposta, um parágrafo factual',
    intent: 'informativa | comercial',
    markdown: 'corpo com ≥2 headings ## em forma de pergunta; ligações só https:// ou /caminho',
    faq: '[{ question, answer }, ...] — usado em JSON-LD FAQPage',
    status: 'draft | published (omissão = draft)',
    agent: 'claude | grok | grok-bot (alternativa ao header X-Agent)',
  },
  seo: {
    answerFirst: true,
    h2AsQuestions: true,
    minH2: 2,
    descriptionMinChars: 80,
    faqJsonLd: true,
    canonical: '/guias/:slug',
    sitemap: '/sitemap.xml',
    robots: '/robots.txt',
    llms: '/llms.txt',
  },
  constraints: {
    noLegalAdvice: true,
    noBaseGovExplainerArticle: true,
    icp: ['obras', 'energia', 'saúde'],
    cta: 'Começar grátis',
    trialDays: 7,
    noCard: true,
    noSalesMeeting: true,
    publicOriginFallback: PUBLIC_SITE_FALLBACK,
  },
} as const;

export function publicSiteOrigin(appBaseUrl: string): string {
  const trimmed = appBaseUrl.replace(/\/$/, '');
  return trimmed || PUBLIC_SITE_FALLBACK;
}

export function robotsTxt(origin: string): string {
  const sitemap = `${origin.replace(/\/$/, '')}/sitemap.xml`;
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /app',
    'Disallow: /api',
    '',
    `Sitemap: ${sitemap}`,
    '',
  ].join('\n');
}

export function sitemapXml(
  origin: string,
  published: { slug: string; updated_at: string }[],
): string {
  const base = origin.replace(/\/$/, '');
  const latest = published.reduce((acc, g) => (g.updated_at > acc ? g.updated_at : acc), '');
  const fallbackDay = (latest || new Date().toISOString()).slice(0, 10);
  const urls: { loc: string; lastmod: string; priority: string }[] = [
    { loc: `${base}/`, lastmod: fallbackDay, priority: '1.0' },
    { loc: `${base}/guias`, lastmod: fallbackDay, priority: '0.8' },
    ...published.map((g) => ({
      loc: `${base}/guias/${g.slug}`,
      lastmod: g.updated_at.slice(0, 10),
      priority: '0.7',
    })),
    { loc: `${base}/termos`, lastmod: fallbackDay, priority: '0.3' },
    { loc: `${base}/privacidade`, lastmod: fallbackDay, priority: '0.3' },
  ];
  const body = urls
    .map(
      (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(u.lastmod)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function llmsTxt(
  origin: string,
  published: { slug: string; title: string; description: string }[],
): string {
  const base = origin.replace(/\/$/, '');
  const lines = [
    '# PrepBid',
    '',
    '> Assistente para ganhar concursos públicos em obras, energia e saúde em Portugal. Conta grátis, sem cartão e sem reunião comercial.',
    '',
    `Site: ${base}/`,
    `Guias: ${base}/guias`,
    '',
    '## Guias',
    '',
  ];
  for (const g of published) {
    lines.push(`- [${g.title}](${base}/guias/${g.slug}): ${g.description}`);
  }
  if (published.length === 0) {
    lines.push('_Ainda não há guias publicados._');
  }
  lines.push('', '## Notas para modelos', '');
  lines.push('- Idioma: português de Portugal (pt-PT).');
  lines.push('- Os guias não são aconselhamento jurídico. Confirme o CCP e as peças do procedimento.');
  lines.push('- Preços públicos: Grátis 0 € · Pro 29 €/mês · Business 99 €/mês (sem IVA). Teste Pro de 7 dias, sem cartão.');
  lines.push('');
  return lines.join('\n');
}

export function resolveGuideAgent(header: string | undefined, bodyAgent: string | undefined): GuideAgent | null {
  const raw = (header ?? bodyAgent ?? '').trim().toLowerCase();
  if (!raw) return 'human';
  const match = AGENTS.find((a) => a === raw);
  return match ?? null;
}

export function parseGuidePayload(slug: string, body: unknown): ParseGuideResult {
  if (!SLUG_RE.test(slug) || slug === 'o-que-e-o-base-gov') {
    return { ok: false, error: 'Slug inválido. Use kebab-case (ex.: ajuste-direto-e-concurso-publico).' };
  }
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Corpo JSON inválido.' };
  }
  const b = body as Record<string, unknown>;
  const title = asTrimmedString(b.title);
  const description = asTrimmedString(b.description);
  const lede = asTrimmedString(b.lede);
  const markdown = typeof b.markdown === 'string' ? b.markdown : '';
  const intent = parseIntent(b.intent);
  if (!title || title.length < 12) {
    return { ok: false, error: 'Título obrigatório (≥12 caracteres).' };
  }
  if (!description || description.length < 80) {
    return { ok: false, error: 'Descrição (meta) obrigatória (≥80 caracteres).' };
  }
  if (!lede || lede.length < 20) {
    return { ok: false, error: 'Lede obrigatório: a primeira resposta, em frase completa.' };
  }
  if (!intent) {
    return { ok: false, error: 'intent deve ser informativa ou comercial.' };
  }
  if (!markdown.trim()) {
    return { ok: false, error: 'markdown obrigatório.' };
  }
  if (countH2(markdown) < 2) {
    return { ok: false, error: 'O markdown precisa de pelo menos dois headings ## (perguntas).' };
  }
  if (hasDisallowedLink(markdown)) {
    return { ok: false, error: 'Ligações só podem ser https:// ou caminhos internos (/…). javascript: recusado.' };
  }
  const faq = parseFaq(b.faq);
  if (faq === null) {
    return { ok: false, error: 'faq deve ser uma lista de { question, answer }.' };
  }
  let status: GuideStatus = 'draft';
  if (b.status !== undefined && b.status !== null && b.status !== '') {
    const parsed = parseStatus(b.status);
    if (!parsed) return { ok: false, error: 'status deve ser draft ou published.' };
    status = parsed;
  }
  return {
    ok: true,
    value: { slug, title, description, lede, intent, markdown, faq, status },
  };
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      i += 1;
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(`<li>${inlineMarkdown(lines[i].slice(2))}</li>`);
        i += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\.\s/, ''))}</li>`);
        i += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('## ') &&
      !lines[i].startsWith('### ') &&
      !lines[i].startsWith('- ') &&
      !lines[i].startsWith('* ') &&
      !/^\d+\.\s/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(`<p>${inlineMarkdown(para.join(' '))}</p>`);
  }
  return blocks.join('');
}

export function intentLabel(intent: GuideIntent): string {
  switch (intent) {
    case 'informativa':
      return 'Informação';
    case 'comercial':
      return 'Ferramenta';
    default: {
      const _never: never = intent;
      return _never;
    }
  }
}

export function renderGuideIndexHtml(origin: string, guides: GuideRecord[]): string {
  const base = origin.replace(/\/$/, '');
  const published = guides.filter((g) => g.status === 'published');
  const informativa = published.filter((g) => g.intent === 'informativa');
  const comercial = published.filter((g) => g.intent === 'comercial');
  const sections = [
    { intent: 'informativa' as const, items: informativa },
    { intent: 'comercial' as const, items: comercial },
  ]
    .filter((s) => s.items.length > 0)
    .map((s) => {
      const heading = intentLabel(s.intent);
      return `    <h2 style="border:0;padding:0;margin-top:8px">${escapeHtml(heading)}</h2>
    <div class="guide-grid">
${s.items.map(guideCard).join('\n')}
    </div>`;
    })
    .join('\n');
  const empty = published.length === 0
    ? '    <p class="updated">Ainda não há guias publicados.</p>'
    : '';
  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Guias de concursos públicos — PrepBid</title>
  <meta name="description" content="Respostas práticas sobre tipos de procedimento, filtrar concursos relevantes e estimar o valor de adjudicação. Sem reunião comercial.">
  <link rel="canonical" href="${escapeHtml(base)}/guias">
  <meta property="og:title" content="Guias de concursos públicos — PrepBid">
  <meta property="og:description" content="Respostas práticas sobre tipos de procedimento e como filtrar concursos relevantes para a sua empresa.">
  <meta property="og:type" content="website">
  ${headChrome()}
</head>
<body>
  ${navHtml('index')}
  <div class="legal-wrap">
    <div class="eyebrow">Guias</div>
    <h1>Concursos públicos, em respostas concretas</h1>
    <p class="updated">Não é um blog. São guias curtos para quem pesquisa como concorrer, quais concursos são relevantes, ou como estimar o valor de adjudicação.</p>
${sections}
${empty}
    <div class="guide-cta">
      <h2>Ver os concursos da sua área, hoje</h2>
      <p>Conta grátis, sem cartão e sem reunião comercial. O teste Pro de 7 dias activa-se depois, nos planos.</p>
      <a class="btn" href="/app/#/registo">Começar grátis</a>
      <span class="fine">Preços públicos: Grátis 0 € · Pro 29 €/mês · Business 99 €/mês (sem IVA).</span>
    </div>
  </div>
  ${footHtml()}
</body>
</html>
`;
}

export function renderGuideArticleHtml(origin: string, guide: GuideRecord): string {
  const base = origin.replace(/\/$/, '');
  const url = `${base}/guias/${guide.slug}`;
  const eyebrow = `Guias · ${intentLabel(guide.intent).toLowerCase()}`;
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    inLanguage: 'pt-PT',
    datePublished: guide.published_at,
    dateModified: guide.updated_at,
    author: { '@type': 'Organization', name: 'Transformatiive, Lda.' },
    publisher: { '@type': 'Organization', name: 'Transformatiive, Lda.' },
    mainEntityOfPage: url,
  };
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guide.faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
  const faqHtml = guide.faq.length
    ? `    <h2>Perguntas frequentes</h2>
    <dl class="guide-faq">
${guide.faq
  .map(
    (f) => `      <dt>${escapeHtml(f.question)}</dt>
      <dd>${escapeHtml(f.answer)}</dd>`,
  )
  .join('\n')}
    </dl>`
    : '';
  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(guide.title)} — PrepBid</title>
  <meta name="description" content="${escapeHtml(guide.description)}">
  <link rel="canonical" href="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(guide.title)}">
  <meta property="og:description" content="${escapeHtml(guide.description)}">
  <meta property="og:type" content="article">
  ${headChrome()}
  <script type="application/ld+json">${safeJsonLd(articleLd)}</script>
  <script type="application/ld+json">${safeJsonLd(faqLd)}</script>
</head>
<body>
  ${navHtml('article')}
  <div class="legal-wrap">
    <div class="eyebrow">${escapeHtml(eyebrow)}</div>
    <h1>${escapeHtml(guide.title)}</h1>
    <p class="updated">Não é aconselhamento jurídico. Confirme o CCP em vigor e as peças do procedimento concreto.</p>
    <p><strong>${escapeHtml(guide.lede)}</strong></p>
    ${guide.body_html}
${faqHtml}
    <div class="guide-cta">
      <h2>Ver os concursos da sua área</h2>
      <p>Conta grátis, sem cartão e sem reunião comercial. O teste Pro de 7 dias activa-se nos planos.</p>
      <a class="btn" href="/app/#/registo">Começar grátis</a>
      <span class="fine">Pro 29 €/mês · 7 dias de teste sem cartão.</span>
    </div>
    <p><a href="/guias">← Todos os guias</a></p>
  </div>
  ${footHtml()}
</body>
</html>
`;
}

export function guideRecordFromRow(row: Record<string, unknown>): GuideRecord {
  const intent = parseIntent(row.intent) ?? 'informativa';
  const status = parseStatus(row.status) ?? 'draft';
  const agent = resolveGuideAgent(undefined, asTrimmedString(row.author_agent) ?? undefined) ?? 'human';
  return {
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description),
    lede: String(row.lede),
    intent,
    markdown: String(row.markdown ?? ''),
    body_html: String(row.body_html ?? ''),
    faq: parseFaq(row.faq) ?? [],
    status,
    published_at: toIso(row.published_at),
    updated_at: toIso(row.updated_at) ?? new Date().toISOString(),
    author_agent: agent,
    created_at: toIso(row.created_at) ?? undefined,
  };
}

function countH2(markdown: string): number {
  return markdown.split('\n').filter((line) => /^## /.test(line)).length;
}

function hasDisallowedLink(markdown: string): boolean {
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    if (!isAllowedHref(m[1].trim())) return true;
  }
  return /javascript:/i.test(markdown);
}

function isAllowedHref(href: string): boolean {
  if (/^https?:\/\//i.test(href)) return true;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  return false;
}

function asTrimmedString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function parseIntent(v: unknown): GuideIntent | null {
  if (v === 'informativa' || v === 'comercial') return v;
  return null;
}

function parseStatus(v: unknown): GuideStatus | null {
  if (v === 'draft' || v === 'published') return v;
  return null;
}

function parseFaq(raw: unknown): GuideFaq[] | null {
  if (raw == null) return [];
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) return null;
  const out: GuideFaq[] = [];
  for (const item of value) {
    if (item == null || typeof item !== 'object') return null;
    const rec = item as Record<string, unknown>;
    const question = asTrimmedString(rec.question);
    const answer = asTrimmedString(rec.answer);
    if (!question || !answer) return null;
    out.push({ question, answer });
  }
  return out;
}

function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s || null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function inlineMarkdown(raw: string): string {
  const escaped = escapeHtml(raw);
  const withBold = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const withEm = withBold.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<span>$2</span>');
  return withEm.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_full, text: string, hrefRaw: string) => {
    const href = hrefRaw.replace(/&amp;/g, '&').trim();
    if (!isAllowedHref(href)) return text;
    return `<a href="${escapeHtml(href)}">${text}</a>`;
  });
}

function headChrome(): string {
  const fonts = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';
  return `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='4' fill='%23141613'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="${fonts}">
  <link rel="stylesheet" href="${fonts}" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="${fonts}"></noscript>
  <link rel="stylesheet" href="/legal.css?v=3">`;
}

function navHtml(kind: 'index' | 'article'): string {
  const enter = kind === 'index'
    ? '<a class="enter" href="/app/#/login">Entrar</a>'
    : '<a class="enter" href="/guias">Guias</a>';
  return `<div class="legal-nav"><div class="in">
    <a class="brand" href="/"><span class="pb-wordmark">PrepBid</span></a>
    <div class="nav-cta">${enter}<a class="start" href="/app/#/registo">Começar grátis</a></div>
  </div></div>`;
}

function footHtml(): string {
  return `<div class="legal-foot"><div class="in">
    <span>PrepBid — um produto da <strong>Transformatiive, Lda.</strong></span>
    <span><a href="/">Início</a> · <a href="/guias">Guias</a> · <a href="/termos">Termos</a> · <a href="/privacidade">Privacidade</a></span>
  </div></div>`;
}

function guideCard(g: GuideRecord): string {
  return `      <a class="guide-card" href="/guias/${encodeURIComponent(g.slug)}">
        <div class="k">${escapeHtml(intentLabel(g.intent))}</div>
        <h2>${escapeHtml(g.title)}</h2>
        <p>${escapeHtml(g.description)}</p>
      </a>`;
}
