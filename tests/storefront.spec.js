// Page integrity at the six required viewport sizes.
const { test, expect } = require('@playwright/test');
const { VIEWPORTS, watchProblems, scrollThrough } = require('./helpers');

const ORIGINAL_SECTIONS = ['home', 'featured', 'categories', 'enquiry-process', 'catalogue', 'finder', 'reviews', 'authenticity', 'why', 'founder', 'visit', 'store-location', 'policies', 'faq'];

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('loads cleanly with every image and no horizontal overflow', async ({ page }) => {
      const problems = watchProblems(page);
      await page.goto('/');
      await scrollThrough(page);
      // Wait for rendered images only; lazy images inside the closed catalogue never load.
      await page.evaluate(() => Promise.all([...document.images].filter((img) => img.getClientRects().length && !img.complete)
        .map((img) => new Promise((resolve) => { img.addEventListener('load', resolve); img.addEventListener('error', resolve); setTimeout(resolve, 8000); }))));
      const broken = await page.evaluate(() => [...document.images].filter((img) => img.getClientRects().length && img.complete && img.naturalWidth === 0).map((img) => img.currentSrc || img.src));
      expect(broken).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(problems).toEqual([]);
    });

    test('display headings never split a word', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => { document.getElementById('catalogue').hidden = false; });
      const offenders = await page.evaluate(() => {
        const style = document.createElement('style');
        style.textContent = '*{overflow-wrap:normal!important;word-break:normal!important}';
        document.head.appendChild(style);
        return [...document.querySelectorAll('h1, h2, h3, .category-copy strong, .btn, .card-action')]
          .filter((el) => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1)
          .map((el) => el.textContent.trim().slice(0, 50));
      });
      expect(offenders).toEqual([]);
    });
  });
}

test('keeps every section of the original design in order', async ({ page }) => {
  await page.goto('/');
  const ids = await page.evaluate(() => [...document.querySelectorAll('main section[id], main [id="store-location"]')].map((s) => s.id));
  expect(ids).toEqual(ORIGINAL_SECTIONS);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveAccessibleName('Fuel the beast.');
});

test('hero heading and calls to action are visible immediately', async ({ page }) => {
  await page.goto('/');
  // Entrance motion starts from at least 78% opacity; nothing waits on a long animation.
  const opacity = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.hero-line > span, .editorial-hero .actions')].map((el) => Number(getComputedStyle(el).opacity))));
  expect(opacity).toBeGreaterThan(0.7);
  await expect(page.locator('.editorial-hero .actions .btn.primary')).toBeVisible();
});

test('products without a supplied photo show a placeholder stage, not a broken image', async ({ page }) => {
  await page.goto('/');
  const pending = page.locator('#featuredGrid .product-photo-pending');
  await expect(pending).toHaveCount(2);
  await expect(pending.first()).toHaveAttribute('aria-label', /awaiting upload/);
  await expect(page.locator('#featuredGrid .featured-card:has(.product-photo-pending) .product-photo-trust')).toHaveCount(0);
});

test('category tiles use real store photos or a typographic treatment', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.category-tile')).toHaveCount(7);
  await expect(page.locator('.category-store-primary')).toHaveCount(3);
  await expect(page.locator('.category-typographic')).toHaveCount(4);
  await expect(page.locator('.category-whey img')).toHaveAttribute('alt', /protein shelves inside Infinite Nutrition/);
});

test('the hero settles: no infinite decorative animation remains', async ({ page }) => {
  await page.goto('/');
  const infinite = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.editorial-hero *')) {
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        if (cs.animationName !== 'none' && cs.animationIterationCount.includes('infinite')) out.push((el.className || el.tagName) + (pseudo || ''));
      }
    }
    return out;
  });
  expect(infinite).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('disables hero and reveal animation', async ({ page }) => {
    await page.goto('/');
    const running = await page.evaluate(() => [...document.querySelectorAll('.editorial-hero *, .reveal-target')].filter((el) => getComputedStyle(el).animationName !== 'none').length);
    expect(running).toBe(0);
    await expect(page.locator('body')).not.toHaveClass(/motion-ready/);
  });
});
