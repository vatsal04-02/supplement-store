// Motion that depends on the visitor allowing animation.
const { test, expect } = require('@playwright/test');

test.use({ contextOptions: { reducedMotion: 'no-preference' }, viewport: { width: 1440, height: 900 } });

test('featured cards and category tiles lift on hover', async ({ page }) => {
  await page.goto('/');
  for (const selector of ['.featured-card >> nth=1', '.category-tile >> nth=0']) {
    const item = page.locator(selector);
    await item.scrollIntoViewIfNeeded();
    await item.hover();
    await expect.poll(() => item.evaluate((el) => getComputedStyle(el).transform)).toMatch(/matrix\(1, 0, 0, 1, 0, -4\)/);
  }
});

test('scroll reveals never hide content, even after an instant jump', async ({ page }) => {
  await page.goto('/');
  const targets = page.locator('.reveal-target');
  expect(await targets.count()).toBeGreaterThan(10);
  // Nothing waits for a script or a timer to become visible.
  const hidden = await targets.evaluateAll((list) => list.filter((el) => Number(getComputedStyle(el).opacity) < 1).length);
  expect(hidden).toBe(0);
  // Jump far down the page without scrolling through it (a fast fling).
  await page.evaluate(() => window.scrollTo({ top: document.getElementById('founder').offsetTop, behavior: 'instant' }));
  const inView = await page.evaluate(() =>
    [...document.querySelectorAll('.reveal-target')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
      })
      .map((el) => {
        const cs = getComputedStyle(el);
        const offset = cs.translate === 'none' ? 0 : Math.max(...cs.translate.split(' ').map((v) => Math.abs(parseFloat(v))));
        return { opacity: Number(cs.opacity), offset };
      })
  );
  expect(inView.length).toBeGreaterThan(0);
  for (const item of inView) {
    expect(item.opacity).toBe(1);
    expect(item.offset).toBeLessThanOrEqual(18);
  }
});
