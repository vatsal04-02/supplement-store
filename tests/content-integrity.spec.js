// Static checks on the source: business facts, link safety, CSP readiness, assets and SEO data.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const html = read('index.html');
const adminHtml = read('admin/index.html');

function load(file, key) {
  const sandbox = { window: {} };
  vm.runInNewContext(read(file), sandbox);
  return sandbox.window[key];
}
const SITE = load('js/site-config.js', 'INFINITE_SITE');
const PRODUCTS = load('js/catalogue.js', 'INFINITE_PRODUCTS');
const MEDIA = load('js/catalogue.js', 'INFINITE_CATEGORY_MEDIA');

test('every tel: and wa.me link uses a published store number from js/site-config.js', () => {
  const tel = new Set(SITE.contacts.map((c) => c.tel));
  const wa = new Set(SITE.contacts.map((c) => c.whatsapp));
  const telLinks = [...html.matchAll(/href="tel:([^"]+)"/g)].map((m) => m[1]);
  const waLinks = [...html.matchAll(/href="https:\/\/wa\.me\/(\d+)/g)].map((m) => m[1]);
  expect(telLinks.length).toBeGreaterThan(0);
  expect(waLinks.length).toBeGreaterThan(0);
  expect(telLinks.filter((n) => !tel.has(n))).toEqual([]);
  expect(waLinks.filter((n) => !wa.has(n))).toEqual([]);
  const ldPhones = JSON.parse(html.match(/id="businessJsonLd">([\s\S]*?)<\/script>/)[1]).telephone.map((t) => '+' + t.replace(/\D/g, ''));
  expect(ldPhones.sort()).toEqual([...tel].sort());
});

test('links that open a new tab are isolated from the page', () => {
  for (const source of [html, adminHtml, read('js/app.js'), read('js/store-map.js')]) {
    const blanks = [...source.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map((m) => m[0]);
    expect(blanks.filter((tag) => !/rel="noopener noreferrer"/.test(tag))).toEqual([]);
  }
});

test('pages are CSP-ready: no inline scripts, inline styles or event handler attributes', () => {
  for (const source of [html, adminHtml]) {
    const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    const inlineCode = scripts.filter(([, attrs, body]) => body.trim() && !/type="application\/ld\+json"/.test(attrs));
    expect(inlineCode.map((m) => m[0].slice(0, 80))).toEqual([]);
    expect(source.match(/\sstyle="/g)).toBeNull();
    expect(source.match(/\son[a-z]+="/g)).toBeNull();
  }
  for (const file of ['js/app.js', 'admin/dashboard.js']) {
    expect(read(file).match(/\sstyle="/g), file).toBeNull();
  }
});

test('every referenced local file exists and nothing is inlined as base64', () => {
  const refs = new Set();
  const collect = (source, base) => {
    for (const m of source.matchAll(/(?:src|href)="([^"#:]+?)"/g)) refs.add(path.posix.join(base, m[1]));
    for (const m of source.matchAll(/(?:srcset|imagesrcset)="([^"]+)"/g)) m[1].split(',').forEach((part) => refs.add(path.posix.join(base, part.trim().split(/\s+/)[0])));
  };
  collect(html, '');
  collect(adminHtml, 'admin');
  PRODUCTS.forEach((p) => { if (p.image) refs.add(p.image); if (p.imageWebp) refs.add(p.imageWebp); });
  Object.values(MEDIA).forEach((m) => [m.visual, m.store].filter(Boolean).forEach((img) => {
    refs.add(img.fallback);
    img.srcset.split(',').forEach((part) => refs.add(part.trim().split(/\s+/)[0]));
  }));
  const missing = [...refs].filter((ref) => ref && !ref.startsWith('..') && !fs.existsSync(path.join(ROOT, ref)));
  expect(missing).toEqual([]);
  expect(html).not.toMatch(/data:[a-z]+\/[a-z+.-]+;base64/);
});

test('every image has an alt attribute', () => {
  for (const source of [html, adminHtml]) {
    const imgs = [...source.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    expect(imgs.filter((tag) => !/\salt="/.test(tag))).toEqual([]);
  }
});

test('structured data publishes no ratings, reviews, prices or unconfirmed address details', () => {
  const data = JSON.parse(html.match(/id="businessJsonLd">([\s\S]*?)<\/script>/)[1]);
  const text = JSON.stringify(data);
  expect(text).not.toMatch(/aggregateRating|review|"price|openingHours|streetAddress|postalCode|geo"/i);
  expect(data.address).toEqual({ '@type': 'PostalAddress', addressLocality: 'Lucknow', addressRegion: 'Uttar Pradesh', addressCountry: 'IN' });
  // No canonical or og:url is published until the production domain is confirmed.
  expect(SITE.siteUrl).toBe('');
  expect(html).not.toMatch(/rel="canonical"|property="og:url"/);
});

test('the catalogue publishes no unconfirmed prices or stock', () => {
  for (const p of PRODUCTS) {
    expect(p.stock, p.id).toBeNull();
    for (const v of p.variants) {
      expect(v.price, p.id).toBeNull();
      expect(v.mrp, p.id).toBeNull();
    }
  }
});

test('the owner dashboard is excluded from search engines', () => {
  expect(adminHtml).toContain('<meta name="robots" content="noindex, nofollow" />');
  expect(read('robots.txt')).toContain('Disallow: /admin/');
});
