import assert from 'node:assert/strict';
import test from 'node:test';
import { cacheControlForPublicFile } from './static-cache.js';

test('HTML da SPA e da landing não fica em cache longa', () => {
  assert.equal(cacheControlForPublicFile('/app/public/index.html'), 'public, max-age=0, must-revalidate');
  assert.equal(cacheControlForPublicFile('/app/public/landing.html'), 'public, max-age=0, must-revalidate');
});

test('vendor e JS/CSS versionados no HTML podem ser imutáveis', () => {
  assert.match(cacheControlForPublicFile('/app/public/vendor/maplibre/maplibre-gl.js'), /immutable/);
  assert.match(cacheControlForPublicFile('/app/public/app.js'), /immutable/);
  assert.match(cacheControlForPublicFile('/app/public/style.css'), /immutable/);
  assert.match(cacheControlForPublicFile('/app/public/tokens.css'), /immutable/);
});
