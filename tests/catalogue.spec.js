// Product discovery: catalogue opening, category/brand filters, search, sort and empty states.
const { test, expect } = require('@playwright/test');
const { instrument, events, openCatalogue, decodeWhatsApp, watchProblems } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await instrument(page);
});

test('catalogue opens from navigation and lists every catalogued product', async ({ page }) => {
  const problems = watchProblems(page);
  await page.goto('/');
  await expect(page.locator('#catalogue')).toBeHidden();
  await openCatalogue(page);
  await expect(page).toHaveURL(/#catalogue$/);
  await expect(page.locator('#productGrid .product-card')).toHaveCount(4);
  await expect(page.locator('#catalogueMeta')).toContainText('4 products shown');
  const list = await events(page, 'view_item_list');
  expect(list.map((e) => e.params.item_list_id)).toContain('catalogue');
  expect(problems).toEqual([]);
});

test('a #catalogue link opens the catalogue on load', async ({ page }) => {
  await page.goto('/#catalogue');
  await expect(page.locator('#catalogue')).toBeVisible();
});

test('category tile filters the catalogue and records the filter', async ({ page }) => {
  await page.goto('/');
  await page.locator('.category-creatine').click();
  await expect(page.locator('#catalogue')).toBeVisible();
  await expect(page.locator('#productGrid .product-card')).toHaveCount(2);
  await expect(page.locator('.filter[data-filter="creatine"]')).toHaveAttribute('aria-pressed', 'true');
  const filters = await events(page, 'filter_products');
  expect(filters.at(-1).params).toMatchObject({ filter_type: 'category', filter_value: 'creatine', source: 'category_tile', results_count: 2 });
});

test('a category with nothing listed explains why and offers a prepared WhatsApp question', async ({ page }) => {
  await page.goto('/');
  await page.locator('.category-preworkout').click();
  await expect(page.locator('#emptySearch')).toBeVisible();
  await expect(page.locator('#productGrid')).toBeHidden();
  await expect(page.locator('#emptySearchTitle')).toHaveText('Pre-workout products are not listed individually yet.');
  const href = await page.locator('#emptyEnquiry').getAttribute('href');
  const message = decodeWhatsApp(href);
  expect(message.number).toBe('918840427558');
  expect(message.text).toContain('which pre-workout products do you currently have');
  expect(message.text).toContain('not a confirmed order');
});

test('search narrows results, shows a no-match state and records the search once', async ({ page }) => {
  await page.goto('/');
  await openCatalogue(page);
  const search = page.locator('#productSearch');
  await search.fill('wellcore');
  await expect(page.locator('#productGrid .product-card')).toHaveCount(1);
  await expect(page.locator('#clearSearch')).toBeVisible();
  await search.press('Enter');
  await search.fill('isolate');
  await expect(page.locator('#emptySearch')).toBeVisible();
  await expect(page.locator('#emptySearchTitle')).toContainText('search “isolate”');
  await search.press('Enter');
  await search.press('Enter');
  const searches = await events(page, 'search');
  expect(searches.map((e) => [e.params.search_term, e.params.results_count])).toEqual([['wellcore', 1], ['isolate', 0]]);
  await page.locator('#clearSearch').click();
  await expect(page.locator('#productGrid .product-card')).toHaveCount(4);
  await expect(search).toBeFocused();
});

test('search terms are scrubbed of e-mail addresses and phone numbers before they are recorded', async ({ page }) => {
  await page.goto('/');
  await openCatalogue(page);
  await page.locator('#productSearch').fill('call me 98765 43210 or me@example.com');
  await page.locator('#productSearch').press('Enter');
  const [search] = await events(page, 'search');
  expect(search.params.search_term).toBe('call me [number] or [email]');
});

test('brand filter, sort and reset work together with context chips', async ({ page }) => {
  await page.goto('/');
  await openCatalogue(page);
  await page.locator('#brandFilter').selectOption('pintola');
  await expect(page.locator('#productGrid .product-card')).toHaveCount(1);
  await expect(page.locator('#catalogueMeta .context-chip')).toContainText('Pintola');
  await page.locator('[data-clear-context="brand"]').click();
  await expect(page.locator('#productGrid .product-card')).toHaveCount(4);
  await page.locator('#sortProducts').selectOption('name');
  const names = await page.locator('#productGrid .product-card h3').allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  await page.locator('.filter[data-filter="other"]').click();
  await expect(page.locator('#productGrid .product-card')).toHaveCount(2);
  await page.locator('#resetFilters').click();
  await expect(page.locator('#productGrid .product-card')).toHaveCount(4);
  await expect(page.locator('#sortProducts')).toHaveValue('featured');
  await expect(page.locator('.filter[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
});

test('price sorting keeps unconfirmed prices in featured order instead of inventing values', async ({ page }) => {
  await page.goto('/');
  await openCatalogue(page);
  const before = await page.locator('#productGrid .product-card').evaluateAll((cards) => cards.map((c) => c.dataset.id));
  await page.locator('#sortProducts').selectOption('price-asc');
  const after = await page.locator('#productGrid .product-card').evaluateAll((cards) => cards.map((c) => c.dataset.id));
  expect(after).toEqual(before);
  await expect(page.locator('#productGrid .selling-price')).toHaveCount(0);
  await expect(page.locator('#productGrid .product-pending').first()).toHaveText('Store confirmation required');
});

test('goal finder routes to a category', async ({ page }) => {
  await page.goto('/');
  await page.locator('.choice', { hasText: 'Workout performance' }).click();
  await expect(page.locator('#resultTitle')).toHaveText('Pre-workout & amino acids');
  await page.locator('#finderBrowse').click();
  await expect(page.locator('#catalogue')).toBeVisible();
  await expect(page.locator('.filter[data-filter="preworkout"]')).toHaveAttribute('aria-pressed', 'true');
});
