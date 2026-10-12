// Page integrity at the six required viewport sizes.
const { test, expect } = require('@playwright/test');
const { VIEWPORTS, watchProblems, scrollThrough, useReviewMode } = require('./helpers');

const ORIGINAL_SECTIONS = [
  'home',
  'featured',
  'categories',
  'enquiry-process',
  'catalogue',
  'finder',
  'reviews',
  'authenticity',
  'why',
  'founder',
  'visit',
  'store-location',
  'policies',
  'faq'
];

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('loads cleanly with every image and no horizontal overflow', async ({ page }) => {
      const problems = watchProblems(page);
      await page.goto('/');
      await scrollThrough(page);
      // Wait for rendered images only; lazy images inside the closed catalogue never load.
      await page.evaluate(() =>
        Promise.all(
          [...document.images]
            .filter((img) => img.getClientRects().length && !img.complete)
            .map(
              (img) =>
                new Promise((resolve) => {
                  img.addEventListener('load', resolve);
                  img.addEventListener('error', resolve);
                  setTimeout(resolve, 8000);
                })
            )
        )
      );
      const broken = await page.evaluate(() =>
        [...document.images]
          .filter((img) => img.getClientRects().length && img.complete && img.naturalWidth === 0)
          .map((img) => img.currentSrc || img.src)
      );
      expect(broken).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(problems).toEqual([]);
    });

    test('display headings and dialog titles fit their longest word with a 4% margin', async ({ page }) => {
      // System fonts differ by a few percent across devices, so a word that only
      // just fits here would split elsewhere (the original "NUTRITI / ON." bug).
      const check = (selector) =>
        page.evaluate((sel) => {
          const out = [];
          for (const el of document.querySelectorAll(sel)) {
            if (!el.getClientRects().length || !el.clientWidth) continue;
            // Hyphens are legitimate break points ("Pre- / workout"), so test the parts.
            for (const word of el.textContent
              .trim()
              .split(/\s+/)
              .flatMap((w) => w.split(/(?<=-)/))) {
              // A custom element, so the site's own span rules cannot restyle the probe.
              const probe = document.createElement('x-probe');
              probe.textContent = word;
              probe.style.setProperty('white-space', 'nowrap', 'important');
              probe.style.setProperty('display', 'inline', 'important');
              el.appendChild(probe);
              const width = probe.getBoundingClientRect().width;
              probe.remove();
              if (width > el.clientWidth * 0.96) out.push(word + ' (' + Math.round(width) + '/' + el.clientWidth + ')');
            }
          }
          return out;
        }, selector);
      await page.goto('/#catalogue');
      expect(await check('main h2, main h3, .category-copy strong')).toEqual([]);
      // The hero lines never wrap by design; they must stay inside the copy column.
      const heroOverflow = await page.evaluate(() => {
        const column = document.querySelector('.hero-copy').getBoundingClientRect();
        return [...document.querySelectorAll('.hero-line > span')].filter((line) => line.getBoundingClientRect().right > column.right + 1)
          .length;
      });
      expect(heroOverflow).toBe(0);
      await page.locator('.product-card[data-id="wellcore-micronised-creatine"] [data-details]').click();
      await expect(page.locator('#modalBackdrop')).toHaveClass(/open/);
      expect(await check('.modal-head h2')).toEqual([]);
      await page.keyboard.press('Escape');
      await page.locator('.site-nav .cart-open').click();
      expect(await check('.drawer-head h2')).toEqual([]);
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
  const opacity = await page.evaluate(() =>
    Math.min(
      ...[...document.querySelectorAll('.hero-line > span, .editorial-hero .actions')].map((el) => Number(getComputedStyle(el).opacity))
    )
  );
  expect(opacity).toBeGreaterThan(0.7);
  await expect(page.locator('.editorial-hero .actions .btn.primary')).toBeVisible();
});

