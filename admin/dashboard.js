/*
  Infinite Nutrition — owner analytics dashboard
  ----------------------------------------------
  Reads aggregated reports from GET /api/stats (server/server.mjs) with the
  owner's access token. Nothing here invents numbers: when no data exists the
  page says so. "Preview with demo data" renders clearly labelled synthetic
  numbers generated in the browser, for layout review only.

  All text from reports (search terms, product names, sources) is inserted
  with textContent; no report value is ever parsed as HTML.
*/
(function () {
  'use strict';

  var TOKEN_KEY = 'infinite-dashboard-token';
  var DAY = 86400000;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var categoryLabels = {};
  (window.INFINITE_CATALOGUE_CATEGORIES || []).forEach(function (c) {
    categoryLabels[c.id] = c.label;
  });
  var productNames = {};
  (window.INFINITE_PRODUCTS || []).forEach(function (p) {
    productNames[p.id] = { name: p.name, brand: p.brand, category: p.category };
  });

  var numberFormat = new Intl.NumberFormat('en-IN');
  var percentFormat = new Intl.NumberFormat('en-IN', { style: 'percent', maximumFractionDigits: 1 });
  var dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  var shortDateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  var timeFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'text') node.textContent = attrs[key];
        else if (key === 'className') node.className = attrs[key];
        else if (attrs[key] !== false && attrs[key] != null) node.setAttribute(key, attrs[key] === true ? '' : attrs[key]);
      });
    }
    (children || []).forEach(function (child) {
      if (child == null) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function svg(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function fmt(n) {
    return numberFormat.format(Math.round(n || 0));
  }
  function compact(n) {
    if (n >= 100000) return (n / 100000).toFixed(n >= 1000000 ? 0 : 1).replace(/\.0$/, '') + 'L';
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  }
  function pct(value) {
    return value == null ? '—' : percentFormat.format(value);
  }
  function dateLabel(d) {
    return dateFormat.format(new Date(d + 'T00:00:00Z'));
  }
  function shortDate(d) {
    return shortDateFormat.format(new Date(d + 'T00:00:00Z'));
  }
  function istToday() {
    return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  }
  function addDays(d, n) {
    return new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
  }
  function dayCount(from, to) {
    return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY) + 1;
  }

  function storageGet(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }
  function storageSet(key, value) {
    try {
      if (value == null) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, value);
    } catch (error) {
      /* tab-only storage unavailable: token stays in memory */
    }
  }

  var state = { token: storageGet(TOKEN_KEY), demo: false, from: '', to: '', current: null, previous: null, requestId: 0 };

  /* ---------- data access ---------- */
  function ApiError(kind, message, status) {
    this.kind = kind;
    this.message = message;
    this.status = status;
  }

  function fetchReport(from, to) {
    if (state.demo) return Promise.resolve(demoReport(from, to));
    var url = '/api/stats?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
    return fetch(url, { headers: { Authorization: 'Bearer ' + state.token }, cache: 'no-store', credentials: 'same-origin' })
      .catch(function () {
        throw new ApiError(
          'network',
          'Could not reach the analytics API at /api/stats. This dashboard works when the site runs on the included Node server (npm start). A static host has no report API.'
        );
      })
      .then(function (response) {
        if (response.ok) return response.json();
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            if (response.status === 401) throw new ApiError('auth', 'That access token was not accepted.', 401);
            if (response.status === 429)
              throw new ApiError('auth', 'Too many unsuccessful attempts. Wait 15 minutes, then try again.', 429);
            if (response.status === 503 && body.error === 'not_configured')
              throw new ApiError('config', body.message || 'Reports are not configured on the server.', 503);
            if (response.status === 400) throw new ApiError('range', body.message || 'That date range cannot be reported.', 400);
            if (response.status === 404 || response.status === 405)
              throw new ApiError(
                'network',
                'This host has no analytics API (for example a Vercel or other static deployment). Reports need the included Node server (npm start); use Google Analytics on static hosting.',
                response.status
              );
            throw new ApiError(
              'server',
              'The server could not build the report (error ' + response.status + '). Try again shortly.',
              response.status
            );
          });
      });
  }

  /* ---------- demo data (clearly labelled, never stored) ---------- */
  function seeded(seedText) {
    var h = 1779033703 ^ seedText.length;
    for (var i = 0; i < seedText.length; i++) {
      h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function demoReport(from, to) {
    var days = dayCount(from, to);
    var daily = [];
    for (var i = 0; i < days; i++) {
      var date = addDays(from, i);
      var r = seeded('demo|' + date);
      var weekday = new Date(date + 'T00:00:00Z').getUTCDay();
      var trend = 1 + (Date.parse(date) - Date.parse('2026-01-01')) / (DAY * 900);
      var sessions = Math.round((34 + r() * 30 + (weekday === 0 || weekday === 6 ? 14 : 0)) * trend);
      var productViews = Math.round(sessions * (0.28 + r() * 0.12));
      daily.push({
        date: date,
        sessions: sessions,
        visitors: Math.round(sessions * (0.82 + r() * 0.08)),
        pageViews: Math.round(sessions * (1.2 + r() * 0.3)),
        productViews: productViews,
        addToCartUnits: Math.round(productViews * (0.18 + r() * 0.12)),
        whatsappClicks: Math.round(sessions * (0.06 + r() * 0.05))
      });
    }
    var sum = function (key) {
      return daily.reduce(function (n, d) {
        return n + d[key];
      }, 0);
    };
    var totals = {
      sessions: sum('sessions'),
      visitors: sum('visitors'),
      pageViews: sum('pageViews'),
      productViews: sum('productViews'),
      addToCartUnits: sum('addToCartUnits'),
      whatsappClicks: sum('whatsappClicks')
    };
    totals.events = totals.pageViews * 6;
    totals.phoneClicks = Math.round(totals.sessions * 0.025);
    totals.searches = Math.round(totals.sessions * 0.11);
    totals.searchesNoResults = Math.round(totals.searches * 0.36);
    totals.removeFromCartUnits = Math.round(totals.addToCartUnits * 0.14);
    var rand = seeded('demo-split|' + from + '|' + to);
    var ids = Object.keys(productNames);
    var weights = ids.map(function () {
      return 0.4 + rand();
    });
    var weightSum = weights.reduce(function (a, b) {
      return a + b;
    }, 0);
    var products = ids
      .map(function (id, index) {
        var share = weights[index] / weightSum;
        return {
          id: id,
          name: productNames[id].name,
          brand: productNames[id].brand,
          category: productNames[id].category,
          views: Math.round(totals.productViews * share),
          selects: Math.round(totals.productViews * share * 0.8),
          addUnits: Math.round(totals.addToCartUnits * share),
          removeUnits: Math.round(totals.removeFromCartUnits * share),
          whatsappClicks: Math.round(totals.whatsappClicks * share * 0.4)
        };
      })
      .sort(function (a, b) {
        return b.views - a.views;
      });
    var categories = Object.keys(categoryLabels)
      .map(function (id) {
        return { id: id, filterUses: Math.round(totals.sessions * (0.02 + rand() * 0.08)), productViews: 0, addUnits: 0 };
      })
      .sort(function (a, b) {
        return b.filterUses - a.filterUses;
      });
    var terms = [
      'creatine',
      'whey protein',
      'peanut butter',
      'pre workout',
      'mass gainer',
      'bcaa',
      'l carnitine',
      'multivitamin',
      'isolate',
      'fish oil'
    ];
    var noMatch = { 'whey protein': 1, 'pre workout': 1, 'mass gainer': 1, bcaa: 1, multivitamin: 1, isolate: 1, 'fish oil': 1 };
    var top = terms
      .map(function (term) {
        var count = Math.max(1, Math.round(totals.searches * (0.03 + rand() * 0.16)));
        return { term: term, count: count, noResults: noMatch[term] ? count : 0 };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });
    var withProductView = Math.round(totals.sessions * 0.31);
    var withAdd = Math.round(withProductView * 0.34);
    var withWhatsapp = Math.round(totals.sessions * 0.085);
    var rate = function (n, d) {
      return { numerator: n, denominator: d, value: d ? n / d : null };
    };
    return {
      range: { from: from, to: to, days: days, timezone: 'Asia/Kolkata' },
      totals: totals,
      funnel: [
        { step: 'sessions', label: 'Visits', count: totals.sessions },
        { step: 'product_view', label: 'Opened product details', count: withProductView },
        { step: 'add_to_cart', label: 'Added to the order list', count: withAdd },
        { step: 'click_whatsapp', label: 'Opened a WhatsApp enquiry', count: withWhatsapp }
      ],
      rates: {
        productViewRate: rate(withProductView, totals.sessions),
        addToListRate: rate(withAdd, totals.sessions),
        whatsappRate: rate(withWhatsapp, totals.sessions),
        noResultSearchRate: rate(totals.searchesNoResults, totals.searches)
      },
      daily: daily,
      products: products,
      categories: categories,
      searches: {
        top: top,
        noResults: top
          .filter(function (t) {
            return t.noResults;
          })
          .map(function (t) {
            return { term: t.term, count: t.noResults };
          })
      },
      sources: [
        { name: 'direct', sessions: Math.round(totals.sessions * 0.46) },
        { name: 'google.com', sessions: Math.round(totals.sessions * 0.31) },
        { name: 'instagram.com', sessions: Math.round(totals.sessions * 0.15) },
        { name: 'utm:whatsapp-status', sessions: Math.round(totals.sessions * 0.08) }
      ],
      devices: [
        { name: 'mobile', sessions: Math.round(totals.sessions * 0.74) },
        { name: 'desktop', sessions: Math.round(totals.sessions * 0.19) },
        { name: 'tablet', sessions: Math.round(totals.sessions * 0.07) }
      ],
      whatsappSources: [
        { source: 'catalogue', clicks: Math.round(totals.whatsappClicks * 0.32) },
        { source: 'order_list', clicks: Math.round(totals.whatsappClicks * 0.27) },
        { source: 'mobile_bar', clicks: Math.round(totals.whatsappClicks * 0.18) },
        { source: 'header', clicks: Math.round(totals.whatsappClicks * 0.11) },
        { source: 'visit', clicks: Math.round(totals.whatsappClicks * 0.08) },
        { source: 'featured', clicks: Math.round(totals.whatsappClicks * 0.04) }
      ],
      contactSplit: { primary: Math.round(totals.whatsappClicks * 0.82), secondary: Math.round(totals.whatsappClicks * 0.18), other: 0 },
      meta: {
        demo: true,
        generatedAt: new Date().toISOString(),
        env: 'demo',
        timezone: 'Asia/Kolkata',
        firstEventAt: null,
        lastEventAt: null
      }
    };
  }

  /* ---------- labels ---------- */
  var SOURCE_LABELS = {
    catalogue: 'Product catalogue',
    order_list: 'Order list drawer',
    mobile_bar: 'Phone quick bar',
    header: 'Header button',
    home: 'Hero',
    visit: 'Visit & contact section',
    featured: 'Featured range',
    footer: 'Footer',
    details_dialog: 'Product details dialog',
    finder: 'Goal finder',
    reviews: 'Reviews section',
    faq: 'FAQ',
    'store-location': 'Store location',
    unknown: 'Not recorded',
    page: 'Elsewhere on the page'
  };
  function sourceLabel(id) {
    if (SOURCE_LABELS[id]) return SOURCE_LABELS[id];
    return String(id || 'unknown')
      .replace(/[_-]+/g, ' ')
      .replace(/^./, function (c) {
        return c.toUpperCase();
      });
  }
  function trafficLabel(name) {
    if (name === 'direct') return 'Direct or unknown';
    if (/^utm:/.test(name)) return 'Campaign: ' + name.slice(4);
    return name;
  }
  function deviceLabel(name) {
    return { mobile: 'Phone', tablet: 'Tablet', desktop: 'Desktop', unknown: 'Unknown' }[name] || name;
  }
  function productLabel(row) {
    var known = productNames[row.id];
    if (known) return { name: known.name, brand: known.brand };
    return { name: row.name || row.id, brand: row.brand || '' };
  }

  /* ---------- rendering helpers ---------- */
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function emptyNote(text) {
    return el('p', { className: 'empty-note', text: text });
  }

  function table(caption, columns, rows) {
    var thead = el('thead', null, [
      el(
        'tr',
        null,
        columns.map(function (c) {
          return el('th', { scope: 'col', className: c.num ? 'num' : '', text: c.label });
        })
      )
    ]);
    var tbody = el(
      'tbody',
      null,
      rows.map(function (row) {
        return el(
          'tr',
          null,
          columns.map(function (c, i) {
            var value = row[i];
            var cell = el(i === 0 ? 'th' : 'td', { scope: i === 0 ? 'row' : null, className: c.num ? 'num' : '' });
            if (value && typeof value === 'object' && value.main != null) {
              cell.appendChild(document.createTextNode(value.main));
              if (value.sub) cell.appendChild(el('small', { text: value.sub }));
            } else {
              cell.textContent = value;
            }
            return cell;
          })
        );
      })
    );
    return el('div', { className: 'table-wrap' }, [el('table', null, [caption ? el('caption', { text: caption }) : null, thead, tbody])]);
  }

  function barList(rows, options) {
    options = options || {};
    var max = rows.reduce(function (m, r) {
      return Math.max(m, r.value);
    }, 0);
    var total = rows.reduce(function (n, r) {
      return n + r.value;
    }, 0);
    return el(
      'ul',
      { className: 'bar-list' + (options.className ? ' ' + options.className : '') },
      rows.map(function (r) {
        var fill = el('span', { className: 'bar-fill', 'aria-hidden': 'true' });
        fill.style.width = (max ? Math.max(0.6, (r.value / max) * 82) : 0) + '%';
        var note = r.note != null ? r.note : options.share && total ? pct(r.value / total) : '';
        return el('li', { className: 'bar-row' }, [
          el('span', { className: 'bar-label', text: r.label }),
          el('span', { className: 'bar-track' }, [
            fill,
            el('span', { className: 'bar-value' }, [fmt(r.value), note ? el('small', { text: note }) : null])
          ])
        ]);
      })
    );
  }

  function niceMax(value) {
    if (value <= 4) return 4;
    var power = Math.pow(10, Math.floor(Math.log10(value)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) {
      if (steps[i] * power >= value) return steps[i] * power;
    }
    return 10 * power;
  }

  /* ---------- line chart (one measure per chart; no second axis) ---------- */
  var tooltip = $('chartTooltip');
  var tooltipOwner = null; // { surface, reposition } while a chart shows the tooltip
  function hideTooltip() {
    tooltip.hidden = true;
    tooltipOwner = null;
  }

  function lineChart(spec) {
    var figure = el('figure', { className: 'chart-figure' });
    var totalCurrent = spec.current.reduce(function (a, b) {
      return a + b;
    }, 0);
    var totalPrevious = spec.previous.reduce(function (a, b) {
      return a + b;
    }, 0);
    figure.appendChild(el('figcaption', null, [spec.title, el('span', { text: fmt(totalCurrent) + ' in range' })]));
    var surface = el('div', {
      className: 'chart-surface',
      tabindex: '0',
      role: 'img',
      'aria-label':
        spec.title +
        ', daily, ' +
        dateLabel(spec.dates[0]) +
        ' to ' +
        dateLabel(spec.dates[spec.dates.length - 1]) +
        ': ' +
        fmt(totalCurrent) +
        ' in total, against ' +
        fmt(totalPrevious) +
        ' in the previous period. Use the arrow keys to read each day, or open the table view.'
    });
    figure.appendChild(surface);

    var width = Math.max(260, Math.round(spec.width || 360));
    var height = 186;
    var m = { top: 12, right: 40, bottom: 26, left: 34 };
    var plotW = width - m.left - m.right;
    var plotH = height - m.top - m.bottom;
    var n = spec.current.length;
    var yMax = niceMax(Math.max.apply(null, spec.current.concat(spec.previous, [1])));
    var x = function (i) {
      return m.left + (n > 1 ? (i * plotW) / (n - 1) : plotW / 2);
    };
    var y = function (v) {
      return m.top + plotH - (v / yMax) * plotH;
    };

    var root = svg('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      width: width,
      height: height,
      'aria-hidden': 'true',
      focusable: 'false'
    });
    [0, 0.5, 1].forEach(function (t) {
      var v = yMax * t;
      root.appendChild(svg('line', { class: t === 0 ? 'baseline' : 'grid', x1: m.left, x2: m.left + plotW, y1: y(v), y2: y(v) }));
      var label = svg('text', { x: m.left - 8, y: y(v) + 4, 'text-anchor': 'end' });
      label.textContent = compact(v);
      root.appendChild(label);
    });
    var tickIdx = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : n === 2 ? [0, 1] : [0];
    tickIdx.forEach(function (i, k) {
      var label = svg('text', {
        x: x(i),
        y: height - 6,
        'text-anchor': tickIdx.length > 1 ? (k === 0 ? 'start' : k === tickIdx.length - 1 ? 'end' : 'middle') : 'middle'
      });
      label.textContent = shortDate(spec.dates[i]);
      root.appendChild(label);
    });

    function path(values) {
      return values
        .map(function (v, i) {
          return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1);
        })
        .join(' ');
    }
    if (n > 1) {
      root.appendChild(
        svg('path', {
          class: 'area-current',
          d: path(spec.current) + ' L' + x(n - 1).toFixed(1) + ' ' + y(0) + ' L' + x(0).toFixed(1) + ' ' + y(0) + ' Z'
        })
      );
    }
    root.appendChild(svg('path', { class: 'line-previous', d: path(spec.previous) }));
    root.appendChild(svg('path', { class: 'line-current', d: path(spec.current) }));
    root.appendChild(svg('circle', { class: 'dot-current', cx: x(n - 1), cy: y(spec.current[n - 1]), r: 4 }));
    var end = svg('text', { class: 'end-label', x: x(n - 1) + 8, y: y(spec.current[n - 1]) + 4 });
    end.textContent = compact(spec.current[n - 1]);
    root.appendChild(end);

    var cross = svg('line', { class: 'crosshair', x1: 0, x2: 0, y1: m.top, y2: m.top + plotH, visibility: 'hidden' });
    var dotPrev = svg('circle', { class: 'dot-previous', r: 4, visibility: 'hidden' });
    var dotCur = svg('circle', { class: 'dot-current', r: 4, visibility: 'hidden' });
    root.appendChild(cross);
    root.appendChild(dotPrev);
    root.appendChild(dotCur);
    surface.appendChild(root);

    var active = -1;
    function show(i, clientX, clientY) {
      active = Math.max(0, Math.min(n - 1, i));
      cross.setAttribute('x1', x(active));
      cross.setAttribute('x2', x(active));
      dotCur.setAttribute('cx', x(active));
      dotCur.setAttribute('cy', y(spec.current[active]));
      dotPrev.setAttribute('cx', x(active));
      dotPrev.setAttribute('cy', y(spec.previous[active]));
      [cross, dotCur, dotPrev].forEach(function (node) {
        node.setAttribute('visibility', 'visible');
      });
      clear(tooltip);
      tooltip.appendChild(
        el('div', {
          className: 'tt-date',
          text: dateLabel(spec.dates[active]) + (spec.prevDates[active] ? ' · vs ' + shortDate(spec.prevDates[active]) : '')
        })
      );
      tooltip.appendChild(
        el('div', { className: 'tt-row' }, [
          el('span', { className: 'key key-current', 'aria-hidden': 'true' }),
          el('strong', { text: fmt(spec.current[active]) }),
          el('span', { className: 'tt-name', text: 'selected period' })
        ])
      );
      tooltip.appendChild(
        el('div', { className: 'tt-row' }, [
          el('span', { className: 'key key-previous', 'aria-hidden': 'true' }),
          el('strong', { text: fmt(spec.previous[active]) }),
          el('span', { className: 'tt-name', text: 'previous period' })
        ])
      );
      tooltip.hidden = false;
      var box = root.getBoundingClientRect();
      var scale = box.width / width;
      var px = clientX != null ? clientX : box.left + x(active) * scale;
      var py = clientY != null ? clientY : box.top + y(spec.current[active]) * scale;
      var tw = tooltip.offsetWidth;
      var th = tooltip.offsetHeight;
      var left = px + 14 + tw > window.innerWidth - 8 ? px - tw - 14 : px + 14;
      tooltip.style.left = Math.max(8, left) + 'px';
      tooltip.style.top = Math.max(8, Math.min(window.innerHeight - th - 8, py - th - 10)) + 'px';
      tooltipOwner = {
        surface: surface,
        reposition: function () {
          show(active);
        }
      };
    }
    function hide() {
      active = -1;
      [cross, dotCur, dotPrev].forEach(function (node) {
        node.setAttribute('visibility', 'hidden');
      });
      hideTooltip();
    }
    surface.addEventListener('pointermove', function (event) {
      var box = root.getBoundingClientRect();
      var local = ((event.clientX - box.left) / box.width) * width;
      var i = n > 1 ? Math.round(((local - m.left) / plotW) * (n - 1)) : 0;
      show(i, event.clientX, event.clientY);
    });
    surface.addEventListener('pointerleave', hide);
    surface.addEventListener('blur', hide);
    surface.addEventListener('focus', function () {
      show(n - 1);
    });
    surface.addEventListener('keydown', function (event) {
      var keys = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1 };
      if (keys[event.key] != null) {
        event.preventDefault();
        show((active < 0 ? n - 1 : active) + keys[event.key]);
      } else if (event.key === 'Home') {
        event.preventDefault();
        show(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        show(n - 1);
      } else if (event.key === 'Escape') hide();
    });

    var details = el('details', { className: 'table-view' }, [el('summary', { text: 'Table view' })]);
    details.appendChild(
      table(
        spec.title + ' by day',
        [{ label: 'Date' }, { label: 'Selected', num: true }, { label: 'Previous period', num: true }],
        spec.dates.map(function (d, i) {
          return [
            dateLabel(d),
            fmt(spec.current[i]),
            { main: fmt(spec.previous[i]), sub: spec.prevDates[i] ? shortDate(spec.prevDates[i]) : '' }
          ];
        })
      )
    );
    figure.appendChild(details);
    return figure;
  }

  /* ---------- report rendering ---------- */
  var KPIS = [
    { key: 'sessions', label: 'Visits' },
    { key: 'visitors', label: 'Visitors (daily, summed)' },
    { key: 'productViews', label: 'Product detail views' },
    { key: 'addToCartUnits', label: 'Units added to order lists' },
    { key: 'whatsappClicks', label: 'WhatsApp taps' },
    { key: 'phoneClicks', label: 'Phone taps' }
  ];

  function deltaText(current, previous, days) {
    var period = 'previous ' + days + (days === 1 ? ' day' : ' days');
    if (!previous && !current) return { lead: 'No activity', rest: ' in this or the ' + period };
    if (!previous) return { lead: 'New', rest: ' · none in the ' + period };
    var change = (current - previous) / previous;
    var arrow = change > 0.0005 ? '▲ ' : change < -0.0005 ? '▼ ' : '';
    return { lead: arrow + (change > 0 ? '+' : '') + percentFormat.format(change), rest: ' vs ' + period };
  }

  function renderKpis(report, previous) {
    var row = clear($('kpiRow'));
    KPIS.forEach(function (k) {
      var value = report.totals[k.key] || 0;
      var delta = deltaText(value, previous ? previous.totals[k.key] || 0 : 0, report.range.days);
      row.appendChild(
        el('div', { className: 'kpi' }, [
          el('span', { className: 'kpi-label', text: k.label }),
          el('span', { className: 'kpi-value', text: fmt(value) }),
          el('span', { className: 'kpi-delta' }, [el('b', { text: delta.lead }), delta.rest]),
          report.meta.demo ? el('span', { className: 'kpi-demo', text: 'Demo' }) : null
        ])
      );
    });
  }

  function renderTrends(report, previous) {
    var host = clear($('trendCharts'));
    var dates = report.daily.map(function (d) {
      return d.date;
    });
    var prevDaily = previous ? previous.daily : [];
    var width = host.clientWidth > 900 ? (host.clientWidth - 44) / 3 : host.clientWidth;
    [
      ['sessions', 'Visits'],
      ['productViews', 'Product detail views'],
      ['whatsappClicks', 'WhatsApp taps']
    ].forEach(function (pair) {
      host.appendChild(
        lineChart({
          title: pair[1],
          width: width,
          dates: dates,
          current: report.daily.map(function (d) {
            return d[pair[0]] || 0;
          }),
          previous: report.daily.map(function (d, i) {
            return prevDaily[i] ? prevDaily[i][pair[0]] || 0 : 0;
          }),
          prevDates: report.daily.map(function (d, i) {
            return prevDaily[i] ? prevDaily[i].date : '';
          })
        })
      );
    });
  }

  function renderFunnel(report) {
    var host = clear($('funnelChart'));
    var steps = report.funnel || [];
    var visits = steps[0] ? steps[0].count : 0;
    if (!visits) {
      host.appendChild(emptyNote('No visits in this range.'));
      return;
    }
    host.appendChild(
      barList(
        steps.map(function (s, i) {
          return { label: s.label, value: s.count, note: i === 0 ? '' : pct(s.count / visits) + ' of visits' };
        }),
        { className: 'funnel' }
      )
    );
  }

  function renderProducts(report) {
    var host = clear($('productsTable'));
    var rows = (report.products || []).filter(function (p) {
      return p.views || p.addUnits || p.whatsappClicks || p.selects;
    });
    if (!rows.length) {
      host.appendChild(emptyNote('No product activity in this range.'));
      return;
    }
    host.appendChild(
      el('p', { className: 'panel-note table-note', text: 'Sorted by detail views. WhatsApp taps here are product-level buttons only.' })
    );
    host.appendChild(
      table(
        '',
        [
          { label: 'Product' },
          { label: 'Detail views', num: true },
          { label: 'Units added', num: true },
          { label: 'Units removed', num: true },
          { label: 'WhatsApp taps', num: true }
        ],
        rows.map(function (p) {
          var label = productLabel(p);
          return [{ main: label.name, sub: label.brand }, fmt(p.views), fmt(p.addUnits), fmt(p.removeUnits), fmt(p.whatsappClicks)];
        })
      )
    );
  }

  function renderCategories(report) {
    var host = clear($('categoriesChart'));
    var rows = (report.categories || []).filter(function (c) {
      return c.filterUses > 0;
    });
    if (!rows.length) {
      host.appendChild(emptyNote('No category filters were used in this range.'));
      return;
    }
    host.appendChild(
      barList(
        rows.map(function (c) {
          return { label: categoryLabels[c.id] || c.id, value: c.filterUses };
        }),
        { share: true }
      )
    );
  }

  function renderSearches(report) {
    var top = clear($('searchTable'));
    var none = clear($('noResultTable'));
    var searches = report.searches || { top: [], noResults: [] };
    var totals = report.totals;
    if (!searches.top.length) top.appendChild(emptyNote('No catalogue searches in this range.'));
    else {
      top.appendChild(
        el('p', {
          className: 'panel-note',
          text:
            fmt(totals.searches) +
            ' searches · ' +
            pct(report.rates.noResultSearchRate.value) +
            ' found nothing listed (' +
            fmt(totals.searchesNoResults) +
            ' of ' +
            fmt(totals.searches) +
            ')'
        })
      );
      top.appendChild(
        table(
          '',
          [{ label: 'Search term' }, { label: 'Searches', num: true }, { label: 'No result', num: true }],
          searches.top.map(function (s) {
            return [s.term, fmt(s.count), fmt(s.noResults)];
          })
        )
      );
    }
    if (!searches.noResults.length) none.appendChild(emptyNote('Every search in this range matched at least one listed product.'));
    else
      none.appendChild(
        table(
          '',
          [{ label: 'Search term' }, { label: 'Searches', num: true }],
          searches.noResults.map(function (s) {
            return [s.term, fmt(s.count)];
          })
        )
      );
  }

  function renderBreakdowns(report) {
    var sources = clear($('sourcesChart'));
    var devices = clear($('devicesChart'));
    var wa = clear($('whatsappChart'));
    if (report.sources && report.sources.length)
      sources.appendChild(
        barList(
          report.sources.slice(0, 8).map(function (s) {
            return { label: trafficLabel(s.name), value: s.sessions };
          }),
          { share: true }
        )
      );
    else sources.appendChild(emptyNote('No visits in this range.'));
    if (report.devices && report.devices.length)
      devices.appendChild(
        barList(
          report.devices.map(function (d) {
            return { label: deviceLabel(d.name), value: d.sessions };
          }),
          { share: true }
        )
      );
    else devices.appendChild(emptyNote('No visits in this range.'));
    if (report.whatsappSources && report.whatsappSources.length) {
      wa.appendChild(
        barList(
          report.whatsappSources.slice(0, 8).map(function (s) {
            return { label: sourceLabel(s.source), value: s.clicks };
          }),
          { share: true }
        )
      );
      var split = report.contactSplit || {};
      var contacts = (window.INFINITE_SITE && window.INFINITE_SITE.contacts) || [];
      var primary = contacts[0] ? contacts[0].label : 'the first number';
      var secondary = contacts[1] ? contacts[1].label : 'the second number';
      wa.appendChild(
        el('p', {
          className: 'panel-note',
          text:
            'By number: ' +
            fmt(split.primary) +
            ' to ' +
            primary +
            ' · ' +
            fmt(split.secondary) +
            ' to ' +
            secondary +
            (split.other ? ' · ' + fmt(split.other) + ' other' : '') +
            '.'
        })
      );
    } else wa.appendChild(emptyNote('No WhatsApp taps in this range.'));
  }

  function renderNotes(report) {
    var meta = report.meta || {};
    var parts = [];
    if (meta.demo) parts.push('Demo preview: every number above is generated in this browser and is not store data.');
    else {
      parts.push(
        'Report generated ' + timeFormat.format(new Date(meta.generatedAt)) + ' IST from the ' + (meta.env || 'unknown') + ' event store.'
      );
      if (meta.firstEventAt)
        parts.push(
          'First event in range: ' +
            timeFormat.format(new Date(meta.firstEventAt)) +
            '; last: ' +
            timeFormat.format(new Date(meta.lastEventAt)) +
            '.'
        );
      if (meta.retentionDays) parts.push('Events are kept for ' + meta.retentionDays + ' days.');
    }
    parts.push('Orders, payments and revenue are not recorded by this website: the store confirms those on WhatsApp or by phone.');
    $('dataNotes').textContent = parts.join(' ');
  }

  function render() {
    var report = state.current;
    var previous = state.previous;
    var body = $('reportBody');
    var empty = !report.meta.demo && !report.totals.events;
    body.classList.toggle('is-empty', empty);
    var message = $('reportMessage');
    if (empty) {
      showMessage(
        'No events recorded between ' + dateLabel(report.range.from) + ' and ' + dateLabel(report.range.to) + '.',
        'Nothing has been collected for this range yet. Check that the storefront is served by this server with analytics enabled in js/site-config.js, then visit the site and reload this report. Visitors who switch statistics off or send a privacy signal are never counted.'
      );
    } else {
      message.hidden = true;
    }
    var prevFrom = previous ? previous.range.from : '';
    var prevTo = previous ? previous.range.to : '';
    $('rangeSummary').textContent =
      dateLabel(report.range.from) +
      ' – ' +
      dateLabel(report.range.to) +
      ' (' +
      report.range.days +
      (report.range.days === 1 ? ' day' : ' days') +
      ', ' +
      (report.range.timezone || 'Asia/Kolkata') +
      ')' +
      (prevFrom ? ' · compared with ' + dateLabel(prevFrom) + ' – ' + dateLabel(prevTo) : '');
    renderKpis(report, previous);
    if (!empty) {
      renderTrends(report, previous);
      renderFunnel(report);
      renderProducts(report);
      renderCategories(report);
      renderSearches(report);
      renderBreakdowns(report);
    }
    renderNotes(report);
    var badge = $('envBadge');
    badge.hidden = false;
    badge.textContent = report.meta.demo ? 'Demo data' : report.meta.env === 'production' ? 'Production' : 'Development';
    badge.setAttribute('data-env', report.meta.demo ? 'demo' : report.meta.env || '');
  }

  function showMessage(title, text) {
    var message = clear($('reportMessage'));
    message.appendChild(el('strong', { text: title }));
    message.appendChild(el('p', { text: text }));
    message.hidden = false;
  }

  /* ---------- flow ---------- */
  function selectedRange() {
    var preset = document.querySelector('input[name="preset"]:checked').value;
    var today = istToday();
    if (preset === 'custom') {
      var from = $('fromDate').value;
      var to = $('toDate').value;
      if (!from || !to || from > to) return null;
      return { from: from, to: to };
    }
    return { from: addDays(today, -Number(preset)), to: today };
  }

  function load() {
    var range = selectedRange();
    if (!range) {
      showMessage('Choose a valid date range.', 'The start date must be on or before the end date.');
      return Promise.resolve();
    }
    if (dayCount(range.from, range.to) > 400) {
      showMessage('Choose a shorter range.', 'Reports cover up to 400 days at a time.');
      return Promise.resolve();
    }
    state.from = range.from;
    state.to = range.to;
    var days = dayCount(range.from, range.to);
    var prevTo = addDays(range.from, -1);
    var prevFrom = addDays(prevTo, -(days - 1));
    var id = ++state.requestId;
    var body = $('reportBody');
    if (state.current) body.classList.add('is-refreshing');
    else $('rangeSummary').textContent = 'Loading report…';
    body.setAttribute('aria-busy', 'true');
    return Promise.all([fetchReport(range.from, range.to), fetchReport(prevFrom, prevTo)])
      .then(function (results) {
        if (id !== state.requestId) return;
        state.current = results[0];
        state.previous = results[1];
        showReport();
        render();
      })
      .catch(function (error) {
        if (id !== state.requestId) return;
        if (error && error.kind === 'auth') {
          signOut(error.message);
          return;
        }
        showReport();
        showMessage(
          error && error.kind === 'config' ? 'Reports are not set up on the server.' : 'The report could not be loaded.',
          (error && error.message) || 'Unexpected error.'
        );
        $('rangeSummary').textContent = '';
        if (!state.current) body.classList.add('is-empty');
      })
      .then(function () {
        body.classList.remove('is-refreshing');
        body.removeAttribute('aria-busy');
      });
  }

  function showReport() {
    $('connectPanel').hidden = true;
    $('reportPanel').hidden = false;
    $('signOut').hidden = state.demo;
    $('demoBanner').hidden = !state.demo;
    document.title = (state.demo ? 'Demo preview · ' : '') + 'Store Analytics · Infinite Nutrition';
  }

  function showConnect(errorText) {
    $('reportPanel').hidden = true;
    $('connectPanel').hidden = false;
    $('signOut').hidden = true;
    $('demoBanner').hidden = true;
    $('envBadge').hidden = true;
    $('connectError').textContent = errorText || '';
    document.title = 'Store Analytics · Infinite Nutrition';
  }

  function signOut(errorText) {
    state.token = null;
    state.current = null;
    state.previous = null;
    storageSet(TOKEN_KEY, null);
    showConnect(errorText);
    $('tokenInput').value = '';
    $('tokenInput').focus();
  }

  $('connectForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var token = $('tokenInput').value.trim();
    if (token.length < 24) {
      $('connectError').textContent = 'Enter the full access token (at least 24 characters).';
      $('tokenInput').focus();
      return;
    }
    state.token = token;
    state.demo = false;
    storageSet(TOKEN_KEY, token);
    var button = $('connectButton');
    button.disabled = true;
    $('connectError').textContent = '';
    load().then(function () {
      button.disabled = false;
      if (!$('reportPanel').hidden) $('reportTitle').focus({ preventScroll: true });
    });
  });

  $('demoButton').addEventListener('click', function () {
    state.demo = true;
    state.current = null;
    load();
  });
  $('exitDemo').addEventListener('click', function () {
    state.demo = false;
    state.current = null;
    if (window.history && history.replaceState) history.replaceState(null, '', location.pathname);
    if (state.token) load();
    else showConnect();
  });
  $('signOut').addEventListener('click', function () {
    signOut();
  });

  $('rangeForm').addEventListener('change', function (event) {
    if (event.target.name !== 'preset') return;
    var custom = event.target.value === 'custom';
    $('customRange').hidden = !custom;
    if (custom) {
      if (!$('fromDate').value) $('fromDate').value = state.from || addDays(istToday(), -27);
      if (!$('toDate').value) $('toDate').value = state.to || istToday();
      $('fromDate').focus();
      return;
    }
    load();
  });
  $('rangeForm').addEventListener('submit', function (event) {
    event.preventDefault();
    load();
  });
  $('toDate').max = istToday();
  $('fromDate').max = istToday();
  $('reportTitle').setAttribute('tabindex', '-1');

  var resizeFrame = 0;
  var lastWidth = 0;
  if ('ResizeObserver' in window) {
    new ResizeObserver(function (entries) {
      var w = Math.round(entries[0].contentRect.width);
      if (!state.current || w === lastWidth) return;
      lastWidth = w;
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(function () {
        hideTooltip();
        if (!$('reportBody').classList.contains('is-empty')) renderTrends(state.current, state.previous);
      });
    }).observe($('trendCharts'));
  }
  // Keyboard readouts follow their focused chart; pointer readouts close on scroll.
  window.addEventListener(
    'scroll',
    function () {
      if (!tooltipOwner) return;
      if (document.activeElement === tooltipOwner.surface) tooltipOwner.reposition();
      else hideTooltip();
    },
    { passive: true }
  );

  if (new URLSearchParams(location.search).get('demo') === '1') {
    state.demo = true;
    load();
  } else if (state.token) {
    load();
  } else {
    showConnect();
  }
})();
