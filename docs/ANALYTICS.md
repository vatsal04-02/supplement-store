# Analytics

The storefront measures what visitors do on the website — and only that. It
never records orders, payments or revenue, because the website has no checkout:
the store confirms orders on WhatsApp or by phone. A WhatsApp tap is reported as
a **click**, never as a submitted enquiry or a sale.

```
Browser (js/analytics.js) ──beacon──▶ POST /api/collect ──▶ data/<env>/<date>.ndjson
                          └─(consent)─▶ Google Analytics 4 (optional)
Owner (admin/) ──Bearer token──▶ GET /api/stats ──▶ aggregated report
```

## 1. Destinations

| Destination | When it is used | Cookies | Configure in |
|---|---|---|---|
| First-party collector (`server/server.mjs`) | Default when the site runs on the included Node server | None | `analytics.firstParty` in `js/site-config.js` |
| Google Analytics 4 | Only if a measurement ID is set **and** the visitor accepts the banner | Yes (`_ga*`) | `analytics.ga4MeasurementId` |
| `window.dataLayer` | Only if a Google Tag Manager container is installed separately (and gtag.js is not) | Depends on GTM | — |

Visitors can switch statistics off under **Privacy & analytics** in the footer
(stored in `localStorage` as `infinite-analytics-optout`). Browsers that send
Global Privacy Control or Do Not Track are not measured at all while
`respectPrivacySignals` is `true`.

## 2. Event schema

Every event is checked against this list in the browser **and** on the server.
Both load the same definition, `js/analytics-schema.js`, so the rules cannot
drift. Unknown events and parameters are dropped.

| Event | Fired when | Parameters |
|---|---|---|
| `page_view` | Once per page load, after the storefront has rendered | — (plus visit context below) |
| `view_item_list` | Featured range is 25 % visible (once); catalogue first opened | `item_list_id` (`featured` \| `catalogue`), `item_list_name`, `item_ids`, `results_count` |
| `select_item` | A product is chosen from the featured range or the catalogue | `item_id`, `item_list_id`, `index`, `item_category` |
| `search` | Typing pauses 0.9 s, Enter, or the field loses focus (≥ 2 characters, each term once in a row) | `search_term`, `results_count`, `source` |
| `filter_products` | Category, brand, sort or reset is applied | `filter_type` (`category` \| `brand` \| `sort` \| `reset`), `filter_value`, `source`, `results_count` |
| `view_item` | Product details dialog opens | `item_id`, `item_name`, `item_brand`, `item_category`, `item_variant`, `quantity`, `source` |
| `add_to_cart` | Units added to the order list (including `+` inside the list) | as `view_item`; `quantity` = units added; `source` (`catalogue_card` \| `details_dialog` \| `order_list`) |
| `remove_from_cart` | Units removed (`−`, Remove, Clear list) | as `view_item`; `source` (`order_list` \| `clear_list`) |
| `view_cart` | Order list drawer opens | `lines_count`, `items_count` |
| `click_whatsapp` | Any WhatsApp link or button is used | `source`, `contact` (`primary` \| `secondary`), `context` (`general` \| `product` \| `order_list` \| `catalogue_empty`), `item_id`, `lines_count`, `items_count` |
| `contact_store` | A telephone link is used | `method` (`phone`), `source`, `contact` |
| `view_store_location` | Store location block is 40 % visible (once), or directions are opened | `action` (`view` \| `directions`), `source` |
| `open_policy` | A policy dialog opens | `policy` |

`price`, `value` and `currency` are added to product events **only** when the
store has confirmed a selling price in `js/catalogue.js`; no price is sent today.

**Deliberately not sent:** `begin_checkout`, `purchase`, `generate_lead`,
`submit_enquiry`. There is no checkout and no form, and whether a WhatsApp
message was actually sent cannot be observed from the website.

**Visit context** (first-party only): page path, device class (`mobile` < 768 px,
`tablet` < 1100 px, `desktop`), and on `page_view` the referring site's host name
and any `utm_source` / `utm_medium` / `utm_campaign` tags.

**`source` values** name where on the page an action happened, for example
`header`, `home` (hero), `featured`, `category_tile`, `filter_bar`, `catalogue`,
`goal_finder`, `flavour_cta`, `order_list`, `details_dialog`, `mobile_bar`,
`visit`, `footer`.

### Privacy safeguards in the data
- Search terms are lower-cased and have e-mail addresses and digit runs of 7+
  characters replaced with `[email]` / `[number]` before they leave the page,
  and again on the server.