test('the featured range shows only photographed products, then the format panel', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#featuredGrid .featured-card')).toHaveCount(2);
  await expect(page.locator('#featuredGrid .product-photo-pending')).toHaveCount(0);
  await expect(page.locator('#featuredGrid .product-photo-trust')).toHaveCount(2);
  // "Explore by format" follows the product grid.
  const order = await page.evaluate(() => [...document.querySelector('#featured .wrap').children].map((el) => el.className.split(' ')[0]));
  expect(order.indexOf('featured-grid')).toBeLessThan(order.indexOf('featured-editorial'));
  // Two cards fill their row: no empty grid column beside them.
  await page.setViewportSize({ width: 1440, height: 900 });
  const widths = await page.evaluate(() => {
    const grid = document.querySelector('#featuredGrid').getBoundingClientRect();
    const cards = [...document.querySelectorAll('#featuredGrid .featured-card')].map((c) => c.getBoundingClientRect());
    return { grid: Math.round(grid.right), last: Math.round(cards.at(-1).right) };
  });
  expect(Math.abs(widths.grid - widths.last)).toBeLessThanOrEqual(1);
});

test('review mode shows products awaiting a photo as a placeholder stage, not a broken image', async ({ page }) => {
  await useReviewMode(page);
  await page.goto('/');
  const pending = page.locator('#featuredGrid .product-photo-pending');
  await expect(pending).toHaveCount(2);
  await expect(pending.first()).toContainText('Store photo coming soon');
  await expect(page.locator('#featuredGrid .featured-photo').nth(2)).toHaveAccessibleName(/^Pintola store photo coming soon/);
  await expect(page.locator('#featuredGrid .featured-card:has(.product-photo-pending) .product-photo-trust')).toHaveCount(0);
});

test('all seven category tiles share one card design and never show "0 listed"', async ({ page }) => {
  await page.goto('/');
  const tiles = page.locator('.category-tile');
  await expect(tiles).toHaveCount(7);
  await expect(page.locator('.category-photo.category-store-primary')).toHaveCount(3);
  await expect(page.locator('.category-gradient .category-icon')).toHaveCount(4);
  await expect(page.locator('.category-mark, .category-typographic')).toHaveCount(0);
  await expect(page.locator('.category-whey img')).toHaveAttribute('alt', /protein shelves inside Infinite Nutrition/);
  const counts = await page.locator('.category-count').allTextContents();
  expect(counts.filter((text) => /^0\b/.test(text))).toEqual([]);
  expect(counts).toContain('2 listed');
  expect(counts.filter((text) => text === 'Ask in store')).toHaveLength(6);
  for (const width of [1440, 900, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await tiles.evaluateAll((list) => list.map((t) => Math.round(t.offsetWidth) + 'x' + Math.round(t.offsetHeight)));
    expect(new Set(sizes).size, `tile sizes at ${width}px: ${sizes}`).toBe(1);
  }
});

test('exactly three sections are light: reviews, why and visit', async ({ page }) => {
  await page.goto('/');
  const light = await page.evaluate(() =>
    [...document.querySelectorAll('main > section')]
      .filter((s) => !s.hidden && getComputedStyle(s).backgroundColor === 'rgb(244, 244, 244)')
      .map((s) => s.id)
  );
  expect(light).toEqual(['reviews', 'why', 'visit']);
});

test('headlines match the agreed copy, with kickers on key sections only', async ({ page }) => {
  await page.goto('/');
  const heads = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('main > section:not(.hero)')]
        .filter((s) => !s.hidden)
        .map((s) => [s.id || s.className.split(' ')[0], s.querySelector('h2').textContent.trim()])
    )
  );
  expect(heads).toEqual({
    featured: 'Featured range.',
    categories: 'Shop by category.',
    'flavour-editorial': 'Read the label.',
    'enquiry-process': 'How it works.',
    finder: 'Start with your goal.',
    reviews: 'Reviews.',
    authenticity: 'Verify before you use.',
    why: 'Why Infinite Nutrition.',
    founder: 'Built on strength. Driven by purpose.',
    visit: 'Visit the store.',
    policies: 'Store policies.',
    faq: 'FAQ.'
  });
  await expect(page.locator('.reviews-tagline')).toHaveText('No fake reviews. Ever.');
  await expect(page.locator('.honest-note strong')).toHaveText('Before you enquire.');
  // Removed: the redundant location headline and the second founder headline.
  await expect(page.locator('#store-location h3, .founder-training h3')).toHaveCount(0);
  const kickers = await page.locator('main .eyebrow').evaluateAll((list) => list.map((k) => k.closest('section').id));
  expect(kickers).toEqual(['home', 'authenticity', 'founder']);
  const result = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('main > section:not(.hero)')].filter((s) => !s.hidden);
    return [...new Set(sections.map((s) => getComputedStyle(s.querySelector('h2')).fontSize))].map(parseFloat);
  });
  // Column-width caps (to keep long words whole) may shave a few pixels.
  expect(Math.max(...result) - Math.min(...result)).toBeLessThanOrEqual(8);
});

