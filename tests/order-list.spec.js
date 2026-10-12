// Order list (enquiry cart): quantities, persistence, drawer behaviour and WhatsApp messages.
const { test, expect } = require('@playwright/test');
const { instrument, events, openCatalogue, decodeWhatsApp, useReviewMode } = require('./helpers');

const CART_KEY = 'infinite-order-list-v1';

test.beforeEach(async ({ page }) => {
  await instrument(page);
});

async function card(page, id) {
  return page.locator(`.product-card[data-id="${id}"]`);
}

test('card quantity stays between 1 and 99', async ({ page }) => {
  await page.goto('/');
  await openCatalogue(page);
  const c = await card(page, 'wellcore-micronised-creatine');
  await expect(c.locator('[data-qty="minus"]')).toBeDisabled();
  for (let i = 0; i < 101; i++) await c.locator('[data-qty="plus"]').evaluate((b) => b.click());
  await expect(c.locator('output')).toHaveText('99');
  await expect(c.locator('[data-qty="plus"]')).toBeDisabled();
  const href = await c.locator('[data-product-whatsapp]').getAttribute('href');
  expect(decodeWhatsApp(href).text).toContain('quantity 99');
});

test('adding updates counts, gives feedback and resets the card quantity', async ({ page }) => {
  await page.goto('/');
  await openCatalogue(page);
  const c = await card(page, 'muscleblaze-micronised-creatine');
  await c.locator('[data-qty="plus"]').click();
  await c.locator('[data-qty="plus"]').click();
  await c.locator('[data-add]').click();
  await expect(page.locator('#cartCount')).toHaveText('3');
  await expect(page.locator('#cartCountTwo')).toHaveText('3');
  await expect(page.locator('.toast')).toContainText('Added 3 × MuscleBlaze Micronised Creatine Monohydrate');
  await expect(c.locator('[data-add]')).toHaveText('Added to list ✓');
  await expect(c.locator('output')).toHaveText('1');
  await expect(page.locator('#cartBackdrop')).toHaveAttribute('aria-hidden', 'true');
  const [add] = await events(page, 'add_to_cart');
  expect(add.params).toMatchObject({ item_id: 'muscleblaze-micronised-creatine', quantity: 3, source: 'catalogue_card' });
  expect(add.params.value).toBeUndefined();
});

test('drawer: quantity controls, removal, clear, focus trap and Escape', async ({ page }) => {
  await page.goto('/');
  await openCatalogue(page);
  await (await card(page, 'muscleblaze-micronised-creatine')).locator('[data-add]').click();
  await (await card(page, 'wellcore-micronised-creatine')).locator('[data-add]').click();
  const opener = page.locator('.toast-action');
  await opener.click();
  const drawer = page.locator('#cartBackdrop');
  await expect(drawer).toHaveClass(/open/);
  await expect(page.locator('#cartBackdrop .close-btn')).toBeFocused();
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await expect(page.locator('#cartSummary')).toContainText('2 product lines');
  await expect(page.locator('#cartSubtotal')).toHaveText('Price to be confirmed');

  const plus = page.locator('[data-cart-qty="plus"]').first();
  await plus.click();
  await expect(page.locator('.cart-qty-value').first()).toHaveText('2');
  await expect(plus).toBeFocused();
  await page.locator('[data-cart-qty="minus"]').first().click();
  await expect(page.locator('[data-cart-qty="minus"]').first()).toBeDisabled();

  // Tab cycles inside the drawer.
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.closest('#cartBackdrop') !== null)).toBe(true);

  await page.locator('.remove').first().click();
  await expect(page.locator('.cart-item')).toHaveCount(1);
  expect(await page.evaluate(() => document.activeElement.closest('#cartBackdrop') !== null)).toBe(true);
  await page.locator('#clearCart').click();
  await expect(page.locator('.cart-empty')).toBeVisible();
  await expect(page.locator('#sendCart')).toBeDisabled();

  await page.keyboard.press('Escape');
  await expect(drawer).not.toHaveClass(/open/);
  await expect(page.locator('main')).not.toHaveAttribute('inert', '');
  const removals = await events(page, 'remove_from_cart');
  expect(removals.map((e) => e.params.source)).toEqual(['order_list', 'order_list', 'clear_list']);
});

test('drawer returns focus to the button that opened it', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('.site-nav .cart-open');
  await button.click();
  await expect(page.locator('#cartBackdrop')).toHaveClass(/open/);
  await page.locator('#cartBackdrop .close-btn').click();
  await expect(button).toBeFocused();
});

