/**
 * Shared SVG authoring and rendering for the scripts in `tools/`.
 *
 * Kept apart from `tools/helpers.js` so that importing a colour helper does not
 * also load svg2img (and its native resvg binding) into scripts that never
 * render an image.
 *
 * The `el`/`escapeXml` pair exists because the obvious off-the-shelf option
 * (`svg-builder`, tried at 3.0.4) cannot express nested markup: its
 * `newInstance()` returns one shared singleton, so every "instance" is the same
 * object with the same `elements` array. Building a child fragment appends to
 * the parent as well, which duplicates elements and hoists them out of their
 * container — fatal for anything with a `<defs>` subtree or a wrapped `<g>`.
 * It also escapes nothing: element content and attribute values are emitted
 * verbatim, so a value containing a quote closes the attribute early.
 *
 * Two of its lesser quirks do have workarounds, for the record: the ESM build
 * that Node cannot resolve (use `createRequire`), and an `<image>` that rejects
 * x/y/width/height (wrap it in a `<g transform>`; resvg draws an image with no
 * width/height at its intrinsic size, so that stays exact).
 *
 * The `svg-builder-esm` fork (3.0.5) is a verbatim copy that only fixes the
 * build config — it shares the singleton and the missing escaping, so it fails
 * the same way. Don't reach for it expecting a different outcome.
 *
 * @module svg
 */
import svg2img from "svg2img";
import util from "util";

/** svg2img is callback-based; every caller here wants a promise. */
const svg2imgPromisified = util.promisify(svg2img);

/**
 * Escape the five XML special characters, so generated values cannot break out
 * of an attribute or element and corrupt the document.
 *
 * @param {string|number} value - The raw value
 * @returns {string} The XML-safe value
 * @example
 * escapeXml('Tom & "Jerry"'); // 'Tom &amp; &quot;Jerry&quot;'
 */
export function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build an SVG element as markup, escaping every attribute value.
 *
 * Attributes are emitted in insertion order and `null`/`undefined` ones are
 * dropped. `children` is inserted verbatim so elements can nest — pass text
 * through {@link escapeXml} at the call site, which keeps escaping visible
 * rather than guessing whether a string is markup or content.
 *
 * @param {string} name - Element name, e.g. `"rect"`
 * @param {Object} attrs - Attribute map; nullish values are omitted
 * @param {string} [children] - Raw child markup. Omit for a self-closing element.
 * @returns {string} The element markup
 * @example
 * el("rect", { x: 1, y: 2, fill: "#fff" });
 * // '<rect x="1" y="2" fill="#fff"/>'
 * el("text", { x: 0 }, escapeXml("A & B"));
 * // '<text x="0">A &amp; B</text>'
 */
export function el(name, attrs, children) {
  const rendered = Object.entries(attrs)
    .filter(([, value]) => value != null)
    .map(([key, value]) => ` ${key}="${escapeXml(value)}"`)
    .join("");

  return children == null ? `<${name}${rendered}/>` : `<${name}${rendered}>${children}</${name}>`;
}

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