- Text parameters are capped at 80 characters; IDs are normalised.
- No names, phone numbers, IP addresses, user agents or cookies are stored.

## 3. How the server stores events

- One JSON line per event in `data/<env>/<YYYY-MM-DD>.ndjson`, dated in
  Asia/Kolkata time. `<env>` is `production` when `NODE_ENV=production`,
  otherwise `development`, so test traffic never mixes with real traffic.
- **Sessions**: a random 16-hex ID kept in `sessionStorage` for the life of the
  browser tab.
- **Visitors**: a 16-hex HMAC of IP address + user agent, keyed with a random
  salt that lives only in server memory and changes every day. It can count
  unique visitors within a day but cannot be reversed or linked across days. A
  server restart starts a new salt, so a restart mid-day can count a returning
  visitor twice that day.
- Known bots and crawlers (including Lighthouse) are discarded.
- Files older than `ANALYTICS_RETENTION_DAYS` (default 395) are deleted
  automatically.
- `/api/collect` accepts same-origin posts only (plus `ALLOWED_ORIGINS`, and
  `X-Forwarded-Host` behind `TRUST_PROXY`), max 32 KB and 50 events per
  request, 120 requests per minute per IP. Rejected origins are logged at most
  once a minute so a proxy misconfiguration is visible.
- A failed disk write fails only that request; the directory is re-created if
  it disappears.

## 4. Owner dashboard

Open `/admin/` and enter `ANALYTICS_ADMIN_TOKEN` (24+ characters; generate one
with `openssl rand -hex 24`). The token is held in that browser tab only.
After 10 failed attempts from an IP within 15 minutes, every request from it
is refused (including one with the right token) until the window passes. The page is
`noindex` and disallowed in `robots.txt`.

The dashboard shows the selected range against the previous range of equal
length. Its "How each number is counted" panel defines every metric. Journey
steps are not strict subsets (an item can be added from a catalogue card
without opening details; WhatsApp can be used without a list), so every rate
uses all visits as its denominator:

| Rate | Numerator | Denominator |
|---|---|---|
| Opened product details | visits with ≥ 1 `view_item` | all visits |
| Added to the order list | visits with ≥ 1 `add_to_cart` | all visits |
| Opened a WhatsApp enquiry | visits with ≥ 1 `click_whatsapp` | all visits |
| Searches with no results | `search` events with `results_count = 0` | all `search` events |

**Demo preview** (`/admin/?demo=1` or the button on the sign-in screen) renders
synthetic numbers generated in the browser for layout review. It is labelled
in a persistent banner, on every number and in the page title, and never
touches the server.

## 5. Setting up Google Analytics 4 (optional)

1. Create a GA4 property and a Web data stream for the production domain;
   copy the measurement ID (`G-XXXXXXXXXX`).
2. Set `analytics.ga4MeasurementId` in `js/site-config.js`.
3. Redeploy. The Node server and the static build both add the Google domains to
   the Content-Security-Policy automatically when an ID is present. On Vercel,
   also update the Content-Security-Policy in `vercel.json`; `npm run
   build:vercel` fails and prints the exact value until you do.
4. Visitors now see a consent banner; GA4 loads only after **Accept**. Consent
   Mode is initialised with ad storage, ad user data and ad personalisation
   denied.
5. Product events are sent with GA4's `items` array. To report on `source`,
   `context`, `contact` or `filter_type`, register them as event-scoped custom
   dimensions in GA4.
6. Update the privacy policy wording (see the launch checklist) before going live.

## 6. Hosting choices

| Host | Command | Analytics available |
|---|---|---|
| Any Node.js host (VPS, Render, Railway, Fly.io …) | `npm run build` then `NODE_ENV=production STATIC_ROOT=dist npm start` | First-party + dashboard (+ GA4 if configured) |
| Vercel | Import the repo; `vercel.json` runs `npm run build:vercel` and publishes `dist/` | GA4 only; the collector is switched off and `/admin/` cannot load reports |
| Other static hosts (Netlify, Cloudflare Pages, GitHub Pages …) | `npm run build:static`, upload `dist/` | GA4 only; the collector is switched off and `/admin/` cannot load reports |

On a static host the first-party endpoint must stay disabled (the static build
does this), otherwise every visit would log a failed request.

## 7. Verifying it works

- Locally, `npm start` and open the site: with `debug: 'auto'` every event is
  logged to the browser console as `[analytics] …`.
- `window.InfiniteAnalytics.recent()` lists the events sent from the current page;
  `window.InfiniteAnalytics.status()` shows sent, failed and dropped counts.
- `npm test` runs the analytics client, server and dashboard suites.
