/**
 * Shared SVG rendering for the scripts in `tools/`.
 *
 * Kept apart from `tools/helpers.js` so that importing a colour helper does not
 * also load svg2img (and its native resvg binding) into scripts that never
 * render an image.
 *
 * @module svg
 */
import svg2img from "svg2img";
import util from "util";

/** svg2img is callback-based; every caller here wants a promise. */
const svg2imgPromisified = util.promisify(svg2img);

/**
 * Render an SVG to a PNG buffer.
 *
 * svg2img (>=1.0) renders via resvg-js, which has no network access — any image
 * referenced by the SVG must be inlined as a `data:` URI.
 *
 * @param {string} source - SVG markup, or a path to an `.svg` file
 * @param {number} [width] - Target width in pixels. The aspect ratio is
 *   preserved, so a square source yields a square result. Omit to render at the
 *   SVG's intrinsic size.
 * @returns {Promise<Buffer>} The rendered PNG
 */
export async function renderSvg(source, width) {
  const options = width ? { resvg: { fitTo: { mode: "width", value: width } } } : {};
  return await svg2imgPromisified(source, options);
}
