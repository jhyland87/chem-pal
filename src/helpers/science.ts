import { SUBSCRIPTS, SUPERSCRIPTS } from "@/constants/science";
import { decodeHTMLEntities, isMoleForm } from "@/helpers/utils";
import { looksLikeSmiles } from "@/helpers/smiles";

/**
 * @group Helpers
 * @groupDescription Scientific formula parsing and chemical notation utilities.
 * @source
 */

/**
 * Converts regular numbers in a string to subscript Unicode characters.
 * @param str - The string containing numbers to convert to subscripts
 * @returns The string with numbers converted to subscript characters
 * @example
 * ```typescript
 * subscript("H2O") // Returns "H₂O"
 * subscript("CO2") // Returns "CO₂"
 * ```
 * @source
 */
export const subscript = (str: string) => {
  return str.replace(/[0-9]/g, (match) => SUBSCRIPTS[match] || match);
};

/**
 * Converts regular numbers in a string to superscript Unicode characters.
 * @param str - The string containing numbers to convert to superscripts
 * @returns The string with numbers converted to superscript characters
 * @example
 * ```typescript
 * superscript("10^2") // Returns "10²"
 * superscript("2^3") // Returns "2³"
 * ```
 * @source
 */
export const superscript = (str: string) => {
  return str.replace(/[0-9]/g, (match) => SUPERSCRIPTS[match]);
};

/**
 * Match for a chemical formula (with or without subscript tags) in a string of html.
 * It does not currently work for formulas with parenthesis or brackets.
 *
 * The function searches for valid chemical element symbols followed by optional subscript numbers.
 * It requires at least two element-number combinations to consider it a valid formula.
 *
 * @param html - The HTML string to search for a formula
 * @returns The HTML that shows the chemical formula only, with proper subscript formatting, or undefined if no formula found
 * @example
 * ```typescript
 * findFormulaInHtml('foobar K<sub>2</sub>Cr<sub>2</sub>O<sub>7</sub> baz')
 * // Returns "K₂Cr₂O₇"
 *
 * findFormulaInHtml('H<sub>2</sub>SO<sub>4</sub>')
 * // Returns "H₂SO₄"
 *
 * findFormulaInHtml('Just some text')
 * // Returns undefined
 * ```
 * @see https://regex101.com/r/H6DXwK/6 - Regex pattern explanation
 * @source
 */
export const findFormulaInHtml = (html: string): string | undefined => {
  const pattern = new RegExp(
    "((?:(?:H[eogf]?|L[iau]|B[eari]?|C[arouseld]?|N[eiapdb]?|O[sg]?" +
      "|F[rle]?|M[gon]|A[lrsgutc]|S[icernmb]?|P[uabotmrd]?|Kr?|T[icebmalh]|" +
      "V|Z[nr]|G[ade]|R[buhena]|Yb?|I[nr]?|Xe|E[ur]|Dy|W|U)+" +
      "(?:(?:<su[bp]>(?:[2-9][0-9]*)</su[bp]>)|[2-9][0-9]*)*){2,})",
  );
  const match = html.match(pattern);
  if (!match) {
    return;
  }
  return match[0]
    .replace(/<sub>(\d+)<\/sub>/g, (match, p1) => subscript(p1 || ""))
    .replace(/<sup>(\d+)<\/sup>/g, (match, p1) => superscript(p1 || ""));
};

/**
 * Extracts a purity percentage from a string. Suppliers commonly bake the
 * purity into a product name or grade label (e.g. "Sodium borohydride, min
 * 95%"), so this finds the first percentage and returns it as a number when it
 * falls within the valid `(0, 100]` range — matching the values
 * `ProductBuilder.setPurity` accepts. Returns nothing when no valid percentage
 * is present.
 * @param value - The string to extract the purity from
 * @returns The purity as a number (e.g. `95`), or nothing if none is found
 * @example
 * ```typescript
 * parsePurity("Sodium borohydride, min 95%") // Returns 95
 * parsePurity("98.5%") // Returns 98.5
 * parsePurity("120%") // Returns nothing (out of range)
 * parsePurity("no percentage here") // Returns nothing
 * ```
 * @source
 */
export const parsePurity = (value: string): number | void => {
  if (!value || typeof value !== "string") return;

  const match = value.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return;

  const purity = Number(match[1]);
  if (!Number.isNaN(purity) && purity > 0 && purity <= 100) return purity;
};

/**
 * Structured chemical properties pulled out of a supplier's free-form product copy.
 * Every field is optional — only the values actually present (and valid) are returned.
 * @source
 */
