import type { FastifyInstance } from 'fastify';

const CF_API = 'https://api.cloudflare.com/client/v4';

export function crawlerDocumentUrls(origin: string): string[] {
  const base = origin.replace(/\/$/, '');
  return [`${base}/robots.txt`, `${base}/sitemap.xml`, `${base}/llms.txt`, `${base}/llms-full.txt`];
}

export function zoneNameFromOrigin(origin: string): string {
  try {
    return new URL(origin).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return 'prepbid.com';
  }
}

/** Destino 301 quando o pedido chega a www.<apex>. */
export function wwwToApexLocation(
  hostHeader: string | undefined,
  requestUrl: string,
  apexOrigin: string,
): string | null {
  const host = (hostHeader || '').split(':')[0].toLowerCase();
  let apexHost: string;
  try {
    apexHost = new URL(apexOrigin).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!apexHost || host !== `www.${apexHost}`) return null;
  const dest = new URL(requestUrl, `https://${apexHost}`);
  dest.hostname = apexHost;
  dest.protocol = 'https:';
  dest.port = '';
  return dest.href;
}

export function applyCrawlerNoStore(headers: {
  header(name: string, value: string): unknown;
}): void {
  // Cloudflare trata .txt como estático e aplica 4h se só houver max-age=0.
  headers.header('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  headers.header('CDN-Cache-Control', 'no-store');
  headers.header('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.header('Expires', '0');
}

export function registerWwwApexRedirect(app: FastifyInstance, apexOrigin: string): void {
  app.addHook('onRequest', async (req, reply) => {
    const dest = wwwToApexLocation(req.headers.host, req.url, apexOrigin);
    if (!dest) return;
    return reply.status(301).redirect(dest);
  });
}

export async function purgeCrawlerDocuments(opts: {
  origin: string;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; skipped: boolean; error?: string }> {
  if (!opts.token) return { ok: true, skipped: true };
  const fetchImpl = opts.fetchImpl ?? fetch;
  const zoneName = zoneNameFromOrigin(opts.origin);
  const files = crawlerDocumentUrls(opts.origin);
  const headers = { Authorization: `Bearer ${opts.token}` };

  const zonesRes = await fetchImpl(`${CF_API}/zones?name=${encodeURIComponent(zoneName)}`, { headers });
  const zonesJson = (await zonesRes.json().catch(() => ({}))) as {
    success?: boolean;
    result?: { id?: string }[];
    errors?: { message?: string }[];
  };
  const zoneId = zonesJson.result?.[0]?.id;
  if (!zonesRes.ok || !zoneId) {
    return {
      ok: false,
      skipped: false,
      error: zonesJson.errors?.[0]?.message || `zone ${zoneName} not found (${zonesRes.status})`,
    };
  }

  const purgeRes = await fetchImpl(`${CF_API}/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  const purgeJson = (await purgeRes.json().catch(() => ({}))) as {
    success?: boolean;
    errors?: { message?: string }[];
  };
  if (!purgeRes.ok || !purgeJson.success) {
    return {
      ok: false,
      skipped: false,
      error: purgeJson.errors?.[0]?.message || `purge HTTP ${purgeRes.status}`,
    };
  }
  return { ok: true, skipped: false };
}
