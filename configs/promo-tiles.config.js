/**
 * Configuration for the Chrome Web Store promo tiles built by
 * `tools/generate-promo-tiles.js` (`pnpm run promo`).
 *
 * Everything the tiles are made of lives here — the logo, the app screenshots,
 * the supplier-name redactions, the layout geometry and the marketing copy — so
 * new tiles are a config edit rather than a code change. The layout skeleton is
 * `assets/promo/promo-tile-template.svg`; every `%token%` in that file is filled
 * from the objects below.
 *
 * Store requirements: small tile 440x280, marquee 1400x560, JPEG or 24-bit PNG
 * with no alpha. The generator flattens to `rgb24` to satisfy the last part.
 */

/** Brand palette, mirroring the logo's navy (`#2C4060`). */
export const PALETTE = {
  /** Top-left of the background wash. */
  bgFrom: "#3a5885",
  /** Bottom-right of the background wash, and the scrim colour. */
  bgTo: "#1c2c43",
  /** Small-tile wash runs slightly lighter so the tile reads at thumbnail size. */
  bgToSmall: "#1f3049",
  title: "#ffffff",
  sub1: "#d3e2f6",
  sub2: "#9db8e0",
  /** Colour of the wordmark halo and the tagline drop shadow. */
  shadow: "#0a1220",
};

/** resvg resolves these against installed system fonts. */
export const FONT_FAMILY = "Arial, Helvetica, sans-serif";

/**
 * The badge shown on every tile. Rendered from the vector source at
 * `renderWidth` (well above its on-tile size) so it stays crisp.
 *
 * The badge's version line is restamped from `public/manifest.json` at render
 * time, so tiles always carry the current version even if the committed logo
 * SVG was generated against an older one.
 */
export const LOGO = {
  src: "public/static/images/logo/ChemPal-logo-inverted.svg",
  renderWidth: 1064,
};

/** Invented supplier names — no real ChemPal supplier appears on a promo tile. */
export const FAKE_SUPPLIER_NAMES = [
  "Nexachem",
  "Reagentia",
  "ChemNova",
  "Orbichem",
  "Molequa",
  "Synthexa",
  "Vantalabs",
  "PureSynth",
  "Labverra",
  "Aurexis",
];

/**
 * App screenshots used as tile backgrounds.
 *
 * `redact` paints an opaque box over each real supplier cell and writes a name
 * from {@link FAKE_SUPPLIER_NAMES} in its place; `rows` are text baselines in
 * the *source* image's coordinates. `crop` (optional) is applied after
 * redaction, also in source coordinates.
 */
export const SCREENSHOTS = {
  /** Full price-tracking view: two expanded rows with variant pricing + trends. */
  priceTracking: {
    src: "public/static/images/demo/price-tracking.png",
    width: 1269,
    height: 888,
    redact: {
      x: 178,
      boxWidth: 112,
      fontSize: 15,
      rows: [158, 373, 591, 621, 651, 681, 711, 741, 771, 801],
    },
  },

  /**
   * Hero crop of the same view: the results header plus the two expanded
   * product rows, each showing its detail panel and full variant price list.
   * Trimmed of the collapsed rows and pagination so the variant pricing — the
   * part worth showing off — dominates the frame.
   */
  variantsHero: {
    src: "public/static/images/demo/price-tracking.png",
    width: 1269,
    height: 888,
    redact: {
      x: 178,
      boxWidth: 112,
      fontSize: 15,
      rows: [158, 373, 591, 621, 651, 681, 711, 741, 771, 801],
    },
    crop: { x: 0, y: 82, width: 1269, height: 520 },
  },
};

/**
 * Geometry shared by both 1400x560 marquee tiles that carry a screenshot.
 *
 * The copy sits across the screenshot rather than beside it, which reads best
 * but puts white text over a mostly-white UI. Legibility is handled per element:
 * the wordmark gets a `titleGlow` halo radiating out of the glyphs, while the
 * smaller taglines sit on `pad`, a heavily blurred dark rectangle. Darkening
 * only where the text lands leaves the screenshot crisp everywhere else, so the
 * variant pricing stays readable.
 */
const MARQUEE_WITH_SHOT = {
  width: 1400,
  height: 560,
  bgFrom: PALETTE.bgFrom,
  bgTo: PALETTE.bgTo,
  logo: { x: 110, y: 150, size: 252 },
  shadow: { dy: 12, blur: 18 },
  // Drawn over the screenshot on these tiles, so kept fainter than the
  // plain marquee's to avoid texturing the UI behind them.
  accent: { opacity: 0.04, scale: 1, x: 0, y: 0 },
  title: { x: 420, y: 278, size: 118 },
  sub: { x: 426, y1: 342, y2: 390, size1: 33, size2: 26 },
  // No scrim: the halo and pad below handle legibility on their own, and a
  // full-height scrim only flattened the background gradient to dull navy.
  scrim: { horizontalWidth: 700, horizontalOpacity: 0, verticalOpacity: 0 },
  // Spans the two taglines only — the wordmark sits above it on its own halo.
  pad: { x: 396, y: 300, width: 800, height: 118, radius: 34, opacity: 0.74, blur: 18 },
  titleGlow: { blur: 16, opacity: 0.55 },
  textShadow: { blur: 7, opacity: 0.6 },
};

