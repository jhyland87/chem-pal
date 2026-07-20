/**
 * This script generates the Chrome Web Store promo tiles.
 * It uses an SVG template and a config object to create the files.
 * The template is an SVG file that contains the tile layout.
 * The config object lives in configs/promo-tiles.config.js and holds the logo,
 * the app screenshots, the layout geometry and the marketing copy.
 * The script writes the tiles to the assets/promo directory.
 * The script uses the svg2img library to render the SVG files to PNG.
 * The script uses ffmpeg to flatten each PNG to 24-bit RGB (the store rejects alpha).
 */
import { execFileSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import {
  FAKE_SUPPLIER_NAMES,
  FONT_FAMILY,
  LOGO,
  OUTPUT_DIR,
  PALETTE,
  SCREENSHOTS,
  TEMPLATE,
  TILES,
} from "../configs/promo-tiles.config.js";
import { _basename, _c, _g, _r, _realpath, _y, getPluginVersion } from "./helpers.js";
import { el, escapeXml, renderSvg } from "./svg.js";

/** A 1x1 transparent PNG, used as the screenshot href on tiles without one. */
const BLANK_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk" +
  "YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/**
 * Fill every `%token%` in a template with the matching key from `data`.
 *
 * The token pattern is restricted to bare identifiers so it cannot span a pair
 * of literal CSS percentages: in `x="-30%" width="160%"` the text between the
 * two `%` signs contains quotes, so it never matches. A looser `%(.*?)%` would
 * match there and only survive because the key lookup happens to fail.
 *
 * @param {string} template - The raw template text
 * @param {Object} data - The values to interpolate
 * @returns {string} The processed template
 */
function fillTemplate(template, data) {
  return template.replace(/%([a-zA-Z][a-zA-Z0-9]*)%/g, (match, key) =>
    Object.hasOwn(data, key) ? data[key] : match,
  );
}

/**
 * Wrap a PNG buffer as a data URI so it can be embedded in an SVG `<image>`.
 * resvg has no network access, so every asset must be inlined this way.
 *
 * @param {Buffer} buffer - The PNG bytes
 * @returns {string} A `data:image/png;base64,...` URI
 */
function toDataUri(buffer) {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

/**
 * Render the ChemPal badge from its vector source, restamping the version line
 * from the manifest.
 *
 * The badge SVG is itself generated (by `generate-logo-files.js`) and carries
 * whatever version was current when it was last regenerated, so reading it
 * as-is would let a tile ship a stale number after a release bump.
 *
 * @param {Object} logo - The {@link LOGO} config
 * @returns {Promise<string>} The badge as a PNG data URI
 */
async function renderLogo(logo) {
  const svg = await fs.readFile(_realpath(logo.src), "utf8");

  // The `<text>` holding the version — the only element whose content looks
  // like `v1.2.3`. Matched rather than diffed, since a re-stamp of the version
  // already in the SVG is a no-op and would look like a failure.
  const versionLine = /(>)v\d[^<]*(<\/text>)/;
  if (!versionLine.test(svg)) {
    console.warn(`  ${_r("No version line found in")} ${_basename(logo.src)} ${_r("— skipping")}`);
  }

  const stamped = svg.replace(versionLine, `$1v${getPluginVersion()}$2`);
  return toDataUri(await renderSvg(stamped, logo.renderWidth));
}

/**
 * Prepare an app screenshot: paint fake supplier names over the real ones and
 * optionally crop. Both happen in a single render — the viewBox does the crop,
 * so redaction coordinates stay in the source image's coordinate space.
 *
 * @param {Object} shot - A {@link SCREENSHOTS} entry
 * @returns {Promise<string>} The prepared screenshot as a PNG data URI
 */
async function renderScreenshot(shot) {
  const source = toDataUri(await fs.readFile(_realpath(shot.src)));
  const crop = shot.crop ?? { x: 0, y: 0, width: shot.width, height: shot.height };

  const r = shot.redact;
  const overlay = (r?.rows ?? [])
    .map((baseline, index) =>
      [
        el("rect", {
          x: r.x - 4,
          y: baseline - r.boxOffsetY,
          width: r.boxWidth,
          height: r.boxHeight,
          fill: r.boxFill,
        }),
        el(
          "text",
          {
            x: r.x,
            y: baseline,
            "font-family": FONT_FAMILY,
            "font-size": r.fontSize,
            fill: r.textFill,
          },
          escapeXml(FAKE_SUPPLIER_NAMES[index % FAKE_SUPPLIER_NAMES.length]),
        ),
      ].join(""),
    )
    .join("");

  const svg = el(
    "svg",
    {
      width: crop.width,
      height: crop.height,
      viewBox: `${crop.x} ${crop.y} ${crop.width} ${crop.height}`,
      xmlns: "http://www.w3.org/2000/svg",
      "xmlns:xlink": "http://www.w3.org/1999/xlink",
    },
    el("image", {
      x: 0,
      y: 0,
      width: shot.width,
      height: shot.height,
      "xlink:href": source,
    }) + overlay,
  );

  return toDataUri(await renderSvg(svg, crop.width));
}

/**
 * Build the token map for one tile and render it through the template.
 *
 * @param {Object} tile - A {@link TILES} entry
 * @param {string} template - The raw template markup
 * @param {string} logoHref - The badge data URI
 * @param {Object<string, string>} screenshots - Prepared screenshots, keyed as in {@link SCREENSHOTS}
 * @returns {Promise<Buffer>} The rendered tile as a PNG (still RGBA)
 */
async function renderTile(tile, template, logoHref, screenshots) {
  const shot = tile.screenshot ? SCREENSHOTS[tile.screenshot] : undefined;
  const place = tile.placement;
  // Scale the screenshot to the configured width, preserving its aspect ratio.
  // A cropped screenshot's aspect comes from the crop box, not the source file.
  const shotBox = shot?.crop ?? shot;
  const shotHeight = shot ? Math.round((place.width * shotBox.height) / shotBox.width) : 0;

  const svg = fillTemplate(template, {
    width: tile.width,
    height: tile.height,
    bgFrom: tile.bgFrom,
    bgTo: tile.bgTo,

    shotHref: shot ? screenshots[tile.screenshot] : BLANK_PNG,
    shotOpacity: shot ? 1 : 0,
    shotX: shot ? place.x : 0,
    shotY: shot ? place.y : 0,
    shotW: shot ? place.width : 1,
    shotH: shot ? shotHeight : 1,
    shotMaskX: shot ? place.maskX : 0,
    shotMaskW: shot ? place.maskWidth : 0,
    shotPeak: shot ? place.peak : 0,

    scrimHWidth: tile.scrim.horizontalWidth,
    scrimHOpacity: tile.scrim.horizontalOpacity,
    scrimVOpacity: tile.scrim.verticalOpacity,

    accentOpacity: tile.accent.opacity,
    accentScale: tile.accent.scale,
    accentX: tile.accent.x,
    accentY: tile.accent.y,
    shadowDy: tile.shadow.dy,
    shadowBlur: tile.shadow.blur,

    padX: tile.pad.x,
    padY: tile.pad.y,
    padWidth: tile.pad.width,
    padHeight: tile.pad.height,
    padRadius: tile.pad.radius,
    padFill: tile.bgTo,
    padOpacity: tile.pad.opacity,
    padBlur: tile.pad.blur,
    shadowColor: PALETTE.shadow,
    titleGlowBlur: tile.titleGlow.blur,
    titleGlowOpacity: tile.titleGlow.opacity,
    textShadowBlur: tile.textShadow.blur,
    textShadowOpacity: tile.textShadow.opacity,

    logoHref,
    logoX: tile.logo.x,
    logoY: tile.logo.y,
    logoSize: tile.logo.size,

    fontFamily: FONT_FAMILY,
    titleColor: PALETTE.title,
    sub1Color: PALETTE.sub1,
    sub2Color: PALETTE.sub2,
    titleX: tile.title.x,
    titleY: tile.title.y,
    titleSize: tile.title.size,
    subX: tile.sub.x,
    sub1Y: tile.sub.y1,
    sub2Y: tile.sub.y2,
    sub1Size: tile.sub.size1,
    sub2Size: tile.sub.size2,

    title: escapeXml(tile.text.title),
    sub1: escapeXml(tile.text.sub1),
    sub2: escapeXml(tile.text.sub2),
  });

  return await renderSvg(svg, tile.width);
}

/**
 * Write a tile to disk as a 24-bit PNG. resvg always emits RGBA and the store
 * only accepts JPEG or 24-bit PNG without an alpha channel, so the render is
 * flattened through ffmpeg. The buffer is piped in over stdin rather than
 * staged as a temporary file, so an interrupted run cannot leave stray
 * artifacts behind in the (version-controlled) output directory.
 *
 * @param {string} name - Output filename without extension
 * @param {Buffer} buffer - The rendered RGBA PNG
 */
function writeTile(name, buffer) {
  const outPath = _realpath(path.join(OUTPUT_DIR, `${name}.png`));

  try {
    execFileSync(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-f", "png_pipe", "-i", "pipe:0", "-pix_fmt", "rgb24", outPath],
      { input: buffer },
    );
  } catch (error) {
    console.error(`  ${_r("ffmpeg")} failed to flatten ${_basename(outPath)}: ${error.message}`);
    console.error(`  ${_r("Install ffmpeg — the store rejects PNGs with an alpha channel.")}`);
    process.exit(1);
  }

  console.log(`  ${_y(_basename(outPath))} created`);
}

console.log("Details:");
console.log(`  Logo:      ${_c(LOGO.src)} ${_y(`(stamped v${getPluginVersion()})`)}`);
console.log(`  Template:  ${_c(TEMPLATE)}`);
console.log(`  Output:    ${_c(OUTPUT_DIR)}`);
console.log(`  Tiles:     ${_c(Object.keys(TILES).length)}`);
console.log("");

const template = await fs.readFile(_realpath(TEMPLATE), "utf8");
const logoHref = await renderLogo(LOGO);

// Prepare each screenshot once, even when several tiles share it.
const screenshots = {};
for (const [key, shot] of Object.entries(SCREENSHOTS)) {
  screenshots[key] = await renderScreenshot(shot);
  console.log(`Prepared screenshot ${_c(key)} from ${_y(_basename(shot.src))}`);
}
console.log("");

await fs.mkdir(_realpath(OUTPUT_DIR), { recursive: true });

for (const [name, tile] of Object.entries(TILES)) {
  console.log(`Generating ${_c(`${name}.png`)} (${tile.width}x${tile.height})...`);
  writeTile(name, await renderTile(tile, template, logoHref, screenshots));
}

console.log("");
console.log(_g(`Done — ${Object.keys(TILES).length} promo tiles written to ${OUTPUT_DIR}/`));
