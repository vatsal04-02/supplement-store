#!/usr/bin/env node
// Infinite Nutrition web server
// -----------------------------
// Serves the storefront and the owner dashboard, and provides the
// first-party analytics API. No dependencies beyond Node.js 20+.
//
//   POST /api/collect   anonymous storefront events (js/analytics.js)
//   GET  /api/stats     aggregated report for /admin/ (Bearer token)
//   GET  /api/health    liveness and configuration status
//
// Configuration is read from environment variables; see .env.example.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createAnalyticsStore, isValidDate, localDate, TIMEZONE } from './analytics-store.mjs';
import { normalizeEvent } from './event-schema.mjs';

const gzip = promisify(zlib.gzip);
const brotli = promisify(zlib.brotliCompress);

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  return {
    port: Number(env.PORT) || 8080,
    host: env.HOST || (production ? '0.0.0.0' : '127.0.0.1'),
    env: production ? 'production' : 'development',
    staticRoot: path.resolve(REPO_ROOT, env.STATIC_ROOT || '.'),
    dataDir: path.resolve(REPO_ROOT, env.ANALYTICS_DATA_DIR || 'data'),
    adminToken: env.ANALYTICS_ADMIN_TOKEN || '',
    retentionDays: Math.max(1, Number(env.ANALYTICS_RETENTION_DAYS) || 395),
    // Number of trusted reverse proxies in front of the server (0 = none).
    trustProxy: Math.max(0, Math.min(5, Number(env.TRUST_PROXY) || 0)),
    // Extra origins allowed to post events, e.g. when a proxy rewrites Host.
    allowedOrigins: String(env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    collect: env.ANALYTICS_COLLECT !== '0',
    allowHeadless: env.ANALYTICS_ALLOW_HEADLESS === '1',
    quiet: env.QUIET === '1'
  };
}

// Reads js/site-config.js in a sandbox so the server can build its
// Content-Security-Policy from the same owner configuration as the page.
async function readSiteConfig(staticRoot) {
  try {
    const code = await readFile(path.join(staticRoot, 'js', 'site-config.js'), 'utf8');
    const sandbox = { window: {} };
    vm.runInNewContext(code, sandbox, { timeout: 200 });
    return sandbox.window.INFINITE_SITE || {};
  } catch (error) {
    return {};
  }
}

