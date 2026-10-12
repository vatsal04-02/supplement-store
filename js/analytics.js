/*
  Infinite Nutrition — analytics event layer
  ------------------------------------------
  One small, provider-neutral API for storefront measurement:

    InfiniteAnalytics.track('add_to_cart', { item_id: 'wellcore-micronised-creatine', quantity: 2 })

  - Only the events in js/analytics-schema.js are accepted; parameters are
    checked against its rules and anything else is dropped, so personal data cannot
    slip into reports by accident (search terms have e-mail addresses and
    long digit runs redacted).
  - Destinations:
      1. First-party collector (cookie-free) — `analytics.firstParty.endpoint`
         in js/site-config.js, served by server/server.mjs.
      2. Google Analytics 4 — only when a measurement ID is configured AND the
         visitor accepts the consent banner.
      3. window.dataLayer — for a tag manager the owner may add later.
  - Visitors can opt out under "Privacy & analytics"; Global Privacy Control
    and Do Not Track are honoured when `respectPrivacySignals` is true.
  - Every event records a click or a view. None of them is a confirmed order:
    the site has no checkout, so `begin_checkout` and `purchase` are never
    sent, and a WhatsApp click is reported as a click, not a submitted
    enquiry.
*/
(function () {
  'use strict';

  var SITE = window.INFINITE_SITE || {};
  var cfg = SITE.analytics || {};

  // Allowed events, parameters and sanitising rules: js/analytics-schema.js
  // (shared with the server so both sides apply identical rules).
  var SCHEMA = window.InfiniteAnalyticsSchema;
  if (!SCHEMA) return;
  var EVENT_SCHEMA = SCHEMA.EVENT_SCHEMA;
  var sanitizeParams = SCHEMA.sanitizeParams;
  var cleanId = SCHEMA.cleanId;

  var KEYS = {
    optOut: 'infinite-analytics-optout',
    ga4: 'infinite-analytics-ga4-consent',
    session: 'infinite-analytics-session',
    landing: 'infinite-analytics-landing'
  };

  function storageGet(area, key) {
    try {
      return window[area].getItem(key);
    } catch (error) {
      return null;
    }
  }
  function storageSet(area, key, value) {
    try {
      if (value == null) window[area].removeItem(key);
      else window[area].setItem(key, value);
    } catch (error) {
      /* storage unavailable: keep the in-memory state */
    }
  }

  var isLocal = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var debug = cfg.debug === true || (cfg.debug === 'auto' && isLocal);
  var privacySignal = !!(navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1');
  var respectSignals = cfg.respectPrivacySignals !== false;
  var endpoint =
    cfg.firstParty && cfg.firstParty.enabled && typeof cfg.firstParty.endpoint === 'string' ? cfg.firstParty.endpoint.trim() : '';
  // A page opened straight from disk has no server to send to.
  if (location.protocol === 'file:') endpoint = '';
  var ga4Id =
    typeof cfg.ga4MeasurementId === 'string' && /^G-[A-Z0-9]{4,20}$/.test(cfg.ga4MeasurementId.trim()) ? cfg.ga4MeasurementId.trim() : '';

  var state = {
    optOut: storageGet('localStorage', KEYS.optOut) === '1',
    ga4Consent: storageGet('localStorage', KEYS.ga4) // 'granted' | 'denied' | null
  };
  var status = { sent: 0, failed: 0, dropped: 0, lastError: '' };
  var recent = [];
  var lastFingerprint = { key: '', at: 0 };
  var pageViewSent = false;

  function blockedBySignal() {
    return respectSignals && privacySignal;
  }
  function measuringAllowed() {
    return !state.optOut && !blockedBySignal();
  }
  function firstPartyActive() {
    return !!endpoint && measuringAllowed();
  }
  function ga4Active() {
    return !!ga4Id && state.ga4Consent === 'granted' && measuringAllowed();
  }

  function randomHex(bytes) {
    var out = '';
    try {
      var buf = new Uint8Array(bytes);
      crypto.getRandomValues(buf);
      for (var i = 0; i < buf.length; i++) out += ('0' + buf[i].toString(16)).slice(-2);
    } catch (error) {
      for (var j = 0; j < bytes * 2; j++) out += Math.floor(Math.random() * 16).toString(16);
    }
    return out;
  }

  // A random identifier scoped to this browser tab. It is not a cookie, is
  // not persisted after the tab closes and is never linked to a person.
  // When storage is blocked the id lives in memory for this page instead.
  var memorySessionId = '';
  function sessionId() {
    var id = storageGet('sessionStorage', KEYS.session) || memorySessionId;
    if (!id || !/^[a-f0-9]{16}$/.test(id)) {
      id = randomHex(8);
      storageSet('sessionStorage', KEYS.session, id);
    }
    memorySessionId = id;
    return id;
  }

  function landingContext() {
    var stored = storageGet('sessionStorage', KEYS.landing);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        /* rebuild below */
      }
    }
    var ctx = { ref: '', utm_source: '', utm_medium: '', utm_campaign: '' };
    try {
      if (document.referrer) {
        var ref = new URL(document.referrer);
        if (ref.hostname && ref.hostname !== location.hostname) ctx.ref = ref.hostname.replace(/^www\./, '').slice(0, 80);
      }
      var params = new URLSearchParams(location.search);
      ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (key) {
        var value = params.get(key);
        if (value) ctx[key] = cleanId(value).slice(0, 60);
      });
    } catch (error) {
      /* keep empty context */
    }
    storageSet('sessionStorage', KEYS.landing, JSON.stringify(ctx));
    return ctx;
  }

  // Media queries rather than innerWidth, so tracking never forces a layout.
  var mobileQuery = window.matchMedia('(max-width: 767.98px)');
  var tabletQuery = window.matchMedia('(max-width: 1099.98px)');
  function deviceClass() {
    return mobileQuery.matches ? 'mobile' : tabletQuery.matches ? 'tablet' : 'desktop';
  }

  function log() {
    if (!debug || !window.console) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('%c[analytics]', 'color:#b80019;font-weight:700');
    console.info.apply(console, args);
  }

  /* ---------- first-party transport ---------- */
  var queue = [];
  var flushTimer = 0;

  function scheduleFlush() {
    if (queue.length >= 20) {
      flush();
      return;
    }
    if (!flushTimer) flushTimer = window.setTimeout(flush, 4000);
  }

  function flush(onExit) {
    if (flushTimer) {
      window.clearTimeout(flushTimer);
      flushTimer = 0;
    }
    if (!queue.length || !firstPartyActive()) {
      queue.length = 0;
      return;
    }
    while (queue.length) {
      var batch = queue.splice(0, 25);
      var body = JSON.stringify({ v: 1, sid: sessionId(), events: batch });
      var sent = false;
      try {
        if (navigator.sendBeacon) sent = navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      } catch (error) {
        sent = false;
      }
      if (sent) {
        status.sent += batch.length;
        continue;
      }
      if (!window.fetch) {
        status.failed += batch.length;
        status.lastError = 'No transport available';
        continue;
      }
      (function (count) {
        window
          .fetch(endpoint, {
            method: 'POST',
            body: body,
            keepalive: !!onExit,
            credentials: 'omit',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
          })
          .then(function (response) {
            if (response.ok) status.sent += count;
            else {
              status.failed += count;
              status.lastError = 'Collector responded ' + response.status;
              log('collector error', response.status);
            }
          })
          .catch(function (error) {
            status.failed += count;
            status.lastError = (error && error.message) || 'Network error';
            log('collector unreachable', status.lastError);
          });
      })(batch.length);
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('pagehide', function () {
    flush(true);
  });

  /* ---------- Google Analytics 4 (consent-gated) ---------- */
  var gaLoaded = false;

  function gtag() {
    window.dataLayer.push(arguments);
  }

  function loadGa4() {
    if (gaLoaded || !ga4Active()) return;
    gaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || gtag;
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', ga4Id, { send_page_view: false });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga4Id);
    script.onerror = function () {
      status.lastError = 'Google Analytics script failed to load';
      log(status.lastError);
    };
    document.head.appendChild(script);
  }

  var GA_ITEM_EVENTS = { view_item: 1, select_item: 1, add_to_cart: 1, remove_from_cart: 1 };
  function forwardToGa4(name, params) {
    if (!ga4Active() || !window.gtag) return;
    var payload = {};
    Object.keys(params).forEach(function (key) {
      payload[key] = params[key];
    });
    if (GA_ITEM_EVENTS[name] && params.item_id) {
      var item = { item_id: params.item_id };
      ['item_name', 'item_brand', 'item_category', 'item_variant', 'quantity', 'price', 'index', 'item_list_id'].forEach(function (key) {
        if (params[key] != null) item[key] = params[key];
      });
      payload.items = [item];
    }
    if (name === 'view_item_list' && params.item_ids) {
      payload.items = params.item_ids.map(function (id, i) {
        return { item_id: id, index: i };
      });
      delete payload.item_ids;
    }
    window.gtag('event', name, payload);
  }

  // GA sets cookies on the registrable domain (e.g. .example.co.in), which
  // cannot be derived reliably from label counts, so deletion is attempted for
  // the host and every parent domain. Browsers ignore domains that do not apply.
  function cookieDomains(hostname) {
    var parts = String(hostname).split('.');
    var domains = [''];
    for (var i = 0; i < parts.length - 1; i++) domains.push('.' + parts.slice(i).join('.'));
    return domains;
  }

  function clearGaCookies() {
    try {
      var domains = cookieDomains(location.hostname);
      document.cookie.split(';').forEach(function (cookie) {
        var name = cookie.split('=')[0].trim();
        if (!/^_ga/.test(name)) return;
        domains.forEach(function (domain) {
          document.cookie = name + '=; Max-Age=0; path=/' + (domain ? '; domain=' + domain : '');
        });
      });
    } catch (error) {
      /* best effort */
    }
  }

  /* ---------- public API ---------- */
  function track(name, params) {
    if (!Object.prototype.hasOwnProperty.call(EVENT_SCHEMA, name)) {
      log('ignored unknown event', name);
      return false;
    }
    if (!measuringAllowed()) return false;
    if (name === 'page_view') {
      if (pageViewSent) return false;
      pageViewSent = true;
    }
    var clean = sanitizeParams(params);
    var key = name + '|' + JSON.stringify(clean);
    var now = Date.now();
    // Guard against the same event firing twice in one interaction (for
    // example from two listeners). Real repeated clicks are kept.
    if (key === lastFingerprint.key && now - lastFingerprint.at < 60) {
      status.dropped++;
      return false;
    }
    lastFingerprint = { key: key, at: now };

    var event = { name: name, params: clean, ts: now, path: location.pathname.slice(0, 120) || '/', device: deviceClass() };
    if (name === 'page_view') {
      var landing = landingContext();
      Object.keys(landing).forEach(function (k) {
        if (landing[k]) event[k] = landing[k];
      });
    }

    recent.push(event);
    if (recent.length > 60) recent.shift();
    log(name, clean);

    if (firstPartyActive()) {
      queue.push(event);
      scheduleFlush();
    }
    forwardToGa4(name, clean);
    // A separately installed Google Tag Manager container can pick events up
    // from the dataLayer. Skipped when gtag.js is in use, to avoid double counts.
    if (!gaLoaded && window.dataLayer && window.google_tag_manager) {
      var layerEvent = { event: name };
      Object.keys(clean).forEach(function (k) {
        layerEvent[k] = clean[k];
      });
      window.dataLayer.push(layerEvent);
    }
    try {
      document.dispatchEvent(new CustomEvent('infinite:analytics', { detail: event }));
    } catch (error) {
      /* old browsers */
    }
    return true;
  }

  function setOptOut(optOut) {
    state.optOut = !!optOut;
    storageSet('localStorage', KEYS.optOut, state.optOut ? '1' : null);
    if (state.optOut) {
      queue.length = 0;
      if (window.gtag && gaLoaded) window.gtag('consent', 'update', { analytics_storage: 'denied' });
      clearGaCookies();
    } else if (ga4Active()) {
      // Turning statistics back on restores an earlier Google Analytics consent.
      if (gaLoaded && window.gtag) window.gtag('consent', 'update', { analytics_storage: 'granted' });
      else loadGa4();
    }
    syncBanner();
  }

  function setGa4Consent(granted) {
    state.ga4Consent = granted ? 'granted' : 'denied';
    storageSet('localStorage', KEYS.ga4, state.ga4Consent);
    if (granted) {
      loadGa4();
      if (gaLoaded && window.gtag) {
        window.gtag('consent', 'update', { analytics_storage: 'granted' });
        // Send the current page view now that measurement is allowed.
        window.gtag('event', 'page_view', { page_path: location.pathname });
      }
    } else {
      if (gaLoaded && window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
      clearGaCookies();
    }
    syncBanner();
  }

  function getState() {
    return {
      firstPartyConfigured: !!endpoint,
      firstPartyActive: firstPartyActive(),
      ga4Configured: !!ga4Id,
      ga4Consent: state.ga4Consent,
      ga4Active: ga4Active(),
      optOut: state.optOut,
      privacySignal: privacySignal,
      respectsPrivacySignals: respectSignals,
      debug: debug
    };
  }

  /* ---------- consent banner (only when GA4 is configured) ---------- */
  var banner = document.getElementById('consentBanner');

  function syncBanner() {
    if (!banner) return;
    var firstPartyNote = document.getElementById('consentFirstPartyNote');
    if (firstPartyNote) firstPartyNote.hidden = !endpoint;
    var show = !!ga4Id && !state.ga4Consent && measuringAllowed();
    banner.hidden = !show;
    document.documentElement.classList.toggle('consent-open', show);
  }

  if (banner) {
    banner.addEventListener('click', function (event) {
      var button = event.target.closest('[data-consent]');
      if (!button) return;
      setGa4Consent(button.getAttribute('data-consent') === 'grant');
    });
  }

  window.InfiniteAnalytics = {
    track: track,
    flush: flush,
    setOptOut: setOptOut,
    setGa4Consent: setGa4Consent,
    getState: getState,
    status: function () {
      return { sent: status.sent, failed: status.failed, dropped: status.dropped, lastError: status.lastError, queued: queue.length };
    },
    cookieDomains: cookieDomains,
    recent: function () {
      return recent.slice();
    },
    schema: EVENT_SCHEMA
  };

  syncBanner();
  if (ga4Active()) loadGa4();
  // page_view is sent once the storefront script has rendered (see js/app.js),
  // so the first event already reflects the page that visitors actually see.
})();
