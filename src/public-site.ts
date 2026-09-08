import type { FastifyInstance } from 'fastify';
import { config } from './config.js';
import {
  guideBySlug,
  publicSiteOrigin,
  robotsTxt,
  sitemapXml,
} from './public-guides.js';

export async function registerPublicSiteRoutes(app: FastifyInstance): Promise<void> {
  const origin = () => publicSiteOrigin(config.appBaseUrl);

  app.get('/robots.txt', async (_req, reply) => {
    reply.type('text/plain; charset=utf-8');
    return robotsTxt(origin());
  });

  app.get('/sitemap.xml', async (_req, reply) => {
    const today = new Date().toISOString().slice(0, 10);
    reply.type('application/xml; charset=utf-8');
    return sitemapXml(origin(), today);
  });

  app.get('/guias', async (_req, reply) => reply.sendFile('guias/index.html'));
  app.get('/guias/', async (_req, reply) => reply.sendFile('guias/index.html'));

  app.get<{ Params: { slug: string } }>('/guias/:slug', async (req, reply) => {
    const guide = guideBySlug(req.params.slug);
    if (!guide) {
      return reply.code(404).type('text/plain; charset=utf-8').send('Guia não encontrado.');
    }
    return reply.sendFile(guide.file);
  });
}
