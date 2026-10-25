// Motion and hover behaviour that depends on the visitor allowing animation.
const { test, expect, devices } = require('@playwright/test');

test.use({ contextOptions: { reducedMotion: 'no-preference' }, viewport: { width: 1440, height: 900 } });

async function hoverAndRead(page, selector, read) {
  const item = page.locator(selector).first();
  await item.scrollIntoViewIfNeeded();
  // Let any scroll reveal settle so the pointer lands on a still target.
  await item.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))));
  // Hero targets follow scroll-linked depth that settles only once the hero is
  // back in view: wait until the target has been still for ten frames.
  await item.evaluate(
    (el) =>
      el.closest('.editorial-hero') &&
      new Promise((resolve) => {
        let last = '';
        let still = 0;
        const check = () => {
          const r = el.getBoundingClientRect();
          const now = [r.x, r.y, r.width, r.height].map((v) => v.toFixed(1)).join();
          still = now === last ? still + 1 : 0;
          last = now;
          if (still >= 10) resolve();
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      })
  );
  await page.mouse.move(2, 2);
  const before = await item.evaluate(read);
  await item.hover();
  await page.waitForTimeout(700);
  const after = await item.evaluate(read);
  return { before, after };
}

test('product cards lift 6px, scale the photo to 1.06 and show a red glow', async ({ page }) => {
  await page.goto('/');
  const { before, after } = await hoverAndRead(page, '.featured-card >> nth=1', (el) => ({
    lift: getComputedStyle(el).transform,
    glow: getComputedStyle(el, '::before').opacity,
    photo: getComputedStyle(el.querySelector('.product-packshot')).transform
  }));
  expect(before).toEqual({ lift: 'none', glow: '0', photo: 'none' });
  expect(after).toEqual({ lift: 'matrix(1, 0, 0, 1, 0, -6)', glow: '1', photo: 'matrix(1.06, 0, 0, 1.06, 0, 0)' });
});

test('outlined buttons sweep red from the left; solid buttons lift and glow', async ({ page }) => {
  await page.goto('/');
  for (const selector of ['.bulk-strip .btn', '.nav-tools .icon-btn']) {
    const sweep = await hoverAndRead(page, selector, (el) => {
      const cs = getComputedStyle(el, '::before');
      return cs.transform + ' ' + cs.transformOrigin.split(' ')[0];
    });
    expect(sweep.before).toBe('matrix(0, 0, 0, 1, 0, 0) 0px');
    expect(sweep.after).toBe('matrix(1, 0, 0, 1, 0, 0) 0px');
  }
  for (const selector of ['.editorial-hero .actions .btn.primary', '.nav-wa']) {
    const solid = await hoverAndRead(
      page,
      selector,
      (el) => getComputedStyle(el).transform + ' ' + getComputedStyle(el, '::after').opacity
    );
    expect(solid.before).toBe('none 0');
    expect(solid.after).toBe('matrix(1, 0, 0, 1, 0, -2) 1');
  }
});

test('nav underline slides in from the left; category cards get a diagonal shine', async ({ page }) => {
  await page.goto('/');
  const nav = await hoverAndRead(page, '#mainNav a[href="#founder"]', (el) => getComputedStyle(el, '::after').transform);
  expect(nav).toEqual({ before: 'matrix(0, 0, 0, 1, 0, 0)', after: 'matrix(1, 0, 0, 1, 0, 0)' });
  const shine = await hoverAndRead(
    page,
    '.category-tile >> nth=3',
    (el) => new DOMMatrix(getComputedStyle(el.querySelector('.category-shine')).transform).m41
  );
  expect(shine.before).toBeLessThan(0);
  expect(shine.after).toBeGreaterThan(0);
  const faq = await hoverAndRead(page, '.faq-item >> nth=0', (el) => getComputedStyle(el, '::before').opacity);
  expect(faq).toEqual({ before: '0', after: '1' });
});

