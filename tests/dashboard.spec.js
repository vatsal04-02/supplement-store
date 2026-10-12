// Owner dashboard: access control, states and demo labelling.
const { test, expect } = require('@playwright/test');
const { watchProblems } = require('./helpers');

const TOKEN = 'test-admin-token-0123456789abcdef';

test('asks for a token and rejects a wrong one', async ({ page }) => {
  const problems = watchProblems(page, [/401/]);
  await page.goto('/admin/');
  await expect(page.locator('#connectPanel')).toBeVisible();
  await expect(page.locator('#reportPanel')).toBeHidden();
  await expect(page.locator('#signOut')).toBeHidden();
  await page.fill('#tokenInput', 'short');
  await page.click('#connectButton');
  await expect(page.locator('#connectError')).toContainText('at least 24 characters');
  await page.fill('#tokenInput', 'definitely-not-the-right-token-123');
  await page.click('#connectButton');
  await expect(page.locator('#connectError')).toHaveText('That access token was not accepted.');
  await expect(page.locator('#reportPanel')).toBeHidden();
  expect(problems).toEqual([]);
});

test('shows the live report with metric definitions after signing in', async ({ page }) => {
  const problems = watchProblems(page);
  await page.goto('/admin/');
  await page.fill('#tokenInput', TOKEN);
  await page.click('#connectButton');
  await expect(page.locator('#reportPanel')).toBeVisible();
  await expect(page.locator('#connectPanel')).toBeHidden();
  await expect(page.locator('.kpi')).toHaveCount(6);
  await expect(page.locator('#demoBanner')).toBeHidden();
  await expect(page.locator('.kpi-demo')).toHaveCount(0);
  await expect(page.locator('#envBadge')).toHaveText('Development');
  await expect(page.locator('#definitionsTitle')).toBeVisible();
  await expect(page.locator('#dataNotes')).toContainText('Orders, payments and revenue are not recorded');
  await expect(page.locator('#rangeSummary')).toContainText('compared with');
  // Token is tab-scoped and survives a reload; sign-out clears it.
  await page.reload();
  await expect(page.locator('#reportPanel')).toBeVisible();
  await page.click('#signOut');
  await expect(page.locator('#connectPanel')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('infinite-dashboard-token'))).toBeNull();
  expect(problems).toEqual([]);
});

test('an empty range says so instead of drawing empty charts', async ({ page }) => {
  await page.goto('/admin/');
  await page.fill('#tokenInput', TOKEN);
  await page.click('#connectButton');
  await expect(page.locator('#reportPanel')).toBeVisible();
  await page.locator('.preset-group label', { hasText: 'Custom' }).click();
  await page.fill('#fromDate', '2025-01-01');
  await page.fill('#toDate', '2025-01-07');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('#reportMessage')).toContainText('No events recorded between 1 Jan 2025 and 7 Jan 2025');
  await expect(page.locator('#trendTitle')).toBeHidden();
  await expect(page.locator('.kpi-value').first()).toHaveText('0');
});

test('reports a clear error when the API is unreachable', async ({ page }) => {
  await page.route('**/api/stats**', (route) => route.abort('connectionrefused'));
  await page.goto('/admin/');
  await page.fill('#tokenInput', TOKEN);
  await page.click('#connectButton');
  await expect(page.locator('#reportMessage')).toContainText('Could not reach the analytics API');
});

test('demo preview is labelled everywhere and is never mistaken for store data', async ({ page }) => {
  await page.goto('/admin/?demo=1');
  await expect(page.locator('#demoBanner')).toBeVisible();
  await expect(page.locator('#demoBanner')).toContainText('not Infinite Nutrition visits, enquiries or sales');
  await expect(page.locator('.kpi-demo')).toHaveCount(6);
  await expect(page.locator('#envBadge')).toHaveText('Demo data');
  await expect(page).toHaveTitle(/^Demo preview/);
  await expect(page.locator('#dataNotes')).toContainText('generated in this browser');
  // Chart interaction works by keyboard too.
  const chart = page.locator('.chart-surface').first();
  await chart.focus();
  await expect(page.locator('#chartTooltip')).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.locator('#chartTooltip .tt-row')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('#chartTooltip')).toBeHidden();
  // Every line chart has a table twin.
  await expect(page.locator('details.table-view')).toHaveCount(3);
  await page.click('#exitDemo');
  await expect(page.locator('#connectPanel')).toBeVisible();
});
