# Design notes — what was preserved and what changed

The supplied file `Website Design Layout (18).html` (kept unchanged in
`docs/original/`) is the source of truth for the visual design. This pass
refined the implementation; it did not redesign the page.

Before/after captures of the most-changed sections are in
[`docs/screenshots/`](screenshots/) (`compare-*.jpg`), along with the demo
dashboard (`dashboard-demo.jpg`, labelled sample data).

## Implementation map of the original page

| Order | Section (`id`) | Content kept |
|---|---|---|
| — | Utility bar, sticky header | Logo lock-up, nav (Home, Featured, Categories, All products, Founder, Visit store), Search, Order list counter, WhatsApp enquiry |
| 1 | Hero (`home`) | "Fuel the beast." headline, brand lock, four service benefits, Shop products / WhatsApp CTAs, red-lit product artwork with depth layers |
| 2 | Featured range (`featured`) | Editorial "More than a single tub." panel, four product cards |
| 3 | Shop by category (`categories`) | Seven-tile bento grid |
| 4 | Flavour editorial | "Read the label. Then choose." with chocolate-protein image |
| 5 | Enquiry process (`enquiry-process`) | Five steps, enquiry-not-purchase statement |
| 6 | Catalogue (`catalogue`, opens on demand) | Proof line, search, category chips, brand and sort, product grid, empty state, catalogue note |
| 7 | Goal finder (`finder`) | Four goals routing to categories |
| 8 | Reviews (`reviews`) | "Reviews, without invention." standards — no fabricated reviews |
| 9 | Product checks (`authenticity`) | Store banner and shelf photos, four verification steps, caveat |
| 10 | Why Infinite Nutrition (`why`) | Six trust points, evidence panel |
| 11 | Founder (`founder`) | Anant Prajapati portrait, facts, training editorial |
| 12 | Visit (`visit`, `store-location`) | Address as supplied, two numbers with call/WhatsApp, detail grid, owner checklist, map placeholder |
| 13 | Policies (`policies`) | Seven owner-review policy dialogs |
| 14 | FAQ (`faq`) | Six questions |
| — | Footer, mobile quick bar, order list drawer, details dialog | As designed |

**Unchanged by design:** section order and content, copy, colour palette
(`#080808` / `#b80019` / white), display typography and system font stacks,
button and card styles, spacing system, product-stage treatment (small
store crops never enlarged), honesty statements, motion language (hero line
reveal, staged copy, frame entrance, scroll reveals, story rails, pointer depth).
`css/styles.css` is the original stylesheet, formatted; every change lives in
`css/refinements.css`.

## What changed, and why

### Repairs (things that were broken in the original)
| Issue | Fix |
|---|---|
| 22 image files referenced by the design were not in the export (4 product photos, 7 category visuals, store insets) → broken images and 404s | Two creatine packshots cropped from the store's own creatine-shelf photo; photo-awaiting stage for the other two; category tiles use real store photos (whey, mass gainers, creatine) or a typographic tile with an outlined numeral |
| Headings split mid-word at ≥1440 px ("VISIT INFINITE NUTRITI / ON.", "CONFIDEN / CE.", a lone "." under "INVENTION") and dialog titles on phones ("MONOHYDRAT / E") | Headings scale to their column with container units and ≥4 % headroom; a test with a safety margin guards it |
| Owner checklist labels floated to the far right of each row | Two-column "Pending · item" layout |
| Featured price/availability divider grew into a grey block | Two equal grid cells with a 1 px hairline |
| Fourth featured card alone on its own row (4-column grid with a double-width first card) | Exactly four products use a 3-column zigzag; the double-width feature card is kept |
| Card and tile hover lift never worked once scroll reveals ran | Reveal animations release after finishing; the lift is restored |
| Store banner (960 × 430) enlarged ~1.7× and cropped in a tall frame | Kept near its natural proportion |
| 7.7 px hero benefit labels on phones | Raised to 9.6 px |
| Order list lost on reload; opening one dialog removed `inert` from the other; live regions became inert while dialogs were open | Validated `localStorage` persistence, layer handling fixed, live regions excluded from `inert` |
| Inline styles and `innerHTML` with unescaped values | CSSOM for custom properties, escaping everywhere, DOM APIs for the map link; strict CSP now possible |

### Refinements
- **Motion:** the hero's ambient loops (product drift, red orbit, light sweeps,
  smoke) now play two slow cycles and settle instead of looping forever;
  scroll-reveal targets wait in their start pose (no 18 px jump); toast feedback
  and an "Added to list ✓" state replace silently opening the drawer. Reduced
  motion disables all of it.
- **Discovery:** a category with nothing listed explains why and offers a
  prepared WhatsApp question; search terms, filters and contacts are measured.
- **Details dialog:** quantity stepper and "Add to enquiry list".
- **Review mode:** owner-facing notes carry `data-owner-note` and hide when
  `reviewMode` is false; the unapproved Fit & First credit is withheld at launch.
- **Accessibility:** names include visible text (WCAG 2.5.3), regions for the
  utility bar and quick bar, focus returns to the opener, focus stays inside the
  drawer after removing rows.
- **SEO:** confirmed locality/region/country added to `LocalBusiness` JSON-LD;
  canonical, social image and sitemap only after the domain is confirmed;
  `robots.txt`; 1200 × 630 social image prepared from the hero artwork.
- **Performance:** the 5.9 MB single file became cached, separately loaded
  assets; 720 w editorial variants; minified build (CSS 28 KB, app 14 KB gzip);
  no forced synchronous layout at start-up; parallax only for on-screen media.

## Architecture decision

The page stays plain HTML, CSS and JavaScript (classic deferred scripts). The
existing implementation was stable and self-contained; a framework migration
would have added a build requirement and put the design at risk without a
matching benefit for a single-page store. Classic scripts also keep the page
working when `index.html` is opened directly from disk (analytics aside).
The only server code is the optional, dependency-free Node server for the
first-party analytics API and dashboard.
