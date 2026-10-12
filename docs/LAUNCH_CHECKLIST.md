# Launch checklist — owner decisions and dependencies

Everything below is either **missing information** or **wording that needs the
owner's approval**. Nothing has been invented to fill a gap: until an item is
resolved, the public site leaves it out (or asks the customer to confirm with
the store), and **review mode** shows the owner exactly what is still missing —
set `reviewMode: true` in `js/site-config.js` on a local copy to see the owner
completion checklist, pending map box, policy draft labels and products that
have no photo yet.

Legend: **Where** = the file to edit. `site-config` = `js/site-config.js`,
`catalogue` = `js/catalogue.js`.

## A. Required before a public launch

| # | Item | What is needed | Where |
|---|---|---|---|
| A1 | Production domain | The exact `https://` origin. Enables the canonical URL, `og:url`, `og:image`, JSON-LD `url`/`logo`/`image` and `sitemap.xml` on build. | `site-config` → `siteUrl` |
| A2 | Complete address | Street/locality, postcode. Only "147, Part 1, Lucknow, Uttar Pradesh" was supplied, which is shown as incomplete. | `site-config` → `address`; address text in `index.html` (visit section, location card, footer); JSON-LD `address.streetAddress` / `postalCode` |
| A3 | Map destination | Exact Google Maps embed URL + directions URL, or a verified Google Place ID. No approximate pin is shown. | `site-config` → `map` |
| A4 | Opening hours | The owner confirmed the store is open 24×7 (now in the announcement bar). Update the visit copy, FAQ and JSON-LD `openingHoursSpecification` to match, and confirm any holiday exceptions. | Visit section in `index.html`; add `openingHoursSpecification` to JSON-LD |
| A5 | Contact roles | Confirm both numbers (+91 88404 27558, +91 83032 53308) are current store numbers and which is primary (the first is used for single-button enquiries). | `site-config` → `contacts` (order) and `index.html` links — `npm test` checks they match |
| A6 | Policies | Approved wording for delivery & collection, returns & replacements, refunds, cancellation, payment methods, terms. Set `approved: true` with the final text. | `site-config` → `policies`; matching FAQ answers in `index.html` |
| A7 | Privacy policy | Approve wording that reflects what the site does: cookie-free first-party statistics, optional Google Analytics with consent, order list kept in the browser, WhatsApp hand-off. A draft is in place. Check obligations under India's DPDP Act 2023 (and GDPR if you serve EU visitors). | `site-config` → `policies.privacy` |
| A8 | Analytics hosting | Choose the Node server (first-party analytics + dashboard) or a static host (GA4 only). Set a strong `ANALYTICS_ADMIN_TOKEN`. | `.env.example`, `docs/ANALYTICS.md` §6 |
| A9 | Review mode | Keep `reviewMode: false` on the public site (the default). Turn it on only locally to review unfinished content. | `site-config` → `reviewMode` |

## B. Product catalogue

| # | Item | What is needed | Where |
|---|---|---|---|
| B1 | Prices, MRP, stock | Selling price and MRP per variant, and stock status. Until then cards say "Store confirmation required", subtotals read "Price pending", and no Product structured data is published. Price sorting starts working once prices exist. | `catalogue` → `variants[].price/mrp`, `stock` |
| B2 | Pack sizes and variants | Exact sizes and flavours for each listed product. | `catalogue` → `variants` |
| B3 | Label facts | Ingredients, serving information, allergens, usage directions — copied from the actual pack. | `catalogue` → `ingredients`, `serving`, `allergens`, `usage` |
| B4 | Missing product photos | Pintola High Protein Peanut Butter and QNT L-Carnitine photos were referenced by the design but not included in the export. Until the photos are added these two products are not published (review mode shows them with a placeholder). | `assets/products/README.md` |
| B5 | Exact product names | The MuscleBlaze label in the shelf photo reads "CreAMP Micronised Creatine Monohydrate"; confirm the SKU name you want listed. | `catalogue` → `name` |
| B6 | More products | Shelf photos show whey proteins, mass gainers, pre-workouts, BCAA/EAA and more that are not listed individually; those category tiles say "Ask in store" and open a prepared WhatsApp question. Add SKUs with a photo each. | `catalogue` |
| B7 | Featured range | The first four catalogue entries are featured. Reorder the catalogue to change them. | `catalogue` order |

