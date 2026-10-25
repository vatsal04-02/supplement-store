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
| 2 | Featured range (`featured`) | Photographed product cards, then the editorial "More than a single tub." panel |
| 3 | Shop by category (`categories`) | Seven tiles, one card design |
| 4 | Flavour editorial | "Read the label. Then choose." with chocolate-protein image |
| 5 | Enquiry process (`enquiry-process`) | Five steps, enquiry-not-purchase statement |
| 6 | Catalogue (`catalogue`, opens on demand) | Proof line, search, category chips, brand and sort, product grid, empty state, catalogue note |
| 7 | Goal finder (`finder`) | Four goals routing to categories |
| 8 | Reviews (`reviews`) | "Reviews, without invention." standards — no fabricated reviews |
| 9 | Product checks (`authenticity`) | Store banner and shelf photos, four verification steps, caveat |
| 10 | Why Infinite Nutrition (`why`) | Six trust points, evidence panel |
| 11 | Founder (`founder`) | Anant Prajapati portrait, facts, training editorial |
| 12 | Visit (`visit`, `store-location`) | Address as supplied, two numbers with call/WhatsApp, location panel (map and directions once verified); detail grid, owner checklist and map placeholder in review mode |
| 13 | Policies (`policies`) | Seven provisional policy dialogs |
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
  smoke) now play two slow cycles and settle instead of looping forever; toast
  feedback and an "Added to list ✓" state replace silently opening the drawer.
  Scroll reveals are described below. Reduced motion disables all of it.
- **Discovery:** a category with nothing listed explains why and offers a
  prepared WhatsApp question; search terms, filters and contacts are measured.
- **Details dialog:** quantity stepper and "Add to enquiry list".
- **Review mode:** owner-facing notes carry `data-owner-note` and hide when
  `reviewMode` is false (the default); the unapproved Fit & First credit is
  withheld.
- **Accessibility:** names include visible text (WCAG 2.5.3), regions for the
  utility bar and quick bar, focus returns to the opener, focus stays inside the
  drawer after removing rows.
- **SEO:** confirmed locality/region/country added to `LocalBusiness` JSON-LD;
  canonical, social image and sitemap only after the domain is confirmed;
  `robots.txt`; 1200 × 630 social image prepared from the hero artwork.
- **Performance:** the 5.9 MB single file became cached, separately loaded
  assets; 720 w editorial variants; minified build (CSS 28 KB, app 14 KB gzip);
  no forced synchronous layout at start-up; parallax only for on-screen media.

## Darkness and layout pass

Requested fixes, applied without changing the palette (`#080808`, `#B80019`,
`#65000D`, white), typography, logo, navigation, sections or flows:

- **Light rhythm:** Reviews, Why Infinite Nutrition and Visit are light
  sections (`#F4F4F4`, near-black text, red accents) between dark ones. The
  section tokens are re-pointed inside `.section-light`, so hairlines, cards
  and secondary text follow.
- **Hero:** a soft red radial glow sits behind the (unchanged) product photo.
- **Grey floor:** secondary copy on dark backgrounds is at least `#B5B5B5`.
- **Logo:** no transparent logo was supplied; a background-removed cut of the
  supplied 380 px logo sits on a solid `#0a0a0a` container (no white box).
- **Categories:** all seven tiles are the same card in an even grid (four per
  row, last row centred). Tiles without a store photo use a Deep Blood Red
  gradient and a line icon; the outlined numerals and the full-width seventh
  tile are gone. Counts are real; an empty category says "Ask in store".
- **Order:** "Explore by format" follows the featured product grid. Reviews →
  Product checks → Why → Founder were already consecutive and are unchanged.
- **Anchors:** sections stop 16 px below the sticky header (`--nav-h`, kept
  exact by `js/app.js`).
- **Headings:** one pattern everywhere: a red small-caps kicker label (white
  text on Power Red, legible on black) over one bold headline size. The red
  underline accent was dropped for consistency.
- **Unfinished content:** the owner checklist, "Incomplete" address label,
  detail grid, empty map box, disabled directions button and policy draft
  labels appear only in review mode. Products without a photo are not
  published (featured range, catalogue and category counts). Customer copy
  no longer refers to the owner. The footer link reads "Privacy Policy" and
  opens the privacy summary with the statistics controls.
- **Scroll reveals:** content is never hidden (the later motion pass below
  describes the current reveal); image frames show a dark brand surface while
  a lazy photo arrives.