/** Geometry shared by both 440x280 tiles that carry a screenshot. */
const SMALL_WITH_SHOT = {
  width: 440,
  height: 280,
  bgFrom: PALETTE.bgFrom,
  bgTo: PALETTE.bgToSmall,
  logo: { x: 30, y: 24, size: 104 },
  shadow: { dy: 6, blur: 9 },
  accent: { opacity: 0.05, scale: 0.42, x: -160, y: 20 },
  // Screenshot sits along the top; copy drops below it over a vertical scrim,
  // so it clears the UI entirely and needs no pad of its own.
  title: { x: 30, y: 186, size: 42 },
  sub: { x: 32, y1: 216, y2: 238, size1: 15.5, size2: 15.5 },
  scrim: { horizontalWidth: 0, horizontalOpacity: 0, verticalOpacity: 1 },
  pad: { x: 0, y: 0, width: 0, height: 0, radius: 0, opacity: 0, blur: 1 },
  titleGlow: { blur: 7, opacity: 0.45 },
  textShadow: { blur: 4, opacity: 0.5 },
};

/**
 * The tiles to emit, keyed by output filename (written to `assets/promo/`).
 *
 * `screenshot` names a key of {@link SCREENSHOTS}, or is omitted for a
 * plain branded tile. `placement` positions that screenshot on the canvas and
 * `maskX`/`maskWidth` control where it fades in from.
 */
export const TILES = {
  // ---------------------------------------------------------------- branded --
  "chempal-marquee-promo-1400x560": {
    width: 1400,
    height: 560,
    bgFrom: PALETTE.bgFrom,
    bgTo: PALETTE.bgTo,
    logo: { x: 120, y: 148, size: 266 },
    shadow: { dy: 12, blur: 18 },
    accent: { opacity: 0.05, scale: 1, x: 0, y: 0 },
    title: { x: 448, y: 290, size: 128 },
    sub: { x: 454, y1: 358, y2: 408, size1: 34, size2: 28 },
    scrim: { horizontalWidth: 0, horizontalOpacity: 0, verticalOpacity: 0 },
    // No screenshot to fight with, so no pad is needed.
    pad: { x: 0, y: 0, width: 0, height: 0, radius: 0, opacity: 0, blur: 1 },
    titleGlow: { blur: 10, opacity: 0.3 },
    textShadow: { blur: 6, opacity: 0.35 },
    text: {
      title: "ChemPal",
      sub1: "Compare laboratory reagent prices across suppliers",
      sub2: "Prices converted, quantities normalized — the best deal, side by side.",
    },
  },

  "chempal-small-promo-440x280": {
    width: 440,
    height: 280,
    bgFrom: PALETTE.bgFrom,
    bgTo: PALETTE.bgToSmall,
    logo: { x: 36, y: 74, size: 132 },
    shadow: { dy: 6, blur: 9 },
    accent: { opacity: 0.05, scale: 0.42, x: -160, y: 20 },
    title: { x: 190, y: 132, size: 50 },
    sub: { x: 193, y1: 166, y2: 190, size1: 17, size2: 17 },
    scrim: { horizontalWidth: 0, horizontalOpacity: 0, verticalOpacity: 0 },
    pad: { x: 0, y: 0, width: 0, height: 0, radius: 0, opacity: 0, blur: 1 },
    titleGlow: { blur: 6, opacity: 0.3 },
    textShadow: { blur: 4, opacity: 0.35 },
    text: {
      title: "ChemPal",
      sub1: "Compare lab-chemical prices",
      sub2: "across suppliers — instantly",
    },
  },

  // ------------------------------------------- expanded row + variant prices --
  "chempal-marquee-ui-1400x560": {
    ...MARQUEE_WITH_SHOT,
    screenshot: "variantsHero",
    placement: { x: 612, y: 104, width: 860, maskX: 600, maskWidth: 800, peak: 0.62 },
    text: {
      title: "ChemPal",
      sub1: "Compare reagent prices across suppliers",
      sub2: "One search, every supplier — ranked side by side.",
    },
  },

  "chempal-small-ui-440x280": {
    ...SMALL_WITH_SHOT,
    screenshot: "variantsHero",
    placement: { x: 150, y: 34, width: 340, maskX: 148, maskWidth: 292, peak: 0.58 },
    text: {
      title: "ChemPal",
      sub1: "Compare lab-chemical prices",
      sub2: "across suppliers",
    },
  },

  // ------------------------------------------------- price tracking over time --
  "chempal-price-tracking-marquee-1400x560": {
    ...MARQUEE_WITH_SHOT,
    screenshot: "priceTracking",
    placement: { x: 612, y: 30, width: 860, maskX: 600, maskWidth: 800, peak: 0.62 },
    text: {
      title: "ChemPal",
      sub1: "Track reagent price trends across suppliers",
      sub2: "Every product & variant monitored over time — spot the drop.",
    },
  },

  "chempal-price-tracking-small-440x280": {
    ...SMALL_WITH_SHOT,
    screenshot: "priceTracking",
    placement: { x: 165, y: 8, width: 250, maskX: 148, maskWidth: 292, peak: 0.58 },
    text: {
      title: "ChemPal",
      sub1: "Track lab-chemical price",
      sub2: "trends across suppliers",
    },
  },
};

/** Where the finished tiles are written, relative to the repo root. */
export const OUTPUT_DIR = "assets/promo";

/** The layout skeleton every tile is rendered through. */
export const TEMPLATE = "assets/promo/promo-tile-template.svg";
