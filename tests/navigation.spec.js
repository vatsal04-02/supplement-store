// Navigation, overlays, policies, privacy controls and contact links.
const { test, expect } = require('@playwright/test');
const { instrument, events, useReviewMode } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await instrument(page);
});

test('mobile menu opens, closes on link, outside tap and Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.locator('.menu-toggle');
  const nav = page.locator('#mainNav');
  await expect(nav).toBeHidden();
  await toggle.click();
  await expect(nav).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await nav.locator('a[href="#founder"]').click();
  await expect(nav).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('every in-page navigation link points at an existing section', async ({ page }) => {
  await page.goto('/');
  const missing = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="#"]')]
      .map((a) => a.getAttribute('href'))
      .filter((href) => href.length > 1 && !document.querySelector(href))
  );
  expect(missing).toEqual([]);
});

test('skip link moves focus to the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
});

test('policy dialogs mark unapproved terms as provisional', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('.policy-button[data-policy="refunds"]');
  await button.click();
  await expect(page.locator('#modalTitle')).toHaveText('Refunds');
  await expect(page.locator('#modalContent .status')).toHaveText('Provisional · confirm with the store');
  await page.locator('#modalBackdrop .close-btn').click();
  await expect(button).toBeFocused();
  const [policy] = await events(page, 'open_policy');
  expect(policy.params.policy).toBe('refunds');
});

test('in review mode policy dialogs say the terms await owner approval', async ({ page }) => {
  await useReviewMode(page);
  await page.goto('/');
  await page.locator('.policy-button[data-policy="refunds"]').click();
  await expect(page.locator('#modalTitle')).toHaveText('Refunds — owner-review draft');
  await expect(page.locator('#modalContent .status')).toHaveText('Owner review required');
});

test('privacy dialog lets a visitor switch statistics off, which stops all events', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#privacySettings')).toHaveText('Privacy Policy');
  await page.locator('#privacySettings').click();
  await expect(page.locator('#modalTitle')).toHaveText('Privacy policy');
  await expect(page.locator('#modalContent')).toContainText('Your order list is kept only in this browser');
  await expect(page.locator('.privacy-state')).toContainText('on');
  await page.locator('[data-privacy="toggle-optout"]').click();
  await expect(page.locator('.privacy-state')).toContainText('off');
  await page.keyboard.press('Escape');
  const before = (await events(page)).length;
  await page.locator('.category-creatine').click();
  await page.waitForTimeout(200);
  expect((await events(page)).length).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('infinite-analytics-optout'))).toBe('1');
  // The choice persists across visits.
  await page.reload();
  expect(await events(page)).toEqual([]);
});

test('owner notes are hidden on the public site and shown in review mode', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.owner-checklist')).toBeHidden();
  await expect(page.locator('.fit-first-note')).toBeHidden();
  // Not approved, so the unconfirmed credit is withheld.
  await expect(page.locator('.powered')).toBeHidden();
  // Customer-facing honesty notes remain.
  await expect(page.locator('.trust-caveat')).toBeVisible();

  await useReviewMode(page);
  await page.reload();
  await expect(page.locator('.owner-checklist')).toBeVisible();
  await expect(page.locator('.verification-label')).toBeVisible();
  await expect(page.locator('.detail-grid')).toBeVisible();
  await expect(page.locator('.powered')).toBeVisible();
});

test('telephone and WhatsApp links are tracked with the right contact role', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('.contact-row a[href="tel:+918303253308"]')
    .first()
    .evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
  await page.locator('.contact-row a[href="tel:+918303253308"]').first().click();
  const [contact] = await events(page, 'contact_store');
  expect(contact.params).toMatchObject({ method: 'phone', contact: 'secondary', source: 'visit' });

  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('.nav-wa').click()]);
  await popup.close();
  const [wa] = await events(page, 'click_whatsapp');
  expect(wa.params).toMatchObject({ source: 'header', contact: 'primary', context: 'general' });
});

test('without a verified map no map box or directions button is shown', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#storeMapShell')).toBeHidden();
  await expect(page.locator('#directionsSlot')).toBeHidden();
  await expect(page.locator('#locationStatus')).toBeHidden();
  // The remaining location copy and contact routes take the full panel.
  const panel = await page.locator('#store-location').boundingBox();
  const copy = await page.locator('#store-location .location-copy').boundingBox();
  expect(Math.abs(panel.width - copy.width)).toBeLessThanOrEqual(1);
  await expect(page.locator('.location-actions a[href^="https://wa.me/"]')).toBeVisible();
});

test('review mode still shows the pending map state to the owner', async ({ page }) => {
  await useReviewMode(page);
  await page.goto('/');
  await expect(page.locator('#storeMapFrame')).toBeHidden();
  await expect(page.locator('#storeMapPlaceholder')).toBeVisible();
  await expect(page.locator('#directionsSlot button')).toBeDisabled();
});

test('a verified map configuration shows the map and a safe directions link', async ({ page }) => {
  await page.route('https://www.google.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>map</p>' }));
  await page.route('**/js/site-config.js', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace("embedUrl: ''", "embedUrl: 'https://www.google.com/maps/embed?pb=test'")
      .replace("directionsUrl: ''", "directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Test\"><script>'");
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  await expect(page.locator('#storeMapFrame')).toBeVisible();
  await expect(page.locator('#store-location')).toHaveAttribute('data-map', 'ready');
  const link = page.locator('#directionsSlot a');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await link.getAttribute('href')).toContain('https://www.google.com/maps/dir/');
  await expect(page.locator('#directionsSlot script')).toHaveCount(0);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 }
]) {
  test(`anchored headings stop below the sticky header at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const clipped = [];
    for (const id of [
      'featured',
      'categories',
      'enquiry-process',
      'finder',
      'reviews',
      'authenticity',
      'why',
      'founder',
      'visit',
      'store-location',
      'policies',
      'faq'
    ]) {
      await page.evaluate((target) => document.getElementById(target).scrollIntoView({ behavior: 'instant', block: 'start' }), id);
      const gap = await page.evaluate((target) => {
        const header = document.querySelector('.site-nav').getBoundingClientRect().bottom;
        const kicker = document.getElementById(target).querySelector('.eyebrow').getBoundingClientRect().top;
        const section = document.getElementById(target).getBoundingClientRect().top;
        return { kicker: kicker - header, section: section - header };
      }, id);
      if (gap.kicker < 0 || gap.section < 15) clipped.push(id + ' ' + JSON.stringify(gap));
    }
    expect(clipped).toEqual([]);
  });
}

test('the nav link to categories lands with the heading in view', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#mainNav a[href="#categories"]').click();
  // Smooth scrolling: wait until the section settles 16px below the header.
  const offset = () =>
    page.evaluate(() => {
      const header = document.querySelector('.site-nav').getBoundingClientRect().bottom;
      return Math.round(document.getElementById('categories').getBoundingClientRect().top - header);
    });
  await expect.poll(offset).toBeLessThanOrEqual(20);
  expect(await offset()).toBeGreaterThanOrEqual(14);
  const heading = await page.locator('#categoriesTitle').boundingBox();
  const header = await page.locator('.site-nav').boundingBox();
  expect(heading.y).toBeGreaterThan(header.y + header.height);
});
