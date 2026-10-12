// Shared helpers for the Playwright suite.

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 780 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 }
];

// Collects console errors, uncaught exceptions, failed requests and HTTP
// errors. `allow` filters out expected failures (for example a deliberate 401).
function watchProblems(page, allow = []) {
  const problems = [];
  const allowed = (text) => allow.some((pattern) => pattern.test(text));
  page.on('console', (message) => {
    if (message.type() === 'error' && !allowed(message.text())) problems.push('console: ' + message.text());
  });
  page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
  page.on('requestfailed', (request) => {
    const text = 'requestfailed: ' + request.url() + ' ' + (request.failure() || {}).errorText;
    if (!allowed(text)) problems.push(text);
  });
  page.on('response', (response) => {
    const text = 'HTTP ' + response.status() + ' ' + response.url();
    if (response.status() >= 400 && !allowed(text)) problems.push(text);
  });
  return problems;
}

// Records every analytics event and stubs window.open, before page scripts run.
async function instrument(page) {
  await page.addInitScript(() => {
    window.__events = [];
    window.__opened = [];
    document.addEventListener('infinite:analytics', (event) => window.__events.push(event.detail));
    window.open = (url) => {
      window.__opened.push(String(url));
      return null;
    };
  });
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'WhatsApp stub' }));
}

async function events(page, name) {
  const all = await page.evaluate(() => window.__events.slice());
  return name ? all.filter((event) => event.name === name) : all;
}

async function openCatalogue(page) {
  await page.locator('#mainNav a[href="#catalogue"]').evaluate((link) => link.click());
  await page.locator('#catalogue').waitFor({ state: 'visible' });
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    window.scrollTo(0, 0);
  });
}

// Serves js/site-config.js with reviewMode on: the owner preview, which also
// lists products that have no photo yet and shows unfinished content.
async function useReviewMode(page) {
  await page.route('**/js/site-config.js', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    if (!source.includes('reviewMode: false')) throw new Error('reviewMode: false not found in js/site-config.js');
    await route.fulfill({ response, body: source.replace('reviewMode: false', 'reviewMode: true') });
  });
}

function decodeWhatsApp(url) {
  const parsed = new URL(url);
  return { number: parsed.pathname.slice(1), text: parsed.searchParams.get('text') || '' };
}

module.exports = { VIEWPORTS, watchProblems, instrument, events, openCatalogue, scrollThrough, decodeWhatsApp, useReviewMode };