## Visual appeal and motion pass

Every effect animates `transform`, `translate` or `opacity` only. Reduced
motion turns all of it off (content static and fully visible); touch and
narrow screens keep reveals and hover-free styling but get no parallax,
magnetic buttons or embers.

- **Spacing:** one vertical padding for every section
  (`--section-pad: clamp(56px, 5.5vw, 80px)`), closing the uneven gaps.
- **Phones:** one display format everywhere, `+91 88404 27558` and
  `+91 83032 53308` (links unchanged).
- **No colour flash:** no section or section pseudo-element animates its
  background; a test checks Goal Finder and Store Policies. (No full-section
  flash existed in the code; the reveals are translate/opacity only.)
- **Hover (fine pointers):** product cards lift 6px, the photo scales to
  1.06 and a pre-drawn red ring fades in (250ms ease-out); outlined buttons
  fill with a red sweep from the left; solid buttons lift 2px with a red glow;
  nav underlines grow from the left (200ms); category cards get a 600ms
  diagonal shine; FAQ rows get a red ring and a turning "+". Colour and
  border changes switch instantly rather than animating.
- **Hero:** headline lines rise out of a mask (`overflow-y: clip`), 90ms
  apart; the photo frame moves at 0.15× scroll speed on desktop; the red
  glow behind it breathes between 0.5 and 0.8 of full strength (4s each way);
  16 slow red embers drift up over the photo side on desktop.
- **Scroll:** a 2px red divider draws across each section's top on scroll-in
  (700ms); blocks entering together are staggered 70ms apart (waiting
  content sits 18px low at 85% opacity, never hidden); the founder portrait
  and the scoop photo move at 0.1× scroll speed on desktop, inside frames
  over-scanned so no edge shows.
- **Ghost type:** outlined "RANGE", "SHOP" and "ASK" (stroke only, ~9%
  white) behind the Featured, Categories and FAQ headlines, hidden from
  assistive technology.
- **Magnetic CTAs:** primary buttons lean up to 6px toward a mouse cursor and
  spring back on leave.
- **Off-screen and scrolling:** the hero pauses every animation when it
  leaves the viewport; while the page is actively scrolling, the glow rests
  at full strength and the embers leave the render tree, then resume.
- **Not added:** counters (the page has no stat block, so none was invented).
  The request also mentioned a scroll-progress bar, a marquee and a category
  gradient sweep; none of these exist in this codebase, so there was nothing
  to preserve or change.

Measured in headless Chromium without a GPU (instant scroll steps at
~1,200 px/s, 1440 × 900): 60 fps below the hero, ~58 fps averaged over the
page, the same as before this pass; the hero region itself runs ~30 fps there
because of the original design's blurred and screen-blended layers. A real
browser with GPU compositing is expected to do better; measure on target
devices with DevTools before launch.

## Master pass: copy and conversion

- **Headlines:** How it works · Start with your goal · FAQ · Store policies ·
  Read the label · Reviews (+ "No fake reviews. Ever.") · Visit the store ·
  Before you enquire. "Find us with confidence" and the second founder
  headline are gone.
- **Labels and CTAs:** red kickers stay on the hero, Product checks and the
  founder only; each section has one primary button.
- **One honest-store note** ("Before you enquire", in Why Infinite
  Nutrition); the other disclaimer banners moved into the FAQ or were
  dropped as duplicates.
- **Hero:** the four service cells became one line, "Imported & Indian
  brands · Guidance before you buy". "100% original" is withheld until
  approved (`approvals.originalClaim`).
- **Conversion:** sticky mobile Call + WhatsApp bar after the hero; a gym /
  trainer bulk-order strip after Featured (prefilled WhatsApp, no prices); a
  rotating announcement bar with three factual messages; a desktop
  back-to-top button after two viewports. The catalogue already had
  client-side category filter chips (all seven categories).

## Round 4: visual polish

- **Announcement bar:** "LUCKNOW'S FIRST 24×7 NUTRITION STORE" (confirmed by
  the owner). Opening hours elsewhere on the page and in structured data are
  unchanged; see the launch checklist.
- **Product cards:** each photo fills 60% of its media stage (the supplied
  crops are about 120 × 150 px, so they are enlarged and look soft until
  larger pack photos are supplied); one trust line per card, "Sealed pack",
  with "100% original" added only once `approvals.originalClaim` is true.
- **Ghost words:** two only ("SHOP", "ASK"), about 40% smaller, at the top
  right edge of their sections; none behind a headline.
