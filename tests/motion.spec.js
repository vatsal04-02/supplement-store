// Motion that depends on the visitor allowing animation.
const { test, expect } = require('@playwright/test');

test.use({ contextOptions: { reducedMotion: 'no-preference' }, viewport: { width: 1440, height: 900 } });

test('featured cards and category tiles lift on hover once revealed', async ({ page }) => {
  await page.goto('/');
  for (const selector of ['.featured-card >> nth=1', '.category-tile >> nth=0']) {
    const item = page.locator(selector);
    await item.scrollIntoViewIfNeeded();
    await expect(item).toHaveClass(/reveal-done/, { timeout: 4000 });
    await item.hover();
    await expect.poll(() => item.evaluate((el) => getComputedStyle(el).transform)).toMatch(/matrix\(1, 0, 0, 1, 0, -4\)/);
  }
});

test('scroll reveals are subtle and never hide content', async ({ page }) => {
  await page.goto('/');
  const opacities = await page.evaluate(() =>
    [...document.querySelectorAll('.reveal-target:not(.in-view)')].map((el) => Number(getComputedStyle(el).opacity))
  );
  expect(opacities.length).toBeGreaterThan(10);
  expect(Math.min(...opacities)).toBeGreaterThanOrEqual(0.9);
});
