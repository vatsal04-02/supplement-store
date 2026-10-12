#!/usr/bin/env node
// Lighthouse audit of the production build.
//
//   npm run build && npm run audit:lighthouse
//
// Starts the Node server on dist/ (minified, compressed, with production
// headers), runs Lighthouse for mobile and desktop, prints the category
// scores and key metrics, and writes the JSON reports to reports/lighthouse/.
// Set CHROME_PATH if Chrome/Chromium is not found automatically.

import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'reports', 'lighthouse');
const PORT = 4321;
const URL = `http://127.0.0.1:${PORT}/`;

const candidates = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const chrome = candidates.find((p) => p && existsSync(p));

if (!existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  console.error('dist/ is missing: run `npm run build` first.');
  process.exit(1);
}

const dataDir = path.join(ROOT, 'test-results', 'lighthouse-data');
const server = spawn(process.execPath, ['server/server.mjs'], {
  cwd: ROOT,
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), HOST: '127.0.0.1', STATIC_ROOT: 'dist', ANALYTICS_DATA_DIR: dataDir, QUIET: '1' },
  stdio: 'ignore'
});

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(URL + 'api/health');
      if (response.ok) return;
    } catch (error) {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('server did not start');
}

function run(preset) {
  const file = path.join(OUT, `${preset}.json`);
  const args = ['--yes', 'lighthouse@13.5.0', URL, '--quiet', '--output=json', `--output-path=${file}`, '--only-categories=performance,accessibility,best-practices,seo', '--chrome-flags=--headless=new --no-sandbox'];
  if (preset === 'desktop') args.push('--preset=desktop');
  execFileSync('npx', args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, CHROME_PATH: chrome || '' } });
  return file;
}

try {
  await mkdir(OUT, { recursive: true });
  await waitForServer();
  for (const preset of ['mobile', 'desktop']) {
    const report = JSON.parse(await readFile(run(preset), 'utf8'));
    const scores = Object.values(report.categories).map((c) => `${c.title} ${Math.round(c.score * 100)}`).join(' · ');
    const audit = (id) => report.audits[id] && report.audits[id].displayValue;
    console.log(`\n${preset.toUpperCase()}  ${scores}`);
    console.log(`  LCP ${audit('largest-contentful-paint')} · FCP ${audit('first-contentful-paint')} · TBT ${audit('total-blocking-time')} · CLS ${audit('cumulative-layout-shift')} · Speed Index ${audit('speed-index')}`);
    const failing = Object.values(report.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable' && a.scoreDisplayMode !== 'manual');
    if (failing.length) console.log('  below 90: ' + failing.map((a) => `${a.id}${a.displayValue ? ` (${a.displayValue})` : ''}`).join(', '));
  }
} finally {
  server.kill();
  await rm(dataDir, { recursive: true, force: true });
}
