import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { migrateAndSeed } from './db.js';
import { registerRoutes } from './routes.js';
import { registerRoutesV2 } from './routes-v2.js';
import { startWorker } from './scraper/worker.js';
import { startOpendataWorker } from './opendata.js';
import { ensureCpvCatalog } from './cpv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  await migrateAndSeed();

  const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });
  await app.register(fastifyCookie, { secret: config.sessionSecret });
  // Sem cache agressiva: garante que o browser recebe sempre a versão atual da SPA.
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
    cacheControl: true,
    maxAge: 0,
    etag: true,
    lastModified: true,
  });
  await registerRoutes(app);
  await registerRoutesV2(app);

  app.get('/health', async () => ({ ok: true }));

  await app.listen({ port: config.port, host: '0.0.0.0' });
  startWorker();
  startOpendataWorker();
  ensureCpvCatalog();
}

// Rede de segurança: um stream sem handler não deve derrubar o serviço inteiro.
process.on('uncaughtException', (err) => console.error('[fatal-guard] uncaughtException:', err));
process.on('unhandledRejection', (err) => console.error('[fatal-guard] unhandledRejection:', err));

main().catch((err) => {
  console.error('Erro fatal no arranque:', err);
  process.exit(1);
});