export function buildCsp(site, production) {
  const ga4 = site.analytics && /^G-[A-Z0-9]{4,20}$/.test(site.analytics.ga4MeasurementId || '');
  const gaHosts = ga4 ? ' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com' : '';
  return [
    "default-src 'self'",
    "script-src 'self'" + (ga4 ? ' https://www.googletagmanager.com' : ''),
    "style-src 'self'",
    "img-src 'self' data:" + gaHosts,
    "connect-src 'self'" + gaHosts,
    'frame-src https://www.google.com https://maps.google.com https://www.google.co.in https://maps.google.co.in',
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(production ? ['upgrade-insecure-requests'] : [])
  ].join('; ');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.txt', '.xml', '.webmanifest']);
// Only these top-level entries are public, so running from the repository
// root never exposes server code, analytics data, tests or package files.
const PUBLIC_ENTRIES = new Set(['index.html', 'admin', 'assets', 'css', 'js', 'robots.txt', 'sitemap.xml', 'favicon.ico']);

// Each trusted proxy appends the address it received the request from, so
// the client's address is the entry `trustProxy` positions from the right.
// Anything further left was supplied by the client and cannot be trusted.
export function clientIp(req, config) {
  if (config.trustProxy) {
    const chain = String(req.headers['x-forwarded-for'] || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const candidate = chain[chain.length - config.trustProxy];
    if (candidate) return candidate;
  }
  return req.socket.remoteAddress || '';
}

// Fixed-window limiter. Expired entries are swept at most once per window,
// and the table is capped so a flood of distinct keys cannot grow it forever.
export function createRateLimiter(limit, windowMs, maxKeys = 20000) {
  const hits = new Map();
  let lastSweep = 0;
  function current(key, now) {
    const entry = hits.get(key);
    return entry && now - entry.start < windowMs ? entry : null;
  }
  function record(key, now = Date.now()) {
    if (now - lastSweep >= windowMs) {
      for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
      lastSweep = now;
    }
    const entry = current(key, now);
    if (entry) {
      entry.count++;
      return entry.count <= limit;
    }
    if (hits.size >= maxKeys) hits.delete(hits.keys().next().value);
    hits.set(key, { start: now, count: 1 });
    return true;
  }
  function blocked(key, now = Date.now()) {
    const entry = current(key, now);
    return !!entry && entry.count >= limit;
  }
  return { record, blocked };
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|lighthouse|pagespeed|pingdom|uptime|monitor|curl|wget|python|httpclient|headless/i;

function tokenMatches(provided, expected) {
  if (!provided || !expected) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    if (Number(req.headers['content-length']) > limit) {
      req.resume(); // discard the body so the 413 response can be delivered
      reject(Object.assign(new Error('Payload too large'), { status: 413 }));
      return;
    }
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        chunks.length = 0;
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!tooLarge) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

export async function createServer(overrides = {}) {
  const config = { ...loadConfig(), ...overrides };
  const site = await readSiteConfig(config.staticRoot);
  const csp = buildCsp(site, config.env === 'production');
  const store = createAnalyticsStore({ dataDir: config.dataDir, env: config.env, retentionDays: config.retentionDays });
  const statsConfigured = config.adminToken.length >= 24;
  const collectLimiter = createRateLimiter(120, 60 * 1000);
  const authFailLimiter = createRateLimiter(10, 15 * 60 * 1000);
  let lastOriginWarning = 0;
  const compressedCache = new Map();
  const log = config.quiet ? () => {} : (...args) => console.log(new Date().toISOString(), ...args);

  store.prune().catch(() => {});
  const pruneTimer = setInterval(() => store.prune().catch(() => {}), 12 * 60 * 60 * 1000);
  pruneTimer.unref();

  function baseHeaders(extra = {}) {
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      ...extra
    };
    if (config.env === 'production') headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    return headers;
  }

  function sendJson(res, status, body, extra = {}) {
    const payload = JSON.stringify(body);
    res.writeHead(
      status,
      baseHeaders({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        ...extra
      })
    );
    res.end(payload);
  }

  function originAllowed(req, origin) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch (error) {
      return false;
    }
    if (config.allowedOrigins.includes(parsed.origin)) return true;
    const hosts = [req.headers.host];
    if (config.trustProxy && req.headers['x-forwarded-host']) hosts.push(String(req.headers['x-forwarded-host']).split(',')[0].trim());
    return hosts.includes(parsed.host);
  }

  async function handleCollect(req, res) {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'POST' });
    const origin = req.headers.origin;
    if (origin && origin !== 'null' && !originAllowed(req, origin)) {
      const now = Date.now();
      if (now - lastOriginWarning > 60000) {
        lastOriginWarning = now;
        log(`rejected analytics from origin ${origin} (Host: ${req.headers.host}); set ALLOWED_ORIGINS if this is your site`);
      }
      return sendJson(res, 403, { error: 'cross_origin' });
    }
    const ip = clientIp(req, config);
    if (!collectLimiter.record(ip)) return sendJson(res, 429, { error: 'rate_limited' }, { 'Retry-After': '60' });
    let body;
    try {
      body = await readBody(req, 32 * 1024);
    } catch (error) {
      return sendJson(
        res,
        error.status || 400,
        { error: error.status === 413 ? 'payload_too_large' : 'bad_request' },
        error.status === 413 ? { Connection: 'close' } : {}
      );
    }
    if (!config.collect) {
      res.writeHead(204, baseHeaders({ 'Cache-Control': 'no-store' }));
      return res.end();
    }
    const userAgent = String(req.headers['user-agent'] || '');
    if (
      !userAgent ||
      (BOT_PATTERN.test(userAgent) && !(config.allowHeadless && /HeadlessChrome/.test(userAgent) && !/lighthouse/i.test(userAgent)))
    ) {
      res.writeHead(204, baseHeaders({ 'Cache-Control': 'no-store' }));
      return res.end();
    }
    let data;
    try {
      data = JSON.parse(body);
    } catch (error) {
      return sendJson(res, 400, { error: 'invalid_json' });
    }
    if (
      !data ||
      data.v !== 1 ||
      typeof data.sid !== 'string' ||
      !/^[a-f0-9]{16}$/.test(data.sid) ||
      !Array.isArray(data.events) ||
      !data.events.length ||
      data.events.length > 50
    ) {
      return sendJson(res, 400, { error: 'invalid_payload' });
    }
    const now = Date.now();
    const visitor = store.visitorKey(localDate(now), ip, userAgent);
    const records = [];
    let rejected = 0;
    for (const raw of data.events) {
      const event = normalizeEvent(raw);
      if (!event) {
        rejected++;
        continue;
      }
      records.push({ t: new Date(now).toISOString(), ...event, s: data.sid, v: visitor });
    }
    try {
      await store.append(records);
    } catch (error) {
      log('analytics write failed', error.message);
      return sendJson(res, 500, { error: 'storage_unavailable' });
    }
    if (rejected) res.setHeader('X-Events-Rejected', String(rejected));
    res.writeHead(204, baseHeaders({ 'Cache-Control': 'no-store' }));
    res.end();
  }

  async function handleStats(req, res, url) {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET' });
    if (!statsConfigured) {
      return sendJson(res, 503, {
        error: 'not_configured',
        message: 'Set ANALYTICS_ADMIN_TOKEN (at least 24 characters) on the server to enable reports.'
      });
    }
    const ip = clientIp(req, config);
    // Checked before the token, so a locked-out client learns nothing from
    // further guesses, correct or not.
    if (authFailLimiter.blocked(ip)) return sendJson(res, 429, { error: 'too_many_attempts' }, { 'Retry-After': '900' });
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!tokenMatches(token, config.adminToken)) {
      authFailLimiter.record(ip);
      return sendJson(res, 401, { error: 'unauthorized' }, { 'WWW-Authenticate': 'Bearer' });
    }
    const to = url.searchParams.get('to') || localDate();
    if (!isValidDate(to)) return sendJson(res, 400, { error: 'invalid_range' });
    const from = url.searchParams.get('from') || localDate(Date.parse(to + 'T00:00:00Z') - 27 * 86400000);
    if (!isValidDate(from) || from > to) return sendJson(res, 400, { error: 'invalid_range' });
    const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
    if (days > 400) return sendJson(res, 400, { error: 'range_too_long', message: 'Choose a range of 400 days or fewer.' });
    try {
      const report = await store.report(from, to);
      report.meta.env = config.env;
      report.meta.timezone = TIMEZONE;
      report.meta.retentionDays = config.retentionDays;
      return sendJson(res, 200, report);
    } catch (error) {
      log('report failed', error.message);
      return sendJson(res, 500, { error: 'report_failed' });
    }
  }

  async function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, baseHeaders({ Allow: 'GET, HEAD' }));
      return res.end();
    }
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch (error) {
      res.writeHead(400, baseHeaders());
      return res.end('Bad request');
    }
    if (pathname === '/admin') {
      res.writeHead(301, baseHeaders({ Location: '/admin/' }));
      return res.end();
    }
    // Backslashes are path separators on Windows and NUL bytes truncate paths:
    // neither belongs in a public URL.
    if (/[\\\0]/.test(pathname)) return notFound(res);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const relative = path.posix.normalize(pathname).replace(/^\/+/, '');
    const segments = relative.split('/');
    const filePath = path.resolve(config.staticRoot, relative);
    const inside = filePath.startsWith(config.staticRoot + path.sep);
    if (!inside || !PUBLIC_ENTRIES.has(segments[0]) || segments.some((s) => s.startsWith('.'))) return notFound(res);
    let info;
    try {
      info = await stat(filePath);
      if (!info.isFile()) return notFound(res);
    } catch (error) {
      return notFound(res);
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const etag = 'W/"' + info.size.toString(16) + '-' + Math.floor(info.mtimeMs).toString(16) + '"';
    const isHtml = ext === '.html';
    const cacheControl = segments[0] === 'assets' ? 'public, max-age=604800' : 'no-cache';
    const headers = baseHeaders({
      'Content-Type': type,
      'Cache-Control': cacheControl,
      ETag: etag,
      'Last-Modified': info.mtime.toUTCString(),
      Vary: 'Accept-Encoding'
    });
    if (isHtml) headers['Content-Security-Policy'] = csp;
    if (segments[0] === 'admin') headers['X-Robots-Tag'] = 'noindex, nofollow';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }
    const accept = String(req.headers['accept-encoding'] || '');
    const encoding =
      COMPRESSIBLE.has(ext) && info.size > 1024 ? (/\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : '') : '';
    let body;
    if (encoding) {
      const key = encoding + ':' + filePath + ':' + etag;
      body = compressedCache.get(key);
      if (!body) {
        const raw = await readFile(filePath);
        body =
          encoding === 'br' ? await brotli(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }) : await gzip(raw, { level: 9 });
        if (compressedCache.size > 200) compressedCache.clear();
        compressedCache.set(key, body);
      }
      headers['Content-Encoding'] = encoding;
    } else {
      body = await readFile(filePath);
      headers['Accept-Ranges'] = 'bytes';
      // Single byte ranges, which Safari requires before it will play a video.
      const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim());
      if (range && (range[1] || range[2])) {
        const size = body.length;
        const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        if (start >= size || start > end) {
          res.writeHead(416, baseHeaders({ 'Content-Range': 'bytes */' + size }));
          return res.end();
        }
        body = body.subarray(start, end + 1);
        headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size;
        headers['Content-Length'] = body.length;
        res.writeHead(206, headers);
        return res.end(req.method === 'HEAD' ? undefined : body);
      }
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  function notFound(res) {
    res.writeHead(404, baseHeaders({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }));
    res.end('Not found');
  }

  const server = http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch (error) {
      res.writeHead(400, baseHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
      res.end('Bad request');
      return;
    }
    try {
      if (url.pathname === '/api/collect') return await handleCollect(req, res);
      if (url.pathname === '/api/stats') return await handleStats(req, res, url);
      if (url.pathname === '/api/health') {
        return sendJson(res, 200, { ok: true, env: config.env, collecting: config.collect, statsConfigured, timezone: TIMEZONE });
      }
      if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'not_found' });
      return await serveStatic(req, res, url);
    } catch (error) {
      log('request failed', req.method, url.pathname, error.message);
      if (!res.headersSent) sendJson(res, 500, { error: 'server_error' });
      else res.end();
    }
  });

  server.on('close', () => clearInterval(pruneTimer));
  return { server, config, store, statsConfigured };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { server, config, statsConfigured } = await createServer();
  server.listen(config.port, config.host, () => {
    console.log(`Infinite Nutrition (${config.env}) → http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}/`);
    console.log(`  static root: ${config.staticRoot}`);
    console.log(`  analytics:   ${config.collect ? 'collecting' : 'collection off'} → ${path.join(config.dataDir, config.env)}`);
    console.log(`  dashboard:   /admin/ ${statsConfigured ? '(token configured)' : '(set ANALYTICS_ADMIN_TOKEN to enable reports)'}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
