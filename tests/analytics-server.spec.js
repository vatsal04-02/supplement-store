// First-party analytics API and report aggregation.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TOKEN = 'test-admin-token-0123456789abcdef';
const UA = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  'Content-Type': 'text/plain;charset=UTF-8'
};

function sid() {
  return [...Array(16)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

test('collector validates payloads and rejects cross-site posts', async ({ request }) => {
  expect((await request.get('/api/collect')).status()).toBe(405);
  expect((await request.post('/api/collect', { headers: UA, data: '{nope' })).status()).toBe(400);
  expect((await request.post('/api/collect', { headers: UA, data: JSON.stringify({ v: 1, sid: 'short', events: [] }) })).status()).toBe(
    400
  );
  expect(
    (
      await request.post('/api/collect', {
        headers: { ...UA, Origin: 'https://attacker.example' },
        data: JSON.stringify({ v: 1, sid: sid(), events: [{ name: 'page_view' }] })
      })
    ).status()
  ).toBe(403);
  const big = JSON.stringify({ v: 1, sid: sid(), events: [{ name: 'page_view', params: { item_name: 'x'.repeat(40000) } }] });
  expect((await request.post('/api/collect', { headers: UA, data: big })).status()).toBe(413);
  const mixed = await request.post('/api/collect', {
    headers: UA,
    data: JSON.stringify({
      v: 1,
      sid: sid(),
      events: [
        { name: 'page_view', path: '/' },
        { name: 'purchase', params: { value: 10 } }
      ]
    })
  });
  expect(mixed.status()).toBe(204);
  expect(mixed.headers()['x-events-rejected']).toBe('1');
});

test('reports require the owner token', async ({ request }) => {
  expect((await request.get('/api/stats')).status()).toBe(401);
  expect((await request.get('/api/stats', { headers: { Authorization: 'Bearer wrong-token-wrong-token-wrong' } })).status()).toBe(401);
  const ok = await request.get('/api/stats', { headers: { Authorization: 'Bearer ' + TOKEN } });
  expect(ok.status()).toBe(200);
  expect(ok.headers()['cache-control']).toBe('no-store');
  expect((await request.get('/api/stats?from=2026-02-30&to=2026-03-01', { headers: { Authorization: 'Bearer ' + TOKEN } })).status()).toBe(
    400
  );
  expect((await request.get('/api/stats?from=2024-01-01&to=2026-01-01', { headers: { Authorization: 'Bearer ' + TOKEN } })).status()).toBe(
    400
  );
});

test('server never serves source, data or package files', async ({ request }) => {
  for (const url of [
    '/package.json',
    '/server/server.mjs',
    '/data/',
    '/tests/helpers.js',
    '/.git/config',
    '/docs/',
    '/node_modules/esbuild/package.json',
    '/assets/../server/server.mjs'
  ]) {
    expect((await request.get(url)).status(), url).toBe(404);
  }
  const home = await request.get('/');
  expect(home.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(home.headers()['x-content-type-options']).toBe('nosniff');
  expect((await request.get('/admin/')).headers()['x-robots-tag']).toBe('noindex, nofollow');
});

test('browser and server share one event schema module', async () => {
  const shared = require('../js/analytics-schema.js');
  const { EVENT_NAMES, PARAM_RULES, sanitizeParams } = await import('../server/event-schema.mjs');
  expect(EVENT_NAMES).toEqual(Object.keys(shared.EVENT_SCHEMA));
  expect(PARAM_RULES).toBe(shared.PARAM_RULES);
  expect(sanitizeParams).toBe(shared.sanitizeParams);
  // The browser layer must not keep its own copy of the rules.
  const client = fs.readFileSync(path.join(__dirname, '..', 'js', 'analytics.js'), 'utf8');
  expect(client).toContain('window.InfiniteAnalyticsSchema');
  expect(client).not.toMatch(/PARAM_RULES\s*=\s*\{/);
});

test('report aggregation counts sessions, funnel steps and searches correctly', async () => {
  const { createAnalyticsStore, localDate } = await import('../server/analytics-store.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'in-analytics-'));
  const store = createAnalyticsStore({ dataDir: dir, env: 'test' });
  const now = new Date().toISOString();
  const today = localDate();
  const rec = (s, n, p = {}, extra = {}) => ({ t: now, n, p, s, v: 'v-' + s, path: '/', d: 'mobile', ...extra });
  await store.append([
    rec('a', 'page_view', {}, { ref: 'google.com' }),
    rec('a', 'view_item', { item_id: 'wellcore-micronised-creatine', item_category: 'creatine' }),
    rec('a', 'add_to_cart', { item_id: 'wellcore-micronised-creatine', item_category: 'creatine', quantity: 3 }),
    rec('a', 'click_whatsapp', { source: 'order_list', context: 'order_list', contact: 'primary' }),
    rec('b', 'page_view'),
    rec('b', 'search', { search_term: 'whey', results_count: 0 }),
    rec('b', 'search', { search_term: 'whey', results_count: 0 }),
    rec('b', 'search', { search_term: 'creatine', results_count: 2 }),
    rec('b', 'filter_products', { filter_type: 'category', filter_value: 'creatine' }),
    rec('c', 'page_view', {}, { us: 'instagram' }),
    rec('c', 'view_item', { item_id: 'qnt-l-carnitine-liquid-formula', item_category: 'other' }),
    rec('c', 'contact_store', { method: 'phone', contact: 'secondary' })
  ]);
  fs.appendFileSync(path.join(dir, 'test', today + '.ndjson'), '{"broken json\n');
  const report = await store.report(today, today);
  expect(report.totals).toMatchObject({
    sessions: 3,
    visitors: 3,
    pageViews: 3,
    productViews: 2,
    addToCartUnits: 3,
    whatsappClicks: 1,
    phoneClicks: 1,
    searches: 3,
    searchesNoResults: 2
  });
  expect(report.funnel.map((s) => s.count)).toEqual([3, 2, 1, 1]);
  expect(report.rates.addToListRate).toEqual({ numerator: 1, denominator: 3, value: 1 / 3 });
  expect(report.searches.noResults).toEqual([{ term: 'whey', count: 2 }]);
  expect(report.sources).toEqual(
    expect.arrayContaining([
      { name: 'google.com', sessions: 1 },
      { name: 'utm:instagram', sessions: 1 },
      { name: 'direct', sessions: 1 }
    ])
  );
  expect(report.categories.find((c) => c.id === 'creatine')).toMatchObject({ filterUses: 1, productViews: 1, addUnits: 3 });
  expect(report.daily).toHaveLength(1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('stored records contain no IP address or user agent and are dropped after the retention period', async () => {
  const { createAnalyticsStore, localDate } = await import('../server/analytics-store.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'in-analytics-'));
  const store = createAnalyticsStore({ dataDir: dir, env: 'test', retentionDays: 30 });
  const key = store.visitorKey(localDate(), '203.0.113.9', 'Mozilla/5.0 Test');
  expect(key).toMatch(/^[a-f0-9]{16}$/);
  expect(store.visitorKey(localDate(), '203.0.113.9', 'Mozilla/5.0 Test')).toBe(key);
  await store.append([{ t: new Date().toISOString(), n: 'page_view', p: {}, s: 'abc', v: key, path: '/', d: 'desktop' }]);
  const contents = fs.readFileSync(path.join(dir, 'test', localDate() + '.ndjson'), 'utf8');
  expect(contents).not.toContain('203.0.113.9');
  expect(contents).not.toContain('Mozilla');
  fs.writeFileSync(path.join(dir, 'test', '2020-01-01.ndjson'), '');
  expect(await store.prune()).toBe(1);
  expect(fs.existsSync(path.join(dir, 'test', localDate() + '.ndjson'))).toBe(true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a real browser visit reaches the report', async ({ page, request }) => {
  const { localDate } = await import('../server/analytics-store.mjs');
  const today = localDate();
  const before = await (
    await request.get(`/api/stats?from=${today}&to=${today}`, { headers: { Authorization: 'Bearer ' + TOKEN } })
  ).json();
  await page.goto('/');
  await page.locator('.category-creatine').click();
  await page.evaluate(() => window.InfiniteAnalytics.flush());
  await expect
    .poll(async () => {
      const after = await (
        await request.get(`/api/stats?from=${today}&to=${today}`, { headers: { Authorization: 'Bearer ' + TOKEN } })
      ).json();
      return after.totals.pageViews - before.totals.pageViews;
    })
    .toBeGreaterThanOrEqual(1);
});

test('a malformed request target does not take the server down', async ({ request }) => {
  const net = require('node:net');
  const raw = await new Promise((resolve) => {
    const socket = net.connect(4173, '127.0.0.1', () => socket.write('GET //[ HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n'));
    let data = '';
    socket.on('data', (chunk) => (data += chunk));
    socket.on('close', () => resolve(data));
    socket.on('error', () => resolve(data));
  });
  expect(raw).toMatch(/^HTTP\/1\.1 400/);
  expect((await request.get('/api/health')).status()).toBe(200);
});

test('unusual paths and dates are rejected cleanly', async ({ request }) => {
  expect((await request.get('/assets/x%5C..%5C..%5Cserver%5Cserver.mjs')).status()).toBe(404);
  expect((await request.get('/assets/%00.png')).status()).toBe(404);
  expect((await request.get('/api/stats?to=garbage', { headers: { Authorization: 'Bearer ' + TOKEN } })).status()).toBe(400);
});

test('locked-out clients are refused even with the right token', async () => {
  const { createServer } = await import('../server/server.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'in-lockout-'));
  const { server } = await createServer({ port: 0, host: '127.0.0.1', dataDir: dir, adminToken: TOKEN, quiet: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (let i = 0; i < 10; i++) {
      expect((await fetch(base + '/api/stats', { headers: { Authorization: 'Bearer wrong-token-wrong-token-' + i } })).status).toBe(401);
    }
    expect((await fetch(base + '/api/stats', { headers: { Authorization: 'Bearer ' + TOKEN } })).status).toBe(429);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('behind a proxy the client address comes from the trusted end of X-Forwarded-For', async () => {
  const { clientIp } = await import('../server/server.mjs');
  const req = (xff) => ({ headers: { 'x-forwarded-for': xff }, socket: { remoteAddress: '10.0.0.1' } });
  expect(clientIp(req('6.6.6.6, 203.0.113.7'), { trustProxy: 1 })).toBe('203.0.113.7');
  expect(clientIp(req('6.6.6.6, 203.0.113.7, 10.0.0.2'), { trustProxy: 2 })).toBe('203.0.113.7');
  expect(clientIp(req('6.6.6.6'), { trustProxy: 0 })).toBe('10.0.0.1');
});

test('behind a proxy that rewrites Host, X-Forwarded-Host and ALLOWED_ORIGINS are accepted', async () => {
  const { createServer } = await import('../server/server.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'in-proxy-'));
  const { server } = await createServer({ dataDir: dir, quiet: true, trustProxy: 1, allowedOrigins: ['https://other.example'] });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (headers) =>
    fetch(base + '/api/collect', {
      method: 'POST',
      headers: { ...UA, ...headers },
      body: JSON.stringify({ v: 1, sid: sid(), events: [{ name: 'page_view', path: '/' }] })
    });
  try {
    expect(
      (await post({ Origin: 'https://shop.example', 'X-Forwarded-Host': 'shop.example', 'X-Forwarded-For': '203.0.113.5' })).status
    ).toBe(204);
    expect((await post({ Origin: 'https://other.example', 'X-Forwarded-For': '203.0.113.5' })).status).toBe(204);
    expect((await post({ Origin: 'https://evil.example', 'X-Forwarded-For': '203.0.113.5' })).status).toBe(403);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('one failed write does not block later writes', async () => {
  const { createAnalyticsStore } = await import('../server/analytics-store.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'in-writes-'));
  const store = createAnalyticsStore({ dataDir: dir, env: 'test' });
  const record = { t: new Date().toISOString(), n: 'page_view', p: {}, s: 'a', v: 'b', path: '/', d: 'mobile' };
  await store.append([record]);
  fs.rmSync(path.join(dir, 'test'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'test'), 'not a directory');
  await expect(store.append([record])).rejects.toThrow();
  fs.rmSync(path.join(dir, 'test'));
  await expect(store.append([record])).resolves.toBeUndefined();
  fs.rmSync(dir, { recursive: true, force: true });
});