## C. Imagery and claims

| # | Item | What is needed | Where |
|---|---|---|---|
| C1 | Category visuals | The seven cinematic category visuals and two store insets (pre-workout, nutrition) were missing from the export. Tiles use real store photos or the same card with a red gradient and category icon meanwhile. | `assets/categories/README.md` |
| C2 | "BEST PRICES" on the store banner | The supplied banner image (product checks section) contains the words "Best prices" and "Wide range". Confirm you are comfortable publishing that claim, or supply a version without it. | `assets/store/store-banner-*` |
| C3 | Branded containers in editorial images | The hero, featured and category artwork show "Infinite Nutrition" branded tubs and bottles. If the store does not sell an own-brand range, consider a note or different artwork so customers are not led to expect one. | `index.html` hero / featured editorial |
| C4 | Fit & First | Confirm the relationship and permission behind "Powered by Fit & First". It is hidden at launch unless approved. | `site-config` → `approvals.fitAndFirstCredit` |
| C5 | Authenticity evidence | Supply documentation before publishing any authorised-dealer, certification, partnership or guaranteed-authenticity claim. None is made today. | Content in `index.html` |
| C6 | Customer reviews | Exact source, wording, rating, date and permission for any review. None are published; no rating appears in structured data. | Reviews section in `index.html` |
| C7 | Social profiles | Exact Instagram and other official profile URLs. | Footer in `index.html`; JSON-LD `sameAs` |
| C9 | "100% original" | The hero line can start with "100% original" only once the store can document it (supplier invoices or brand authorisation). It is hidden until then. | `site-config` → `approvals.originalClaim` |
| C8 | Transparent logo | No transparent logo was supplied, so the header, hero and footer use a background-removed cut of the supplied 380 px logo (`assets/brand/logo-mark-*`) on a #0a0a0a container. Supply an official transparent PNG or SVG to replace it. | `assets/brand/` |
| C10 | Hero video (TEMP) | The mobile hero loop (`assets/hero-bg.webm`, `assets/hero-bg.mp4`) is a temporary clip rendered from the hero photo. Replace it with real store footage under the same names: dark, slow motion, red accent, 9:16, no audio, 3 MB or less in total. Update `assets/hero-poster.jpg` to its first frame. | `assets/`, `TEMP-REPLACE` comment in `index.html` |

## D. Technical go-live steps

1. Fill in A1–A9 (and any of B/C you can).
2. `npm ci && npm run check` — lint, formatting and the full test suite must pass.
3. `npm run build` (or `npm run build:static`; Vercel runs `npm run build:vercel` itself).
4. Deploy `dist/`:
   - Node host: `NODE_ENV=production STATIC_ROOT=dist ANALYTICS_ADMIN_TOKEN=… npm start`, behind HTTPS. Behind one reverse proxy set `TRUST_PROXY=1` (and `ALLOWED_ORIGINS=https://<domain>` if the proxy rewrites `Host`).
   - Vercel: import the repository and keep the Framework Preset on "Other" with
     no build/output overrides; `vercel.json` supplies them.
   - Other static host: upload `dist/` (including `_headers`).
5. `npm run audit:lighthouse` against the build, then check the live site in
   Google's Rich Results Test and PageSpeed Insights.
6. Submit `https://<domain>/sitemap.xml` in Google Search Console and create or
   claim the Google Business Profile with the confirmed address and hours.
7. Open `/admin/`, sign in, and confirm today's visits appear.
