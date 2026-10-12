const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', 'docs/**', 'data/**'] },
  js.configs.recommended,
  { rules: { 'no-unused-vars': ['error', { caughtErrors: 'none' }] } },
  {
    files: ['js/**/*.js', 'admin/**/*.js'],
    languageOptions: { ecmaVersion: 2020, sourceType: 'script', globals: { ...globals.browser } },
    rules: { 'no-var': 'off', strict: ['error', 'function'] }
  },
  {
    files: ['server/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } }
  },
  {
    files: ['tests/**/*.js', 'playwright.config.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } }
  }
];
