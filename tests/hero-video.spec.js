// Mobile hero: looping background video, its poster fallbacks and the phone layout.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const CLIP = /\/assets\/hero-bg\.(webm|mp4)$/;

function watchMedia(page) {
  const urls = [];
  page.on('request', (request) => {
    if (/hero-bg\.|hero-poster\.jpg/.test(request.url())) urls.push(new URL(request.url()).pathname);
  });
  return urls;
}

const playing = (page) => page.locator('.hero-video').evaluate((v) => !v.paused && v.currentTime > 0 && v.readyState >= 3);

test.describe('phones', () => {
  test.use({ ...PHONE, contextOptions: { reducedMotion: 'no-preference' } });

  test('a muted, looping, inline video plays behind the copy, WebM first then MP4', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('.hero-video');
    await expect(page.locator('.editorial-visual')).toHaveClass(/hero-video-on/);
    await expect.poll(() => playing(page)).toBe(true);
    const state = await video.evaluate((v) => ({
      muted: v.muted,
      loop: v.loop,
      autoplay: v.autoplay,
      inline: v.hasAttribute('playsinline'),
      controls: v.controls,
      preload: v.getAttribute('preload'),
      poster: v.getAttribute('poster'),
      hidden: v.getAttribute('aria-hidden'),
      sources: [...v.querySelectorAll('source')].map((s) => [new URL(s.src).pathname, s.type]),
      fit: getComputedStyle(v).objectFit + ' ' + getComputedStyle(v).objectPosition
    }));
    expect(state).toEqual({
      muted: true,
      loop: true,
      autoplay: true,
      inline: true,
      controls: false,
      preload: 'metadata',
      poster: 'assets/hero-poster.jpg',
      hidden: 'true',
      sources: [
        ['/assets/hero-bg.webm', 'video/webm'],
        ['/assets/hero-bg.mp4', 'video/mp4']
      ],
      fit: 'cover 50% 50%'
    });
    // The clip covers the hero, under the copy (measured once the frame's entrance has finished).
    await page.locator('.editorial-visual').evaluate((el) =>
      Promise.all(
        el
          .getAnimations()
          .filter((a) => a.effect.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {}))
      )
    );
    const cover = await page.evaluate(() => {
      const hero = document.getElementById('home').getBoundingClientRect();
      const v = document.querySelector('.hero-video').getBoundingClientRect();
      return [v.top - hero.top, v.width - hero.width, v.bottom - hero.bottom].every((d) => Math.abs(d) <= 1);
    });
    expect(cover).toBe(true);
  });

  test('the overlay is dark at the edges, clear in the middle and 10% stronger than desktop', async ({ page }) => {
    await page.goto('/');
    const shade = await page.locator('.hero-video-shade').evaluate((el) => ({
      strength: getComputedStyle(el).getPropertyValue('--hero-shade').trim(),
      layers: getComputedStyle(el).backgroundImage,
      wash: getComputedStyle(el.parentElement, '::before').display
    }));
    expect(shade.strength).toBe('0.79');
    expect(shade.layers).toMatch(
      /^linear-gradient\(rgba\(0, 0, 0, 0\.79\) 0%.*rgba\(0, 0, 0, 0\) 40%, rgba\(0, 0, 0, 0\) 64%.*rgba\(0, 0, 0, 0\.79\) 100%\)/
    );
    expect(shade.layers).toContain('rgba(184, 0, 25');
    // The old full-height black wash is off while the video runs.
    expect(shade.wash).toBe('none');
  });

  test('the clip pauses when the hero leaves the screen and resumes on return', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => playing(page)).toBe(true);
    await page.evaluate(() => document.getElementById('why').scrollIntoView({ behavior: 'instant' }));
    await expect.poll(() => page.locator('.hero-video').evaluate((v) => v.paused)).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect.poll(() => playing(page)).toBe(true);
  });

  test('a missing clip falls back to the poster with an 18s Ken Burns zoom, never a black box', async ({ page }) => {
    await page.route(CLIP, (route) => route.fulfill({ status: 404, body: '' }));
    const urls = watchMedia(page);
    await page.goto('/');
    await expect(page.locator('.editorial-visual')).toHaveClass(/hero-video-fallback/);
    await expect(page.locator('.hero-video')).toBeHidden();
    const poster = await page.locator('.hero-poster').evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        image: cs.backgroundImage.includes('/assets/hero-poster.jpg'),
        size: cs.backgroundSize,
        animation: [cs.animationName, cs.animationDuration, cs.animationDirection, cs.animationIterationCount].join(' ')
      };
    });
    expect(poster).toEqual({ image: true, size: 'cover', animation: 'heroKenBurns 18s alternate infinite' });
    await expect.poll(() => urls.includes('/assets/hero-poster.jpg')).toBe(true);
    await expect
      .poll(() => page.locator('.hero-poster').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a))
      .toBeGreaterThan(1);
  });

  test('a refused autoplay also hands over to the poster', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    });
    await page.goto('/');
    await expect(page.locator('.editorial-visual')).toHaveClass(/hero-video-fallback/);
    await expect(page.locator('.hero-video')).toBeHidden();
    await expect(page.locator('.hero-poster')).toBeVisible();
  });
});

