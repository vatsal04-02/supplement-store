// Append-only event store and report aggregation for the owner dashboard.
//
// Events are written as one JSON object per line to
//   <dataDir>/<env>/<YYYY-MM-DD>.ndjson
// where the date is the store's local date (Asia/Kolkata). No IP address,
// user agent or cookie is stored. A visitor key is a SHA-256 hash of the
// request IP and user agent with a random salt that exists only in memory
// and changes every day, so it can count unique visitors within a day but
// cannot be linked across days or back to a person.

import { createReadStream } from 'node:fs';
import { appendFile, mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';

export const TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function localDate(ms = Date.now()) {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function datesBetween(from, to) {
  const out = [];
  let t = Date.parse(from + 'T00:00:00Z');
  const end = Date.parse(to + 'T00:00:00Z');
  while (t <= end) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += DAY_MS;
  }
  return out;
}

export function createAnalyticsStore({ dataDir, env, retentionDays = 395 }) {
  const dir = path.join(dataDir, env);
  const salts = new Map();
  const ready = mkdir(dir, { recursive: true }).catch(() => {});
  let writeChain = Promise.resolve();

  function saltFor(date) {
    if (!salts.has(date)) {
      salts.clear(); // keep only the current day's salt
      salts.set(date, crypto.randomBytes(32));
    }
    return salts.get(date);
  }

  function visitorKey(date, ip, userAgent) {
    return crypto
      .createHmac('sha256', saltFor(date))
      .update(String(ip) + '\n' + String(userAgent))
      .digest('hex')
      .slice(0, 16);
  }

  async function append(records) {
    if (!records.length) return;
    await ready;
    const byDate = new Map();
    for (const record of records) {
      const date = localDate(Date.parse(record.t));
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push(JSON.stringify(record));
    }
    // Serialise writes so concurrent requests never interleave lines. The
    // directory is re-created if it was removed, and a failed write only
    // fails its own request: the chain itself always recovers.
    const write = writeChain.then(async () => {
      await mkdir(dir, { recursive: true });
      for (const [date, lines] of byDate) {
        await appendFile(path.join(dir, date + '.ndjson'), lines.join('\n') + '\n', 'utf8');
      }
    });
    writeChain = write.catch(() => {});
    return write;
  }

  async function* readRange(from, to) {
    await ready;
    for (const date of datesBetween(from, to)) {
      const file = path.join(dir, date + '.ndjson');
      let stream;
      try {
        stream = createReadStream(file, { encoding: 'utf8' });
        await new Promise((resolve, reject) => {
          stream.once('open', resolve);
          stream.once('error', reject);
        });
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
      for await (const line of lines) {
        if (!line) continue;
        try {
          const record = JSON.parse(line);
          record.date = date;
          yield record;
        } catch (error) {
          // A partially written line (for example after a crash) is skipped.
        }
      }
    }
  }

  async function prune(now = Date.now()) {
    await ready;
    const cutoff = localDate(now - retentionDays * DAY_MS);
    let removed = 0;
    for (const name of await readdir(dir)) {
      const match = /^(\d{4}-\d{2}-\d{2})\.ndjson$/.exec(name);
      if (match && match[1] < cutoff) {
        await unlink(path.join(dir, name));
        removed++;
      }
    }
    return removed;
  }

  async function report(from, to) {
    const dates = datesBetween(from, to);
    const daily = new Map(
      dates.map((date) => [
        date,
        { date, pageViews: 0, sessions: new Set(), visitors: new Set(), productViews: 0, addToCartUnits: 0, whatsappClicks: 0 }
      ])
    );
    const sessions = new Map();
    const products = new Map();
    const categories = new Map();
    const searchTerms = new Map();
    const whatsappSources = new Map();
    const contactSplit = { primary: 0, secondary: 0, other: 0 };
    const totals = {
      events: 0,
      pageViews: 0,
      productListViews: 0,
      selectItem: 0,
      productViews: 0,
      addToCartEvents: 0,
      addToCartUnits: 0,
      removeFromCartUnits: 0,
      cartViews: 0,
      whatsappClicks: 0,
      whatsappListClicks: 0,
      whatsappProductClicks: 0,
      phoneClicks: 0,
      searches: 0,
      searchesNoResults: 0,
      filterUses: 0,
      locationViews: 0,
      directionsClicks: 0,
      policyViews: 0
    };
    let firstEventAt = null;
    let lastEventAt = null;

    const productRow = (p) => {
      const id = p.item_id;
      if (!products.has(id))
        products.set(id, {
          id,
          name: p.item_name || '',
          brand: p.item_brand || '',
          category: p.item_category || '',
          views: 0,
          selects: 0,
          addUnits: 0,
          removeUnits: 0,
          whatsappClicks: 0
        });
      const row = products.get(id);
      if (!row.name && p.item_name) row.name = p.item_name;
      if (!row.brand && p.item_brand) row.brand = p.item_brand;
      if (!row.category && p.item_category) row.category = p.item_category;
      return row;
    };
    const categoryRow = (id) => {
      if (!categories.has(id)) categories.set(id, { id, filterUses: 0, productViews: 0, addUnits: 0 });
      return categories.get(id);
    };

    for await (const r of readRange(from, to)) {
      if (!daily.has(r.date)) continue;
      const day = daily.get(r.date);
      const p = r.p || {};
      totals.events++;
      if (!firstEventAt || r.t < firstEventAt) firstEventAt = r.t;
      if (!lastEventAt || r.t > lastEventAt) lastEventAt = r.t;
      if (r.s) {
        day.sessions.add(r.s);
        if (!sessions.has(r.s))
          sessions.set(r.s, { productView: false, add: false, whatsapp: false, source: null, device: r.d || 'unknown' });
      }
      if (r.v) day.visitors.add(r.v);
      const session = r.s ? sessions.get(r.s) : null;

      switch (r.n) {
        case 'page_view':
          totals.pageViews++;
          day.pageViews++;
          if (session && !session.source) session.source = r.us ? 'utm:' + r.us : r.ref || 'direct';
          break;
        case 'view_item_list':
          totals.productListViews++;
          break;
        case 'select_item':
          totals.selectItem++;
          if (p.item_id) productRow(p).selects++;
          break;
        case 'view_item':
          totals.productViews++;
          day.productViews++;
          if (session) session.productView = true;
          if (p.item_id) productRow(p).views++;
          if (p.item_category) categoryRow(p.item_category).productViews++;
          break;
        case 'add_to_cart': {
          const units = p.quantity || 1;
          totals.addToCartEvents++;
          totals.addToCartUnits += units;
          day.addToCartUnits += units;
          if (session) session.add = true;
          if (p.item_id) productRow(p).addUnits += units;
          if (p.item_category) categoryRow(p.item_category).addUnits += units;
          break;
        }
        case 'remove_from_cart':
          totals.removeFromCartUnits += p.quantity || 1;
          if (p.item_id) productRow(p).removeUnits += p.quantity || 1;
          break;
        case 'view_cart':
          totals.cartViews++;
          break;
        case 'click_whatsapp':
          totals.whatsappClicks++;
          day.whatsappClicks++;
          if (session) session.whatsapp = true;
          if (p.context === 'order_list') totals.whatsappListClicks++;
          if (p.context === 'product') totals.whatsappProductClicks++;
          if (p.item_id) productRow(p).whatsappClicks++;
          whatsappSources.set(p.source || 'unknown', (whatsappSources.get(p.source || 'unknown') || 0) + 1);
          contactSplit[p.contact === 'primary' || p.contact === 'secondary' ? p.contact : 'other']++;
          break;
        case 'contact_store':
          totals.phoneClicks++;
          break;
        case 'search': {
          totals.searches++;
          const noResults = p.results_count === 0;
          if (noResults) totals.searchesNoResults++;
          if (p.search_term) {
            if (!searchTerms.has(p.search_term)) searchTerms.set(p.search_term, { term: p.search_term, count: 0, noResults: 0 });
            const row = searchTerms.get(p.search_term);
            row.count++;
            if (noResults) row.noResults++;
          }
          break;
        }
        case 'filter_products':
          totals.filterUses++;
          if (p.filter_type === 'category' && p.filter_value && p.filter_value !== 'all') categoryRow(p.filter_value).filterUses++;
          break;
        case 'view_store_location':
          if (p.action === 'directions') totals.directionsClicks++;
          else totals.locationViews++;
          break;
        case 'open_policy':
          totals.policyViews++;
          break;
        default:
          break;
      }
    }

    const sessionList = [...sessions.values()];
    const sessionCount = sessionList.length;
    const withProductView = sessionList.filter((s) => s.productView).length;
    const withAdd = sessionList.filter((s) => s.add).length;
    const withWhatsapp = sessionList.filter((s) => s.whatsapp).length;
    const visitorDays = [...daily.values()].reduce((n, d) => n + d.visitors.size, 0);

    const rate = (num, den) => ({ numerator: num, denominator: den, value: den ? num / den : null });
    const countBy = (key) => {
      const m = new Map();
      for (const s of sessionList) {
        const k = s[key] || 'unknown';
        m.set(k, (m.get(k) || 0) + 1);
      }
      return [...m.entries()].map(([name, sessions]) => ({ name, sessions })).sort((a, b) => b.sessions - a.sessions);
    };
    const sortDesc = (list, key) => list.sort((a, b) => b[key] - a[key] || String(a.id || a.term).localeCompare(String(b.id || b.term)));

    return {
      range: { from, to, days: dates.length, timezone: TIMEZONE },
      totals: { ...totals, sessions: sessionCount, visitors: visitorDays },
      funnel: [
        { step: 'sessions', label: 'Visits', count: sessionCount },
        { step: 'product_view', label: 'Opened product details', count: withProductView },
        { step: 'add_to_cart', label: 'Added to the order list', count: withAdd },
        { step: 'click_whatsapp', label: 'Opened a WhatsApp enquiry', count: withWhatsapp }
      ],
      rates: {
        productViewRate: rate(withProductView, sessionCount),
        // Every journey rate uses all visits as its denominator: visitors can add
        // from a catalogue card without opening details, or tap WhatsApp
        // without a list, so the steps are not strict subsets of each other.
        addToListRate: rate(withAdd, sessionCount),
        whatsappRate: rate(withWhatsapp, sessionCount),
        noResultSearchRate: rate(totals.searchesNoResults, totals.searches)
      },
      daily: [...daily.values()].map((d) => ({
        date: d.date,
        pageViews: d.pageViews,
        sessions: d.sessions.size,
        visitors: d.visitors.size,
        productViews: d.productViews,
        addToCartUnits: d.addToCartUnits,
        whatsappClicks: d.whatsappClicks
      })),
      products: sortDesc([...products.values()], 'views'),
      categories: sortDesc([...categories.values()], 'filterUses'),
      searches: {
        top: sortDesc([...searchTerms.values()], 'count').slice(0, 20),
        noResults: sortDesc(
          [...searchTerms.values()].filter((s) => s.noResults > 0).map((s) => ({ term: s.term, count: s.noResults })),
          'count'
        ).slice(0, 20)
      },
      sources: countBy('source'),
      devices: countBy('device'),
      whatsappSources: [...whatsappSources.entries()].map(([source, clicks]) => ({ source, clicks })).sort((a, b) => b.clicks - a.clicks),
      contactSplit,
      meta: { firstEventAt, lastEventAt, generatedAt: new Date().toISOString(), demo: false }
    };
  }

  return { dir, visitorKey, append, readRange, prune, report };
}
