import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PUBLIC_GUIDES,
  guideBySlug,
  publicSiteOrigin,
  robotsTxt,
  sitemapXml,
  PUBLIC_SITE_FALLBACK,
} from './public-guides.js';

test('cada guia tem slug único, título, descrição e ficheiro em guias/', () => {
  const slugs = PUBLIC_GUIDES.map((g) => g.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const g of PUBLIC_GUIDES) {
    assert.match(g.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(g.title.length > 12);
    assert.ok(g.description.length > 40);
    assert.equal(g.file, `guias/${g.slug}.html`);
    assert.ok(g.intent === 'informativa' || g.intent === 'comercial');
  }
});

test('cada guia tem um HTML correspondente em public/', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
  assert.equal(existsSync(join(root, 'guias/index.html')), true);
  for (const g of PUBLIC_GUIDES) {
    assert.equal(existsSync(join(root, g.file)), true, g.file);
  }
});

test('guideBySlug devolve o guia ou undefined', () => {
  assert.equal(guideBySlug('o-que-e-o-base-gov')?.title.includes('BASE.gov'), true);
  assert.equal(guideBySlug('../etc/passwd'), undefined);
  assert.equal(guideBySlug(''), undefined);
});

test('publicSiteOrigin usa APP_URL e cai no domínio de produção', () => {
  assert.equal(publicSiteOrigin('https://baseradar.example/'), 'https://baseradar.example');
  assert.equal(publicSiteOrigin(''), PUBLIC_SITE_FALLBACK);
});

test('robots.txt permite o site público e esconde /app e /api', () => {
  const txt = robotsTxt('https://baseradar.example');
  assert.match(txt, /Allow: \//);
  assert.match(txt, /Disallow: \/app/);
  assert.match(txt, /Disallow: \/api/);
  assert.match(txt, /Sitemap: https:\/\/baseradar\.example\/sitemap\.xml/);
});

test('sitemap.xml inclui landing, guias e páginas legais', () => {
  const xml = sitemapXml('https://baseradar.example', '2026-09-08');
  assert.match(xml, /<loc>https:\/\/baseradar\.example\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/baseradar\.example\/guias<\/loc>/);
  for (const g of PUBLIC_GUIDES) {
    assert.match(xml, new RegExp(`<loc>https://baseradar\\.example/guias/${g.slug}</loc>`));
  }
  assert.match(xml, /\/termos</);
  assert.match(xml, /\/privacidade</);
  assert.doesNotMatch(xml, /\/app/);
});