test('hover effects animate transform and opacity only', async ({ page }) => {
  await page.goto('/');
  const offenders = await page.evaluate(() => {
    const allowed = new Set(['transform', 'translate', 'opacity', 'all']);
    const selectors = [
      '.btn',
      '.small-action',
      '.nav-wa',
      '.icon-btn',
      '.featured-card',
      '.category-tile',
      '.policy-button',
      '.faq-item summary',
      '.nav-links a'
    ];
    const out = [];
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        for (const pseudo of [null, '::before', '::after']) {
          const cs = getComputedStyle(el, pseudo);
          const durations = cs.transitionDuration.split(',').map((d) => parseFloat(d));
          cs.transitionProperty.split(',').forEach((prop, i) => {
            const name = prop.trim();
            if ((durations[i % durations.length] || 0) > 0 && !allowed.has(name)) out.push(selector + (pseudo || '') + ': ' + name);
          });
        }
      }
    }
    return [...new Set(out)];
  });
  expect(offenders).toEqual([]);
});

test('hero headline lines rise out of a mask, 90ms apart', async ({ page }) => {
  await page.goto('/');
  const lines = await page.evaluate(() =>
    [...document.querySelectorAll('.editorial-hero h1 .hero-line')].map((line) => ({
      clip: getComputedStyle(line).overflowY,
      name: getComputedStyle(line.firstElementChild).animationName,
      delay: getComputedStyle(line.firstElementChild).animationDelay
    }))
  );
  expect(lines).toEqual([
    { clip: 'clip', name: 'heroMaskRise', delay: '0s' },
    { clip: 'clip', name: 'heroMaskRise', delay: '0.09s' }
  ]);
});

test('section dividers draw across the top on scroll-in', async ({ page }) => {
  await page.goto('/');
  const rail = page.locator('#faq > .story-rail');
  const scale = () => rail.evaluate((el) => getComputedStyle(el, '::after').transform);
  expect(await scale()).toBe('matrix(0, 0, 0, 1, 0, 0)');
  const geometry = await rail.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const wrap = el.parentElement.querySelector('.wrap').getBoundingClientRect();
    return {
      height: r.height,
      width: Math.round(r.width),
      wrap: Math.round(wrap.width),
      duration: getComputedStyle(el, '::after').transitionDuration
    };
  });
  expect(geometry).toEqual({ height: 2, width: geometry.wrap, wrap: geometry.wrap, duration: '0.7s' });
  await page.locator('#faq').scrollIntoViewIfNeeded();
  await expect.poll(scale).toBe('matrix(1, 0, 0, 1, 0, 0)');
});

test('cards that enter together are staggered 70ms apart and never hidden', async ({ page }) => {
  await page.goto('/');
  // Waiting below the fold: shifted and slightly faded, never invisible.
  const waiting = await page.evaluate(() =>
    [...document.querySelectorAll('.reveal-target:not(.in-view)')].map((el) => Number(getComputedStyle(el).opacity))
  );
  expect(waiting.length).toBeGreaterThan(10);
  expect(Math.min(...waiting)).toBeGreaterThanOrEqual(0.7);
  await page.evaluate(() => window.scrollTo({ top: document.getElementById('why').offsetTop, behavior: 'instant' }));
  await expect(page.locator('.trust-item').nth(2)).toHaveClass(/in-view/);
  const delays = await page
    .locator('.trust-item')
    .evaluateAll((items) => items.slice(0, 3).map((el) => getComputedStyle(el).animationDelay));
  const ms = delays.map((d) => Math.round(parseFloat(d) * 1000));
  expect(ms[1] - ms[0]).toBe(70);
  expect(ms[2] - ms[1]).toBe(70);
  // A fast jump never leaves anything hidden.
  await page.evaluate(() => window.scrollTo({ top: document.getElementById('founder').offsetTop, behavior: 'instant' }));
  const inView = await page.evaluate(() =>
    [...document.querySelectorAll('.reveal-target')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight;
      })
      .map((el) => Number(getComputedStyle(el).opacity))
  );
  expect(inView.length).toBeGreaterThan(0);
  expect(Math.min(...inView)).toBeGreaterThanOrEqual(0.7);
});

