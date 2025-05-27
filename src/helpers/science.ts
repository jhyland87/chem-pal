import { SUBSCRIPTS, SUPERSCRIPTS } from "../constants/science";

/**
 * @group Helpers
 * @groupDescription Scientific formula parsing and chemical notation utilities.
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
