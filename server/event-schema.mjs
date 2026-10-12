// Server-side copy of the storefront event schema (js/analytics.js).
// tests/analytics-server.spec.js fails if the two lists drift apart.

export const EVENT_NAMES = [
  'page_view',
  'view_item_list',
  'select_item',
  'search',
  'filter_products',
  'view_item',
  'add_to_cart',
  'remove_from_cart',
  'view_cart',
  'click_whatsapp',
  'contact_store',
  'view_store_location',
  'open_policy'
];

export const PARAM_RULES = {
  item_id: 'id',
  item_name: 'text',
  item_brand: 'text',
  item_category: 'id',
  item_variant: 'text',
  item_list_id: 'id',
  item_list_name: 'text',
  item_ids: 'idlist',
  index: 'int',
  quantity: 'int',
  value: 'num',
  price: 'num',
  currency: 'id',
  search_term: 'term',
  results_count: 'int',
  filter_type: 'id',
  filter_value: 'text',
  source: 'id',
  contact: 'id',
  context: 'id',
  items_count: 'int',
  lines_count: 'int',
  method: 'id',
  policy: 'id',
  action: 'id'
};

const EVENT_SET = new Set(EVENT_NAMES);

function cleanText(value, max = 80) {
  // Control characters are stripped on purpose.
  return (
    String(value)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)
  );
}
function cleanId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
function cleanTerm(value) {
  return cleanText(value, 120)
    .toLowerCase()
    .replace(/[^\s@]+@[^\s@]+/g, '[email]')
    .replace(/\+?\d[\d\s-]{5,}\d/g, '[number]')
    .slice(0, 60);
}

export function sanitizeParams(params) {
  const out = {};
  if (!params || typeof params !== 'object' || Array.isArray(params)) return out;
  for (const [key, raw] of Object.entries(params)) {
    const rule = PARAM_RULES[key];
    if (!rule || raw == null || raw === '') continue;
    let value = raw;
    if (rule === 'id') {
      value = cleanId(value);
      if (value) out[key] = value;
    } else if (rule === 'text') {
      value = cleanText(value);
      if (value) out[key] = value;
    } else if (rule === 'term') {
      value = cleanTerm(value);
      if (value) out[key] = value;
    } else if (rule === 'int') {
      value = Number(value);
      if (Number.isInteger(value) && value >= 0 && value <= 100000) out[key] = value;
    } else if (rule === 'num') {
      value = Number(value);
      if (Number.isFinite(value) && value >= 0 && value <= 10000000) out[key] = Math.round(value * 100) / 100;
    } else if (rule === 'idlist' && Array.isArray(value)) {
      value = value.map(cleanId).filter(Boolean).slice(0, 24);
      if (value.length) out[key] = value;
    }
  }
  return out;
}

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
