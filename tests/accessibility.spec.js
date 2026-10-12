// Automated WCAG 2.1 A/AA checks with axe-core, in the states customers actually see.
const { test, expect } = require('@playwright/test');
const { default: AxeBuilder } = require('@axe-core/playwright');
const { instrument, openCatalogue } = require('./helpers');

async function scan(page, include) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include) builder.include(include);
  const results = await builder.analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
}

test.beforeEach(async ({ page }) => {
  await instrument(page);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`storefront at ${viewport.width}px has no serious or critical violations`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await openCatalogue(page);
    expect(await scan(page)).toEqual([]);
  });
}

test('order list drawer has no serious or critical violations', async ({ page }) => {
  await page.goto('/');
  await openCatalogue(page);
  await page.locator('.product-card [data-add]').first().click();
  await page.locator('.site-nav .cart-open').click();
  await expect(page.locator('#cartBackdrop')).toHaveClass(/open/);
  expect(await scan(page, '#cartBackdrop')).toEqual([]);
});

test('product details dialog has no serious or critical violations', async ({ page }) => {
  await page.goto('/');
  await openCatalogue(page);
  await page.locator('.product-card [data-details]').first().click();
  await expect(page.locator('#modalBackdrop')).toHaveClass(/open/);
  expect(await scan(page, '#modalBackdrop')).toEqual([]);
});

test('owner dashboard (demo) has no serious or critical violations', async ({ page }) => {
  await page.goto('/admin/?demo=1');
  await expect(page.locator('.kpi')).toHaveCount(6);
  expect(await scan(page)).toEqual([]);
});

test('owner dashboard sign-in has no serious or critical violations', async ({ page }) => {
  await page.goto('/admin/');
  expect(await scan(page)).toEqual([]);
});