test.describe('phones with reduced motion', () => {
  test.use({ ...PHONE, contextOptions: { reducedMotion: 'reduce' } });

  test('show the poster still and never download the clip', async ({ page }) => {
    const urls = watchMedia(page);
    await page.goto('/');
    await expect(page.locator('.editorial-visual')).toHaveClass(/hero-video-static/);
    await expect(page.locator('.hero-video')).toBeHidden();
    await expect(page.locator('.hero-video source')).toHaveCount(0);
    const poster = await page
      .locator('.hero-poster')
      .evaluate((el) => [getComputedStyle(el).display, getComputedStyle(el).animationName, getComputedStyle(el).transform]);
    expect(poster).toEqual(['block', 'none', 'none']);
    await page.waitForLoadState('networkidle');
    expect(urls.filter((u) => CLIP.test(u))).toEqual([]);
  });
});

for (const size of [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 360, height: 740 },
  { width: 430, height: 932 }
]) {
  test.describe(`mobile hero layout at ${size.width}x${size.height}`, () => {
    test.use({ ...PHONE, viewport: size, contextOptions: { reducedMotion: 'reduce' } });

    test('fits in 92svh with the copy centred, a clamped headline and a centred CTA', async ({ page }) => {
      await page.goto('/');
      const m = await page.evaluate(() => {
        const box = (sel) => document.querySelector(sel).getBoundingClientRect();
        const hero = box('#home');
        const copy = getComputedStyle(document.querySelector('.hero-copy'));
        const top = box('.editorial-hero .eyebrow').top - hero.top - parseFloat(copy.paddingTop);
        const cta = box('.editorial-hero .actions .btn.primary');
        return {
          vw: innerWidth,
          vh: innerHeight,
          heroH: hero.height,
          gapAbove: top,
          gapBelow: hero.bottom - cta.bottom - parseFloat(copy.paddingBottom),
          ctaW: cta.width,
          ctaSides: [cta.left, innerWidth - cta.right],
          h1: parseFloat(getComputedStyle(document.querySelector('.editorial-hero h1')).fontSize),
          underline: getComputedStyle(document.querySelector('.editorial-hero .accent-line')).textDecorationLine
        };
      });
      expect(m.heroH).toBeLessThanOrEqual(Math.ceil(m.vh * 0.92) + 1);
      expect(Math.abs(m.gapAbove - m.gapBelow)).toBeLessThanOrEqual(2);
      expect(m.gapBelow).toBeGreaterThanOrEqual(0);
      expect(m.ctaW).toBeLessThanOrEqual(340);
      expect(m.ctaW).toBeGreaterThanOrEqual(Math.min(340, m.vw - 40));
      expect(Math.abs(m.ctaSides[0] - m.ctaSides[1])).toBeLessThanOrEqual(1);
      expect(m.h1).toBeCloseTo(Math.min(72, Math.max(41.6, m.vw * 0.12)), 1);
      expect(m.underline).toBe('underline');
    });
  });
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'no-preference' } });

  test('keeps the photo hero and downloads no video or poster', async ({ page }) => {
    const urls = watchMedia(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.hero-video, .hero-poster, .hero-video-shade')).toHaveCount(3);
    for (const sel of ['.hero-video', '.hero-poster', '.hero-video-shade']) await expect(page.locator(sel)).toBeHidden();
    await expect(page.locator('.editorial-visual')).not.toHaveClass(/hero-video-on/);
    await expect(page.locator('.hero-store-main')).toBeVisible();
    await expect(page.locator('.hero-video source')).toHaveCount(0);
    expect(urls).toEqual([]);
  });
});

test('the server sends the clips as video with byte ranges, which Safari needs', async ({ request }) => {
  const size = fs.statSync(path.join(__dirname, '..', 'assets', 'hero-bg.mp4')).size;
  const full = await request.get('/assets/hero-bg.mp4');
  expect(full.status()).toBe(200);
  expect(full.headers()['content-type']).toBe('video/mp4');
  expect(full.headers()['accept-ranges']).toBe('bytes');
  const part = await request.get('/assets/hero-bg.mp4', { headers: { Range: 'bytes=0-1' } });
  expect(part.status()).toBe(206);
  expect(part.headers()['content-range']).toBe('bytes 0-1/' + size);
  expect((await part.body()).length).toBe(2);
  const tail = await request.get('/assets/hero-bg.webm', { headers: { Range: 'bytes=-10' } });
  expect(tail.status()).toBe(206);
  expect(tail.headers()['content-type']).toBe('video/webm');
  expect((await tail.body()).length).toBe(10);
  expect((await request.get('/assets/hero-bg.mp4', { headers: { Range: 'bytes=' + size + '-' } })).status()).toBe(416);
});

test('the clips stay under 3MB together and the poster is a light JPEG', () => {
  const kb = (f) => fs.statSync(path.join(__dirname, '..', 'assets', f)).size / 1024;
  expect(kb('hero-bg.webm') + kb('hero-bg.mp4')).toBeLessThan(3 * 1024);
  expect(kb('hero-poster.jpg')).toBeLessThan(150);
});
