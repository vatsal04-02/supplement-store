// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 45000,
  expect: { timeout: 7000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node server/server.mjs',
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 20000,
    env: {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      ANALYTICS_DATA_DIR: 'test-results/analytics-data',
      ANALYTICS_ADMIN_TOKEN: 'test-admin-token-0123456789abcdef',
      ANALYTICS_ALLOW_HEADLESS: '1',
      QUIET: '1'
    }
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
