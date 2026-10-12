/*
  Infinite Nutrition — analytics event schema (shared)
  ----------------------------------------------------
  One definition of the allowed events, their parameters and the sanitising
  rules, used by the browser layer (js/analytics.js, as
  window.InfiniteAnalyticsSchema) and by the server (server/event-schema.mjs,
  via require). Change it here and both sides follow.
*/
/* global module */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InfiniteAnalyticsSchema = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // name -> description (documented in docs/ANALYTICS.md)
  var EVENT_SCHEMA = {
    page_view: 'A storefront page was loaded',
    view_item_list: 'A product list became visible (featured range or catalogue)',
    select_item: 'A product was chosen from a list',
    search: 'A catalogue search was made (debounced)',
    filter_products: 'A category, brand or sort control was applied',
    view_item: 'A product details dialog was opened',
    add_to_cart: 'Units were added to the order list',
    remove_from_cart: 'Units were removed from the order list',
    view_cart: 'The order list drawer was opened',
    click_whatsapp: 'A WhatsApp link or button was used (a click, not a sent message)',
    contact_store: 'A telephone link was used',
    view_store_location: 'The store location block was viewed, or directions were opened',
    open_policy: 'A policy dialog was opened'
  };

  var PARAM_RULES = {
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

  // Control characters are stripped on purpose.
  // eslint-disable-next-line no-control-regex
  var CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

  function cleanText(value, max) {
    return String(value)
      .replace(CONTROL_CHARS, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max || 80);
  }

  function cleanId(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  }

  // Search terms: e-mail addresses and runs of 7+ digits (phone numbers) are
  // replaced before anything is stored.
  function cleanTerm(value) {
    return cleanText(value, 120)
      .toLowerCase()
      .replace(/[^\s@]+@[^\s@]+/g, '[email]')
      .replace(/\+?\d[\d\s-]{5,}\d/g, '[number]')
      .slice(0, 60);
  }

  function sanitizeParams(params) {
    var out = {};
    if (!params || typeof params !== 'object' || Array.isArray(params)) return out;
    Object.keys(params).forEach(function (key) {
      var rule = PARAM_RULES[key];
      var value = params[key];
      if (!rule || value == null || value === '') return;
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
    });
    return out;
  }

  return {
    EVENT_SCHEMA: EVENT_SCHEMA,
    EVENT_NAMES: Object.keys(EVENT_SCHEMA),
    PARAM_RULES: PARAM_RULES,
    cleanText: cleanText,
    cleanId: cleanId,
    cleanTerm: cleanTerm,
    sanitizeParams: sanitizeParams
  };
});
