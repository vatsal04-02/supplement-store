/*
  Infinite Nutrition product catalogue data
  ----------------------------------------
  This file is the owner-editable product source. Presentation and filtering
  live in js/app.js. Do not publish a value unless it has been confirmed by
  the store or copied from a clearly readable product label.

  Pending store confirmation for every item below:
  - pack size(s)
  - selling price and MRP
  - current inventory/stock status
  - full ingredients, serving information, allergens and usage directions

  Null/empty values are intentionally omitted from the customer-facing UI.
  Supplied shelf photos also show whey, mass-gainer, pre-workout, amino-acid
  and vitamin products, but those are not listed as individual products until
  the store supplies a dedicated photo and confirms the exact SKU.

  Field reference
  - image / imageWebp: product photo paths. Leave '' when no photo has been
    supplied; the card then shows a "photo awaiting upload" stage instead of
    a broken image.
  - variants: [{ id, label, flavour, size, price, mrp }]. `price` and `mrp`
    are numbers in rupees, or null until confirmed. A numeric subtotal and
    Product structured data appear only when every needed price is confirmed.
  - stock: 'in-stock' | 'low-stock' | 'out-of-stock' | null (unconfirmed).
*/
window.INFINITE_CATALOGUE_CATEGORIES = [
  { id: 'whey', label: 'Whey protein' },
  { id: 'mass', label: 'Mass gainers' },
  { id: 'creatine', label: 'Creatine' },
  { id: 'preworkout', label: 'Pre-workout' },
  { id: 'amino', label: 'Amino acids' },
  { id: 'vitamins', label: 'Vitamins' },
  { id: 'other', label: 'Other' }
];

/*
  Category tile media
  - visual: the cinematic "supporting category visual" from the original
    design. Those image files were not included in the supplied export, so
    every visual below is set to null. To restore one, copy the files into
    assets/categories/ and replace null with the commented object.
  - store: a real Infinite Nutrition store photograph. Used as the tile's
    main image while no supporting visual is supplied, and as the small
    "real store range" inset once it is.
  Tiles with neither show a typographic treatment instead of a broken image.
*/
window.INFINITE_CATEGORY_MEDIA = {
  whey: {
    visual: null,
    /* visual: { srcset: 'assets/categories/category-visual-protein-720.webp 720w, assets/categories/category-visual-protein-1440.webp 1440w', fallback: 'assets/categories/category-visual-protein.jpg', width: 1440, height: 960, alt: 'Cinematic protein powder and scoop under red studio lighting, supporting imagery for the protein category, not an actual store product' }, */
    store: {
      srcset:
        'assets/store/protein-shelves-256.webp 256w, assets/store/protein-shelves-512.webp 512w, assets/store/protein-shelves-720.webp 720w',
      fallback: 'assets/store/protein-shelves-720.jpg',
      width: 720,
      height: 1280,
      focus: 'center 34%',
      alt: 'Whey protein tubs on the protein shelves inside Infinite Nutrition'
    }
  },
  mass: {
    visual: null,
    /* visual: { srcset: 'assets/categories/category-visual-mass-gainer-720.webp 720w, assets/categories/category-visual-mass-gainer-1440.webp 1440w', fallback: 'assets/categories/category-visual-mass-gainer.jpg', width: 1920, height: 1280, alt: 'Infinite Nutrition branded mass-gainer display tub beside an oat milkshake and powder scoop under red studio lighting, supporting imagery for the mass-gainer category, not an actual store product' }, */
    store: {
      srcset:
        'assets/store/protein-shelves-256.webp 256w, assets/store/protein-shelves-512.webp 512w, assets/store/protein-shelves-720.webp 720w',
      fallback: 'assets/store/protein-shelves-720.jpg',
      width: 720,
      height: 1280,
      focus: 'center 92%',
      alt: 'Mass gainer tubs on the lower protein shelf inside Infinite Nutrition'
    }
  },
  creatine: {
    visual: null,
    /* visual: { srcset: 'assets/categories/category-visual-creatine-720.webp 720w, assets/categories/category-visual-creatine-1440.webp 1440w', fallback: 'assets/categories/category-visual-creatine.jpg', width: 1440, height: 960, alt: 'Cinematic powder and scoop under red studio lighting, supporting imagery for the creatine category, not an actual store product' }, */
    store: {
      srcset:
        'assets/store/creatine-display-512.webp 512w, assets/store/creatine-display-720.webp 720w, assets/store/creatine-display-1280.webp 1280w',
      fallback: 'assets/store/creatine-display-1280.jpg',
      width: 1280,
      height: 720,
      focus: 'center 58%',
      alt: 'Creatine products on display inside Infinite Nutrition'
    }
  },
  preworkout: {
    visual: null,
    /* visual: { srcset: 'assets/categories/category-visual-preworkout-720.webp 720w, assets/categories/category-visual-preworkout-1440.webp 1440w', fallback: 'assets/categories/category-visual-preworkout.jpg', width: 2384, height: 1008, alt: 'Infinite Nutrition branded black shaker rising through a cinematic red splash, supporting imagery for the pre-workout category, not an actual store product' }, */
    store: null
  },
  amino: {
    visual: null,
    /* visual: { srcset: 'assets/categories/category-visual-amino-720.webp 720w, assets/categories/category-visual-amino-1440.webp 1440w', fallback: 'assets/categories/category-visual-amino.jpg', width: 2384, height: 1008, alt: 'BCAA and EAA-style capsules spilling from an Infinite Nutrition branded display jar under red studio lighting, supporting imagery for the amino-acids category, not an actual store product' }, */
    store: null
  },
  vitamins: {
    visual: null,
    /* visual: { srcset: 'assets/categories/category-visual-micronutrients-720.webp 720w, assets/categories/category-visual-micronutrients-1440.webp 1440w', fallback: 'assets/categories/category-visual-micronutrients.jpg', width: 2352, height: 1008, alt: 'Two Infinite Nutrition branded display bottles with a smaller supporting bottle and capsules under red studio lighting, supporting imagery for the micronutrient category, not actual store products' }, */
    store: null
  },
  other: {
    visual: null,
    /* visual: { srcset: 'assets/categories/category-visual-other-720.webp 720w, assets/categories/category-visual-other-1440.webp 1440w', fallback: 'assets/categories/category-visual-other.jpg', width: 1824, height: 1280, alt: 'Infinite Nutrition branded peanut-butter and multivitamin display jars beside an unbranded dropper bottle and shaker under red studio lighting, supporting imagery for the other-supplements category, not actual store products' }, */
    store: null
  }
};

