// Server side of the storefront event schema. The allowed events, parameter
// rules and sanitisers come from js/analytics-schema.js, the same file the
// browser loads, so both sides always apply identical rules.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const schema = require('../js/analytics-schema.js');

export const EVENT_NAMES = schema.EVENT_NAMES;
export const PARAM_RULES = schema.PARAM_RULES;
export const sanitizeParams = schema.sanitizeParams;
const { cleanText, cleanId } = schema;
const EVENT_SET = new Set(EVENT_NAMES);

const DEVICES = new Set(['mobile', 'tablet', 'desktop']);

// Returns a normalised event or null when the input is not acceptable.
export function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!EVENT_SET.has(raw.name)) return null;
  const event = {
    n: raw.name,
    p: sanitizeParams(raw.params),
    path: typeof raw.path === 'string' && raw.path.startsWith('/') ? cleanText(raw.path, 120).replace(/\s/g, '') : '/',
    d: DEVICES.has(raw.device) ? raw.device : 'unknown'
  };
  if (Number.isFinite(raw.ts)) event.ct = Math.round(raw.ts);
  if (raw.name === 'page_view') {
    if (typeof raw.ref === 'string' && /^[a-z0-9.-]{1,80}$/i.test(raw.ref)) event.ref = raw.ref.toLowerCase();
    for (const [from, to] of [
      ['utm_source', 'us'],
      ['utm_medium', 'um'],
      ['utm_campaign', 'uc']
    ]) {
      if (typeof raw[from] === 'string' && raw[from]) {
        const v = cleanId(raw[from]).slice(0, 60);
        if (v) event[to] = v;
      }
    }
  }
  return event;
}