test('desktop parallax: hero photo at 0.15x, founder portrait at 0.1x', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
  await expect.poll(() => page.locator('.editorial-visual').evaluate((el) => el.style.translate)).toBe('0px 60px');
  await page.evaluate(() => {
    const founder = document.querySelector('.founder-photo');
    const r = founder.getBoundingClientRect();
    // Put the portrait's centre 200px below the viewport centre.
    window.scrollTo({ top: scrollY + r.top + r.height / 2 - innerHeight / 2 - 200, behavior: 'instant' });
  });
  await expect
    .poll(() => page.locator('.founder-photo').evaluate((el) => parseFloat(el.style.getPropertyValue('--motion-depth-y'))))
    .toBeCloseTo(-20, 0);
});

test('primary CTAs lean toward the cursor by at most 6px and spring back', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('.editorial-hero .actions .btn.primary');
  const box = await button.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 1, box.y + 1, { steps: 3 });
  // Toward the top-right corner: right and up, never more than 6px.
  const lean = () => button.evaluate((el) => (el.style.translate || '0px 0px').split(' ').map(parseFloat));
  await expect.poll(async () => (await lean())[0]).toBeGreaterThan(3);
  const [x, y] = await lean();
  expect(x).toBeLessThanOrEqual(6);
  expect(y).toBeLessThan(0);
  expect(y).toBeGreaterThanOrEqual(-6);
  await page.mouse.move(2, 2);
  await expect.poll(() => button.evaluate((el) => el.style.translate)).toBe('');
});

test('no animation runs in a section outside the viewport', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.scrollTo({ top: document.getElementById('why').offsetTop, behavior: 'instant' }));
  await page.waitForTimeout(1200);
  const offscreen = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === 'running')
      .map((a) => a.effect.target)
      .filter((el) => {
        const section = el.closest('section, header, footer');
        const r = (section || el).getBoundingClientRect();
        return r.bottom <= 0 || r.top >= innerHeight;
      })
      .map((el) => el.className || el.tagName)
  );
  expect(offscreen).toEqual([]);
});

test('no section animates its own background (no colour flash on scroll-in)', async ({ page }) => {
  await page.goto('/');
  for (const id of ['finder', 'policies']) {
    await page.evaluate((target) => document.getElementById(target).scrollIntoView({ behavior: 'instant' }), id);
    const motion = await page.evaluate((target) => {
      const section = document.getElementById(target);
      return [null, '::before', '::after'].map((pseudo) => {
        const cs = getComputedStyle(section, pseudo);
        return cs.animationName + '|' + cs.transitionDuration;
      });
    }, id);
    expect(motion.every((entry) => entry === 'none|0s')).toBe(true);
  }
});

test.describe('touch devices', () => {
  const phone = devices['Pixel 7'];
  test.use({
    viewport: phone.viewport,
    deviceScaleFactor: phone.deviceScaleFactor,
    isMobile: phone.isMobile,
    hasTouch: phone.hasTouch,
    userAgent: phone.userAgent,
    contextOptions: { reducedMotion: 'no-preference' }
  });
  test('get reveals but no parallax, magnetic buttons or embers', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => ({
      reveals: document.documentElement.classList.contains('motion-ok'),
      embers: document.querySelectorAll('.hero-embers').length,
      heroParallax: document.querySelector('.editorial-visual').style.translate,
      depth: [...document.querySelectorAll('.motion-depth')].filter(
        (n) => parseFloat(n.style.getPropertyValue('--motion-depth-y') || '0') !== 0
      ).length
    }));
    expect(state).toEqual({ reveals: true, embers: 0, heroParallax: '', depth: 0 });
    const button = page.locator('.editorial-hero .actions .btn.primary');
    await button.tap();
    expect(await button.evaluate((el) => el.style.translate)).toBe('');
  });
});
