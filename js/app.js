(function () {
  var products = (window.INFINITE_PRODUCTS || []).map(
    function (product, index) {
      product.order = index;
      return product;
    },
  );
  var categories = window.INFINITE_CATALOGUE_CATEGORIES || [];
  var categoryMap = {};
  categories.forEach(function (category) {
    categoryMap[category.id] = category.label;
  });
  var STORE_CONTACTS = [
    { label: "08840 427558", whatsapp: "918840427558" },
    { label: "83032 53308", whatsapp: "918303253308" },
  ];
  var cart = [];
  var activeFilter = "all";
  var activeBrand = "all";
  var sortMode = "featured";
  var catalogueInitialized = false;
  var grid = document.getElementById("productGrid");
  var catalogueSection = document.getElementById("catalogue");
  var siteAnnouncements = document.getElementById("siteAnnouncements");
  function announceSite(message) {
    siteAnnouncements.textContent = "";
    requestAnimationFrame(function () {
      siteAnnouncements.textContent = message;
    });
  }
  function revealCatalogue() {
    if (!catalogueInitialized) applyFilters({ suppressMotion: true });
    var wasHidden = catalogueSection.hidden;
    catalogueSection.hidden = false;
    if (wasHidden) {
      triggerCatalogueMotion();
      announceSite("Product catalogue opened.");
    }
    requestAnimationFrame(function () {
      catalogueSection.scrollIntoView({ block: "start" });
    });
  }
  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[c];
    });
  }
  function money(value) {
    return "₹" + Number(value).toLocaleString("en-IN");
  }
  function currentVariant(p, card) {
    if (!p.variants || !p.variants.length) return null;
    var select = card && card.querySelector("[data-variant]");
    var id = select ? select.value : p.variants[0].id;
    return (
      p.variants.find(function (v) {
        return v.id === id;
      }) || p.variants[0]
    );
  }
  function variantLabel(variant) {
    if (!variant) return "";
    return (
      variant.label ||
      [variant.flavour, variant.size].filter(Boolean).join(" · ")
    );
  }
  function productImageMarkup(p, loading) {
    var webp = p.imageWebp || p.image;
    var width = Math.max(1, Number(p.imageWidth) || 800);
    var height = Math.max(1, Number(p.imageHeight) || 800);
    return (
      '<picture style="--product-source-w:' +
      width +
      "px;--product-source-h:" +
      height +
      'px"><source srcset="' +
      esc(webp) +
      '" type="image/webp"><img class="product-packshot" src="' +
      esc(p.image) +
      '" alt="' +
      esc(p.alt) +
      '" loading="' +
      (loading || "lazy") +
      '" decoding="async" width="' +
      width +
      '" height="' +
      height +
      '"></picture>'
    );
  }
  function currentPrice(p, card) {
    var variant = currentVariant(p, card);
    return variant && Number.isFinite(variant.price) ? variant.price : null;
  }
  function priceMarkup(p) {
    var variant = currentVariant(p);
    if (!variant || !Number.isFinite(variant.price))
      return '<div class="product-data-item"><span class="product-data-label">Selling price</span><strong class="product-pending">Store confirmation required</strong></div>';
    var html =
      '<div class="product-data-item"><span class="product-data-label">Selling price</span><div class="price-row"><strong class="selling-price">' +
      money(variant.price) +
      "</strong>";
    if (Number.isFinite(variant.mrp) && variant.mrp > variant.price) {
      var discount = Math.round(
        ((variant.mrp - variant.price) / variant.mrp) * 100,
      );
      html +=
        '<span class="mrp">MRP ' +
        money(variant.mrp) +
        '</span><span class="discount">' +
        discount +
        "% off</span>";
    }
    return html + "</div></div>";
  }
  function stockMarkup(p) {
    var labels = {
      "in-stock": "In stock",
      "low-stock": "Low stock",
      "out-of-stock": "Out of stock",
    };
    return (
      '<div class="product-data-item"><span class="product-data-label">Availability</span>' +
      (p.stock && labels[p.stock]
        ? '<strong class="stock-status">' + labels[p.stock] + "</strong>"
        : '<strong class="stock-status pending">Store confirmation required</strong>') +
      "</div>"
    );
  }
  function variantMarkup(p) {
    if (!p.variants || !p.variants.length)
      return '<div class="product-data-item"><span class="product-data-label">Size / variant</span><strong class="product-pending">Store confirmation required</strong></div>';
    if (p.variants.length === 1)
      return (
        '<div class="product-data-item"><span class="product-data-label">Size / variant</span><strong class="product-data-value">' +
        esc(variantLabel(p.variants[0])) +
        "</strong></div>"
      );
    return (
      '<label class="variant-field"><span>Size / variant</span><select data-variant aria-label="Select size or variant for ' +
      esc(p.name) +
      '">' +
      p.variants
        .map(function (v) {
          return (
            '<option value="' +
            esc(v.id) +
            '">' +
            esc(variantLabel(v)) +
            "</option>"
          );
        })
        .join("") +
      "</select></label>"
    );
  }
  function productCard(p) {
    var category = categoryMap[p.category] || p.category;
    var pack =
      p.variants && p.variants.length === 1 ? variantLabel(p.variants[0]) : "";
    var titleId = "product-title-" + p.id;
    var unavailable = p.stock === "out-of-stock";
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
      esc(
        (p.name + " " + p.brand + " " + category + " " + pack).toLowerCase(),
      ) +
      '"><div class="product-photo">' +
      productImageMarkup(p, "lazy") +
      '<span class="category-tag">' +
      esc(category) +
      '</span><span class="product-photo-trust">Store-supplied photo</span></div><div class="product-body"><div class="product-heading"><span class="product-brand">' +
      esc(p.brand) +
      '</span><h3 id="' +
      esc(titleId) +
      '">' +
      esc(p.name) +
      '</h3></div><div class="product-core-facts">' +
      variantMarkup(p) +
      "<div data-price-area>" +
      priceMarkup(p) +
      "</div>" +
      stockMarkup(p) +
      '</div><div class="qty-row"><span class="product-qty-label" id="qty-label-' +
      esc(p.id) +
      '">Quantity</span><div class="qty" role="group" aria-labelledby="qty-label-' +
      esc(p.id) +
      '"><button type="button" data-qty="minus" aria-label="Decrease quantity for ' +
      esc(p.name) +
      '">−</button><output aria-live="polite" aria-label="Selected quantity for ' +
      esc(p.name) +
      '">1</output><button type="button" data-qty="plus" aria-label="Increase quantity for ' +
      esc(p.name) +
      '">+</button></div></div><div class="card-actions"><button class="card-action" type="button" data-details="' +
      esc(p.id) +
      '" aria-haspopup="dialog" aria-controls="modalBackdrop">View details</button><a class="card-action whatsapp" aria-label="Enquire on WhatsApp about ' +
      esc(p.brand + " " + p.name) +
      '" data-product-whatsapp href="' +
      enquiryUrl(p, currentVariant(p), 0, 1) +
      '" target="_blank" rel="noopener">WhatsApp</a><button class="card-action add" type="button" data-add="' +
      esc(p.id) +
      '"' +
      (unavailable ? ' disabled aria-disabled="true"' : "") +
      ">" +
      (unavailable ? "Out of stock" : "Add to enquiry list") +
      "</button></div></div></article>"
    );
  }
  var catalogueMotionTimer = 0;
  var catalogueMotionFrame = 0;
  var reducedMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  function stopCatalogueMotion() {
    if (catalogueMotionTimer) window.clearTimeout(catalogueMotionTimer);
    if (catalogueMotionFrame) cancelAnimationFrame(catalogueMotionFrame);
    catalogueMotionTimer = 0;
    catalogueMotionFrame = 0;
    grid.classList.remove("motion-refresh");
  }
  function triggerCatalogueMotion() {
    if (
      catalogueSection.hidden ||
      reducedMotionQuery.matches ||
      document.visibilityState === "hidden"
    ) {
      stopCatalogueMotion();
      return;
    }
    if (catalogueMotionTimer) window.clearTimeout(catalogueMotionTimer);
    if (catalogueMotionFrame) cancelAnimationFrame(catalogueMotionFrame);
    grid.classList.remove("motion-refresh");
    catalogueMotionFrame = requestAnimationFrame(function () {
      catalogueMotionFrame = 0;
      if (catalogueSection.hidden || reducedMotionQuery.matches) return;
      grid.classList.add("motion-refresh");
      catalogueMotionTimer = window.setTimeout(function () {
        grid.classList.remove("motion-refresh");
        catalogueMotionTimer = 0;
      }, 620);
    });
  }
  function renderProducts(list, animate) {
    grid.innerHTML = list.map(productCard).join("");
    Array.prototype.forEach.call(grid.children, function (card, index) {
      card.style.setProperty("--motion-order", String(Math.min(index, 6)));
    });
    if (animate === false) stopCatalogueMotion();
    else triggerCatalogueMotion();
  }
  if (reducedMotionQuery.addEventListener)
    reducedMotionQuery.addEventListener("change", function (event) {
      if (event.matches) stopCatalogueMotion();
    });
  function whatsappUrl(number, message) {
    return "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
  }
  function productEnquiryMessage(p, variant, qty) {
    var units = Math.max(1, Math.min(99, Number(qty) || 1));
    var confirmedPrice = variant && Number.isFinite(variant.price);
    var variantText = variant
      ? variantLabel(variant)
      : "size / variant to confirm";
    var priceText = confirmedPrice
      ? " — displayed price " +
        money(variant.price) +
        " each" +
        (units > 1
          ? " (" + money(variant.price * units) + " for " + units + ")"
          : "")
      : " — price to confirm";
    return (
      "Hi Infinite Nutrition, I would like to enquire about " +
      p.brand +
      " " +
      p.name +
      " — " +
      variantText +
      " — quantity " +
      units +
      priceText +
      ". Please confirm the size or variant, availability, final price, delivery charges and payment arrangements. I understand this is an enquiry, not a completed purchase or confirmed order."
    );
  }
  function enquiryUrl(p, variant, contactIndex, qty) {
    return whatsappUrl(
      STORE_CONTACTS[contactIndex || 0].whatsapp,
      productEnquiryMessage(p, variant, qty),
    );
  }
  function featuredCard(p) {
    var category = categoryMap[p.category] || p.category;
    var variant = currentVariant(p);
    var featuredPrice =
      variant && Number.isFinite(variant.price)
        ? money(variant.price)
        : "Confirm with store";
    var featuredStock =
      {
        "in-stock": "In stock",
        "low-stock": "Low stock",
        "out-of-stock": "Out of stock",
      }[p.stock] || "Confirm with store";
    return (
      '<article class="featured-card"><a class="featured-photo" href="#catalogue" data-open-catalogue data-category-link="' +
      p.category +
      '" aria-label="View ' +
      esc(p.brand + " " + p.name) +
      ' in the catalogue">' +
      productImageMarkup(p, "lazy") +
      '<span class="product-photo-trust">Store-supplied photo</span></a><div class="featured-body"><span>' +
      esc(p.brand) +
      "</span><h3>" +
      esc(p.name) +
      "</h3><p>" +
      esc(category + (variant ? " · " + variantLabel(variant) : "")) +
      '</p><div class="featured-facts"><div class="featured-fact"><small>Selling price</small><strong>' +
      esc(featuredPrice) +
      '</strong></div><div class="featured-fact"><small>Availability</small><strong>' +
      esc(featuredStock) +
      '</strong></div></div><div><a class="text-link" href="#catalogue" data-open-catalogue data-category-link="' +
      p.category +
      '">View catalogue</a><a class="small-action" href="' +
      enquiryUrl(p, variant) +
      '" target="_blank" rel="noopener">Prepare enquiry</a></div></div></article>'
    );
  }
  document.getElementById("featuredGrid").innerHTML = products
    .slice(0, 4)
    .map(featuredCard)
    .join("");
  var categoryImages = {
    whey: {
      srcset:
        "assets/category-visual-protein-720.webp 720w, assets/category-visual-protein-1440.webp 1440w",
      fallback: "assets/category-visual-protein.jpg",
      width: 1440,
      height: 960,
      alt: "Cinematic protein powder and scoop under red studio lighting, supporting imagery for the protein category, not an actual store product",
      supporting: true,
      store: {
        srcset:
          "assets/category-protein-256.webp 256w, assets/category-protein-512.webp 512w",
        fallback: "assets/category-protein.jpg",
        width: 720,
        height: 1280,
        alt: "Protein supplement shelves photographed inside Infinite Nutrition",
      },
    },
    mass: {
      srcset:
        "assets/category-visual-mass-gainer-720.webp 720w, assets/category-visual-mass-gainer-1440.webp 1440w",
      fallback: "assets/category-visual-mass-gainer.jpg",
      width: 1920,
      height: 1280,
      alt: "Infinite Nutrition branded mass-gainer display tub beside an oat milkshake and powder scoop under red studio lighting, supporting imagery for the mass-gainer category, not an actual store product",
      supporting: true,
    },
    creatine: {
      srcset:
        "assets/category-visual-creatine-720.webp 720w, assets/category-visual-creatine-1440.webp 1440w",
      fallback: "assets/category-visual-creatine.jpg",
      width: 1440,
      height: 960,
      alt: "Cinematic powder and scoop under red studio lighting, supporting imagery for the creatine category, not an actual store product",
      supporting: true,
      store: {
        srcset:
          "assets/category-creatine-256.webp 256w, assets/category-creatine-512.webp 512w, assets/category-creatine-1280.webp 1280w",
        fallback: "assets/category-creatine.jpg",
        width: 1280,
        height: 720,
        alt: "Creatine products photographed on display inside Infinite Nutrition",
      },
    },
    preworkout: {
      srcset:
        "assets/category-visual-preworkout-720.webp 720w, assets/category-visual-preworkout-1440.webp 1440w",
      fallback: "assets/category-visual-preworkout.jpg",
      width: 2384,
      height: 1008,
      alt: "Infinite Nutrition branded black shaker rising through a cinematic red splash, supporting imagery for the pre-workout category, not an actual store product",
      supporting: true,
      store: {
        srcset:
          "assets/category-preworkout-256.webp 256w, assets/category-preworkout-512.webp 512w, assets/category-preworkout-720.webp 720w",
        fallback: "assets/category-preworkout.jpg",
        width: 720,
        height: 1280,
        alt: "Pre-workout products photographed on the shelves inside Infinite Nutrition",
      },
    },
    amino: {
      srcset:
        "assets/category-visual-amino-720.webp 720w, assets/category-visual-amino-1440.webp 1440w",
      fallback: "assets/category-visual-amino.jpg",
      width: 2384,
      height: 1008,
      alt: "BCAA and EAA-style capsules spilling from an Infinite Nutrition branded display jar under red studio lighting, supporting imagery for the amino-acids category, not an actual store product",
      supporting: true,
    },
    vitamins: {
      srcset:
        "assets/category-visual-micronutrients-720.webp 720w, assets/category-visual-micronutrients-1440.webp 1440w",
      fallback: "assets/category-visual-micronutrients.jpg",
      width: 2352,
      height: 1008,
      alt: "Two Infinite Nutrition branded display bottles with a smaller supporting bottle and capsules under red studio lighting, supporting imagery for the micronutrient category, not actual store products",
      supporting: true,
      store: {
        srcset:
          "assets/category-nutrition-256.webp 256w, assets/category-nutrition-512.webp 512w, assets/category-nutrition-1280.webp 1280w",
        fallback: "assets/category-nutrition.jpg",
        width: 1280,
        height: 720,
        alt: "Nutrition products photographed on display inside Infinite Nutrition",
      },
    },
    other: {
      srcset:
        "assets/category-visual-other-720.webp 720w, assets/category-visual-other-1440.webp 1440w",
      fallback: "assets/category-visual-other.jpg",
      width: 1824,
      height: 1280,
      alt: "Infinite Nutrition branded peanut-butter and multivitamin display jars beside an unbranded dropper bottle and shaker under red studio lighting, supporting imagery for the other-supplements category, not actual store products",
      supporting: true,
    },
  };
  function categoryPicture(image, className, sizes) {
    return (
      "<picture" +
      (className ? ' class="' + className + '"' : "") +
      '><source srcset="' +
      image.srcset +
      '" sizes="' +
      sizes +
      '" type="image/webp"><img src="' +
      image.fallback +
      '" alt="' +
      esc(image.alt) +
      '" loading="lazy" fetchpriority="low" decoding="async" width="' +
      image.width +
      '" height="' +
      image.height +
      '"></picture>'
    );
  }
  document.getElementById("categoryGrid").innerHTML = categories
    .map(function (category) {
      var count = products.filter(function (p) {
        return p.category === category.id;
      }).length;
      var image = categoryImages[category.id];
      if (!image) return "";
      var note = image.supporting
        ? image.store
          ? "Supporting category visual · inset shows the real store range"
          : "Supporting category visual"
        : "Real Infinite Nutrition store photo";
      var storeProof = image.store
        ? categoryPicture(image.store, "category-store-proof", "112px")
        : "";
      return (
        '<a class="category-tile category-' +
        category.id +
        '" href="#catalogue" data-open-catalogue data-category-link="' +
        category.id +
        '" aria-label="Browse ' +
        esc(category.label) +
        ": " +
        count +
        " listed " +
        (count === 1 ? "product" : "products") +
        '"><div class="category-media">' +
        categoryPicture(
          image,
          "category-primary",
          "(max-width: 760px) calc(100vw - 24px), (max-width: 1050px) 50vw, 58vw",
        ) +
        storeProof +
        '</div><div class="category-copy"><span>' +
        count +
        " listed</span><strong>" +
        esc(category.label) +
        '</strong><small class="category-visual-note">' +
        note +
        "</small></div></a>"
      );
    })
    .join("");
  document.getElementById("catalogueFilters").innerHTML =
    '<button class="filter" type="button" aria-pressed="true" data-filter="all">All categories <span class="filter-count" aria-label="' +
    products.length +
    ' products">' +
    products.length +
    "</span></button>" +
    categories
      .map(function (category) {
        var count = products.filter(function (p) {
          return p.category === category.id;
        }).length;
        return (
          '<button class="filter" type="button" aria-pressed="false" data-filter="' +
          category.id +
          '">' +
          esc(category.label) +
          ' <span class="filter-count" aria-label="' +
          count +
          ' products">' +
          count +
          "</span></button>"
        );
      })
      .join("");
  var brands = products
    .map(function (p) {
      return p.brand;
    })
    .filter(function (value, index, list) {
      return list.indexOf(value) === index;
    })
    .sort();
  document.getElementById("brandFilter").innerHTML =
    '<option value="all">All brands</option>' +
    brands
      .map(function (brand) {
        return (
          '<option value="' +
          esc(brand.toLowerCase()) +
          '">' +
          esc(brand) +
          "</option>"
        );
      })
      .join("");
  function syncCategoryButtons() {
    document.querySelectorAll(".filter").forEach(function (x) {
      x.setAttribute("aria-pressed", String(x.dataset.filter === activeFilter));
    });
  }
  function clearSecondaryFilters() {
    activeBrand = "all";
    sortMode = "featured";
    document.getElementById("productSearch").value = "";
    document.getElementById("brandFilter").value = "all";
    document.getElementById("sortProducts").value = "featured";
  }
  document.querySelectorAll("[data-category-link]").forEach(function (link) {
    link.addEventListener("click", function () {
      clearSecondaryFilters();
      activeFilter = link.dataset.categoryLink;
      syncCategoryButtons();
      applyFilters();
    });
  });
  document
    .querySelectorAll("[data-open-catalogue]")
    .forEach(function (control) {
      control.addEventListener("click", function (e) {
        e.preventDefault();
        if (!control.dataset.categoryLink) {
          resetFilters(false);
        }
        revealCatalogue();
      });
    });
  function sortedProducts(list) {
    return list.slice().sort(function (a, b) {
      if (sortMode === "name") {
        var byName = a.name.localeCompare(b.name);
        return byName || a.brand.localeCompare(b.brand);
      }
      if (sortMode === "price-asc" || sortMode === "price-desc") {
        var ap = currentPrice(a),
          bp = currentPrice(b);
        if (ap == null && bp == null) return a.order - b.order;
        if (ap == null) return 1;
        if (bp == null) return -1;
        return sortMode === "price-asc" ? ap - bp : bp - ap;
      }
      return a.order - b.order;
    });
  }
  function applyFilters(options) {
    catalogueInitialized = true;
    var searchInput = document.getElementById("productSearch");
    var rawQuery = searchInput.value.trim();
    var q = rawQuery.toLowerCase();
    var matches = products.filter(function (p) {
      var search = (
        p.name +
        " " +
        p.brand +
        " " +
        (categoryMap[p.category] || "") +
        " " +
        (p.variants || []).map(variantLabel).join(" ")
      ).toLowerCase();
      return (
        (activeFilter === "all" || p.category === activeFilter) &&
        (activeBrand === "all" || p.brand.toLowerCase() === activeBrand) &&
        (!q || search.indexOf(q) > -1)
      );
    });
    renderProducts(
      sortedProducts(matches),
      !(options && options.suppressMotion),
    );
    var empty = matches.length === 0;
    document.getElementById("emptySearch").classList.toggle("show", empty);
    grid.hidden = empty;
    document.getElementById("clearSearch").hidden = !q;
    var chips = [];
    if (q)
      chips.push(
        '<span class="context-chip">Search: ' +
          esc(rawQuery) +
          '<button type="button" data-clear-context="search" aria-label="Clear search">×</button></span>',
      );
    if (activeFilter !== "all")
      chips.push(
        '<span class="context-chip">' +
          esc(categoryMap[activeFilter] || activeFilter) +
          '<button type="button" data-clear-context="category" aria-label="Clear category filter">×</button></span>',
      );
    if (activeBrand !== "all")
      chips.push(
        '<span class="context-chip">' +
          esc(
            document.getElementById("brandFilter").selectedOptions[0]
              .textContent,
          ) +
          '<button type="button" data-clear-context="brand" aria-label="Clear brand filter">×</button></span>',
      );
    document.getElementById("catalogueMeta").innerHTML =
      "<span><strong>" +
      matches.length +
      "</strong>&nbsp;" +
      (matches.length === 1 ? "product" : "products") +
      " shown</span>" +
      (chips.length
        ? '<span class="catalogue-context">' + chips.join("") + "</span>"
        : '<span class="catalogue-context"><span class="context-chip">All categories and brands</span></span>');
    var request = [
      q ? "search “" + rawQuery + "”" : "",
      activeFilter !== "all" ? categoryMap[activeFilter] || activeFilter : "",
      activeBrand !== "all"
        ? document.getElementById("brandFilter").selectedOptions[0].textContent
        : "",
    ]
      .filter(Boolean)
      .join(", ");
    document.getElementById("emptySearchTitle").textContent = request
      ? "No listed products found for " + request + "."
      : "No products match these filters.";
    document.getElementById("emptySearchCopy").textContent = request
      ? "The store may still carry more products than this photographed catalogue. Reset the filters or ask the team about the current range."
      : "Try a different search, category or brand.";
    document.getElementById("emptyEnquiry").href = whatsappUrl(
      STORE_CONTACTS[0].whatsapp,
      "Hi Infinite Nutrition, I could not find " +
        (request || "the product I need") +
        " in the website catalogue. Please share the current available range and prices. I understand this is an enquiry, not a confirmed order.",
    );
  }
  function resetFilters(focusSearch) {
    activeFilter = "all";
    activeBrand = "all";
    sortMode = "featured";
    document.getElementById("productSearch").value = "";
    document.getElementById("brandFilter").value = "all";
    document.getElementById("sortProducts").value = "featured";
    syncCategoryButtons();
    applyFilters();
    if (focusSearch) document.getElementById("productSearch").focus();
  }
  document.querySelectorAll(".filter").forEach(function (btn) {
    btn.addEventListener("click", function () {
      activeFilter = btn.dataset.filter;
      syncCategoryButtons();
      applyFilters();
    });
  });
  var filterFrame = 0;
  function scheduleFilters() {
    if (filterFrame) cancelAnimationFrame(filterFrame);
    filterFrame = requestAnimationFrame(function () {
      filterFrame = 0;
      applyFilters({ suppressMotion: true });
    });
  }
  document
    .getElementById("productSearch")
    .addEventListener("input", scheduleFilters);
  document.getElementById("clearSearch").addEventListener("click", function () {
    document.getElementById("productSearch").value = "";
    applyFilters();
    document.getElementById("productSearch").focus();
  });
  document
    .getElementById("brandFilter")
    .addEventListener("change", function (e) {
      activeBrand = e.target.value;
      applyFilters();
    });
  document
    .getElementById("sortProducts")
    .addEventListener("change", function (e) {
      sortMode = e.target.value;
      applyFilters();
    });
  document
    .getElementById("resetFilters")
    .addEventListener("click", function () {
      resetFilters(true);
    });
  document.querySelectorAll("[data-reset-filters]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      resetFilters(true);
    });
  });
  document
    .getElementById("catalogueMeta")
    .addEventListener("click", function (e) {
      var button = e.target.closest("[data-clear-context]");
      if (!button) return;
      var type = button.dataset.clearContext;
      if (type === "search")
        document.getElementById("productSearch").value = "";
      if (type === "category") activeFilter = "all";
      if (type === "brand") {
        activeBrand = "all";
        document.getElementById("brandFilter").value = "all";
      }
      syncCategoryButtons();
      applyFilters();
    });
  document.getElementById("focusSearch").addEventListener("click", function () {
    revealCatalogue();
    setTimeout(function () {
      document.getElementById("productSearch").focus();
    }, 350);
  });
  function getQty(card) {
    return Math.max(1, Number(card.querySelector("output").textContent) || 1);
  }
  grid.addEventListener("change", function (e) {
    if (!e.target.matches("[data-variant]")) return;
    var card = e.target.closest(".product-card");
    var p = products.find(function (x) {
      return x.id === card.dataset.id;
    });
    var chosen = currentVariant(p, card);
    card.querySelector("[data-price-area]").innerHTML = priceMarkup({
      variants: chosen ? [chosen] : [],
    });
    card.querySelector("[data-product-whatsapp]").href = enquiryUrl(
      p,
      chosen,
      0,
      getQty(card),
    );
  });
  grid.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    var card = btn.closest(".product-card");
    if (btn.dataset.qty) {
      var out = card.querySelector("output");
      var value = getQty(card) + (btn.dataset.qty === "plus" ? 1 : -1);
      out.textContent = Math.max(1, Math.min(99, value));
      var quantityProduct = products.find(function (x) {
        return x.id === card.dataset.id;
      });
      card.querySelector("[data-product-whatsapp]").href = enquiryUrl(
        quantityProduct,
        currentVariant(quantityProduct, card),
        0,
        getQty(card),
      );
      return;
    }
    var id = btn.dataset.add || btn.dataset.details;
    if (!id) return;
    var p = products.find(function (x) {
      return x.id === id;
    });
    var qty = getQty(card);
    var variant = currentVariant(p, card);
    var variantId = variant ? variant.id : "";
    if (btn.dataset.add) {
      if (
        !p ||
        p.stock === "out-of-stock" ||
        !Number.isInteger(qty) ||
        qty < 1 ||
        qty > 99
      )
        return;
      var existing = cart.find(function (x) {
        return x.id === id && x.variantId === variantId;
      });
      if (existing) existing.qty = Math.min(99, existing.qty + qty);
      else
        cart.push({
          key: id + "::" + variantId,
          id: id,
          variantId: variantId,
          qty: qty,
        });
      updateCart(
        "Added " + qty + " × " + p.brand + " " + p.name + " to the order list.",
      );
      openCart();
    } else {
      openProduct(p, variant);
    }
  });
  var previousCartCount = 0;
  function updateCounts() {
    var count = cart.reduce(function (n, x) {
      return n + x.qty;
    }, 0);
    ["cartCount", "cartCountTwo", "cartCountMobile"].forEach(function (id) {
      var counter = document.getElementById(id);
      counter.textContent = count;
      if (count !== previousCartCount) {
        counter.classList.remove("count-pop");
        void counter.offsetWidth;
        counter.classList.add("count-pop");
      }
    });
    document.getElementById("mobileWhatsApp").textContent = count
      ? "Send list on WhatsApp"
      : "WhatsApp enquiry";
    document
      .getElementById("mobileWhatsApp")
      .setAttribute(
        "aria-label",
        count
          ? "Send " +
              count +
              " selected " +
              (count === 1 ? "item" : "items") +
              " as a WhatsApp enquiry"
          : "Open a WhatsApp product enquiry",
      );
    previousCartCount = count;
  }
  function announce(message) {
    var feedback = document.getElementById("cartFeedback");
    feedback.textContent = message || "";
  }
  function cartItemData(item) {
    var p = products.find(function (x) {
      return x.id === item.id;
    });
    if (!p) return null;
    var variant =
      (p.variants || []).find(function (v) {
        return v.id === item.variantId;
      }) || null;
    return {
      product: p,
      variant: variant,
      price: variant && Number.isFinite(variant.price) ? variant.price : null,
    };
  }
  function updateCart(message) {
    cart = cart.filter(function (item) {
      return (
        products.some(function (p) {
          return p.id === item.id;
        }) &&
        Number.isInteger(item.qty) &&
        item.qty > 0 &&
        item.qty <= 99
      );
    });
    var box = document.getElementById("cartItems");
    var priced = true;
    var subtotal = 0;
    if (!cart.length) {
      box.innerHTML =
        '<p class="cart-empty">Your order list is empty. Add products to prepare an enquiry list.</p>';
      priced = false;
    } else {
      box.innerHTML = cart
        .map(function (item) {
          var data = cartItemData(item);
          if (data.price == null) priced = false;
          else subtotal += data.price * item.qty;
          var cartVariant = data.variant
            ? variantLabel(data.variant)
            : "Size / variant to confirm";
          return (
            '<div class="cart-item"><div class="cart-item-main"><h3>' +
            esc(data.product.brand + " " + data.product.name) +
            '</h3><p><span class="cart-item-variant">' +
            esc(cartVariant) +
            "</span> · " +
            (data.price == null
              ? "Price to confirm"
              : money(data.price) + " each") +
            '</p></div><div class="cart-item-controls"><button class="cart-qty-btn" type="button" data-cart-qty="minus" data-key="' +
            esc(item.key) +
            '" aria-label="Decrease ' +
            esc(data.product.name) +
            ' quantity">−</button><strong class="cart-qty-value" aria-label="Quantity ' +
            item.qty +
            '">' +
            item.qty +
            '</strong><button class="cart-qty-btn" type="button" data-cart-qty="plus" data-key="' +
            esc(item.key) +
            '" aria-label="Increase ' +
            esc(data.product.name) +
            ' quantity">+</button><button class="remove" type="button" data-remove="' +
            esc(item.key) +
            '">Remove</button></div></div>'
          );
        })
        .join("");
    }
    var totalUnits = cart.reduce(function (total, item) {
      return total + item.qty;
    }, 0);
    document.getElementById("cartSummary").innerHTML =
      "<span><strong>" +
      cart.length +
      "</strong> " +
      (cart.length === 1 ? "product line" : "product lines") +
      "</span><span><strong>" +
      totalUnits +
      "</strong> " +
      (totalUnits === 1 ? "total unit" : "total units") +
      "</span>";
    document.getElementById("cartSubtotal").textContent =
      cart.length && priced ? money(subtotal) : "Price pending";
    document.getElementById("cartPriceNote").textContent =
      cart.length && priced
        ? "Calculated from the confirmed prices displayed above. Delivery charges and final availability are confirmed by the store."
        : "A numeric subtotal is shown only when every selected variant has a confirmed selling price. The store will confirm variants, availability, final prices, delivery charges and final total.";
    document.getElementById("sendCart").disabled = !cart.length;
    document.getElementById("sendCartTwo").disabled = !cart.length;
    document.getElementById("clearCart").disabled = !cart.length;
    if (message) announce(message);
    updateCounts();
  }
  document.getElementById("cartItems").addEventListener("click", function (e) {
    var qtyButton = e.target.closest("[data-cart-qty]");
    var removeButton = e.target.closest("[data-remove]");
    if (qtyButton) {
      var item = cart.find(function (x) {
        return x.key === qtyButton.dataset.key;
      });
      if (!item) return;
      item.qty = Math.max(
        1,
        Math.min(
          99,
          item.qty + (qtyButton.dataset.cartQty === "plus" ? 1 : -1),
        ),
      );
      updateCart("Quantity updated to " + item.qty + ".");
      return;
    }
    if (removeButton) {
      var removed = cartItemData(
        cart.find(function (x) {
          return x.key === removeButton.dataset.remove;
        }),
      );
      cart = cart.filter(function (x) {
        return x.key !== removeButton.dataset.remove;
      });
      updateCart(
        removed
          ? "Removed " +
              removed.product.brand +
              " " +
              removed.product.name +
              "."
          : "Item removed.",
      );
    }
  });
  document.getElementById("clearCart").addEventListener("click", function () {
    if (!cart.length) return;
    cart = [];
    updateCart("Order list cleared.");
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
          ? "price to confirm"
          : "displayed price " +
            money(data.price) +
            " each · line total " +
            money(data.price * item.qty);
      var variantText = data.variant
        ? variantLabel(data.variant)
        : "size / variant to confirm";
      return (
        i +
        1 +
        ". " +
        data.product.brand +
        " " +
        data.product.name +
        " — " +
        variantText +
        " — quantity " +
        item.qty +
        " — " +
        priceText
      );
    });
    return (
      "Infinite Nutrition WhatsApp enquiry\n\n" +
      lines.join("\n") +
      "\n\nDisplayed subtotal: " +
      (allPriced ? money(subtotal) : "Price to confirm") +
      "\n\nPlease confirm sizes or variants, availability, final prices, delivery charges and payment arrangements. This is an enquiry, not a completed purchase or confirmed order."
    );
  }
  function openCartWhatsApp(contactIndex) {
    if (!cart.length) return;
    var contact = STORE_CONTACTS[contactIndex];
    var url = whatsappUrl(contact.whatsapp, cartEnquiryMessage());
    announce(
      "Opening this enquiry in WhatsApp for " +
        contact.label +
        ". This is not a confirmed order.",
    );
    window.open(url, "_blank", "noopener");
  }
  document.getElementById("sendCart").addEventListener("click", function () {
    openCartWhatsApp(0);
  });
  document.getElementById("sendCartTwo").addEventListener("click", function () {
    openCartWhatsApp(1);
  });
  document
    .getElementById("mobileWhatsApp")
    .addEventListener("click", function () {
      if (cart.length) {
        openCartWhatsApp(0);
        return;
      }
      window.open(
        whatsappUrl(
          STORE_CONTACTS[0].whatsapp,
          "Hi Infinite Nutrition, I would like to make a product enquiry. Please help me browse the current range and confirm availability, prices, delivery charges and payment arrangements. I understand this is an enquiry, not a completed purchase or confirmed order.",
        ),
        "_blank",
        "noopener",
      );
    });
  var cartBackdrop = document.getElementById("cartBackdrop");
  var modalBackdrop = document.getElementById("modalBackdrop");
  var lastFocus = null;
  function setPageInert(active, on) {
    Array.prototype.forEach.call(document.body.children, function (node) {
      if (node === active || node.tagName === "SCRIPT") return;
      if (on) node.setAttribute("inert", "");
      else node.removeAttribute("inert");
    });
  }
  function openLayer(layer) {
    lastFocus = document.activeElement;
    setPageInert(layer, true);
    layer.removeAttribute("inert");
    layer.classList.add("open");
    layer.setAttribute("aria-hidden", "false");
    document.body.classList.add("lock");
    setTimeout(function () {
      var first = layer.querySelector("button:not([disabled]),a[href]");
      if (first) first.focus();
    }, 20);
  }
  function closeLayer(layer) {
    layer.classList.remove("open");
    layer.setAttribute("aria-hidden", "true");
    layer.setAttribute("inert", "");
    setPageInert(layer, false);
    document.body.classList.remove("lock");
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  function openCart() {
    openLayer(cartBackdrop);
  }
  document.querySelectorAll(".cart-open").forEach(function (btn) {
    btn.addEventListener("click", openCart);
  });
  function openProduct(p, selectedVariant) {
    var variant = selectedVariant || currentVariant(p);
    var sections = [];
    if (p.specifications && p.specifications.length)
      sections.push(
        '<section class="detail-section"><h3>Specifications</h3><div class="detail-facts">' +
          p.specifications
            .map(function (spec) {
              return (
                '<div class="detail-fact"><span>' +
                esc(spec.label) +
                "</span><strong>" +
                esc(spec.value) +
                "</strong></div>"
              );
            })
            .join("") +
          "</div></section>",
      );
    [
      ["ingredients", "Ingredients"],
      ["serving", "Serving information"],
      ["allergens", "Allergens"],
      ["usage", "Usage information"],
    ].forEach(function (field) {
      if (p[field[0]])
        sections.push(
          '<section class="detail-section"><h3>' +
            field[1] +
            "</h3><p>" +
            esc(p[field[0]]) +
            "</p></section>",
        );
    });
    var category = categoryMap[p.category] || p.category;
    var availability =
      {
        "in-stock": "In stock",
        "low-stock": "Low stock",
        "out-of-stock": "Out of stock",
      }[p.stock] || "Store confirmation required";
    var variantText = variant
      ? variantLabel(variant)
      : "Store confirmation required";
    var price =
      variant && Number.isFinite(variant.price)
        ? money(variant.price)
        : "Store confirmation required";
    document.getElementById("modalTitle").textContent = p.name;
    document.getElementById("modalContent").innerHTML =
      '<div class="detail-hero">' +
      productImageMarkup(p, "eager") +
      '<div><span class="product-brand">' +
      esc(p.brand) +
      '</span><dl class="detail-summary"><div><dt>Category</dt><dd>' +
      esc(category) +
      "</dd></div><div><dt>Size / variant</dt><dd>" +
      esc(variantText) +
      "</dd></div><div><dt>Selling price</dt><dd>" +
      esc(price) +
      "</dd></div><div><dt>Availability</dt><dd>" +
      esc(availability) +
      "</dd></div></dl></div></div>" +
      sections.join("") +
      '<p class="detail-confirmation-note">Only store-confirmed details are shown as facts. Ask the store to confirm any pending product information before travelling or ordering.</p><div class="detail-actions"><a class="btn primary" href="' +
      enquiryUrl(p, variant) +
      '" target="_blank" rel="noopener">WhatsApp enquiry</a><a class="btn" href="' +
      enquiryUrl(p, variant, 1) +
      '" target="_blank" rel="noopener">WhatsApp 83032 53308</a></div>';
    openLayer(modalBackdrop);
  }
  var policyData = {
    shipping: [
      "Delivery & collection — owner-review draft",
      "Delivery coverage, charges, dispatch timing, delivery estimates, collection location and collection procedure have not been supplied for publication. Customers should contact the store before ordering or travelling.",
    ],
    returns: [
      "Returns & replacements — owner-review draft",
      "Eligibility, inspection requirements, exclusions and the returns or replacement process have not been supplied. No return or replacement promise is made here.",
    ],
    refunds: [
      "Refunds — owner-review draft",
      "Refund eligibility, method and timelines require owner-approved wording. Contact the store about the specific item before relying on a refund.",
    ],
    cancellation: [
      "Order cancellation — owner-review draft",
      "The store’s cancellation deadline and eligibility conditions have not been supplied. Ask the store whether an enquiry or confirmed order can be cancelled.",
    ],
    payments: [
      "Payment methods — owner-review draft",
      "Accepted payment methods, payment timing and invoice or receipt arrangements have not been confirmed for this website. This page does not collect or store card or payment details.",
    ],
    privacy: [
      "Privacy policy — owner-review draft",
      "This static page does not submit forms or store customer information. Opening WhatsApp transfers the prepared enquiry to WhatsApp under the customer’s control. The owner must approve a complete privacy policy before launch.",
    ],
    terms: [
      "Terms & conditions — owner-review draft",
      "Product availability, exact price, delivery charges and final total must be confirmed directly by the store through the published contact channels. A WhatsApp enquiry is not an order confirmation. Complete owner-approved terms are still required.",
    ],
  };
  document.querySelectorAll(".policy-button").forEach(function (btn) {
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-controls", "modalBackdrop");
    btn.addEventListener("click", function () {
      var data = policyData[btn.dataset.policy];
      document.getElementById("modalTitle").textContent = data[0];
      document.getElementById("modalContent").innerHTML =
        '<span class="status">Owner review required</span><p>' +
        esc(data[1]) +
        "</p>";
      openLayer(modalBackdrop);
    });
  });
  document.querySelectorAll(".cart-open").forEach(function (btn) {
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-controls", "cartBackdrop");
  });
  document.querySelectorAll('[data-close="cart"]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      closeLayer(cartBackdrop);
    });
  });
  document.querySelectorAll('[data-close="modal"]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      closeLayer(modalBackdrop);
    });
  });
  [cartBackdrop, modalBackdrop].forEach(function (layer) {
    layer.addEventListener("click", function (e) {
      if (e.target === layer) closeLayer(layer);
    });
  });
  function activeLayer() {
    if (modalBackdrop.classList.contains("open")) return modalBackdrop;
    if (cartBackdrop.classList.contains("open")) return cartBackdrop;
    return null;
  }
  function trapLayerFocus(e, layer) {
    var focusable = Array.prototype.slice
      .call(
        layer.querySelectorAll(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      )
      .filter(function (element) {
        return element.getClientRects().length > 0;
      });
    if (!focusable.length) {
      e.preventDefault();
      return;
    }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    var current = document.activeElement;
    if (e.shiftKey && (current === first || !layer.contains(current))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (current === last || !layer.contains(current))) {
      e.preventDefault();
      first.focus();
    }
  }
  document.addEventListener("keydown", function (e) {
    var layer = activeLayer();
    if (e.key === "Escape" && layer) {
      e.preventDefault();
      closeLayer(layer);
      return;
    }
    if (e.key === "Tab" && layer) trapLayerFocus(e, layer);
  });
  var choices = document.querySelectorAll(".choice");
  var selectedFinder = "whey";
  function syncFinderAction() {
    var listed = products.some(function (p) {
      return p.category === selectedFinder;
    });
    document.getElementById("finderBrowse").textContent =
      selectedFinder === "contact"
        ? "Contact the store"
        : listed
          ? "Browse listed products"
          : "View range or enquire";
  }
  choices.forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectedFinder = btn.dataset.filter;
      choices.forEach(function (x) {
        x.setAttribute("aria-pressed", "false");
      });
      btn.setAttribute("aria-pressed", "true");
      document.getElementById("resultTitle").textContent = btn.dataset.title;
      document.getElementById("resultCopy").textContent = btn.dataset.copy;
      syncFinderAction();
    });
  });
  syncFinderAction();
  document
    .getElementById("finderBrowse")
    .addEventListener("click", function () {
      if (selectedFinder === "contact") {
        document.getElementById("visit").scrollIntoView();
        return;
      }
      clearSecondaryFilters();
      activeFilter = selectedFinder;
      syncCategoryButtons();
      applyFilters();
      revealCatalogue();
    });
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("mainNav");
  function closeMenu(restoreFocus) {
    if (!nav.classList.contains("open")) return;
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open main menu");
    toggle.textContent = "Menu";
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute(
      "aria-label",
      open ? "Close main menu" : "Open main menu",
    );
    toggle.textContent = open ? "Close" : "Menu";
    announceSite(open ? "Main menu opened." : "Main menu closed.");
  });
  nav.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      closeMenu(false);
    });
  });
  document.addEventListener("pointerdown", function (event) {
    if (
      nav.classList.contains("open") &&
      !nav.contains(event.target) &&
      event.target !== toggle
    )
      closeMenu(false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && nav.classList.contains("open"))
      closeMenu(true);
  });
  window.addEventListener(
    "resize",
    function () {
      if (window.innerWidth > 1050) closeMenu(false);
    },
    { passive: true },
  );
  var navAnchors = Array.prototype.slice.call(
    nav.querySelectorAll('a[href^="#"]'),
  );
  function setCurrentNav(targetId) {
    navAnchors.forEach(function (a) {
      var current = a.getAttribute("href") === "#" + targetId;
      a.classList.toggle("active", current);
      if (current) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  }
  setCurrentNav("home");
  if ("IntersectionObserver" in window) {
    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setCurrentNav(entry.target.id);
        });
      },
      { rootMargin: "-34% 0px -58% 0px", threshold: 0 },
    );
    navAnchors.forEach(function (a) {
      var target = document.querySelector(a.getAttribute("href"));
      if (target) sectionObserver.observe(target);
    });
  }
  var siteNav = document.querySelector(".site-nav");
  var navTick = false;
  function syncNavSurface() {
    siteNav.classList.toggle("scrolled", window.scrollY > 18);
    navTick = false;
  }
  window.addEventListener(
    "scroll",
    function () {
      if (!navTick) {
        navTick = true;
        requestAnimationFrame(syncNavSurface);
      }
    },
    { passive: true },
  );
  syncNavSurface();
  if (
    "IntersectionObserver" in window &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    var revealSelectors = [
      ".section-head",
      ".featured-editorial > *",
      ".featured-card",
      ".category-tile",
      ".flavour-layout > *",
      ".enquiry-process-head",
      ".enquiry-step",
      ".enquiry-process-actions",
      ".finder-copy",
      ".finder-panel",
      ".reviews-layout > *",
      ".authenticity-grid > *",
      ".trust-item",
      ".trust-evidence > *",
      ".founder-grid > *",
      ".founder-training > *",
      ".visit-panel > *",
      ".policy-button",
      ".faq-item",
      ".footer-grid > *",
    ];
    var revealNodes = [];
    var imageRevealSelector =
      ".featured-editorial-media,.flavour-media,.authenticity-media,.founder-photo,.founder-training-media";
    revealSelectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (node) {
        if (revealNodes.indexOf(node) === -1) revealNodes.push(node);
      });
    });
    revealNodes.forEach(function (node, index) {
      node.classList.add("reveal-target");
      if (node.matches(imageRevealSelector)) node.classList.add("reveal-image");
      node.style.setProperty("--reveal-delay", String(index % 4));
    });
    document.body.classList.add("motion-ready");
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    revealNodes.forEach(function (node) {
      revealObserver.observe(node);
    });
  }
  /* Connected section storytelling and restrained media depth. */
  document
    .querySelectorAll(
      ".reviews-layout > *,.authenticity-grid > *,.founder-grid > *,.visit-panel > *",
    )
    .forEach(function (node) {
      node.classList.add("reveal-side");
    });
  var storySections = Array.prototype.slice.call(
    document.querySelectorAll("main > section:not(.hero)"),
  );
  storySections.forEach(function (section) {
    section.classList.add("story-section");
    var rail = document.createElement("span");
    rail.className = "story-rail";
    rail.setAttribute("aria-hidden", "true");
    section.appendChild(rail);
  });
  if ("IntersectionObserver" in window) {
    var storyObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("story-active");
            storyObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -18% 0px", threshold: 0.04 },
    );
    storySections.forEach(function (section) {
      storyObserver.observe(section);
    });
  } else {
    storySections.forEach(function (section) {
      section.classList.add("story-active");
    });
  }
  var heroSection = document.querySelector(".editorial-hero");
  if (heroSection && "IntersectionObserver" in window) {
    var heroMotionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          heroSection.classList.toggle("motion-paused", !entry.isIntersecting);
        });
      },
      { rootMargin: "120px 0px" },
    );
    heroMotionObserver.observe(heroSection);
  } else if (heroSection) {
    heroSection.classList.remove("motion-paused");
  }
  /* Fine-pointer depth only: tiny offsets preserve sharpness and never run on touch or reduced-motion devices. */
  var precisionMotion = window.matchMedia(
    "(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
  );
  var heroVisual =
    heroSection && heroSection.querySelector(".editorial-visual");
  var heroPointerFrame = 0;
  var heroX = 0;
  var heroY = 0;
  function commitHeroDepth() {
    heroPointerFrame = 0;
    if (!heroSection) return;
    heroSection.style.setProperty("--hero-motion-x", heroX.toFixed(2) + "px");
    heroSection.style.setProperty("--hero-motion-y", heroY.toFixed(2) + "px");
    heroSection.style.setProperty(
      "--hero-bg-x",
      (-heroX * 0.46).toFixed(2) + "px",
    );
    heroSection.style.setProperty(
      "--hero-bg-y",
      (-heroY * 0.42).toFixed(2) + "px",
    );
    heroSection.style.setProperty(
      "--hero-fg-x",
      (heroX * 0.72).toFixed(2) + "px",
    );
    heroSection.style.setProperty(
      "--hero-fg-y",
      (heroY * 0.62).toFixed(2) + "px",
    );
  }
  function scheduleHeroDepth() {
    if (!heroPointerFrame)
      heroPointerFrame = requestAnimationFrame(commitHeroDepth);
  }
  if (heroVisual) {
    heroVisual.addEventListener(
      "pointermove",
      function (event) {
        if (!precisionMotion.matches) return;
        var rect = heroVisual.getBoundingClientRect();
        heroX = ((event.clientX - rect.left) / rect.width - 0.5) * 4;
        heroY = ((event.clientY - rect.top) / rect.height - 0.5) * 3;
        scheduleHeroDepth();
      },
      { passive: true },
    );
    heroVisual.addEventListener(
      "pointerleave",
      function () {
        heroX = 0;
        heroY = 0;
        scheduleHeroDepth();
      },
      { passive: true },
    );
  }
  var depthMedia = Array.prototype.slice.call(
    document.querySelectorAll(
      ".featured-editorial-media,.flavour-media,.authenticity-photo,.founder-training-media",
    ),
  );
  depthMedia.forEach(function (node) {
    node.classList.add("motion-depth");
  });
  var depthFrame = 0;
  function updateMediaDepth() {
    depthFrame = 0;
    var enabled = precisionMotion.matches;
    var viewport = window.innerHeight || document.documentElement.clientHeight;
    depthMedia.forEach(function (node) {
      var offset = 0;
      if (enabled) {
        var rect = node.getBoundingClientRect();
        var relative =
          (rect.top + rect.height / 2 - viewport / 2) /
          (viewport + rect.height);
        offset = Math.max(-7, Math.min(7, relative * -12));
      }
      node.style.setProperty("--motion-depth-y", offset.toFixed(2) + "px");
    });
  }
  function scheduleMediaDepth() {
    if (!depthFrame) depthFrame = requestAnimationFrame(updateMediaDepth);
  }
  function syncMediaDepthTracking() {
    window.removeEventListener("scroll", scheduleMediaDepth);
    window.removeEventListener("resize", scheduleMediaDepth);
    if (precisionMotion.matches) {
      window.addEventListener("scroll", scheduleMediaDepth, { passive: true });
      window.addEventListener("resize", scheduleMediaDepth, { passive: true });
    }
    scheduleMediaDepth();
  }
  if (precisionMotion.addEventListener)
    precisionMotion.addEventListener("change", syncMediaDepthTracking);
  syncMediaDepthTracking();
  document.addEventListener(
    "error",
    function (event) {
      var image = event.target;
      if (!image || image.tagName !== "IMG" || image.dataset.errorHandled)
        return;
      image.dataset.errorHandled = "true";
      var region = image.closest(
        ".product-photo,.featured-photo,.featured-editorial-media,.category-media,.flavour-media,.authenticity-photo,.store-proof-grid figure,.founder-photo,.founder-training-media,.hero-visual",
      );
      if (!region || region.querySelector(".media-error")) return;
      image.hidden = true;
      var message = document.createElement("span");
      message.className = "media-error";
      message.textContent =
        "Image unavailable. " +
        (image.alt || "Product or store image could not be loaded.");
      region.appendChild(message);
      announceSite(
        "An image could not be loaded. Its description is shown instead.",
      );
    },
    true,
  );
  updateCart();
})();
