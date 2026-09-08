/** Catálogo das páginas públicas de guias (SEO / LLMs). Não é o manual autenticado em /app. */

export type GuideIntent = 'informativa' | 'comercial';

export interface PublicGuide {
  slug: string;
  title: string;
  description: string;
  intent: GuideIntent;
  file: string;
}

export const PUBLIC_SITE_FALLBACK = 'https://basegov-robot-production.up.railway.app';

export const PUBLIC_GUIDES: PublicGuide[] = [
  {
    slug: 'o-que-e-o-base-gov',
    title: 'O que é o BASE.gov e como funciona',
    description: 'O Portal BASE é o repositório oficial da contratação pública portuguesa. O que lá encontra, o que não encontra, e como usar os dados sem perder concursos.',
    intent: 'informativa',
    file: 'guias/o-que-e-o-base-gov.html',
  },
  {
    slug: 'ajuste-direto-e-concurso-publico',
    title: 'Ajuste direto e concurso público: a diferença na prática',
    description: 'Quando a entidade pode adjudicar por ajuste direto, quando tem de abrir concurso, e o que isso muda para quem quer concorrer.',
    intent: 'informativa',
    file: 'guias/ajuste-direto-e-concurso-publico.html',
  },
  {
    slug: 'como-saber-quais-concursos-sao-relevantes',
    title: 'Como saber quais concursos públicos são relevantes para a sua empresa',
    description: 'Filtrar o ruído do BASE com CPV, distritos, valor e o histórico de contratos que se repetem — em vez de abrir o portal todas as manhãs.',
    intent: 'comercial',
    file: 'guias/como-saber-quais-concursos-sao-relevantes.html',
  },
  {
    slug: 'como-prever-o-valor-de-adjudicacao',
    title: 'Como prever o valor de adjudicação de um concurso público',
    description: 'O preço base raramente é o valor adjudicado. Como estimar um intervalo a partir do histórico do mesmo CPV e da mesma entidade, sem fingir uma percentagem de confiança de modelo.',
    intent: 'comercial',
    file: 'guias/como-prever-o-valor-de-adjudicacao.html',
  },
];

export function guideBySlug(slug: string): PublicGuide | undefined {
  return PUBLIC_GUIDES.find((g) => g.slug === slug);
}

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

export function sitemapXml(origin: string, lastmod: string, guides = PUBLIC_GUIDES): string {
  const base = origin.replace(/\/$/, '');
  const urls: { loc: string; priority: string }[] = [
    { loc: `${base}/`, priority: '1.0' },
    { loc: `${base}/guias`, priority: '0.8' },
    ...guides.map((g) => ({ loc: `${base}/guias/${g.slug}`, priority: '0.7' })),
    { loc: `${base}/termos`, priority: '0.3' },
    { loc: `${base}/privacidade`, priority: '0.3' },
  ];
  const body = urls.map((u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
