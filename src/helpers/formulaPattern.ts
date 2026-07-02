/**
 * @group Helpers
 * @groupDescription Shared building blocks for chemical-formula detection, used by both
 * `findFormulaInText` and `findFormulaInHtml`. They differ only in how subscripts are
 * represented (unicode/entity/escape/tag for plain text vs `<sub>`/`<sup>` tags for HTML)
 * and in post-match conversion; the element gating, charge/separator/coefficient grammar,
 * and "pick the most likely of several matches" logic live here so they aren't duplicated.
 * @source
 */

/**
 * Element-symbol alternation (all 118 symbols, folded into per-first-letter character classes).
 * Gates formula matching so ordinary prose isn't read as a formula.
 * @source
 */
export const FORMULA_ELEMENT_PATTERN =
  "(?:H[eogsf]?|L[iavru]|B[eahkri]?|C[arofmusenld]?|N[eiahopdb]?|O[sg]?|F[rlem]?|M[godtcn]|A[lrsgutmc]|S[icerngmb]?|P[uabotmrd]?|Kr?|T[icebmsalh]|V|Z[nr]|G[ade]|R[buhenagf]|Yb?|I[nr]?|Xe|E[urs]|D[ysb]|W|U)";

/**
 * Builds the chemical-formula matching regex, parameterized by the subscript token for the
 * source format. Everything else is shared: element gating, an optional ionic charge,
 * salt/hydrate separators with optional coefficients, and a "head" that must look like a
 * formula — either ≥2 element/bracket units, or a single element carrying a real subscript.
 *
 * The returned regex is **global**, so callers can collect every candidate (via `matchAll`)
 * and choose the most likely one with {@link pickBestFormula}.
 *
 * @param subToken - Regex source matching one real subscript/superscript in the source format
 *   (e.g. `<su[bp]>…</su[bp]>` for HTML, or the union of glyph/escape/entity/tag forms for text).
 * @returns A global RegExp that matches formula candidates.
 * @example
 * ```typescript
 * const re = buildFormulaPattern("<su[bp]>[1-9][0-9]*</su[bp]>");
 * [...("H<sub>2</sub>O and CO<sub>2</sub>".matchAll(re))].map((m) => m[0]);
 * // ["H<sub>2</sub>O", "CO<sub>2</sub>"]
 * ```
 * @source
 */
export function buildFormulaPattern(subToken: string): RegExp {
  const element = FORMULA_ELEMENT_PATTERN;
  // A subscript inside a unit: a real subscript token, or a plain inline count.
  const subPart = `(?:${subToken}|[1-9][0-9]*)`;
  // One "unit": a run of elements/brackets, then any trailing subscripts.
  const unit = `(?:(?:${element}|[()\\[\\]])+(?:${subPart})*)`;
  // The head must look like a formula and not prose: ≥2 units, or one element + a real subscript.
  const head = `(?:(?:${unit}){2,}|(?:${element}|[()\\[\\]])+${subToken})`;
  // An optional ionic charge sign; the lookahead keeps it from grabbing a hyphen inside a word.
  const charge = "(?:[+-](?![A-Za-z0-9]))?";
  // Salt/hydrate separator: a spaced dot glyph, or a tight "." immediately followed by a component.
  const separator = "(?:\\s*[·•‧∙⋅・･*]\\s*|\\.(?=[A-Za-z(\\[]))";
  // A leading coefficient after a separator: a subscript, an integer/fraction, or a variable x/n.
  const coefficient = `(?:${subToken}|[1-9][0-9]*(?:/[1-9][0-9]*)?|[xn])`;

  return new RegExp(
    `((?![^<>]*>)${head}${charge}(?:${separator}(?:${coefficient})?${unit}+${charge})*)`,
    "g",
  );
}

/**
 * Scores how "formula-like" a candidate is, so the best of several matches can be chosen.
 * Favors more element symbols first (a real formula packs several), then the presence of a
 * subscript/count, then raw length — so `NaOSOCH3` outranks a two-letter coincidence such as
 * `IN` (from "EINECS") or `CS` pulled out of surrounding codes/prose.
 *
 * @param candidate - A raw formula match.
 * @returns A numeric score; higher is more likely to be a real formula.
 * @example
 * ```typescript
 * scoreFormula("NaOSOCH3") > scoreFormula("IN"); // true
 * ```
 * @source
 */
export function scoreFormula(candidate: string): number {
  const elementCount = candidate.match(new RegExp(FORMULA_ELEMENT_PATTERN, "g"))?.length ?? 0;
  const hasCount = /[0-9₀-₉⁰-⁹]/.test(candidate);
  return elementCount * 100 + (hasCount ? 50 : 0) + candidate.length;
}

/**
 * Returns the most-likely-correct formula from a list of raw matches (highest {@link scoreFormula},
 * first match winning ties), or `undefined` when the list is empty.
 *
 * @param candidates - Raw formula matches, e.g. from `matchAll`.
 * @returns The best candidate, or `undefined`.
 * @example
 * ```typescript
 * pickBestFormula(["IN", "CS", "NaOSOCH3"]); // "NaOSOCH3"
 * ```
 * @source
 */
export function pickBestFormula(candidates: string[]): string | undefined {
  let best: string | undefined;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score = scoreFormula(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}