test('one primary call to action per section and one honest-store note', async ({ page }) => {
  await page.goto('/');
  const counts = await page.evaluate(() =>
    [...document.querySelectorAll('main > section')]
      .filter((s) => !s.hidden && s.id !== 'catalogue')
      .map((s) => [s.id || s.className.split(' ')[0], [...s.querySelectorAll('.btn')].filter((b) => b.checkVisibility()).length])
      .filter(([, n]) => n > 1)
  );
  expect(counts).toEqual([]);
  await expect(page.locator('.trust-caveat, .catalogue-note')).toHaveCount(0);
  await expect(page.locator('.honest-note')).toHaveCount(1);
  // Hero: one proof line; the unapproved "100% original" claim stays hidden.
  await expect(page.locator('.hero-benefits')).toHaveCount(0);
  await expect(page.locator('.hero-proof [data-approval="originalClaim"]')).toBeHidden();
  expect((await page.locator('.hero-proof').innerText()).toLowerCase()).toBe('imported & indian brands · guidance before you buy');
});

test('bulk-order strip opens a prefilled WhatsApp bulk enquiry', async ({ page }) => {
  await page.goto('/');
  const order = await page.evaluate(() => [...document.querySelector('main').children].map((el) => el.id || el.className.split(' ')[0]));
  expect(order.indexOf('bulk-strip')).toBe(order.indexOf('featured') + 1);
  const href = await page.locator('.bulk-strip a').getAttribute('href');
  const text = new URL(href).searchParams.get('text');
  expect(new URL(href).pathname).toBe('/918840427558');
  expect(text).toContain('bulk enquiry for a gym or trainer order');
  expect(text).not.toMatch(/₹|discount|offer/i);
});

test('the announcement bar rotates factual messages', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const active = () => page.locator('.utility-msg.is-active').textContent();
  expect(await active()).toBe('Sports nutrition and supplements · Lucknow');
  await page.clock.fastForward(4600);
  expect(await active()).toBe('Build an order list, then enquire on WhatsApp');
  await page.clock.fastForward(4600);
  expect(await active()).toBe('Call or WhatsApp +91 88404 27558');
  await expect(page.locator('.utility-msg[aria-hidden="true"]')).toHaveCount(2);
});

test('back-to-top appears after two viewports on desktop and returns to the top', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const button = page.locator('#backToTop');
  await expect(button).toBeHidden();
  await page.evaluate(() => window.scrollTo({ top: innerHeight * 2.5, behavior: 'instant' }));
  await expect(button).toBeVisible();
  await expect(button).toHaveAccessibleName('Back to top');
  await button.click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 3000, behavior: 'instant' }));
  await expect(button).toBeHidden();
});

test('sticky mobile bar with Call and WhatsApp appears after the hero', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const bar = page.locator('.mobile-bar');
  await expect(bar).toBeHidden();
  await page.evaluate(() => window.scrollTo({ top: 1400, behavior: 'instant' }));
  await expect(bar).toBeVisible();
  await expect(bar.locator('a[href="tel:+918840427558"]')).toHaveText('Call');
  await expect(bar.locator('#mobileWhatsApp')).toHaveText('WhatsApp');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(bar).toBeHidden();
});