window.INFINITE_PRODUCTS = [
  {
    id: 'muscleblaze-micronised-creatine',
    category: 'creatine',
    brand: 'MuscleBlaze',
    name: 'Micronised Creatine Monohydrate',
    // Cropped from the store's creatine display photo (assets/store/creatine-display-1280.jpg).
    image: 'assets/products/muscleblaze-creatine-single.jpg',
    imageWebp: 'assets/products/muscleblaze-creatine-single.webp',
    imageWidth: 118,
    imageHeight: 150,
    alt: 'MuscleBlaze Micronised Creatine Monohydrate tub photographed at Infinite Nutrition',
    variants: [],
    specifications: [],
    ingredients: '',
    serving: '',
    allergens: '',
    usage: '',
    stock: null
  },
  {
    id: 'wellcore-micronised-creatine',
    category: 'creatine',
    brand: 'Wellcore',
    name: 'Micronised Creatine Monohydrate',
    // Cropped from the store's creatine display photo (assets/store/creatine-display-1280.jpg).
    image: 'assets/products/wellcore-creatine-single.jpg',
    imageWebp: 'assets/products/wellcore-creatine-single.webp',
    imageWidth: 114,
    imageHeight: 126,
    alt: 'Wellcore Micronised Creatine Monohydrate tub photographed at Infinite Nutrition',
    variants: [],
    specifications: [],
    ingredients: '',
    serving: '',
    allergens: '',
    usage: '',
    stock: null
  },
  {
    id: 'pintola-high-protein-peanut-butter',
    category: 'other',
    brand: 'Pintola',
    name: 'High Protein Peanut Butter',
    // Photo not included in the supplied export. Expected files:
    // assets/products/pintola-high-protein-peanut-butter-single.jpg / .webp (175 × 260).
    image: '',
    imageWebp: '',
    imageWidth: 175,
    imageHeight: 260,
    alt: 'Pintola High Protein Peanut Butter, Dark Chocolate – Crunchy, photographed at Infinite Nutrition',
    variants: [
      {
        id: 'dark-chocolate-crunchy',
        label: 'Dark Chocolate – Crunchy',
        flavour: 'Dark Chocolate – Crunchy',
        size: '',
        price: null,
        mrp: null
      }
    ],
    specifications: [],
    ingredients: '',
    serving: '',
    allergens: '',
    usage: '',
    stock: null
  },
  {
    id: 'qnt-l-carnitine-liquid-formula',
    category: 'other',
    brand: 'QNT',
    name: 'L-Carnitine Liquid Formula',
    // Photo not included in the supplied export. Expected files:
    // assets/products/qnt-l-carnitine-single.jpg / .webp (105 × 240).
    image: '',
    imageWebp: '',
    imageWidth: 105,
    imageHeight: 240,
    alt: 'QNT L-Carnitine Liquid Formula bottle photographed at Infinite Nutrition',
    variants: [],
    specifications: [],
    ingredients: '',
    serving: '',
    allergens: '',
    usage: '',
    stock: null
  }
];
