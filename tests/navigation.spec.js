// Navigation, overlays, policies, privacy controls and contact links.
const { test, expect } = require('@playwright/test');
const { instrument, events } = require('./helpers');

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

test('policy dialogs state that terms await owner approval', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('.policy-button[data-policy="refunds"]');
  await button.click();
  await expect(page.locator('#modalTitle')).toHaveText('Refunds — owner-review draft');
  await expect(page.locator('#modalContent .status')).toHaveText('Owner review required');
  await page.locator('#modalBackdrop .close-btn').click();
  await expect(button).toBeFocused();
  const [policy] = await events(page, 'open_policy');
  expect(policy.params.policy).toBe('refunds');
});

test('privacy dialog lets a visitor switch statistics off, which stops all events', async ({ page }) => {
  await page.goto('/');
  await page.locator('#privacySettings').click();
  await expect(page.locator('#modalTitle')).toHaveText('Privacy & analytics');
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

test('owner notes are visible in review mode and hidden when reviewMode is false', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.owner-checklist')).toBeVisible();
  await expect(page.locator('.powered')).toBeVisible();

  await page.route('**/js/site-config.js', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace('reviewMode: true', 'reviewMode: false');
    await route.fulfill({ response, body });
  });
  await page.reload();
  await expect(page.locator('.owner-checklist')).toBeHidden();
  await expect(page.locator('.fit-first-note')).toBeHidden();
  // Not approved, so the unconfirmed credit is withheld at launch.
  await expect(page.locator('.powered')).toBeHidden();
  // Customer-facing honesty notes remain.
  await expect(page.locator('.trust-caveat')).toBeVisible();
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

test('store location stays an honest empty state without a verified map', async ({ page }) => {
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
  const link = page.locator('#directionsSlot a');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await link.getAttribute('href')).toContain('https://www.google.com/maps/dir/');
  await expect(page.locator('#directionsSlot script')).toHaveCount(0);
});
