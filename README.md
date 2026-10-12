# Infinite Nutrition — storefront

Website for **Infinite Nutrition**, a sports nutrition and supplement store in
Lucknow. Customers browse the photographed catalogue, build an order list and
send it to the store as a WhatsApp enquiry; the store confirms availability,
price, delivery and payment directly. There is no online checkout.

- `index.html` — the storefront (original design, refined)
- `admin/` — private owner analytics dashboard
- `server/` — optional zero-dependency Node server: static files, security
  headers, first-party analytics API

See [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) for everything the
owner still needs to confirm, [docs/ANALYTICS.md](docs/ANALYTICS.md) for the
measurement design and [docs/DESIGN_NOTES.md](docs/DESIGN_NOTES.md) for what
changed from the supplied design.

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
npm start                      # http://127.0.0.1:8080/
```

To try the owner dashboard, start the server with a token and open `/admin/`:

```bash
ANALYTICS_ADMIN_TOKEN=$(openssl rand -hex 24) npm start
# or preview the layout with labelled demo data: http://127.0.0.1:8080/admin/?demo=1
```

`index.html` also opens directly from disk; everything except analytics works.

## Project layout

```
index.html              storefront markup
css/styles.css          original design system (formatted, otherwise unchanged)
css/refinements.css     all fixes and refinements made in this pass
js/site-config.js       ✎ business details, map, policies, analytics settings
js/catalogue.js         ✎ products, categories, category imagery
js/analytics.js         event layer (schema, privacy, transport, GA4 consent)
js/store-map.js         map/directions, shown only for verified URLs
js/app.js               storefront behaviour
admin/                  owner dashboard (index.html, dashboard.js, dashboard.css)
assets/                 images (hero, editorial, store, founder, products, brand, social)
server/                 server.mjs, analytics-store.mjs, event-schema.mjs
scripts/build.mjs       production build → dist/
scripts/lighthouse.mjs  Lighthouse audit of dist/
tests/                  Playwright + axe test suite
docs/                   launch checklist, analytics, design notes, original file
```

Files marked ✎ are the ones the owner edits. Comments in each explain every field.

## Commands

| Command                           | What it does                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `npm start`                       | Serve the source tree with the analytics API (development data in `data/development/`) |
| `npm run build`                   | Minified production build in `dist/` for the Node server                               |
| `npm run build:static`            | Build for a static host: collector off, `_headers` with CSP                            |
| `npm run start:dist`              | Serve `dist/`                                                                          |
| `npm test`                        | Full Playwright suite (starts its own server)                                          |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                                      |
| `npm run check`                   | Lint + format check + tests                                                            |
| `npm run audit:lighthouse`        | Lighthouse mobile and desktop on `dist/` (run `npm run build` first)                   |

Tests use Chromium via Playwright. On a new machine run
`npx playwright install chromium` once.

## Configuration

**Business content** lives in `js/site-config.js` and `js/catalogue.js`. Only
confirmed values belong there; anything still empty is left off the public
page (for example the map, directions, and products without a photo). Set
`reviewMode: true` on a local copy to preview everything that is unfinished,
including the owner completion checklist. Phone links in `index.html` are
plain HTML so they work without JavaScript — `npm test` fails if they drift
from `site-config`.

**Server environment variables** (see `.env.example`):

| Variable                   | Default                                   | Purpose                                                                                                                                                                        |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PORT`                     | `8080`                                    | Listening port                                                                                                                                                                 |
| `HOST`                     | `127.0.0.1` (dev), `0.0.0.0` (production) | Listening address                                                                                                                                                              |
| `NODE_ENV`                 | —                                         | `production` enables HSTS, `upgrade-insecure-requests` and the production event store                                                                                          |
| `STATIC_ROOT`              | `.`                                       | Folder to serve (`dist` after a build)                                                                                                                                         |
| `ANALYTICS_ADMIN_TOKEN`    | —                                         | Dashboard access token (≥ 24 characters). Reports are disabled without it                                                                                                      |
| `ANALYTICS_DATA_DIR`       | `data`                                    | Event storage folder                                                                                                                                                           |
| `ANALYTICS_RETENTION_DAYS` | `395`                                     | Days of events kept                                                                                                                                                            |
| `ANALYTICS_COLLECT`        | `1`                                       | `0` pauses collection                                                                                                                                                          |
| `TRUST_PROXY`              | `0`                                       | Number of trusted reverse proxies in front of the server (usually `1`); the client address is read from that position in `X-Forwarded-For`, and `X-Forwarded-Host` is accepted |
| `ALLOWED_ORIGINS`          | —                                         | Extra comma-separated origins allowed to post analytics (e.g. `https://www.example.in`) when a proxy rewrites `Host`                                                           |

No secret is ever placed in frontend code. The dashboard token is entered by
the owner and kept only in that browser tab.

## Deployment

- **Node host** (keeps first-party analytics and the dashboard):
  `npm ci && npm run build`, then run
  `NODE_ENV=production STATIC_ROOT=dist ANALYTICS_ADMIN_TOKEN=… node server/server.mjs`
  behind HTTPS, with a persistent volume for `ANALYTICS_DATA_DIR`. Deploy the whole repository: the server serves `dist/` and reads the shared event schema from `js/analytics-schema.js`.
- **Vercel**: import the repository; `vercel.json` already sets everything
  (install `npm ci`, build `npm run build:vercel`, output `dist`, security
  headers, `/admin` → `/admin/`). Leave the project's Framework Preset as
  "Other" and the build/output overrides empty so `vercel.json` applies. Vercel
  cannot run the Node analytics server, so the first-party collector is off in
  this build and `/admin/` explains that reports are unavailable (demo preview
  still works). Use Google Analytics for measurement: after setting
  `ga4MeasurementId`, update the Content-Security-Policy in `vercel.json` — the
  build stops with the exact value to paste if it is out of date.
- **Other static hosts** (Netlify, Cloudflare Pages): `npm run build:static`
  and upload `dist/` (including `_headers`). Same analytics limits as Vercel.

Nothing has been deployed by this project: the production domain, address and
other launch items are still to be confirmed.

## Quality status (measured on this build)

- 99 automated tests passing: six viewports (360–1920 px) with no console
  errors, failed requests or horizontal overflow; catalogue, order list,
  overlays, analytics client/server, dashboard, axe WCAG 2.1 AA scans (no
  serious or critical issues), source integrity checks, and the layout rules
  (three light sections, uniform category tiles, headings clear of the
  sticky header, no unfinished content on the public page, reveals that
  never hide content).
- Lighthouse 13.5 on the production build, local server (two runs):
  mobile Performance 97–100, Accessibility 100, Best Practices 100, SEO 100
  (LCP 1.8–1.9 s, CLS 0); desktop 100 / 100 / 100 / 100 (LCP 0.4 s, CLS 0).
  Field performance on a real host and network will differ.
