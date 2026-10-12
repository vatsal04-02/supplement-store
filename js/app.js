/*
  Infinite Nutrition storefront
  -----------------------------
  Rendering and interaction for index.html. Business facts come from
  js/site-config.js, products and categories from js/catalogue.js, and
  measurement goes through js/analytics.js.

  Sections (search for "/* ----------"):
    configuration · utilities · media · featured range · categories ·
    catalogue · order list · overlays · product details · policies & privacy ·
    goal finder · navigation · motion · analytics observers · start-up
*/
(function () {
  'use strict';

  /* ---------- configuration ---------- */
  var SITE = window.INFINITE_SITE || {};
  var MAX_QTY = 99;
  var CART_KEY = 'infinite-order-list-v1';
  var STOCK_LABELS = { 'in-stock': 'In stock', 'low-stock': 'Low stock', 'out-of-stock': 'Out of stock' };
  var ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/;

  var STORE_CONTACTS = (Array.isArray(SITE.contacts) ? SITE.contacts : []).filter(function (c) {
    return c && /^\d{10,15}$/.test(String(c.whatsapp || '')) && typeof c.label === 'string';
  });
  if (!STORE_CONTACTS.length) {
    STORE_CONTACTS = [
      { label: '08840 427558', tel: '+918840427558', whatsapp: '918840427558' },
      { label: '83032 53308', tel: '+918303253308', whatsapp: '918303253308' }
    ];
  }

  function track(name, params) {
    if (!window.InfiniteAnalytics) return;
    try {
      window.InfiniteAnalytics.track(name, params || {});
    } catch (error) {
      /* never break the page for analytics */
    }
  }

  var categories = (window.INFINITE_CATALOGUE_CATEGORIES || []).filter(function (c) {
    return c && typeof c.id === 'string' && ID_PATTERN.test(c.id) && typeof c.label === 'string';
  });
  var categoryMap = {};
  categories.forEach(function (category) {
    categoryMap[category.id] = category.label;
  });
  var categoryMedia = window.INFINITE_CATEGORY_MEDIA || {};

  function finitePrice(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  }

  // Normalise the owner-edited catalogue once, so the rest of the file can
  // rely on its shape. Entries without an id, name, brand or known category
  // are skipped rather than rendered half-empty.
  var products = (window.INFINITE_PRODUCTS || [])
    .filter(function (p) {
      return p && typeof p.id === 'string' && ID_PATTERN.test(p.id) && p.name && p.brand && categoryMap[p.category];
    })
    .map(function (p, index) {
      var variants = (Array.isArray(p.variants) ? p.variants : [])
        .filter(function (v) {
          return v && typeof v.id === 'string' && v.id;
        })
        .map(function (v) {
          return {
            id: v.id,
            label: v.label || '',
            flavour: v.flavour || '',
            size: v.size || '',
            price: finitePrice(v.price),
            mrp: finitePrice(v.mrp)
          };
        });
      return {
        id: p.id,
        category: p.category,
        brand: String(p.brand),
        name: String(p.name),
        image: typeof p.image === 'string' ? p.image : '',
        imageWebp: typeof p.imageWebp === 'string' ? p.imageWebp : '',
        imageWidth: Math.max(1, Number(p.imageWidth) || 800),
        imageHeight: Math.max(1, Number(p.imageHeight) || 800),
        alt: p.alt || p.brand + ' ' + p.name,
        variants: variants,
        specifications: Array.isArray(p.specifications)
          ? p.specifications.filter(function (s) {
              return s && s.label && s.value;
            })
          : [],
        ingredients: p.ingredients || '',
        serving: p.serving || '',
        allergens: p.allergens || '',
        usage: p.usage || '',
        stock: STOCK_LABELS[p.stock] ? p.stock : null,
        order: index
      };
    });
  var productById = {};
  products.forEach(function (p) {
    productById[p.id] = p;
  });

  /* ---------- utilities ---------- */
  function byId(id) {
    return document.getElementById(id);
  }

  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c];
    });
  }

  function money(value) {
    return '₹' + Number(value).toLocaleString('en-IN');
  }

  var siteAnnouncements = byId('siteAnnouncements');
  function announceSite(message) {
    if (!siteAnnouncements) return;
    siteAnnouncements.textContent = '';
    requestAnimationFrame(function () {
      siteAnnouncements.textContent = message;
    });
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }
  function storageSet(key, value) {
    try {
      if (value == null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (error) {
      /* private mode or blocked storage: keep working in memory */
    }
  }

  var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function whatsappUrl(number, message) {
    return 'https://wa.me/' + number + '?text=' + encodeURIComponent(message);
  }

  function contactRole(href) {
    var digits = String(href || '').replace(/\D+/g, '');
    for (var i = 0; i < STORE_CONTACTS.length; i++) {
      if (digits.indexOf(STORE_CONTACTS[i].whatsapp) !== -1) return i === 0 ? 'primary' : 'secondary';
    }
    return 'other';
  }

  function sourceOf(element) {
    if (!element || !element.closest) return 'page';
    var explicit = element.closest('[data-track-source]');
    if (explicit) return explicit.getAttribute('data-track-source');
    if (element.closest('.drawer')) return 'order_list';
    if (element.closest('.modal')) return 'details_dialog';
    if (element.closest('.mobile-bar')) return 'mobile_bar';
    if (element.closest('.site-nav')) return 'header';
    if (element.closest('.footer')) return 'footer';
    var section = element.closest('section[id]');
    return section ? section.id : 'page';
  }

  /* ---------- review mode & owner approvals ---------- */
  var reviewMode = SITE.reviewMode !== false;
  document.documentElement.classList.toggle('review-mode', reviewMode);
  document.querySelectorAll('[data-approval]').forEach(function (node) {
    var approved = SITE.approvals && SITE.approvals[node.getAttribute('data-approval')] === true;
    node.hidden = !(approved || reviewMode);
  });

  /* ---------- media ---------- */
  function variantLabel(variant) {
    if (!variant) return '';
    return variant.label || [variant.flavour, variant.size].filter(Boolean).join(' · ');
  }

  function currentVariant(p, card) {
    if (!p.variants.length) return null;
    var select = card && card.querySelector('[data-variant]');
    var id = select ? select.value : p.variants[0].id;
    return (
      p.variants.find(function (v) {
        return v.id === id;
      }) || p.variants[0]
    );
  }

  function currentPrice(p, card) {
    var variant = currentVariant(p, card);
    return variant ? variant.price : null;
  }

  // Product photos are small crops of store photography. Their source size
  // is passed to CSS so the stage never enlarges them beyond their pixels.
  function productImageMarkup(p, loading) {
    if (!p.image) {
      return (
        '<div class="product-photo-pending"><span class="pending-brand">' +
        esc(p.brand) +
        '</span> ' +
        '<span class="pending-note">Store photo coming soon</span></div>'
      );
    }
    return (
      '<picture data-source-w="' +
      p.imageWidth +
      '" data-source-h="' +
      p.imageHeight +
      '">' +
      (p.imageWebp ? '<source srcset="' + esc(p.imageWebp) + '" type="image/webp">' : '') +
      '<img class="product-packshot" src="' +
      esc(p.image) +
      '" alt="' +
      esc(p.alt) +
      '" loading="' +
      (loading || 'lazy') +
      '" decoding="async" width="' +
      p.imageWidth +
      '" height="' +
      p.imageHeight +
      '"></picture>'
    );
  }

  // CSP-safe: custom properties and focal points are applied through the
  // CSSOM after rendering instead of inline style attributes.
  function applyMediaVars(root) {
    root.querySelectorAll('[data-source-w]').forEach(function (node) {
      node.style.setProperty('--product-source-w', node.getAttribute('data-source-w') + 'px');
      node.style.setProperty('--product-source-h', node.getAttribute('data-source-h') + 'px');
    });
    root.querySelectorAll('img[data-focus]').forEach(function (img) {
      img.style.objectPosition = img.getAttribute('data-focus');
    });
  }

  function photoTrust(p) {
    return p.image ? '<span class="product-photo-trust">Store-supplied photo</span>' : '';
  }

  function priceMarkup(variant) {
    if (!variant || variant.price == null) {
      return '<div class="product-data-item"><span class="product-data-label">Selling price</span><strong class="product-pending">Store confirmation required</strong></div>';
    }
    var html =
      '<div class="product-data-item"><span class="product-data-label">Selling price</span><div class="price-row"><strong class="selling-price">' +
      money(variant.price) +
      '</strong>';
    if (variant.mrp != null && variant.mrp > variant.price) {
      var discount = Math.round(((variant.mrp - variant.price) / variant.mrp) * 100);
      html += '<span class="mrp">MRP ' + money(variant.mrp) + '</span><span class="discount">' + discount + '% off</span>';
    }
    return html + '</div></div>';
  }

  function stockMarkup(p) {
    return (
      '<div class="product-data-item"><span class="product-data-label">Availability</span>' +
      (p.stock
        ? '<strong class="stock-status">' + STOCK_LABELS[p.stock] + '</strong>'
        : '<strong class="stock-status pending">Store confirmation required</strong>') +
      '</div>'
    );
  }

  function variantMarkup(p) {
    if (!p.variants.length) {
      return '<div class="product-data-item"><span class="product-data-label">Size / variant</span><strong class="product-pending">Store confirmation required</strong></div>';
    }
    if (p.variants.length === 1) {
      return (
        '<div class="product-data-item"><span class="product-data-label">Size / variant</span><strong class="product-data-value">' +
        esc(variantLabel(p.variants[0])) +
        '</strong></div>'
      );
    }
    return (
      '<label class="variant-field"><span>Size / variant</span><select data-variant aria-label="Select size or variant for ' +
      esc(p.name) +
      '">' +
      p.variants
        .map(function (v) {
          return '<option value="' + esc(v.id) + '">' + esc(variantLabel(v)) + '</option>';
        })
        .join('') +
      '</select></label>'
    );
  }

  /* ---------- enquiry messages ---------- */
  function productEnquiryMessage(p, variant, qty) {
    var units = clampQty(qty);
    var confirmedPrice = variant && variant.price != null;
    var variantText = variant ? variantLabel(variant) : 'size / variant to confirm';
    var priceText = confirmedPrice
      ? ' — displayed price ' +
        money(variant.price) +
        ' each' +
        (units > 1 ? ' (' + money(variant.price * units) + ' for ' + units + ')' : '')
      : ' — price to confirm';
    return (
      'Hi Infinite Nutrition, I would like to enquire about ' +
      p.brand +
      ' ' +
      p.name +
      ' — ' +
      variantText +
      ' — quantity ' +
      units +
      priceText +
      '. Please confirm the size or variant, availability, final price, delivery charges and payment arrangements. I understand this is an enquiry, not a completed purchase or confirmed order.'
    );
  }

  function enquiryUrl(p, variant, contactIndex, qty) {
    var contact = STORE_CONTACTS[contactIndex || 0] || STORE_CONTACTS[0];
    return whatsappUrl(contact.whatsapp, productEnquiryMessage(p, variant, qty));
  }

  function clampQty(value) {
    var n = Math.round(Number(value));
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(MAX_QTY, n));
  }

  /* ---------- featured range ---------- */
  function featuredCard(p, index) {
    var category = categoryMap[p.category];
    var variant = currentVariant(p);
    var featuredPrice = variant && variant.price != null ? money(variant.price) : 'Confirm with store';
    var featuredStock = STOCK_LABELS[p.stock] || 'Confirm with store';
    var label = p.brand + ' ' + p.name;
    return (
      '<article class="featured-card" data-id="' +
      esc(p.id) +
      '" data-index="' +
      index +
      '">' +
      '<a class="featured-photo" href="#catalogue" data-open-catalogue data-category-link="' +
      esc(p.category) +
      '" data-select-item="' +
      esc(p.id) +
      '" aria-label="' +
      esc((p.image ? 'Store-supplied photo of ' + label : p.brand + ' store photo coming soon: ' + p.name) + ', view in the catalogue') +
      '">' +
      productImageMarkup(p, 'lazy') +
      photoTrust(p) +
      '</a>' +
      '<div class="featured-body"><span>' +
      esc(p.brand) +
      '</span><h3>' +
      esc(p.name) +
      '</h3><p>' +
      esc(category + (variant ? ' · ' + variantLabel(variant) : '')) +
      '</p>' +
      '<div class="featured-facts"><div class="featured-fact"><small>Selling price</small><strong>' +
      esc(featuredPrice) +
      '</strong></div>' +
      '<div class="featured-fact"><small>Availability</small><strong>' +
      esc(featuredStock) +
      '</strong></div></div>' +
      '<div><a class="text-link" href="#catalogue" data-open-catalogue data-category-link="' +
      esc(p.category) +
      '" data-select-item="' +
      esc(p.id) +
      '">View catalogue</a>' +
      '<a class="small-action" href="' +
      esc(enquiryUrl(p, variant)) +
      '" target="_blank" rel="noopener noreferrer" data-wa-context="product" data-item-id="' +
      esc(p.id) +
      '" aria-label="' +
      esc('Prepare enquiry on WhatsApp about ' + label) +
      '">Prepare enquiry</a></div></div></article>'
    );
  }

  var featuredGrid = byId('featuredGrid');
  var featuredProducts = products.slice(0, 4);
  featuredGrid.innerHTML = featuredProducts.map(featuredCard).join('');
  applyMediaVars(featuredGrid);

  /* ---------- categories ---------- */
  function categoryPicture(image, className, sizes) {
    return (
      '<picture' +
      (className ? ' class="' + className + '"' : '') +
      '><source srcset="' +
      esc(image.srcset) +
      '" sizes="' +
      esc(sizes) +
      '" type="image/webp"><img src="' +
      esc(image.fallback) +
      '" alt="' +
      esc(image.alt) +
      '" loading="lazy" fetchpriority="low" decoding="async" width="' +
      Number(image.width) +
      '" height="' +
      Number(image.height) +
      '"' +
      (image.focus ? ' data-focus="' + esc(image.focus) + '"' : '') +
      '></picture>'
    );
  }

  function listedCount(categoryId) {
    return products.filter(function (p) {
      return p.category === categoryId;
    }).length;
  }

  var categoryGrid = byId('categoryGrid');
  categoryGrid.innerHTML = categories
    .map(function (category, index) {
      var count = listedCount(category.id);
      var media = categoryMedia[category.id] || {};
      var visual = media.visual && media.visual.srcset ? media.visual : null;
      var store = media.store && media.store.srcset ? media.store : null;
      var primary = visual || store;
      var tileSizes = '(max-width: 760px) calc(100vw - 24px), (max-width: 1050px) 50vw, 58vw';
      var note;
      if (visual) note = store ? 'Supporting category visual · inset shows the real store range' : 'Supporting category visual';
      else if (store) note = 'Real Infinite Nutrition store photo';
      else note = count ? 'Browse the listed products' : 'On the store shelves · ask for current options';
      var mediaMarkup = primary
        ? categoryPicture(primary, 'category-primary', tileSizes) +
          (visual && store ? categoryPicture(store, 'category-store-proof', '112px') : '')
        : '<span class="category-mark" data-mark="' + String(index + 1).padStart(2, '0') + '"></span>';
      // The tile's name comes from its visible copy (WCAG 2.5.3 label in name);
      // the image layer is decorative here because the note says what it shows.
      return (
        '<a class="category-tile category-' +
        esc(category.id) +
        (primary ? '' : ' category-typographic') +
        (!visual && store ? ' category-store-primary' : '') +
        '" href="#catalogue" data-open-catalogue data-category-link="' +
        esc(category.id) +
        '" data-track-source="category_tile"><div class="category-media" aria-hidden="true">' +
        mediaMarkup +
        '</div><div class="category-copy"><span>' +
        count +
        ' listed</span><strong>' +
        esc(category.label) +
        '</strong><small class="category-visual-note">' +
        esc(note) +
        '</small></div></a>'
      );
    })
    .join('');
  applyMediaVars(categoryGrid);

  /* ---------- catalogue ---------- */
  var grid = byId('productGrid');
  var catalogueSection = byId('catalogue');
  var searchInput = byId('productSearch');
  var brandFilter = byId('brandFilter');
  var sortSelect = byId('sortProducts');
  var activeFilter = 'all';
  var activeBrand = 'all';
  var sortMode = 'featured';
  var catalogueInitialized = false;
  var catalogueListTracked = false;
  var lastResults = [];

  byId('catalogueFilters').innerHTML =
    '<button class="filter" type="button" aria-pressed="true" data-filter="all">All categories <span class="filter-count" aria-hidden="true">' +
    products.length +
    '</span><span class="sr-only">, ' +
    products.length +
    ' products</span></button>' +
    categories
      .map(function (category) {
        var count = listedCount(category.id);
        return (
          '<button class="filter" type="button" aria-pressed="false" data-filter="' +
          esc(category.id) +
          '">' +
          esc(category.label) +
          ' <span class="filter-count" aria-hidden="true">' +
          count +
          '</span><span class="sr-only">, ' +
          count +
          (count === 1 ? ' product' : ' products') +
          '</span></button>'
        );
      })
      .join('');

  var brands = products
    .map(function (p) {
      return p.brand;
    })
    .filter(function (value, index, list) {
      return list.indexOf(value) === index;
    })
    .sort();
  brandFilter.innerHTML =
    '<option value="all">All brands</option>' +
    brands
      .map(function (brand) {
        return '<option value="' + esc(brand.toLowerCase()) + '">' + esc(brand) + '</option>';
      })
      .join('');

  function productCard(p) {
    var category = categoryMap[p.category];
    var pack = p.variants.length === 1 ? variantLabel(p.variants[0]) : '';
    var titleId = 'product-title-' + p.id;
    var unavailable = p.stock === 'out-of-stock';
    var label = p.brand + ' ' + p.name;
    return (
      '<article class="product-card" aria-labelledby="' +
      esc(titleId) +
      '" data-id="' +
      esc(p.id) +
      '" data-category="' +
      esc(p.category) +
      '" data-brand="' +
      esc(p.brand.toLowerCase()) +
      '" data-search="' +
      esc((p.name + ' ' + p.brand + ' ' + category + ' ' + pack).toLowerCase()) +
      '"><div class="product-photo">' +
      productImageMarkup(p, 'lazy') +
      '<span class="category-tag">' +
      esc(category) +
      '</span>' +
      photoTrust(p) +
      '</div>' +
      '<div class="product-body"><div class="product-heading"><span class="product-brand">' +
      esc(p.brand) +
      '</span><h3 id="' +
      esc(titleId) +
      '">' +
      esc(p.name) +
      '</h3></div>' +
      '<div class="product-core-facts">' +
      variantMarkup(p) +
      '<div data-price-area>' +
      priceMarkup(currentVariant(p)) +
      '</div>' +
      stockMarkup(p) +
      '</div>' +
      '<div class="qty-row"><span class="product-qty-label" id="qty-label-' +
      esc(p.id) +
      '">Quantity</span><div class="qty" role="group" aria-labelledby="qty-label-' +
      esc(p.id) +
      '">' +
      '<button type="button" data-qty="minus" aria-label="' +
      esc('Decrease quantity for ' + p.name) +
      '" disabled>−</button><output aria-live="polite" aria-label="' +
      esc('Selected quantity for ' + p.name) +
      '">1</output>' +
      '<button type="button" data-qty="plus" aria-label="' +
      esc('Increase quantity for ' + p.name) +
      '">+</button></div></div>' +
      '<div class="card-actions"><button class="card-action" type="button" data-details="' +
      esc(p.id) +
      '" aria-haspopup="dialog" aria-controls="modalBackdrop">View details</button>' +
      '<a class="card-action whatsapp" aria-label="' +
      esc('Enquire on WhatsApp about ' + label) +
      '" data-product-whatsapp data-wa-context="product" data-item-id="' +
      esc(p.id) +
      '" href="' +
      esc(enquiryUrl(p, currentVariant(p), 0, 1)) +
      '" target="_blank" rel="noopener noreferrer">WhatsApp</a>' +
      '<button class="card-action add" type="button" data-add="' +
      esc(p.id) +
      '"' +
      (unavailable ? ' disabled aria-disabled="true"' : '') +
      '>' +
      (unavailable ? 'Out of stock' : 'Add to enquiry list') +
      '</button></div></div></article>'
    );
  }

  var catalogueMotionTimer = 0;
  var catalogueMotionFrame = 0;
  function stopCatalogueMotion() {
    if (catalogueMotionTimer) window.clearTimeout(catalogueMotionTimer);
    if (catalogueMotionFrame) cancelAnimationFrame(catalogueMotionFrame);
    catalogueMotionTimer = 0;
    catalogueMotionFrame = 0;
    grid.classList.remove('motion-refresh');
  }
  function triggerCatalogueMotion() {
    if (catalogueSection.hidden || reducedMotionQuery.matches || document.visibilityState === 'hidden') {
      stopCatalogueMotion();
      return;
    }
    stopCatalogueMotion();
    catalogueMotionFrame = requestAnimationFrame(function () {
      catalogueMotionFrame = 0;
      if (catalogueSection.hidden || reducedMotionQuery.matches) return;
      grid.classList.add('motion-refresh');
      catalogueMotionTimer = window.setTimeout(function () {
        grid.classList.remove('motion-refresh');
        catalogueMotionTimer = 0;
      }, 620);
    });
  }
  if (reducedMotionQuery.addEventListener) {
    reducedMotionQuery.addEventListener('change', function (event) {
      if (event.matches) stopCatalogueMotion();
    });
  }

  function renderProducts(list, animate) {
    grid.innerHTML = list.map(productCard).join('');
    applyMediaVars(grid);
    Array.prototype.forEach.call(grid.children, function (card, index) {
      card.style.setProperty('--motion-order', String(Math.min(index, 6)));
    });
    if (animate === false) stopCatalogueMotion();
    else triggerCatalogueMotion();
  }

  function syncCategoryButtons() {
    document.querySelectorAll('.filter').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-filter') === activeFilter));
    });
  }

  function clearSecondaryFilters() {
    activeBrand = 'all';
    sortMode = 'featured';
    searchInput.value = '';
    brandFilter.value = 'all';
    sortSelect.value = 'featured';
  }

  function sortedProducts(list) {
    return list.slice().sort(function (a, b) {
      if (sortMode === 'name') return a.name.localeCompare(b.name) || a.brand.localeCompare(b.brand);
      if (sortMode === 'price-asc' || sortMode === 'price-desc') {
        var ap = currentPrice(a);
        var bp = currentPrice(b);
        if (ap == null && bp == null) return a.order - b.order;
        if (ap == null) return 1;
        if (bp == null) return -1;
        return sortMode === 'price-asc' ? ap - bp : bp - ap;
      }
      return a.order - b.order;
    });
  }

  function selectedBrandLabel() {
    var option = brandFilter.selectedOptions && brandFilter.selectedOptions[0];
    return option ? option.textContent : activeBrand;
  }

  function contextChip(label, type, clearLabel) {
    return (
      '<span class="context-chip">' +
      esc(label) +
      '<button type="button" data-clear-context="' +
      type +
      '" aria-label="' +
      esc(clearLabel) +
      '">×</button></span>'
    );
  }

  function applyFilters(options) {
    catalogueInitialized = true;
    var rawQuery = searchInput.value.trim();
    var q = rawQuery.toLowerCase();
    var matches = products.filter(function (p) {
      var haystack = (
        p.name +
        ' ' +
        p.brand +
        ' ' +
        (categoryMap[p.category] || '') +
        ' ' +
        p.variants.map(variantLabel).join(' ')
      ).toLowerCase();
      return (
        (activeFilter === 'all' || p.category === activeFilter) &&
        (activeBrand === 'all' || p.brand.toLowerCase() === activeBrand) &&
        (!q || haystack.indexOf(q) > -1)
      );
    });
    lastResults = sortedProducts(matches);
    renderProducts(lastResults, !(options && options.suppressMotion));

    var empty = matches.length === 0;
    byId('emptySearch').classList.toggle('show', empty);
    grid.hidden = empty;
    byId('clearSearch').hidden = !q;

    var chips = [];
    if (q) chips.push(contextChip('Search: ' + rawQuery, 'search', 'Clear search'));
    if (activeFilter !== 'all') chips.push(contextChip(categoryMap[activeFilter] || activeFilter, 'category', 'Clear category filter'));
    if (activeBrand !== 'all') chips.push(contextChip(selectedBrandLabel(), 'brand', 'Clear brand filter'));
    byId('catalogueMeta').innerHTML =
      '<span><strong>' +
      matches.length +
      '</strong>&nbsp;' +
      (matches.length === 1 ? 'product' : 'products') +
      ' shown</span>' +
      '<span class="catalogue-context">' +
      (chips.length ? chips.join('') : '<span class="context-chip">All categories and brands</span>') +
      '</span>';

    var request = [
      q ? 'search “' + rawQuery + '”' : '',
      activeFilter !== 'all' ? categoryMap[activeFilter] || activeFilter : '',
      activeBrand !== 'all' ? selectedBrandLabel() : ''
    ]
      .filter(Boolean)
      .join(', ');

    // A category with nothing listed yet is a different situation from a
    // search that missed: say so, and offer a prepared WhatsApp question.
    var unlistedCategory = activeFilter !== 'all' && !q && activeBrand === 'all' && listedCount(activeFilter) === 0;
    var emptyEnquiry = byId('emptyEnquiry');
    if (unlistedCategory) {
      var label = categoryMap[activeFilter];
      byId('emptySearchTitle').textContent = label + ' products are not listed individually yet.';
      byId('emptySearchCopy').textContent =
        'The store carries more than this photographed catalogue shows. Ask on WhatsApp for the current ' +
        label.toLowerCase() +
        ' options, prices and availability.';
      emptyEnquiry.textContent = 'Ask about ' + label.toLowerCase();
      emptyEnquiry.href = whatsappUrl(
        STORE_CONTACTS[0].whatsapp,
        'Hi Infinite Nutrition, which ' +
          label.toLowerCase() +
          ' products do you currently have? Please share the options, prices and availability. I understand this is an enquiry, not a confirmed order.'
      );
    } else {
      byId('emptySearchTitle').textContent = request ? 'No listed products found for ' + request + '.' : 'No products match these filters.';
      byId('emptySearchCopy').textContent = request
        ? 'The store may still carry more products than this photographed catalogue. Reset the filters or ask the team about the current range.'
        : 'Try a different search, category or brand.';
      emptyEnquiry.textContent = 'Ask the store';
      emptyEnquiry.href = whatsappUrl(
        STORE_CONTACTS[0].whatsapp,
        'Hi Infinite Nutrition, I could not find ' +
          (request || 'the product I need') +
          ' in the website catalogue. Please share the current available range and prices. I understand this is an enquiry, not a confirmed order.'
      );
    }
    emptyEnquiry.setAttribute('data-wa-context', 'catalogue_empty');
    return matches.length;
  }

  function trackFilter(type, value, source) {
    track('filter_products', { filter_type: type, filter_value: value, source: source, results_count: lastResults.length });
  }

  function resetFilters(focusSearch) {
    activeFilter = 'all';
    clearSecondaryFilters();
    syncCategoryButtons();
    applyFilters();
    if (focusSearch) searchInput.focus();
  }

  function revealCatalogue(options) {
    if (!catalogueInitialized) applyFilters({ suppressMotion: true });
    var wasHidden = catalogueSection.hidden;
    catalogueSection.hidden = false;
    if (wasHidden) {
      triggerCatalogueMotion();
      announceSite('Product catalogue opened.');
    }
    if (location.hash !== '#catalogue' && window.history && history.replaceState) {
      history.replaceState(null, '', '#catalogue');
    }
    if (!catalogueListTracked) {
      catalogueListTracked = true;
      track('view_item_list', {
        item_list_id: 'catalogue',
        item_list_name: 'Complete catalogue',
        item_ids: lastResults.map(function (p) {
          return p.id;
        }),
        results_count: lastResults.length
      });
    }
    if (!(options && options.noScroll)) {
      requestAnimationFrame(function () {
        catalogueSection.scrollIntoView({ block: 'start' });
      });
    }
  }

  // Delegated so tiles and cards rendered from data work the same as static links.
  document.addEventListener('click', function (event) {
    var control = event.target.closest('[data-open-catalogue]');
    if (!control) return;
    event.preventDefault();
    var categoryId = control.getAttribute('data-category-link');
    var selectId = control.getAttribute('data-select-item');
    if (selectId && productById[selectId]) {
      var card = control.closest('[data-index]');
      track('select_item', {
        item_id: selectId,
        item_list_id: 'featured',
        index: card ? Number(card.getAttribute('data-index')) : 0,
        item_category: productById[selectId].category
      });
    }
    if (categoryId && categoryMap[categoryId]) {
      clearSecondaryFilters();
      activeFilter = categoryId;
      syncCategoryButtons();
      applyFilters();
      trackFilter('category', categoryId, sourceOf(control));
    } else {
      resetFilters(false);
    }
    revealCatalogue();
  });

  byId('catalogueFilters').addEventListener('click', function (event) {
    var button = event.target.closest('.filter');
    if (!button) return;
    activeFilter = button.getAttribute('data-filter');
    syncCategoryButtons();
    applyFilters();
    trackFilter('category', activeFilter, 'filter_bar');
  });

  var filterFrame = 0;
  var searchTimer = 0;
  var lastTrackedSearch = '';
  function trackSearch() {
    if (searchTimer) {
      window.clearTimeout(searchTimer);
      searchTimer = 0;
    }
    var term = searchInput.value.trim();
    if (term.length < 2 || term.toLowerCase() === lastTrackedSearch) return;
    lastTrackedSearch = term.toLowerCase();
    track('search', { search_term: term, results_count: lastResults.length, source: 'catalogue' });
  }
  searchInput.addEventListener('input', function () {
    if (filterFrame) cancelAnimationFrame(filterFrame);
    filterFrame = requestAnimationFrame(function () {
      filterFrame = 0;
      applyFilters({ suppressMotion: true });
    });
    if (searchTimer) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(trackSearch, 900);
  });
  searchInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      trackSearch();
    }
  });
  searchInput.addEventListener('blur', trackSearch);

  byId('clearSearch').addEventListener('click', function () {
    searchInput.value = '';
    lastTrackedSearch = '';
    applyFilters();
    searchInput.focus();
  });
  brandFilter.addEventListener('change', function () {
    activeBrand = brandFilter.value;
    applyFilters();
    trackFilter('brand', activeBrand, 'brand_select');
  });
  sortSelect.addEventListener('change', function () {
    sortMode = sortSelect.value;
    applyFilters();
    trackFilter('sort', sortMode, 'sort_select');
  });
  byId('resetFilters').addEventListener('click', function () {
    resetFilters(true);
    trackFilter('reset', 'all', 'reset_button');
  });
  document.querySelectorAll('[data-reset-filters]').forEach(function (button) {
    button.addEventListener('click', function () {
      resetFilters(true);
      trackFilter('reset', 'all', 'empty_state');
    });
  });
  byId('catalogueMeta').addEventListener('click', function (event) {
    var button = event.target.closest('[data-clear-context]');
    if (!button) return;
    var type = button.getAttribute('data-clear-context');
    if (type === 'search') {
      searchInput.value = '';
      lastTrackedSearch = '';
    }
    if (type === 'category') activeFilter = 'all';
    if (type === 'brand') {
      activeBrand = 'all';
      brandFilter.value = 'all';
    }
    syncCategoryButtons();
    applyFilters();
    searchInput.focus();
  });
  byId('focusSearch').addEventListener('click', function () {
    revealCatalogue();
    searchInput.focus({ preventScroll: true });
  });

  function getQty(card) {
    var output = card.querySelector('output');
    return clampQty(output ? output.textContent : 1);
  }
  function setQty(card, value) {
    var qty = clampQty(value);
    card.querySelector('output').textContent = qty;
    var minus = card.querySelector('[data-qty="minus"]');
    var plus = card.querySelector('[data-qty="plus"]');
    if (minus) minus.disabled = qty <= 1;
    if (plus) plus.disabled = qty >= MAX_QTY;
    return qty;
  }

  function refreshCardEnquiry(card, p) {
    var link = card.querySelector('[data-product-whatsapp]');
    if (link) link.href = enquiryUrl(p, currentVariant(p, card), 0, getQty(card));
  }

  grid.addEventListener('change', function (event) {
    if (!event.target.matches('[data-variant]')) return;
    var card = event.target.closest('.product-card');
    var p = productById[card.getAttribute('data-id')];
    card.querySelector('[data-price-area]').innerHTML = priceMarkup(currentVariant(p, card));
    refreshCardEnquiry(card, p);
  });

  grid.addEventListener('click', function (event) {
    var button = event.target.closest('button');
    if (!button || button.disabled) return;
    var card = button.closest('.product-card');
    if (!card) return;
    var p = productById[card.getAttribute('data-id')];
    if (!p) return;
    if (button.hasAttribute('data-qty')) {
      setQty(card, getQty(card) + (button.getAttribute('data-qty') === 'plus' ? 1 : -1));
      refreshCardEnquiry(card, p);
      return;
    }
    var variant = currentVariant(p, card);
    if (button.hasAttribute('data-add')) {
      if (addToCart(p, variant, getQty(card), 'catalogue_card')) {
        setQty(card, 1);
        refreshCardEnquiry(card, p);
        flashAdded(button);
      }
    } else if (button.hasAttribute('data-details')) {
      track('select_item', { item_id: p.id, item_list_id: 'catalogue', index: lastResults.indexOf(p), item_category: p.category });
      openProduct(p, variant, getQty(card));
    }
  });

  function flashAdded(button) {
    if (!button || button.classList.contains('is-added')) return;
    var label = button.textContent;
    button.classList.add('is-added');
    button.textContent = 'Added to list ✓';
    window.setTimeout(function () {
      button.classList.remove('is-added');
      button.textContent = label;
    }, 1600);
  }

  /* ---------- order list (enquiry cart) ---------- */
  function variantIsValid(p, variantId) {
    if (!p.variants.length) return variantId === '';
    return p.variants.some(function (v) {
      return v.id === variantId;
    });
  }

  // Anything read back from storage is untrusted: unknown products, stale
  // variants and out-of-range quantities are dropped, duplicates merged.
  function sanitizeCart(list) {
    var merged = [];
    var byKey = {};
    (Array.isArray(list) ? list : []).forEach(function (raw) {
      if (!raw || typeof raw !== 'object') return;
      var p = productById[raw.id];
      var variantId = typeof raw.variantId === 'string' ? raw.variantId : '';
      var qty = Number(raw.qty);
      if (!p || p.stock === 'out-of-stock' || !variantIsValid(p, variantId) || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return;
      var key = p.id + '::' + variantId;
      if (byKey[key]) byKey[key].qty = Math.min(MAX_QTY, byKey[key].qty + qty);
      else {
        byKey[key] = { key: key, id: p.id, variantId: variantId, qty: qty };
        merged.push(byKey[key]);
      }
    });
    return merged;
  }

  function loadCart() {
    var raw = storageGet(CART_KEY);
    if (!raw) return [];
    try {
      return sanitizeCart(JSON.parse(raw));
    } catch (error) {
      return [];
    }
  }

  function saveCart() {
    storageSet(
      CART_KEY,
      cart.length
        ? JSON.stringify(
            cart.map(function (item) {
              return { id: item.id, variantId: item.variantId, qty: item.qty };
            })
          )
        : null
    );
  }

  var cart = loadCart();

  function cartItemData(item) {
    var p = productById[item.id];
    if (!p) return null;
    var variant =
      p.variants.find(function (v) {
        return v.id === item.variantId;
      }) || null;
    return { product: p, variant: variant, price: variant ? variant.price : null };
  }

  function productEventParams(p, variant, qty, source) {
    var params = {
      item_id: p.id,
      item_name: p.name,
      item_brand: p.brand,
      item_category: p.category,
      item_variant: variant ? variantLabel(variant) : '',
      quantity: qty,
      source: source
    };
    if (variant && variant.price != null) {
      params.price = variant.price;
      params.value = variant.price * qty;
      params.currency = 'INR';
    }
    return params;
  }

  function addToCart(p, variant, qty, source) {
    var units = Number(qty);
    if (!p || p.stock === 'out-of-stock' || !Number.isInteger(units) || units < 1 || units > MAX_QTY) return false;
    var variantId = variant ? variant.id : '';
    if (!variantIsValid(p, variantId)) return false;
    var key = p.id + '::' + variantId;
    var existing = cart.find(function (x) {
      return x.key === key;
    });
    var added = units;
    if (existing) {
      added = Math.min(MAX_QTY, existing.qty + units) - existing.qty;
      if (added <= 0) {
        showToast('The order list already holds the maximum of ' + MAX_QTY + ' units for this product.', {
          label: 'Review list',
          run: openCart
        });
        return false;
      }
      existing.qty += added;
    } else {
      cart.push({ key: key, id: p.id, variantId: variantId, qty: units });
    }
    var message = 'Added ' + added + ' × ' + p.brand + ' ' + p.name + ' to the order list.';
    updateCart(message);
    showToast(message, { label: 'Review list', run: openCart });
    track('add_to_cart', productEventParams(p, variant, added, source));
    return true;
  }

  var previousCartCount = -1;
  function updateCounts() {
    var count = cart.reduce(function (n, x) {
      return n + x.qty;
    }, 0);
    ['cartCount', 'cartCountTwo', 'cartCountMobile'].forEach(function (id) {
      var counter = byId(id);
      if (!counter) return;
      counter.textContent = count;
      if (previousCartCount !== -1 && count !== previousCartCount && !reducedMotionQuery.matches) {
        counter.classList.remove('count-pop');
        void counter.offsetWidth;
        counter.classList.add('count-pop');
      }
    });
    var mobile = byId('mobileWhatsApp');
    mobile.textContent = count ? 'Send list on WhatsApp' : 'WhatsApp enquiry';
    if (count) mobile.setAttribute('aria-label', 'Send list on WhatsApp: ' + count + ' selected ' + (count === 1 ? 'item' : 'items'));
    else mobile.removeAttribute('aria-label');
    previousCartCount = count;
  }

  function announceCart(message) {
    byId('cartFeedback').textContent = message || '';
  }

  function updateCart(message) {
    cart = cart.filter(function (item) {
      return productById[item.id] && Number.isInteger(item.qty) && item.qty > 0 && item.qty <= MAX_QTY;
    });
    var box = byId('cartItems');
    var priced = cart.length > 0;
    var subtotal = 0;
    if (!cart.length) {
      box.innerHTML = '<p class="cart-empty">Your order list is empty. Add products to prepare an enquiry list.</p>';
    } else {
      box.innerHTML = cart
        .map(function (item) {
          var data = cartItemData(item);
          if (data.price == null) priced = false;
          else subtotal += data.price * item.qty;
          var cartVariant = data.variant ? variantLabel(data.variant) : 'Size / variant to confirm';
          var name = data.product.brand + ' ' + data.product.name;
          return (
            '<div class="cart-item"><div class="cart-item-main"><h3>' +
            esc(name) +
            '</h3><p><span class="cart-item-variant">' +
            esc(cartVariant) +
            '</span> · ' +
            (data.price == null ? 'Price to confirm' : money(data.price) + ' each') +
            '</p></div><div class="cart-item-controls">' +
            '<button class="cart-qty-btn" type="button" data-cart-qty="minus" data-key="' +
            esc(item.key) +
            '" aria-label="' +
            esc('Decrease ' + name + ' quantity') +
            '"' +
            (item.qty <= 1 ? ' disabled' : '') +
            '>−</button>' +
            '<strong class="cart-qty-value" aria-label="' +
            esc('Quantity ' + item.qty) +
            '">' +
            item.qty +
            '</strong>' +
            '<button class="cart-qty-btn" type="button" data-cart-qty="plus" data-key="' +
            esc(item.key) +
            '" aria-label="' +
            esc('Increase ' + name + ' quantity') +
            '"' +
            (item.qty >= MAX_QTY ? ' disabled' : '') +
            '>+</button>' +
            '<button class="remove" type="button" data-remove="' +
            esc(item.key) +
            '" aria-label="' +
            esc('Remove ' + name + ' from the order list') +
            '">Remove</button></div></div>'
          );
        })
        .join('');
    }
    var totalUnits = cart.reduce(function (total, item) {
      return total + item.qty;
    }, 0);
    byId('cartSummary').innerHTML =
      '<span><strong>' +
      cart.length +
      '</strong> ' +
      (cart.length === 1 ? 'product line' : 'product lines') +
      '</span><span><strong>' +
      totalUnits +
      '</strong> ' +
      (totalUnits === 1 ? 'total unit' : 'total units') +
      '</span>';
    byId('cartSubtotal').textContent = priced ? money(subtotal) : 'Price pending';
    byId('cartPriceNote').textContent = priced
      ? 'Calculated from the confirmed prices displayed above. Delivery charges and final availability are confirmed by the store.'
      : 'A numeric subtotal is shown only when every selected variant has a confirmed selling price. The store will confirm variants, availability, final prices, delivery charges and final total.';
    byId('sendCart').disabled = !cart.length;
    byId('sendCartTwo').disabled = !cart.length;
    byId('clearCart').disabled = !cart.length;
    if (message) announceCart(message);
    saveCart();
    updateCounts();
  }

  byId('cartItems').addEventListener('click', function (event) {
    var qtyButton = event.target.closest('[data-cart-qty]');
    var removeButton = event.target.closest('[data-remove]');
    if (qtyButton && !qtyButton.disabled) {
      var item = cart.find(function (x) {
        return x.key === qtyButton.getAttribute('data-key');
      });
      if (!item) return;
      var delta = qtyButton.getAttribute('data-cart-qty') === 'plus' ? 1 : -1;
      var next = Math.max(1, Math.min(MAX_QTY, item.qty + delta));
      if (next === item.qty) return;
      item.qty = next;
      var data = cartItemData(item);
      updateCart('Quantity updated to ' + item.qty + '.');
      track(delta > 0 ? 'add_to_cart' : 'remove_from_cart', productEventParams(data.product, data.variant, 1, 'order_list'));
      var same = byId('cartItems').querySelector(
        '[data-cart-qty="' + (delta > 0 ? 'plus' : 'minus') + '"][data-key="' + CSS.escape(item.key) + '"]'
      );
      if (same && !same.disabled) same.focus();
      else {
        var other = byId('cartItems').querySelector('[data-key="' + CSS.escape(item.key) + '"]:not([disabled])');
        if (other) other.focus();
      }
      return;
    }
    if (removeButton) {
      var key = removeButton.getAttribute('data-remove');
      var removedItem = cart.find(function (x) {
        return x.key === key;
      });
      if (!removedItem) return;
      var removed = cartItemData(removedItem);
      var index = cart.indexOf(removedItem);
      cart = cart.filter(function (x) {
        return x.key !== key;
      });
      updateCart('Removed ' + removed.product.brand + ' ' + removed.product.name + '.');
      track('remove_from_cart', productEventParams(removed.product, removed.variant, removedItem.qty, 'order_list'));
      // Keep keyboard focus inside the drawer after the row disappears.
      var rows = byId('cartItems').querySelectorAll('.remove');
      var target = rows[Math.min(index, rows.length - 1)] || cartBackdrop.querySelector('.close-btn');
      if (target) target.focus();
    }
  });

  byId('clearCart').addEventListener('click', function () {
    if (!cart.length) return;
    var removedLines = cart.slice();
    cart = [];
    updateCart('Order list cleared.');
    removedLines.forEach(function (item) {
      var data = cartItemData(item);
      if (data) track('remove_from_cart', productEventParams(data.product, data.variant, item.qty, 'clear_list'));
    });
    cartBackdrop.querySelector('.close-btn').focus();
  });

  function cartEnquiryMessage() {
    var allPriced = true;
    var subtotal = 0;
    var lines = cart.map(function (item, i) {
      var data = cartItemData(item);
      if (data.price == null) allPriced = false;
      else subtotal += data.price * item.qty;
      var priceText =
        data.price == null
          ? 'price to confirm'
          : 'displayed price ' + money(data.price) + ' each · line total ' + money(data.price * item.qty);
      var variantText = data.variant ? variantLabel(data.variant) : 'size / variant to confirm';
      return (
        i + 1 + '. ' + data.product.brand + ' ' + data.product.name + ' — ' + variantText + ' — quantity ' + item.qty + ' — ' + priceText
      );
    });
    return (
      'Infinite Nutrition WhatsApp enquiry\n\n' +
      lines.join('\n') +
      '\n\nDisplayed subtotal: ' +
      (allPriced ? money(subtotal) : 'Price to confirm') +
      '\n\nPlease confirm sizes or variants, availability, final prices, delivery charges and payment arrangements. This is an enquiry, not a completed purchase or confirmed order.'
    );
  }

  function openCartWhatsApp(contactIndex, source) {
    if (!cart.length) return;
    var contact = STORE_CONTACTS[contactIndex] || STORE_CONTACTS[0];
    var url = whatsappUrl(contact.whatsapp, cartEnquiryMessage());
    announceCart('Opening this enquiry in WhatsApp for ' + contact.label + '. This is not a confirmed order.');
    track('click_whatsapp', {
      source: source,
      context: 'order_list',
      contact: contactIndex === 0 ? 'primary' : 'secondary',
      lines_count: cart.length,
      items_count: cart.reduce(function (n, x) {
        return n + x.qty;
      }, 0)
    });
    window.open(url, '_blank', 'noopener');
  }

  byId('sendCart').addEventListener('click', function () {
    openCartWhatsApp(0, 'order_list');
  });
  byId('sendCartTwo').addEventListener('click', function () {
    openCartWhatsApp(1, 'order_list');
  });
  if (STORE_CONTACTS[0]) byId('sendCart').textContent = 'Enquire via ' + STORE_CONTACTS[0].label;
  if (STORE_CONTACTS[1]) byId('sendCartTwo').textContent = 'Enquire via ' + STORE_CONTACTS[1].label;
  else byId('sendCartTwo').hidden = true;

  byId('mobileWhatsApp').addEventListener('click', function () {
    if (cart.length) {
      openCartWhatsApp(0, 'mobile_bar');
      return;
    }
    track('click_whatsapp', { source: 'mobile_bar', context: 'general', contact: 'primary' });
    window.open(
      whatsappUrl(
        STORE_CONTACTS[0].whatsapp,
        'Hi Infinite Nutrition, I would like to make a product enquiry. Please help me browse the current range and confirm availability, prices, delivery charges and payment arrangements. I understand this is an enquiry, not a completed purchase or confirmed order.'
      ),
      '_blank',
      'noopener'
    );
  });

  // Keep the list in step when it changes in another tab.
  window.addEventListener('storage', function (event) {
    if (event.key !== CART_KEY) return;
    cart = loadCart();
    updateCart();
  });

  /* ---------- toast feedback ---------- */
  var toastRegion = byId('toastRegion');
  var toastTimer = 0;
  function hideToast() {
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = 0;
    var toast = toastRegion && toastRegion.querySelector('.toast');
    if (!toast) return;
    toast.classList.remove('show');
    window.setTimeout(
      function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      },
      reducedMotionQuery.matches ? 0 : 240
    );
  }
  function showToast(message, action) {
    if (!toastRegion) return;
    toastRegion.replaceChildren();
    var toast = document.createElement('div');
    toast.className = 'toast';
    var text = document.createElement('p');
    text.textContent = message;
    toast.appendChild(text);
    if (action) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'toast-action';
      button.textContent = action.label;
      button.addEventListener('click', function () {
        hideToast();
        action.run();
      });
      toast.appendChild(button);
    }
    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'toast-close';
    dismiss.setAttribute('aria-label', 'Dismiss message');
    dismiss.textContent = '×';
    dismiss.addEventListener('click', hideToast);
    toast.appendChild(dismiss);
    var schedule = function () {
      toastTimer = window.setTimeout(hideToast, 5200);
    };
    toast.addEventListener('pointerenter', function () {
      window.clearTimeout(toastTimer);
    });
    toast.addEventListener('pointerleave', schedule);
    toast.addEventListener('focusin', function () {
      window.clearTimeout(toastTimer);
    });
    toast.addEventListener('focusout', schedule);
    toastRegion.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add('show');
    });
    if (toastTimer) window.clearTimeout(toastTimer);
    schedule();
  }

  /* ---------- overlays (order list drawer and details dialog) ---------- */
  var cartBackdrop = byId('cartBackdrop');
  var modalBackdrop = byId('modalBackdrop');
  var LAYERS = [cartBackdrop, modalBackdrop];
  // Live regions must stay outside `inert` or their announcements are lost.
  var NEVER_INERT = { siteAnnouncements: 1, toastRegion: 1 };
  var lastFocus = null;

  function setPageInert(active, on) {
    Array.prototype.forEach.call(document.body.children, function (node) {
      if (node === active || node.tagName === 'SCRIPT' || NEVER_INERT[node.id]) return;
      if (LAYERS.indexOf(node) !== -1) {
        node.setAttribute('inert', '');
        return;
      }
      if (on) node.setAttribute('inert', '');
      else node.removeAttribute('inert');
    });
  }

  function activeLayer() {
    if (modalBackdrop.classList.contains('open')) return modalBackdrop;
    if (cartBackdrop.classList.contains('open')) return cartBackdrop;
    return null;
  }

  function openLayer(layer) {
    var current = activeLayer();
    if (current && current !== layer) {
      current.classList.remove('open');
      current.setAttribute('aria-hidden', 'true');
      current.setAttribute('inert', '');
    } else if (!current) {
      lastFocus = document.activeElement;
    }
    setPageInert(layer, true);
    layer.removeAttribute('inert');
    layer.classList.add('open');
    layer.setAttribute('aria-hidden', 'false');
    if (!document.body.classList.contains('lock')) {
      var scrollbar = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.setProperty('--scrollbar-comp', Math.max(0, scrollbar) + 'px');
    }
    document.body.classList.add('lock');
    hideToast();
    window.setTimeout(function () {
      var first = layer.querySelector('.close-btn') || layer.querySelector('button:not([disabled]),a[href]');
      if (first) first.focus();
    }, 20);
  }

  function closeLayer(layer) {
    if (!layer.classList.contains('open')) return;
    layer.classList.remove('open');
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('inert', '');
    setPageInert(layer, false);
    document.body.classList.remove('lock');
    document.body.style.removeProperty('--scrollbar-comp');
    if (lastFocus && document.contains(lastFocus) && !lastFocus.closest('[inert]')) lastFocus.focus();
    lastFocus = null;
  }

  function openCart() {
    openLayer(cartBackdrop);
    track('view_cart', {
      lines_count: cart.length,
      items_count: cart.reduce(function (n, x) {
        return n + x.qty;
      }, 0)
    });
  }

  document.querySelectorAll('.cart-open').forEach(function (button) {
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', 'cartBackdrop');
    button.addEventListener('click', openCart);
  });
  document.querySelectorAll('[data-close="cart"]').forEach(function (button) {
    button.addEventListener('click', function () {
      closeLayer(cartBackdrop);
    });
  });
  document.querySelectorAll('[data-close="modal"]').forEach(function (button) {
    button.addEventListener('click', function () {
      closeLayer(modalBackdrop);
    });
  });
  LAYERS.forEach(function (layer) {
    layer.addEventListener('click', function (event) {
      if (event.target === layer) closeLayer(layer);
    });
  });

  function trapLayerFocus(event, layer) {
    var focusable = Array.prototype.slice
      .call(
        layer.querySelectorAll(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      )
      .filter(function (element) {
        return element.getClientRects().length > 0;
      });
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    var current = document.activeElement;
    if (event.shiftKey && (current === first || !layer.contains(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !layer.contains(current))) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', function (event) {
    var layer = activeLayer();
    if (!layer) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLayer(layer);
      return;
    }
    if (event.key === 'Tab') trapLayerFocus(event, layer);
  });

  var modalTitle = byId('modalTitle');
  var modalContent = byId('modalContent');
  var modalShell = modalBackdrop.querySelector('.modal');
  function setModal(title, html, kind) {
    modalTitle.textContent = title;
    modalContent.innerHTML = html;
    modalShell.setAttribute('data-kind', kind);
    applyMediaVars(modalContent);
  }

  /* ---------- product details ---------- */
  function openProduct(p, selectedVariant, qty) {
    var variant = selectedVariant || currentVariant(p);
    var sections = [];
    if (p.specifications.length) {
      sections.push(
        '<section class="detail-section"><h3>Specifications</h3><div class="detail-facts">' +
          p.specifications
            .map(function (spec) {
              return '<div class="detail-fact"><span>' + esc(spec.label) + '</span><strong>' + esc(spec.value) + '</strong></div>';
            })
            .join('') +
          '</div></section>'
      );
    }
    [
      ['ingredients', 'Ingredients'],
      ['serving', 'Serving information'],
      ['allergens', 'Allergens'],
      ['usage', 'Usage information']
    ].forEach(function (field) {
      if (p[field[0]]) sections.push('<section class="detail-section"><h3>' + field[1] + '</h3><p>' + esc(p[field[0]]) + '</p></section>');
    });
    var unavailable = p.stock === 'out-of-stock';
    var units = clampQty(qty || 1);
    var secondary = STORE_CONTACTS[1];
    setModal(
      p.name,
      '<div class="detail-hero">' +
        productImageMarkup(p, 'eager') +
        '<div><span class="product-brand">' +
        esc(p.brand) +
        '</span><dl class="detail-summary">' +
        '<div><dt>Category</dt><dd>' +
        esc(categoryMap[p.category]) +
        '</dd></div>' +
        '<div><dt>Size / variant</dt><dd>' +
        esc(variant ? variantLabel(variant) : 'Store confirmation required') +
        '</dd></div>' +
        '<div><dt>Selling price</dt><dd>' +
        esc(variant && variant.price != null ? money(variant.price) : 'Store confirmation required') +
        '</dd></div>' +
        '<div><dt>Availability</dt><dd>' +
        esc(STOCK_LABELS[p.stock] || 'Store confirmation required') +
        '</dd></div></dl></div></div>' +
        sections.join('') +
        '<p class="detail-confirmation-note">Only store-confirmed details are shown as facts. Ask the store to confirm any pending product information before travelling or ordering.</p>' +
        '<div class="detail-purchase" data-detail-id="' +
        esc(p.id) +
        '" data-variant-id="' +
        esc(variant ? variant.id : '') +
        '"><span class="product-qty-label" id="detail-qty-label">Quantity</span>' +
        '<div class="qty" role="group" aria-labelledby="detail-qty-label"><button type="button" data-detail-qty="minus" aria-label="' +
        esc('Decrease quantity for ' + p.name) +
        '"' +
        (units <= 1 ? ' disabled' : '') +
        '>−</button>' +
        '<output aria-live="polite" aria-label="' +
        esc('Selected quantity for ' + p.name) +
        '">' +
        units +
        '</output><button type="button" data-detail-qty="plus" aria-label="' +
        esc('Increase quantity for ' + p.name) +
        '"' +
        (units >= MAX_QTY ? ' disabled' : '') +
        '>+</button></div>' +
        '<button class="card-action add" type="button" data-detail-add' +
        (unavailable ? ' disabled aria-disabled="true"' : '') +
        '>' +
        (unavailable ? 'Out of stock' : 'Add to enquiry list') +
        '</button></div>' +
        '<div class="detail-actions"><a class="btn primary" href="' +
        esc(enquiryUrl(p, variant, 0, units)) +
        '" target="_blank" rel="noopener noreferrer" data-detail-whatsapp="0" data-wa-context="product" data-item-id="' +
        esc(p.id) +
        '">WhatsApp enquiry</a>' +
        (secondary
          ? '<a class="btn" href="' +
            esc(enquiryUrl(p, variant, 1, units)) +
            '" target="_blank" rel="noopener noreferrer" data-detail-whatsapp="1" data-wa-context="product" data-item-id="' +
            esc(p.id) +
            '">WhatsApp ' +
            esc(secondary.label) +
            '</a>'
          : '') +
        '</div>',
      'product'
    );
    openLayer(modalBackdrop);
    track('view_item', productEventParams(p, variant, units, 'details_dialog'));
  }

  modalContent.addEventListener('click', function (event) {
    var purchase = event.target.closest('.detail-purchase');
    if (!purchase) return;
    var p = productById[purchase.getAttribute('data-detail-id')];
    if (!p) return;
    var variantId = purchase.getAttribute('data-variant-id');
    var variant =
      p.variants.find(function (v) {
        return v.id === variantId;
      }) || null;
    var output = purchase.querySelector('output');
    var stepper = event.target.closest('[data-detail-qty]');
    if (stepper && !stepper.disabled) {
      var qty = clampQty(Number(output.textContent) + (stepper.getAttribute('data-detail-qty') === 'plus' ? 1 : -1));
      output.textContent = qty;
      purchase.querySelector('[data-detail-qty="minus"]').disabled = qty <= 1;
      purchase.querySelector('[data-detail-qty="plus"]').disabled = qty >= MAX_QTY;
      modalContent.querySelectorAll('[data-detail-whatsapp]').forEach(function (link) {
        link.href = enquiryUrl(p, variant, Number(link.getAttribute('data-detail-whatsapp')), qty);
      });
      return;
    }
    var add = event.target.closest('[data-detail-add]');
    if (add && !add.disabled && addToCart(p, variant, clampQty(output.textContent), 'details_dialog')) flashAdded(add);
  });

  /* ---------- policies & privacy ---------- */
  var policies = SITE.policies || {};
  document.querySelectorAll('.policy-button').forEach(function (button) {
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', 'modalBackdrop');
    button.addEventListener('click', function () {
      var id = button.getAttribute('data-policy');
      var data = policies[id];
      if (!data) return;
      setModal(
        data.title + (data.approved ? '' : ' — owner-review draft'),
        (data.approved ? '' : '<span class="status">Owner review required</span>') + '<p>' + esc(data.body) + '</p>',
        'policy'
      );
      openLayer(modalBackdrop);
      track('open_policy', { policy: id });
    });
  });

  function renderPrivacy() {
    var state = window.InfiniteAnalytics ? window.InfiniteAnalytics.getState() : null;
    var html = '<p>This website does not use accounts, forms or advertising cookies, and it never asks for card or payment details.</p>';
    html +=
      '<section class="detail-section privacy-section"><h3>Your order list</h3><p>Products you add are kept only in this browser so the list survives a page reload. Nothing is sent until you choose to open WhatsApp.</p>' +
      '<button class="btn" type="button" data-privacy="clear-list"' +
      (cart.length ? '' : ' disabled') +
      '>Clear saved order list</button></section>';
    if (!state || (!state.firstPartyConfigured && !state.ga4Configured)) {
      html +=
        '<section class="detail-section privacy-section"><h3>Website analytics</h3><p>Website analytics is not enabled on this site.</p></section>';
    } else {
      var signal = state.privacySignal && state.respectsPrivacySignals;
      html +=
        '<section class="detail-section privacy-section"><h3>Anonymous usage statistics</h3>' +
        '<p>When on, the site counts page views, product views, searches and button use without cookies, names or phone numbers, so the store can see which products and pages are useful.</p>' +
        (signal
          ? '<p class="privacy-signal">Your browser is sending a privacy signal (Global Privacy Control or Do Not Track), so analytics stays off.</p>'
          : '<button class="btn' +
            (state.optOut ? ' primary' : '') +
            '" type="button" data-privacy="toggle-optout">' +
            (state.optOut ? 'Turn statistics back on' : 'Turn off statistics') +
            '</button>' +
            '<p class="privacy-state" role="status">Statistics are currently <strong>' +
            (state.optOut ? 'off' : 'on') +
            '</strong> in this browser.</p>') +
        '</section>';
      if (state.ga4Configured && !signal && !state.optOut) {
        html +=
          '<section class="detail-section privacy-section"><h3>Google Analytics</h3><p>Google Analytics uses cookies and runs only if you allow it.</p>' +
          '<button class="btn" type="button" data-privacy="toggle-ga4">' +
          (state.ga4Consent === 'granted' ? 'Withdraw Google Analytics consent' : 'Allow Google Analytics') +
          '</button></section>';
      }
    }
    setModal('Privacy & analytics', html, 'privacy');
  }

  byId('privacySettings').addEventListener('click', function () {
    renderPrivacy();
    openLayer(modalBackdrop);
  });

  modalContent.addEventListener('click', function (event) {
    var control = event.target.closest('[data-privacy]');
    if (!control || control.disabled) return;
    var action = control.getAttribute('data-privacy');
    var analytics = window.InfiniteAnalytics;
    if (action === 'clear-list') {
      cart = [];
      updateCart('Order list cleared.');
      announceSite('Saved order list cleared.');
    } else if (action === 'toggle-optout' && analytics) {
      analytics.setOptOut(!analytics.getState().optOut);
      announceSite(analytics.getState().optOut ? 'Anonymous statistics turned off.' : 'Anonymous statistics turned on.');
    } else if (action === 'toggle-ga4' && analytics) {
      analytics.setGa4Consent(analytics.getState().ga4Consent !== 'granted');
    }
    renderPrivacy();
    var again = modalContent.querySelector('[data-privacy="' + action + '"]');
    (again && !again.disabled ? again : modalBackdrop.querySelector('.close-btn')).focus();
  });

  /* ---------- goal finder ---------- */
  var choices = document.querySelectorAll('.choice');
  var selectedFinder = 'whey';
  function syncFinderAction() {
    var listed = products.some(function (p) {
      return p.category === selectedFinder;
    });
    byId('finderBrowse').textContent =
      selectedFinder === 'contact' ? 'Contact the store' : listed ? 'Browse listed products' : 'View range or enquire';
  }
  choices.forEach(function (button) {
    button.addEventListener('click', function () {
      selectedFinder = button.getAttribute('data-filter');
      choices.forEach(function (x) {
        x.setAttribute('aria-pressed', 'false');
      });
      button.setAttribute('aria-pressed', 'true');
      byId('resultTitle').textContent = button.getAttribute('data-title');
      byId('resultCopy').textContent = button.getAttribute('data-copy');
      syncFinderAction();
    });
  });
  syncFinderAction();
  byId('finderBrowse').addEventListener('click', function () {
    if (selectedFinder === 'contact') {
      byId('visit').scrollIntoView();
      return;
    }
    clearSecondaryFilters();
    activeFilter = categoryMap[selectedFinder] ? selectedFinder : 'all';
    syncCategoryButtons();
    applyFilters();
    trackFilter('category', activeFilter, 'goal_finder');
    revealCatalogue();
  });

  /* ---------- navigation ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var nav = byId('mainNav');
  function closeMenu(restoreFocus) {
    if (!nav.classList.contains('open')) return;
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open main menu');
    toggle.textContent = 'Menu';
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close main menu' : 'Open main menu');
    toggle.textContent = open ? 'Close' : 'Menu';
    announceSite(open ? 'Main menu opened.' : 'Main menu closed.');
  });
  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      closeMenu(false);
    });
  });
  document.addEventListener('pointerdown', function (event) {
    if (nav.classList.contains('open') && !nav.contains(event.target) && event.target !== toggle) closeMenu(false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && nav.classList.contains('open')) closeMenu(true);
  });
  window.addEventListener(
    'resize',
    function () {
      if (window.innerWidth > 1050) closeMenu(false);
    },
    { passive: true }
  );

  var navAnchors = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  function setCurrentNav(targetId) {
    navAnchors.forEach(function (a) {
      var current = a.getAttribute('href') === '#' + targetId;
      a.classList.toggle('active', current);
      if (current) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  }
  setCurrentNav('home');
  if ('IntersectionObserver' in window) {
    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setCurrentNav(entry.target.id);
        });
      },
      { rootMargin: '-34% 0px -58% 0px', threshold: 0 }
    );
    navAnchors.forEach(function (a) {
      var target = document.querySelector(a.getAttribute('href'));
      if (target) sectionObserver.observe(target);
    });
  }

  var siteNav = document.querySelector('.site-nav');
  var navTick = false;
  function syncNavSurface() {
    siteNav.classList.toggle('scrolled', window.scrollY > 18);
    navTick = false;
  }
  window.addEventListener(
    'scroll',
    function () {
      if (!navTick) {
        navTick = true;
        requestAnimationFrame(syncNavSurface);
      }
    },
    { passive: true }
  );
  // First read after the initial render, in a frame, so it never forces a synchronous layout.
  requestAnimationFrame(syncNavSurface);

  /* ---------- motion ---------- */
  if ('IntersectionObserver' in window && !reducedMotionQuery.matches) {
    var revealSelectors = [
      '.section-head',
      '.featured-editorial > *',
      '.featured-card',
      '.category-tile',
      '.flavour-layout > *',
      '.enquiry-process-head',
      '.enquiry-step',
      '.enquiry-process-actions',
      '.finder-copy',
      '.finder-panel',
      '.reviews-layout > *',
      '.authenticity-grid > *',
      '.trust-item',
      '.trust-evidence > *',
      '.founder-grid > *',
      '.founder-training > *',
      '.visit-panel > *',
      '.policy-button',
      '.faq-item',
      '.footer-grid > *'
    ];
    var revealNodes = [];
    var imageRevealSelector = '.featured-editorial-media,.flavour-media,.authenticity-media,.founder-photo,.founder-training-media';
    revealSelectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (node) {
        if (revealNodes.indexOf(node) === -1) revealNodes.push(node);
      });
    });
    revealNodes.forEach(function (node, index) {
      node.classList.add('reveal-target');
      if (node.matches(imageRevealSelector)) node.classList.add('reveal-image');
      node.style.setProperty('--reveal-delay', String(index % 4));
    });
    document.body.classList.add('motion-ready');
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var node = entry.target;
            node.classList.add('in-view');
            revealObserver.unobserve(node);
            // Release the finished animation so its fill no longer overrides
            // hover transforms on cards and tiles.
            node.addEventListener('animationend', function done(event) {
              if (event.target !== node) return;
              node.removeEventListener('animationend', done);
              node.classList.add('reveal-done');
            });
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    revealNodes.forEach(function (node) {
      revealObserver.observe(node);
    });
  }

  /* Connected section storytelling and restrained media depth. */
  document.querySelectorAll('.reviews-layout > *,.authenticity-grid > *,.founder-grid > *,.visit-panel > *').forEach(function (node) {
    node.classList.add('reveal-side');
  });
  var storySections = Array.prototype.slice.call(document.querySelectorAll('main > section:not(.hero)'));
  storySections.forEach(function (section) {
    section.classList.add('story-section');
    var rail = document.createElement('span');
    rail.className = 'story-rail';
    rail.setAttribute('aria-hidden', 'true');
    section.appendChild(rail);
  });
  if ('IntersectionObserver' in window) {
    var storyObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('story-active');
            storyObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -18% 0px', threshold: 0.04 }
    );
    storySections.forEach(function (section) {
      storyObserver.observe(section);
    });
  } else {
    storySections.forEach(function (section) {
      section.classList.add('story-active');
    });
  }

  var heroSection = document.querySelector('.editorial-hero');
  if (heroSection && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          heroSection.classList.toggle('motion-paused', !entry.isIntersecting);
        });
      },
      { rootMargin: '120px 0px' }
    ).observe(heroSection);
  }

  /* Fine-pointer depth only: tiny offsets preserve sharpness and never run on touch or reduced-motion devices. */
  var precisionMotion = window.matchMedia(
    '(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
  );
  var heroVisual = heroSection && heroSection.querySelector('.editorial-visual');
  var heroPointerFrame = 0;
  var heroX = 0;
  var heroY = 0;
  function commitHeroDepth() {
    heroPointerFrame = 0;
    heroSection.style.setProperty('--hero-motion-x', heroX.toFixed(2) + 'px');
    heroSection.style.setProperty('--hero-motion-y', heroY.toFixed(2) + 'px');
    heroSection.style.setProperty('--hero-bg-x', (-heroX * 0.46).toFixed(2) + 'px');
    heroSection.style.setProperty('--hero-bg-y', (-heroY * 0.42).toFixed(2) + 'px');
    heroSection.style.setProperty('--hero-fg-x', (heroX * 0.72).toFixed(2) + 'px');
    heroSection.style.setProperty('--hero-fg-y', (heroY * 0.62).toFixed(2) + 'px');
  }
  function scheduleHeroDepth() {
    if (!heroPointerFrame) heroPointerFrame = requestAnimationFrame(commitHeroDepth);
  }
  if (heroVisual) {
    heroVisual.addEventListener(
      'pointermove',
      function (event) {
        if (!precisionMotion.matches) return;
        var rect = heroVisual.getBoundingClientRect();
        heroX = ((event.clientX - rect.left) / rect.width - 0.5) * 4;
        heroY = ((event.clientY - rect.top) / rect.height - 0.5) * 3;
        scheduleHeroDepth();
      },
      { passive: true }
    );
    heroVisual.addEventListener(
      'pointerleave',
      function () {
        heroX = 0;
        heroY = 0;
        scheduleHeroDepth();
      },
      { passive: true }
    );
  }

  // Scroll parallax runs only for media that is on screen.
  var depthMedia = Array.prototype.slice.call(
    document.querySelectorAll('.featured-editorial-media,.flavour-media,.authenticity-photo,.founder-training-media')
  );
  var visibleDepth = [];
  depthMedia.forEach(function (node) {
    node.classList.add('motion-depth');
  });
  var depthFrame = 0;
  function updateMediaDepth() {
    depthFrame = 0;
    var enabled = precisionMotion.matches;
    var viewport = window.innerHeight || document.documentElement.clientHeight;
    (enabled ? visibleDepth : depthMedia).forEach(function (node) {
      var offset = 0;
      if (enabled) {
        var rect = node.getBoundingClientRect();
        var relative = (rect.top + rect.height / 2 - viewport / 2) / (viewport + rect.height);
        offset = Math.max(-7, Math.min(7, relative * -12));
      }
      node.style.setProperty('--motion-depth-y', offset.toFixed(2) + 'px');
    });
  }
  function scheduleMediaDepth() {
    if (!depthFrame) depthFrame = requestAnimationFrame(updateMediaDepth);
  }
  if ('IntersectionObserver' in window) {
    var depthObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var index = visibleDepth.indexOf(entry.target);
          if (entry.isIntersecting && index === -1) visibleDepth.push(entry.target);
          if (!entry.isIntersecting && index !== -1) visibleDepth.splice(index, 1);
        });
        scheduleMediaDepth();
      },
      { rootMargin: '80px 0px' }
    );
    depthMedia.forEach(function (node) {
      depthObserver.observe(node);
    });
  } else {
    visibleDepth = depthMedia.slice();
  }
  function syncMediaDepthTracking() {
    window.removeEventListener('scroll', scheduleMediaDepth);
    window.removeEventListener('resize', scheduleMediaDepth);
    if (precisionMotion.matches) {
      window.addEventListener('scroll', scheduleMediaDepth, { passive: true });
      window.addEventListener('resize', scheduleMediaDepth, { passive: true });
    }
    scheduleMediaDepth();
  }
  if (precisionMotion.addEventListener) precisionMotion.addEventListener('change', syncMediaDepthTracking);
  syncMediaDepthTracking();

  /* Image failures show the description instead of a broken icon. */
  document.addEventListener(
    'error',
    function (event) {
      var image = event.target;
      if (!image || image.tagName !== 'IMG' || image.dataset.errorHandled) return;
      image.dataset.errorHandled = 'true';
      var region = image.closest(
        '.product-photo,.featured-photo,.featured-editorial-media,.category-media,.flavour-media,.authenticity-photo,.store-proof-grid figure,.founder-photo,.founder-training-media,.hero-visual,.detail-hero'
      );
      if (!region || region.querySelector('.media-error')) return;
      image.hidden = true;
      var message = document.createElement('span');
      message.className = 'media-error';
      message.textContent = 'Image unavailable. ' + (image.alt || 'Product or store image could not be loaded.');
      region.appendChild(message);
      announceSite('An image could not be loaded. Its description is shown instead.');
    },
    true
  );

  /* ---------- analytics observers ---------- */
  document.addEventListener(
    'click',
    function (event) {
      var link = event.target.closest('a[href]');
      if (!link) return;
      var href = link.getAttribute('href') || '';
      if (href.indexOf('https://wa.me/') === 0) {
        track('click_whatsapp', {
          source: sourceOf(link),
          contact: contactRole(href),
          context: link.getAttribute('data-wa-context') || 'general',
          item_id: link.getAttribute('data-item-id') || ''
        });
      } else if (href.indexOf('tel:') === 0) {
        track('contact_store', { method: 'phone', source: sourceOf(link), contact: contactRole(href) });
      } else if (link.hasAttribute('data-directions')) {
        track('view_store_location', { action: 'directions', source: sourceOf(link) });
      }
    },
    true
  );

  if ('IntersectionObserver' in window) {
    var onceVisible = function (element, threshold, callback) {
      if (!element) return;
      var observer = new IntersectionObserver(
        function (entries) {
          if (
            entries.some(function (entry) {
              return entry.isIntersecting;
            })
          ) {
            observer.disconnect();
            callback();
          }
        },
        { threshold: threshold }
      );
      observer.observe(element);
    };
    onceVisible(featuredGrid, 0.25, function () {
      track('view_item_list', {
        item_list_id: 'featured',
        item_list_name: 'Featured range',
        item_ids: featuredProducts.map(function (p) {
          return p.id;
        }),
        results_count: featuredProducts.length
      });
    });
    onceVisible(byId('store-location'), 0.4, function () {
      track('view_store_location', { action: 'view', source: 'visit' });
    });
  }

  /* ---------- structured data for verified products ---------- */
  // Product markup is published only for items whose price and availability
  // the store has confirmed; nothing is emitted for unverified items.
  (function emitProductStructuredData() {
    var schemaAvailability = {
      'in-stock': 'https://schema.org/InStock',
      'low-stock': 'https://schema.org/LimitedAvailability',
      'out-of-stock': 'https://schema.org/OutOfStock'
    };
    var verified = products.filter(function (p) {
      return (
        p.image &&
        p.stock &&
        p.variants.length &&
        p.variants.every(function (v) {
          return v.price != null;
        })
      );
    });
    if (!verified.length) return;
    var data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: verified.map(function (p, i) {
        return {
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Product',
            name: p.name,
            brand: { '@type': 'Brand', name: p.brand },
            image: new URL(p.image, location.href).href,
            category: categoryMap[p.category],
            offers: p.variants.map(function (v) {
              return {
                '@type': 'Offer',
                name: variantLabel(v) || undefined,
                price: v.price.toFixed(2),
                priceCurrency: 'INR',
                availability: schemaAvailability[p.stock]
              };
            })
          }
        };
      })
    };
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'productJsonLd';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  })();

  /* ---------- start-up ---------- */
  updateCart();
  track('page_view', {});
  if (location.hash === '#catalogue') revealCatalogue();
  window.addEventListener('hashchange', function () {
    if (location.hash === '#catalogue') revealCatalogue();
  });
})();