test('unfinished content stays hidden on the public site', async ({ page }) => {
  await page.goto('/');
  const visible = await page.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (/owner|pending|coming soon|awaiting/i.test(text) && node.parentElement.checkVisibility()) out.push(text.slice(0, 60));
    }
    return out;
  });
  expect(visible).toEqual([]);
  for (const selector of [
    '.owner-checklist',
    '.verification-label',
    '.detail-grid',
    '#storeMapShell',
    '#directionsSlot',
    '#locationStatus',
    '.location-pending-note'
  ]) {
    await expect(page.locator(selector)).toBeHidden();
  }
  await expect(page.locator('.product-photo-pending')).toHaveCount(0);
  await expect(page.locator('#privacySettings')).toHaveText('Privacy Policy');
  // The location panel closes up around what remains.
  await expect(page.locator('.location-actions a[href^="https://wa.me/"]')).toBeVisible();
});

test('the hero loops only its glow pulse and embers, and pauses them off-screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const infinite = () =>
    page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('.editorial-hero, .editorial-hero *')) {
        for (const pseudo of [null, '::before', '::after']) {
          const cs = getComputedStyle(el, pseudo);
          if (cs.animationName !== 'none' && cs.animationIterationCount.includes('infinite'))
            out.push({ name: cs.animationName, state: cs.animationPlayState });
        }
      }
      return out;
    });
  const atTop = await infinite();
  expect([...new Set(atTop.map((a) => a.name))].sort()).toEqual(['emberRise', 'heroGlowPulse']);
  expect(atTop.filter((a) => a.name === 'emberRise').length).toBeLessThanOrEqual(20);
  await page.evaluate(() => window.scrollTo({ top: document.getElementById('categories').offsetTop, behavior: 'instant' }));
  await expect(page.locator('.editorial-hero')).toHaveClass(/motion-paused/);
  // Off-screen (and not mid-scroll): every loop is paused.
  await expect.poll(async () => (await infinite()).filter((a) => a.state !== 'paused').length).toBe(0);
});

test('every section uses one vertical padding value', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const paddings = await page.evaluate(() =>
      [...document.querySelectorAll('main > section:not(.hero)')]
        .filter((s) => !s.hidden)
        .map((s) => getComputedStyle(s).paddingTop + '/' + getComputedStyle(s).paddingBottom)
    );
    expect(new Set(paddings).size, `paddings at ${width}px: ${paddings}`).toBe(1);
  }
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('disables hero and reveal animation', async ({ page }) => {
    await page.goto('/');
    const running = await page.evaluate(
      () =>
        [...document.querySelectorAll('.editorial-hero *, .reveal-target')].filter((el) => getComputedStyle(el).animationName !== 'none')
          .length
    );
    expect(running).toBe(0);
    const state = await page.evaluate(() => ({
      shifted: [...document.querySelectorAll('.reveal-target')].filter(
        (el) => getComputedStyle(el).translate !== 'none' || getComputedStyle(el).opacity !== '1'
      ).length,
      running: document.getAnimations().filter((a) => a.playState === 'running').length,
      heroLines: [...document.querySelectorAll('.hero-line > span')].map((s) => getComputedStyle(s).transform),
      dividersDrawn: [...document.querySelectorAll('.story-rail')].every(
        (r) =>
          getComputedStyle(r, '::after').transform === 'none' || getComputedStyle(r, '::after').transform === 'matrix(1, 0, 0, 1, 0, 0)'
      ),
      embers: document.querySelectorAll('.hero-embers').length,
      glow: getComputedStyle(document.querySelector('.editorial-hero .hero-grid'), '::before').animationName
    }));
    expect(state).toEqual({ shifted: 0, running: 0, heroLines: ['none', 'none'], dividersDrawn: true, embers: 0, glow: 'none' });
  });
});

test('index.html opened directly from disk works without errors', async ({ page }) => {
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto('file://' + require('node:path').join(__dirname, '..', 'index.html'));
  await page.locator('#mainNav a[href="#catalogue"]').evaluate((link) => link.click());
  await expect(page.locator('#productGrid .product-card')).toHaveCount(2);
  await page.locator('.product-card [data-add]').first().click();
  await expect(page.locator('#cartCount')).toHaveText('1');
  expect(problems).toEqual([]);
});
