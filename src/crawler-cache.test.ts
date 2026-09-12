import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCrawlerNoStore,
  crawlerDocumentUrls,
  purgeCrawlerDocuments,
  wwwToApexLocation,
  zoneNameFromOrigin,
} from './crawler-cache.js';

test('crawlerDocumentUrls lista robots, sitemap e llms no apex', () => {
  assert.deepEqual(crawlerDocumentUrls('https://prepbid.com/'), [
    'https://prepbid.com/robots.txt',
    'https://prepbid.com/sitemap.xml',
    'https://prepbid.com/llms.txt',
    'https://prepbid.com/llms-full.txt',
  ]);
});

test('zoneNameFromOrigin tira www', () => {
  assert.equal(zoneNameFromOrigin('https://www.prepbid.com'), 'prepbid.com');
  assert.equal(zoneNameFromOrigin('https://prepbid.com'), 'prepbid.com');
});

test('wwwToApexLocation só redirecciona o host www', () => {
  assert.equal(
    wwwToApexLocation('www.prepbid.com', '/sitemap.xml', 'https://prepbid.com'),
    'https://prepbid.com/sitemap.xml',
  );
  assert.equal(wwwToApexLocation('prepbid.com', '/sitemap.xml', 'https://prepbid.com'), null);
  assert.equal(wwwToApexLocation('basegov-robot-production.up.railway.app', '/', 'https://prepbid.com'), null);
});

test('applyCrawlerNoStore manda Cloudflare não guardar', () => {
  const got: Record<string, string> = {};
  applyCrawlerNoStore({
    header(name, value) {
      got[name] = value;
    },
  });
  assert.equal(got['Cache-Control'], 'private, no-store, no-cache, must-revalidate, max-age=0');
  assert.equal(got['CDN-Cache-Control'], 'no-store');
  assert.equal(got['Cloudflare-CDN-Cache-Control'], 'no-store');
});

test('purgeCrawlerDocuments não chama a API sem token', async () => {
  let called = 0;
  const result = await purgeCrawlerDocuments({
    origin: 'https://prepbid.com',
    token: '',
    fetchImpl: async () => {
      called += 1;
      return new Response('{}');
    },
  });
  assert.equal(called, 0);
  assert.deepEqual(result, { ok: true, skipped: true });
});

test('purgeCrawlerDocuments pede a zona e os ficheiros', async () => {
  const urls: string[] = [];
  const result = await purgeCrawlerDocuments({
    origin: 'https://prepbid.com',
    token: 'test-token',
    fetchImpl: async (input, init) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/zones?name=')) {
        return Response.json({ success: true, result: [{ id: 'zone1' }] });
      }
      assert.equal(init?.method, 'POST');
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.files[0], 'https://prepbid.com/robots.txt');
      return Response.json({ success: true });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, false);
  assert.equal(urls.length, 2);
});
