#!/usr/bin/env node
// Production build → dist/
//
//   npm run build          for hosting with the included Node server
//   npm run build:static   for a static host (Netlify, Cloudflare Pages, …):
//                          disables the first-party collector, which needs the
//                          server, and writes a _headers file with the CSP
//
// Minifies CSS and page scripts with esbuild. The owner-editable data files
// (js/site-config.js, js/catalogue.js) are copied unminified so they stay
// readable on the server. SEO tags that need an absolute URL — canonical,
// og:url, og:image and sitemap.xml — are written only when `siteUrl` is set
// in js/site-config.js, so a placeholder domain is never published.

import { cp, mkdir, readFile, rm, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { buildCsp } from '../server/server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const STATIC = process.argv.includes('--static');
const UNMINIFIED = new Set(['js/site-config.js', 'js/catalogue.js']);

function readSiteConfig(code) {
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { timeout: 200 });
  return sandbox.window.INFINITE_SITE || {};
}

function validSiteUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || /example\.|localhost|127\.0\.0\.1/.test(url.hostname))
      throw new Error('not a production https origin');
    return url.origin;
  } catch (error) {
    throw new Error(
      `siteUrl "${value}" in js/site-config.js must be the confirmed production origin, e.g. https://www.yourdomain.in (${error.message})`,
      { cause: error }
    );
  }
}

function escAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function main() {
  const configSource = await readFile(path.join(ROOT, 'js/site-config.js'), 'utf8');
  const site = readSiteConfig(configSource);
  const siteUrl = validSiteUrl(site.siteUrl);

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  for (const entry of ['index.html', 'admin', 'assets', 'css', 'js']) {
    await cp(path.join(ROOT, entry), path.join(DIST, entry), { recursive: true });
  }

  // Minify styles and page scripts.
  for (const file of await walk(DIST)) {
    const rel = path.relative(DIST, file).split(path.sep).join('/');
    const ext = path.extname(file);
    if ((ext !== '.css' && ext !== '.js') || UNMINIFIED.has(rel)) continue;
    const source = await readFile(file, 'utf8');
    const result = await transform(source, {
      loader: ext.slice(1),
      minify: true,
      legalComments: 'none',
      target: ext === '.css' ? ['chrome100', 'safari15', 'firefox100'] : ['es2018']
    });
    await writeFile(file, result.code);
  }

  // Static hosts have no /api/collect: switch the collector off in the copy.
  if (STATIC) {
    const distConfig = path.join(DIST, 'js/site-config.js');
    const code = await readFile(distConfig, 'utf8');
    const updated = code.replace(/endpoint:\s*'\/api\/collect'/, "endpoint: ''");
    if (updated === code) console.warn('! could not find the first-party endpoint in js/site-config.js; check analytics settings manually');
    await writeFile(distConfig, updated);
  }

  // SEO tags that require the confirmed production origin.
  const indexPath = path.join(DIST, 'index.html');
  let html = await readFile(indexPath, 'utf8');
  if (siteUrl) {
    const image = siteUrl + '/assets/social/og-1200x630.jpg';
    const tags = [
      `<link rel="canonical" href="${escAttr(siteUrl + '/')}" />`,
      `<meta property="og:url" content="${escAttr(siteUrl + '/')}" />`,
      `<meta property="og:image" content="${escAttr(image)}" />`,
      '<meta property="og:image:width" content="1200" />',
      '<meta property="og:image:height" content="630" />',
      '<meta property="og:image:alt" content="Infinite Nutrition branded supplement containers under red studio lighting" />',
      `<meta name="twitter:image" content="${escAttr(image)}" />`
    ].join('\n  ');
    html = html.replace(/\n\s*<!-- A canonical URL, og:url and absolute social-preview image are intentionally omitted[^>]*-->/, '');
    html = html.replace('<meta name="twitter:card" content="summary" />', '<meta name="twitter:card" content="summary_large_image" />');
    html = html.replace(/(\s*)<title>/, `$1${tags}$1<title>`);
    html = html.replace(
      /(<script type="application\/ld\+json" id="businessJsonLd">\s*)([\s\S]*?)(\s*<\/script>)/,
      (match, open, json, close) => {
        const data = JSON.parse(json);
        data.url = siteUrl + '/';
        data.logo = siteUrl + '/assets/brand/logo-192.png';
        data.image = siteUrl + '/assets/social/og-1200x630.jpg';
        return open + JSON.stringify(data, null, 2) + close;
      }
    );
  }
  await writeFile(indexPath, html);

  // robots.txt and sitemap.xml
  const robots = ['User-agent: *', 'Allow: /', 'Disallow: /admin/', 'Disallow: /api/'];
  if (siteUrl) robots.push('', `Sitemap: ${siteUrl}/sitemap.xml`);
  await writeFile(path.join(DIST, 'robots.txt'), robots.join('\n') + '\n');
  if (siteUrl) {
    const today = new Date().toISOString().slice(0, 10);
    await writeFile(
      path.join(DIST, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${today}</lastmod>\n  </url>\n</urlset>\n`
    );
  }

  if (STATIC) {
    const csp = buildCsp(site, true);
    const security = [
      `  Content-Security-Policy: ${csp}`,
      '  X-Content-Type-Options: nosniff',
      '  Referrer-Policy: strict-origin-when-cross-origin',
      '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
      '  X-Frame-Options: DENY'
    ];
    await writeFile(
      path.join(DIST, '_headers'),
      [
        '/*',
        ...security,
        '',
        '/admin/*',
        '  X-Robots-Tag: noindex, nofollow',
        '',
        '/assets/*',
        '  Cache-Control: public, max-age=604800',
        ''
      ].join('\n')
    );
  }

  // Size report
  let raw = 0;
  let gz = 0;
  const lines = [];
  for (const file of await walk(DIST)) {
    const rel = path.relative(DIST, file);
    const size = (await stat(file)).size;
    raw += size;
    const isText = /\.(html|css|js|json|xml|txt|svg)$/.test(file);
    const gzSize = isText ? zlib.gzipSync(await readFile(file), { level: 9 }).length : size;
    gz += gzSize;
    if (isText)
      lines.push(`  ${rel.padEnd(28)} ${(size / 1024).toFixed(1).padStart(7)} KB  gzip ${(gzSize / 1024).toFixed(1).padStart(6)} KB`);
  }
  console.log(`Built ${STATIC ? 'static ' : ''}site → dist/`);
  console.log(lines.sort().join('\n'));
  console.log(`  total ${(raw / 1024 / 1024).toFixed(2)} MB (${(gz / 1024 / 1024).toFixed(2)} MB with text gzipped)`);
  console.log(
    siteUrl
      ? `  SEO: canonical, og:url, og:image and sitemap.xml written for ${siteUrl}`
      : '  SEO: siteUrl not set — canonical, og:url, og:image and sitemap.xml omitted (launch dependency)'
  );
  if (STATIC) console.log('  Static build: first-party analytics collector disabled; the /admin/ dashboard needs the Node server.');
}

main().catch((error) => {
  console.error('Build failed:', error.message);
  process.exit(1);
});
