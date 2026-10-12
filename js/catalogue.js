/*
  Infinite Nutrition product catalogue data
  ----------------------------------------
  This file is the owner-editable product source. Presentation and filtering
  live in index.html. Do not publish a value unless it has been confirmed by
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

window.INFINITE_PRODUCTS = [
  {
    id: 'muscleblaze-micronised-creatine',
    category: 'creatine',
    brand: 'MuscleBlaze',
    name: 'Micronised Creatine Monohydrate',
    image: 'assets/products/muscleblaze-creatine-single.jpg',
    imageWebp: 'assets/products/muscleblaze-creatine-single.webp',
    imageWidth: 170, imageHeight: 180,
    alt: 'MuscleBlaze Micronised Creatine Monohydrate tub photographed at Infinite Nutrition',
    variants: [],
    specifications: [],
    ingredients: '', serving: '', allergens: '', usage: '',
    stock: null
  },
  {
    id: 'wellcore-micronised-creatine',
    category: 'creatine',
    brand: 'Wellcore',
    name: 'Micronised Creatine Monohydrate',
    image: 'assets/products/wellcore-creatine-single.jpg',
    imageWebp: 'assets/products/wellcore-creatine-single.webp',
    imageWidth: 155, imageHeight: 260,
    alt: 'Wellcore Micronised Creatine Monohydrate tub photographed at Infinite Nutrition',
    variants: [],
    specifications: [],
    ingredients: '', serving: '', allergens: '', usage: '',
    stock: null
  },
  {
    id: 'pintola-high-protein-peanut-butter',
    category: 'other',
    brand: 'Pintola',
    name: 'High Protein Peanut Butter',
    image: 'assets/products/pintola-high-protein-peanut-butter-single.jpg',
    imageWebp: 'assets/products/pintola-high-protein-peanut-butter-single.webp',
    imageWidth: 175, imageHeight: 260,
    alt: 'Pintola High Protein Peanut Butter, Dark Chocolate – Crunchy, photographed at Infinite Nutrition',
    variants: [
      { id: 'dark-chocolate-crunchy', label: 'Dark Chocolate – Crunchy', flavour: 'Dark Chocolate – Crunchy', size: '', price: null, mrp: null }
    ],
    specifications: [],
    ingredients: '', serving: '', allergens: '', usage: '',
    stock: null
  },
  {
    id: 'qnt-l-carnitine-liquid-formula',
    category: 'other',
    brand: 'QNT',
    name: 'L-Carnitine Liquid Formula',
    image: 'assets/products/qnt-l-carnitine-single.jpg',
    imageWebp: 'assets/products/qnt-l-carnitine-single.webp',
    imageWidth: 105, imageHeight: 240,
    alt: 'QNT L-Carnitine Liquid Formula bottle photographed at Infinite Nutrition',
    variants: [],
    specifications: [],
    ingredients: '', serving: '', allergens: '', usage: '',
    stock: null
  }
];