- **Spacing:** section padding capped at `clamp(48px, 5vw, 72px)`.
- **Reviews:** a slim strip: headline, one line, Share feedback.
- **Goal finder:** watermark removed; goals on the left, the suggested
  category panel on the right.
- **Headings:** a secondary, sentence-case style for nine sections; the
  condensed all-caps treatment stays on the hero, Featured range, Shop by
  category and the founder. Hero headline tracking loosened to −0.02em.
- **Header:** Search and Order list are icon buttons (with accessible names
  and a count badge); all six nav links stay.

## Mobile hero video

- **Phones only (≤760 px).** A muted, looping, inline `<video>` sits behind
  the hero copy. `js/app.js` attaches its sources (`assets/hero-bg.webm`,
  then `assets/hero-bg.mp4`) and poster only on phones that allow motion,
  so desktop and tablet keep the photo hero pixel-for-pixel and download
  nothing extra.
- **TEMP-REPLACE.** The current clip is an 8 s seamless loop rendered from
  the existing hero photo (slow push-in, drifting red mist, a soft red glow
  pulse). It is not stock footage. Replace it with real store footage,
  keeping the same file names: dark, slow motion, a red accent, 9:16, about
  540 × 960, no audio, 3 MB or less for both files. Re-export
  `assets/hero-poster.jpg` from the first frame.
- **Fallbacks.** A poster layer sits under the video. If both files fail,
  the video errors or autoplay is refused (for example iOS Low Power Mode),
  the video hides and the poster takes over with a slow Ken Burns zoom
  (1 → 1.12, 18 s, alternating). Under reduced motion the poster stays still
  and the clip is never downloaded. Controls and the iOS play glyph are
  suppressed.
- **Readability.** The overlay is clear through the middle and
  rgba(0,0,0,0.79) at the top and bottom edges (0.72 + 10% for phones),
  with a soft lift behind the copy column, a faint red vignette in two
  corners and a light text shadow on the lede and proof line. The old
  full-height black wash is off while the video runs.
- **Layout.** The hero is capped at 92svh with the copy centred. The
  headline is `clamp(2.6rem, 12vw, 4.5rem)` with a thicker red underline.
  The CTA is full width up to 340 px, centred. The proof line wraps to the
  lede's measure so it stays clear of the tub's emblem.
- **Performance.** The clip pauses when the hero scrolls out of view and
  resumes on return. The local Node server now sends `video/*` types and
  byte ranges, which Safari needs to play video; Vercel does this already.

## Light premium redesign

The all-black page read as heavy, so the site now uses a light palette.
The change lives in `css/redesign.css`, loaded last. It re-points the colour
tokens, so the older layers follow, and fixes only what tokens cannot.

- **Palette:** warm paper `#F6F3EE` and white sections alternate down the page
  (white: categories, how it works, reviews, why, visit, FAQ). Type is
  charcoal `#17140F` with secondary text `#5B5248`, both well above 4.5:1. The
  brand red `#B80019` is kept for calls to action, kickers and accents only.
- **Dark on purpose:** the phone hero (it plays over video), the
  announcement bar, the bulk-order band and the footer (warm charcoal
  `#1B1815`). Photo category tiles keep a dark scrim under white type.
- **Type:** Barlow Condensed 700 for display headlines and Manrope (variable)
  for body text, both self-hosted under `assets/fonts/` (SIL Open Font
  License, about 47 KB in total), so the strict CSP is unchanged. System fonts are
  the fallback, including when the page is opened from disk.
- **Surfaces:** white cards with a 1px warm border, 14–20px radius and a soft
  layered shadow that deepens on hover; rounded photos; captions on photos
  are white pills. The header is translucent white with a blur.
- **Desktop hero:** a bright editorial hero with the moody product photograph
  in a rounded, shadowed frame; the red glow behind it is softened and the
  ember particles are off.
- **Overlays:** dialogs, the order-list drawer, toasts, the catalogue filters
  and the phone menu were moved to white. Every text element was checked
  for contrast in each state at 390, 768 and 1440 px.

## Architecture decision

The page stays plain HTML, CSS and JavaScript (classic deferred scripts). The
existing implementation was stable and self-contained; a framework migration
would have added a build requirement and put the design at risk without a
matching benefit for a single-page store. Classic scripts also keep the page
working when `index.html` is opened directly from disk (analytics aside).
The only server code is the optional, dependency-free Node server for the
first-party analytics API and dashboard.
