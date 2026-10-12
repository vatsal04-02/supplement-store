# Category visuals (awaiting files)

The original design shows a cinematic "supporting category visual" on each
category tile. Those image files were referenced by the design but were not
included in the supplied single-file export, so the tiles currently use real
store photography (whey, mass gainers, creatine) or a typographic treatment.

To restore a visual, copy its files here and replace `visual: null` with the
commented object for that category in `js/catalogue.js`.

| Category | Expected files | Size |
|---|---|---|
| Whey protein | `category-visual-protein-720.webp`, `category-visual-protein-1440.webp`, `category-visual-protein.jpg` | 1440 × 960 |
| Mass gainers | `category-visual-mass-gainer-720.webp`, `category-visual-mass-gainer-1440.webp`, `category-visual-mass-gainer.jpg` | 1920 × 1280 |
| Creatine | `category-visual-creatine-720.webp`, `category-visual-creatine-1440.webp`, `category-visual-creatine.jpg` | 1440 × 960 |
| Pre-workout | `category-visual-preworkout-720.webp`, `category-visual-preworkout-1440.webp`, `category-visual-preworkout.jpg` | 2384 × 1008 |
| Amino acids | `category-visual-amino-720.webp`, `category-visual-amino-1440.webp`, `category-visual-amino.jpg` | 2384 × 1008 |
| Vitamins | `category-visual-micronutrients-720.webp`, `category-visual-micronutrients-1440.webp`, `category-visual-micronutrients.jpg` | 2352 × 1008 |
| Other | `category-visual-other-720.webp`, `category-visual-other-1440.webp`, `category-visual-other.jpg` | 1824 × 1280 |

Real-store inset photos for pre-workout (`category-preworkout-*.webp`, 720 × 1280)
and nutrition (`category-nutrition-*.webp`, 1280 × 720) were also missing; add
them to `assets/store/` and reference them as `store:` in `js/catalogue.js`.
