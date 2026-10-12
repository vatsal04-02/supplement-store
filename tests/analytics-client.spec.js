// Storefront analytics behaviour: schema, de-duplication, privacy signals and transport.
const { test, expect } = require('@playwright/test');
const { instrument, events, openCatalogue, watchProblems } = require('./helpers');

test('page_view fires exactly once and featured list views are recorded once', async ({ page }) => {
  await instrument(page);
  await page.goto('/');
  await page.mouse.wheel(0, 1800);
  await page.waitForTimeout(400);
  await page.mouse.wheel(0, -1800);
  await page.mouse.wheel(0, 1800);
  await page.waitForTimeout(400);
  expect(await events(page, 'page_view')).toHaveLength(1);
  expect((await events(page, 'view_item_list')).filter((e) => e.params.item_list_id === 'featured')).toHaveLength(1);
});

test('only schema events with allow-listed parameters leave the page', async ({ page }) => {
  await instrument(page);
  await page.goto('/');
  const result = await page.evaluate(() => [
    window.InfiniteAnalytics.track('purchase', { value: 999 }),
    window.InfiniteAnalytics.track('begin_checkout', {}),
    window.InfiniteAnalytics.track('search', { search_term: 'whey', email: 'a@b.c', phone: '9999999999', results_count: 0 })
  ]);
  expect(result).toEqual([false, false, true]);
  const [search] = await events(page, 'search');
  expect(search.params).toEqual({ search_term: 'whey', results_count: 0 });
});

test('events are delivered to the first-party collector in batches', async ({ page }) => {
  const batches = [];
  await page.route('**/api/collect', async (route) => {
    batches.push(JSON.parse(route.request().postData()));
    await route.fulfill({ status: 204 });
  });
  await page.goto('/');
  await openCatalogue(page);
  await page.evaluate(() => window.InfiniteAnalytics.flush());
  await expect.poll(() => batches.length).toBeGreaterThan(0);
  const all = batches.flatMap((b) => b.events);
  expect(batches[0]).toMatchObject({ v: 1, sid: expect.stringMatching(/^[a-f0-9]{16}$/) });
  expect(all.map((e) => e.name)).toEqual(expect.arrayContaining(['page_view', 'view_item_list']));
  expect(JSON.stringify(batches)).not.toMatch(/cookie|userAgent|ip/i);
});

test('an unreachable collector never breaks the page', async ({ page }) => {
  const problems = watchProblems(page, [/api\/collect/, /Failed to load resource/]);
  await instrument(page);
  await page.route('**/api/collect', (route) => route.abort('connectionfailed'));
  await page.goto('/');
  await openCatalogue(page);
  await page.locator('.product-card [data-add]').first().click();
  await page.evaluate(() => window.InfiniteAnalytics.flush());
  await expect(page.locator('#cartCount')).toHaveText('1');
  expect(problems).toEqual([]);
});

test.describe('Global Privacy Control', () => {
  test('is honoured: no events, no collector requests', async ({ page }) => {
    let requests = 0;
    await page.route('**/api/collect', (route) => { requests++; return route.fulfill({ status: 204 }); });
    await page.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }));
    await instrument(page);
    await page.goto('/');
    await openCatalogue(page);
    await page.evaluate(() => window.InfiniteAnalytics.flush());
    await page.waitForTimeout(300);
    expect(await events(page)).toEqual([]);
    expect(requests).toBe(0);
    expect(await page.evaluate(() => window.InfiniteAnalytics.getState().privacySignal)).toBe(true);
  });
});

test('Google Analytics is never loaded without a measurement ID and consent', async ({ page }) => {
  const thirdParty = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1')) thirdParty.push(request.url()); });
  await page.goto('/');
  await openCatalogue(page);
  await expect(page.locator('#consentBanner')).toBeHidden();
  expect(thirdParty).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).toBe('');
});

test('with a GA4 ID configured, the banner asks first and declining keeps Google out', async ({ page }) => {
  const google = [];
  page.on('request', (request) => { if (/googletagmanager|google-analytics/.test(request.url())) google.push(request.url()); });
  await page.route('**/js/site-config.js', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace("ga4MeasurementId: ''", "ga4MeasurementId: 'G-TEST1234'") });
  });
  await page.goto('/');
  await expect(page.locator('#consentBanner')).toBeVisible();
  await page.locator('[data-consent="deny"]').click();
  await expect(page.locator('#consentBanner')).toBeHidden();
  await page.reload();
  await expect(page.locator('#consentBanner')).toBeHidden();
  expect(google).toEqual([]);
  expect(await page.evaluate(() => window.InfiniteAnalytics.getState().ga4Consent)).toBe('denied');
});