export interface ChemicalSpecs {
  /** Purity percentage in the `(0, 100]` range (e.g. `98`). */
  purity?: number;
  /** Molecular formula, validated as a plausible formula (e.g. `C2H3KO2`). */
  formula?: string;
  /** Molecular weight / mass in g/mol (e.g. `98.14`). */
  molecularWeight?: number;
  /** SMILES structure string, validated as plausibly-valid SMILES. */
  smiles?: string;
}

// Wix suppliers bury specs in HTML accordions and bullet lists. Flatten that markup to one value
// per line — break on block/list/break tags, drop remaining tags, decode entities, then collapse
// runs of non-newline whitespace — so the label/value matchers below work line-by-line.
const normalizeSpecText = (html: string): string =>
  decodeHTMLEntities(
    html
      .replace(/<\/(?:p|li|ul|ol|div|tr|h[1-6])>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  ).replace(/[^\S\n]+/g, " ");

// A label followed by an optional separator (":", "-", "#", "=", em/en dashes) and the value.
const MOLEWEIGHT_REGEX =
  /(?:molecular\s+(?:weight|mass)|mol(?:ecular|\.)?\s+(?:wt|weight|mass)|\bmw\b)\s*[:#=–—-]*\s*(\d+(?:\.\d+)?)/i;
const FORMULA_REGEX = /(?:molecular\s+formula|\bformula\b)\s*[:#=–—-]*\s*([A-Za-z][A-Za-z0-9()·.]*)/i;
const SMILES_LABEL_REGEX = /\bsmiles\b\s*[:#=–—-]*\s*(\S+)/i;
const PURITY_PERCENT_REGEX = /(\d{1,3}(?:\.\d+)?)\s*\+?\s*%/;

/**
 * Pulls a purity percentage from messy, multi-line product copy. Unlike {@link parsePurity}, this
 * only trusts a percentage that sits on a line mentioning "purity" — so a stray "50% brine" in a
 * description is ignored — and tolerates the `98%+`, `99+%`, and `99-100%` shapes suppliers use.
 * @param lines - The normalized, line-split product copy
 * @returns The purity as a number (e.g. `98`), or nothing if none is found
 * @source
 */
const extractPurity = (lines: string[]): number | undefined => {
  for (const line of lines) {
    if (!/purity/i.test(line)) continue;
    const match = line.match(PURITY_PERCENT_REGEX);
    if (!match) continue;
    const purity = Number(match[1]);
    if (!Number.isNaN(purity) && purity > 0 && purity <= 100) return purity;
  }
  return undefined;
};

/**
 * Extracts structured chemical properties (purity, molecular formula, molecular weight, SMILES)
 * from a supplier's free-form, HTML-laced product copy. Built for Wix suppliers whose specs live
 * inside descriptions and additional-info accordions as loosely-labelled bullet lists — labels and
 * separators vary wildly (`MW -`, `Molecular mass :`, `Formula:`), so each field is matched
 * tolerantly and validated before being returned. CAS numbers are intentionally left to
 * {@link findCAS}, which already searches free text robustly.
 * @category Helpers
 * @param html - Raw product copy, possibly containing HTML markup
 * @returns The chemical properties found; fields absent or invalid are omitted
 * @example
 * ```typescript
 * parseChemicalSpecs("<p>Purity: 98%+</p><p>Formula: C5H9KO2</p><p>MW: 140.22g/mol</p>")
 * // { purity: 98, formula: "C5H9KO2", molecularWeight: 140.22 }
 * parseChemicalSpecs("<li>MW - 136.169 G/MOL</li><li>SMILES: [K+].CCCCC([O-])=O</li>")
 * // { molecularWeight: 136.169, smiles: "[K+].CCCCC([O-])=O" }
 * parseChemicalSpecs("Ships in 4-6 business days") // {}
 * ```
 * @source
 */
export const parseChemicalSpecs = (html: string): ChemicalSpecs => {
  if (!html || typeof html !== "string") return {};

  const text = normalizeSpecText(html);
  const lines = text.split("\n").map((line) => line.trim());
  const specs: ChemicalSpecs = {};

  const purity = extractPurity(lines);
  if (purity !== undefined) specs.purity = purity;

  const formulaMatch = text.match(FORMULA_REGEX);
  if (formulaMatch && isMoleForm(formulaMatch[1])) specs.formula = formulaMatch[1];

  const moleweightMatch = text.match(MOLEWEIGHT_REGEX);
  if (moleweightMatch) {
    const moleweight = Number(moleweightMatch[1]);
    if (!Number.isNaN(moleweight) && moleweight > 0) specs.molecularWeight = moleweight;
  }

  const smilesMatch = text.match(SMILES_LABEL_REGEX);
  if (smilesMatch && looksLikeSmiles(smilesMatch[1])) specs.smiles = smilesMatch[1];

  return specs;
};