test('order list survives a reload and rejects tampered storage', async ({ page }) => {
  await page.goto('/');
  await openCatalogue(page);
  await (await card(page, 'wellcore-micronised-creatine')).locator('[data-add]').click();
  await page.reload();
  await expect(page.locator('#cartCount')).toHaveText('1');

  await page.evaluate(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify([
          { id: 'wellcore-micronised-creatine', variantId: '', qty: 2 },
          { id: 'wellcore-micronised-creatine', variantId: '', qty: 3 },
          { id: 'not-a-product', variantId: '', qty: 1 },
          { id: 'pintola-high-protein-peanut-butter', variantId: 'made-up-variant', qty: 1 },
          { id: 'muscleblaze-micronised-creatine', variantId: '', qty: 500 },
          { id: 'muscleblaze-micronised-creatine', variantId: '', qty: 1.5 },
          '<img src=x onerror=alert(1)>'
        ])
      ),
    CART_KEY
  );
  await page.reload();
  await expect(page.locator('#cartCount')).toHaveText('5');
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), CART_KEY);
  expect(stored).toEqual([{ id: 'wellcore-micronised-creatine', variantId: '', qty: 5 }]);

  await page.evaluate((key) => localStorage.setItem(key, '{not json'), CART_KEY);
  await page.reload();
  await expect(page.locator('#cartCount')).toHaveText('0');
});

test('the WhatsApp list message carries every line, quantity and the enquiry disclaimer', async ({ page }) => {
  // Review mode lists the multi-variant Pintola entry and the variant-less QNT entry.
  await useReviewMode(page);
  await page.goto('/');
  await openCatalogue(page);
  const pintola = await card(page, 'pintola-high-protein-peanut-butter');
  await pintola.locator('[data-qty="plus"]').click();
  await pintola.locator('[data-add]').click();
  await (await card(page, 'qnt-l-carnitine-liquid-formula')).locator('[data-add]').click();
  await page.locator('.site-nav .cart-open').click();
  await page.locator('#sendCartTwo').click();
  const opened = await page.evaluate(() => window.__opened);
  expect(opened).toHaveLength(1);
  const message = decodeWhatsApp(opened[0]);
  expect(message.number).toBe('918303253308');
  expect(message.text).toContain('1. Pintola High Protein Peanut Butter — Dark Chocolate – Crunchy — quantity 2 — price to confirm');
  expect(message.text).toContain('2. QNT L-Carnitine Liquid Formula — size / variant to confirm — quantity 1 — price to confirm');
  expect(message.text).toContain('Displayed subtotal: Price to confirm');
  expect(message.text).toContain('This is an enquiry, not a completed purchase or confirmed order.');
  const [click] = await events(page, 'click_whatsapp');
  expect(click.params).toMatchObject({ source: 'order_list', context: 'order_list', contact: 'secondary', lines_count: 2, items_count: 3 });
});

test('product details dialog: facts, quantity, add to list and focus return', async ({ page }) => {
  await page.goto('/');
  await openCatalogue(page);
  const c = await card(page, 'wellcore-micronised-creatine');
  const trigger = c.locator('[data-details]');
  await trigger.click();
  const modal = page.locator('#modalBackdrop');
  await expect(modal).toHaveClass(/open/);
  await expect(page.locator('#modalTitle')).toHaveText('Micronised Creatine Monohydrate');
  await expect(page.locator('.detail-summary')).toContainText('Store confirmation required');
  await page.locator('[data-detail-qty="plus"]').click();
  const wa = await page.locator('[data-detail-whatsapp="0"]').getAttribute('href');
  expect(decodeWhatsApp(wa).text).toContain('quantity 2');
  await page.locator('[data-detail-add]').click();
  await expect(page.locator('#cartCount')).toHaveText('2');
  await expect(page.locator('.toast')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).not.toHaveClass(/open/);
  await expect(trigger).toBeFocused();
  const names = (await events(page)).map((e) => e.name);
  expect(names).toEqual(expect.arrayContaining(['select_item', 'view_item', 'add_to_cart']));
});

test('mobile quick bar sends the list on WhatsApp when it has items', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#mobileWhatsApp')).toHaveText('WhatsApp');
  await openCatalogue(page);
  await (await card(page, 'wellcore-micronised-creatine')).locator('[data-add]').click();
  await expect(page.locator('#mobileWhatsApp')).toHaveText('Send list on WhatsApp');
  await page.locator('#mobileWhatsApp').click();
  const opened = await page.evaluate(() => window.__opened);
  expect(decodeWhatsApp(opened[0]).text).toContain('Wellcore Micronised Creatine Monohydrate');
});
