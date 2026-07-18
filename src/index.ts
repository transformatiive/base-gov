import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { migrateAndSeed } from './db.js';
import { registerRoutes } from './routes.js';
import { registerRoutesV2 } from './routes-v2.js';
import { registerAccountRoutes } from './routes-account.js';
import { registerSeatRoutes } from './seats.js';
import { startWorker } from './scraper/worker.js';
import { startOpendataWorker } from './opendata.js';
import { ensureCpvCatalog } from './cpv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  await migrateAndSeed();

  const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });
  await app.register(fastifyCookie, { secret: config.sessionSecret });
  // Sem cache agressiva: garante que o browser recebe sempre a versão atual da SPA.
  // index:false → a raiz não serve automaticamente o index.html da SPA; a landing
  // pública fica em "/" e a aplicação passa para "/app".
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
    index: false,
    cacheControl: true,
    maxAge: 0,
    etag: true,
    lastModified: true,
  });

  // Landing comercial na raiz do domínio.
  app.get('/', (_req, reply) => reply.sendFile('landing.html'));
  // Aplicação (SPA com routing por hash) servida em /app.
  const sendApp = (_req: unknown, reply: import('fastify').FastifyReply) => reply.sendFile('index.html');
  app.get('/app', sendApp);
  app.get('/app/', sendApp);

  // Guarda o corpo cru dos pedidos JSON (necessário para verificar a assinatura
  // HMAC dos webhooks do Easypay antes de mutar estado).
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    (req as unknown as { rawBody?: string }).rawBody = body as string;
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await registerRoutes(app);
  await registerRoutesV2(app);
  await registerAccountRoutes(app);
  await registerSeatRoutes(app);

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
