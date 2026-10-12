/*
  Infinite Nutrition — owner-editable site configuration
  ------------------------------------------------------
  Every business fact the storefront uses at runtime lives here, so it can be
  updated without touching page logic. Publish a value only after the owner
  has confirmed it. Empty strings and `false` keep the honest "awaiting
  confirmation" states that the page already shows.

  Phone numbers also appear as plain tel:/wa.me links in index.html so they
  work without JavaScript. `npm test` fails if those links drift from the
  numbers below.
*/
window.INFINITE_SITE = {
  name: 'Infinite Nutrition',

  // Production origin, e.g. 'https://www.example.in'. Leave empty until the
  // domain is confirmed: the build only writes canonical, og:url, og:image,
  // sitemap.xml and absolute JSON-LD URLs once this is set.
  siteUrl: '',

  // Review mode is for the owner, not for customers. When true the page also
  // shows everything that is still unfinished: the owner completion
  // checklist, approval notes, the address/contact detail grid, the pending
  // map box and disabled directions button, policy draft labels, and
  // products that have no photo yet (as "Store photo coming soon" cards).
  // Keep it false on the public site; switch it on locally to review.
  reviewMode: false,

  // Owner approvals for wording that must not be published by default.
  approvals: {
    // "Powered by Fit & First" — relationship and permission not yet confirmed.
    fitAndFirstCredit: false
  },

  // Published store numbers. The first entry is used for single-button
  // WhatsApp enquiries; both are offered for the order list.
  contacts: [
    { label: '+91 88404 27558', tel: '+918840427558', whatsapp: '918840427558' },
    { label: '+91 83032 53308', tel: '+918303253308', whatsapp: '918303253308' }
  ],

  address: {
    supplied: '147, Part 1, Lucknow, Uttar Pradesh',
    // Set to true only when street/locality and postcode are confirmed.
    complete: false,
    locality: 'Lucknow',
    region: 'Uttar Pradesh',
    country: 'IN',
    postcode: ''
  },

  // Store map: paste owner-verified values only. Preferred: the exact Google
  // Maps embed URL and directions URL. Alternative: a verified Google Place ID.
  map: {
    embedUrl: '',
    directionsUrl: '',
    placeId: '',
    locationLabel: 'Infinite Nutrition'
  },

  analytics: {
    // First-party, cookieless event collection (see docs/ANALYTICS.md).
    // The endpoint is served by `npm start` (server/server.mjs). On a static
    // host without that server, set endpoint to '' to disable sending.
    firstParty: {
      enabled: true,
      endpoint: '/api/collect'
    },
    // Optional Google Analytics 4. Loaded only after the visitor accepts the
    // analytics banner. Example: 'G-XXXXXXXXXX'. Leave empty to disable.
    ga4MeasurementId: '',
    // Honour Global Privacy Control and Do Not Track browser signals.
    respectPrivacySignals: true,
    // 'auto' logs events to the browser console on localhost only.
    debug: 'auto'
  },

  // Policy wording. Each entry is shown as a provisional draft (and, in
  // review mode, labelled for owner review) until the owner supplies approved
  // terms; set `approved: true` with the final text.
  policies: {
    shipping: {
      title: 'Delivery & collection',
      approved: false,
      body: 'Delivery coverage, charges, dispatch timing, delivery estimates, collection location and collection procedure have not been supplied for publication. Customers should contact the store before ordering or travelling.'
    },
    returns: {
      title: 'Returns & replacements',
      approved: false,
      body: 'Eligibility, inspection requirements, exclusions and the returns or replacement process have not been supplied. No return or replacement promise is made here.'
    },
    refunds: {
      title: 'Refunds',
      approved: false,
      body: 'Refund eligibility, method and timelines have not been confirmed for publication. Contact the store about the specific item before relying on a refund.'
    },
    cancellation: {
      title: 'Order cancellation',
      approved: false,
      body: 'The store’s cancellation deadline and eligibility conditions have not been supplied. Ask the store whether an enquiry or confirmed order can be cancelled.'
    },
    payments: {
      title: 'Payment methods',
      approved: false,
      body: 'Accepted payment methods, payment timing and invoice or receipt arrangements have not been confirmed for this website. This page does not collect or store card or payment details.'
    },
    privacy: {
      title: 'Privacy policy',
      approved: false,
      body: 'This website does not use forms, accounts or advertising cookies and does not collect names, phone numbers or payment details. If website analytics is enabled, it records anonymous usage events — such as pages viewed, products viewed, searches and buttons used — without cookies, and visitors can switch it off under “Privacy Policy” in the footer. Your order list is kept only in this browser. Opening WhatsApp transfers the prepared enquiry to WhatsApp under the customer’s control. This is a summary; the store’s complete privacy policy has not been published yet.'
    },
    terms: {
      title: 'Terms & conditions',
      approved: false,
      body: 'Product availability, exact price, delivery charges and final total must be confirmed directly by the store through the published contact channels. A WhatsApp enquiry is not an order confirmation. Complete terms have not been published yet.'
    }
  }
};
