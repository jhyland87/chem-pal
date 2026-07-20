import {
  SUBSCRIPT_GLYPHS,
  SUBSCRIPTS,
  SUPERSCRIPT_GLYPHS,
  SUPERSCRIPTS,
} from "@/constants/science";
import {
  buildFormulaPattern,
  FORMULA_ELEMENT_PATTERN,
  pickBestFormula,
} from "@/helpers/formulaPattern";
import { looksLikeSmiles } from "@/helpers/smiles";
import { decodeHTMLEntities, ucfirst } from "@/helpers/utils";

/**
 * @category Science Helpers
 * @showCategories
 * @categoryDescription Scientific formula parsing and chemical notation utilities.
 * @source
 */

/**
 * @group Core Utilities
 * @groupDescription Country lookups backed by the `country-list-js` library,
 * @showGroups
 * @category Country Helpers
 */

/**
 * @group Regex Patterns
 * @showGroups
 * @groupDescription Fancy pants regex patterns for parsing the unparseable
 * @category Science Helpers
 * @source
 */

/**
 * @group Parsers
 * @showGroups
 * @groupDescription Parsers for the unparseable.
 * @category Science Helpers
 * @source
 */

/**
 * @group Formatters
 * @showGroups
 * @groupDescription Formatting stuff
 * @category Science Helpers
 * @source
 */

/**
 * @group Converters
 * @showGroups
 * @groupDescription Converting A to B
 * @category Science Helpers
 * @source
 */

/**
 * @group Formatters
 * @showGroups
 * @groupDescription Formatting stuff
 * @category Science Helpers
 * @source
 */

/**
 * @group Converters
 * @showGroups
 * @groupDescription Converting A to B
 * @category Science Helpers
 * @source
 */

/**
 * @group Types
 * @showGroups
 * @groupDescription Types and interfaces
 * @category Science Helpers
 * @source
 */

/**
 * Converts regular numbers in a string to subscript Unicode characters.
 * @group Formatters
 * @category Science Helpers
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
  // Subscript digits are contiguous from U+2080 (₀), so ₀–₉ is just 0x2080 + the digit.
  return str.replace(/[0-9]/g, (d) => String.fromCodePoint(0x2080 + Number(d)));
};

/**
 * Converts regular numbers in a string to superscript Unicode characters.
 * @group Formatters
 * @category Science Helpers
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
  // Superscript digits aren't contiguous: ¹²³ live in the Latin-1 block (U+00B9/B2/B3), while
  // ⁰ and ⁴–⁹ are contiguous from U+2070. Special-case the three, compute the rest.
  return str.replace(/[0-9]/g, (d) => {
    const n = Number(d);
    if (n === 1) return "¹";
    if (n === 2) return "²";
    if (n === 3) return "³";
    return String.fromCodePoint(0x2070 + n);
  });
};

/**
 * Normalizes Unicode superscript digits already present in `str` to their literal glyph spelling,
 * mapping each {@link SUPERSCRIPTS} value to its {@link SUPERSCRIPT_GLYPHS} counterpart. Because both
 * maps resolve the digit keys to identical code points, a string that already contains superscript
 * characters is returned unchanged — this is a normalization pass, not a converter. It does NOT turn
 * ASCII digits into superscripts; use {@link superscript} for that.
 * @group Formatters
 * @category Science Helpers
 * @param str - The string whose Unicode superscript digits to normalize
 * @returns The string with superscript digits in glyph form (ASCII digits untouched)
 * @example
 * ```typescript
 * superscriptGlyph("x²") // Returns "x²"
 * superscriptGlyph("x2") // Returns "x2" (ASCII digits are not converted)
 * ```
 * @source
 */
export const superscriptGlyph = (str: string) => {
  for (const key in SUPERSCRIPT_GLYPHS) {
    str = str.replace(new RegExp(SUPERSCRIPTS[key], "g"), SUPERSCRIPT_GLYPHS[key]);
  }
  return str;
};

/**
 * Normalizes Unicode subscript digits already present in `str` to their literal glyph spelling,
 * mapping each {@link SUBSCRIPTS} value to its {@link SUBSCRIPT_GLYPHS} counterpart. Because both maps
 * resolve the digit keys to identical code points, a string that already contains subscript
 * characters is returned unchanged — this is a normalization pass, not a converter. It does NOT turn
 * ASCII digits into subscripts; use {@link subscript} for that.
 * @group Formatters
 * @category Science Helpers
 * @param str - The string whose Unicode subscript digits to normalize
 * @returns The string with subscript digits in glyph form (ASCII digits untouched)
 * @example
 * ```typescript
 * subscriptGlyph("H₂O") // Returns "H₂O"
 * subscriptGlyph("H2O") // Returns "H2O" (ASCII digits are not converted)
 * ```
 * @source
 */
export const subscriptGlyph = (str: string) => {
  for (const key in SUBSCRIPT_GLYPHS) {
    str = str.replace(new RegExp(SUBSCRIPTS[key], "g"), SUBSCRIPT_GLYPHS[key]);
  }
  return str;
};

/** Polymer repeat-unit index letters mapped to their subscript glyphs (see {@link findFormulaInText}). */
const REPEAT_INDEX_GLYPHS: Record<string, string> = { n: "ₙ", m: "ₘ", x: "ₓ" };

/**
 * Checks if a string is a valid molecular formula.
 * @group Parsers
 * @category Science Helpers
 * @see https://regex101.com/r/YTOdbq/1
 * @param moleform - The string to check
 * @returns True if the string is a valid molecular formula, false otherwise
 * @example
 * ```typescript
 * isMoleForm("C12H22O11"); // true
 * isMoleForm("12H22O11"); // false
 * isMoleForm("C<sub>11</sub>H<sub>8</sub>I<sub>3</sub>N<sub>2</sub>NaO<sub>4</sub>") // true
 * ```
 * @source
 */
export function isMoleForm(moleform: string): boolean {
  const pattern = new RegExp(/^(?:[A-Z][a-z]?(?:(?:<sub>)?[1-9]\d*(?:<\/sub>)?)?)+$/);
  return pattern.test(moleform);
}

/**
 * Finds the first chemical-formula-like substring in `text` and returns it with `<sub>`/`<sup>` tags
 * converted to Unicode sub/superscript glyphs, or `undefined` if none is found. Unlike
 * {@link findFormulaInHtml} (which only understands `<sub>`/`<sup>` markup), this recognizes a
 * subscript/superscript number written in any of four representations, so it works on raw scraped
 * text regardless of how the source encoded it:
 * - literal glyphs — `H₂O`, `x²`;
 * - `\u` escape text — `H₂O` (e.g. unparsed JSON);
 * - HTML numeric entities — `H&#8322;O`, `H&#x2082;O` (decimal or hex);
 * - `<sub>`/`<sup>` tags — `H<sub>2</sub>O`.
 *
 * All four forms are *matched* so the formula is found; for the returned string only `<sub>`/`<sup>`
 * tags are rewritten to glyphs. Glyph input already carries glyphs and passes through unchanged;
 * entity- and `\u`-escape-encoded numbers are returned in their source encoding. Untagged inline
 * digits (e.g. a salt/hydrate coefficient like `·12H₂O`, or `2K` after a separator) are matched but
 * left as regular digits.
 *
 * Also handles salts/hydrates joined by `·`/`•`/`*` (or a tight `.`) with optional integer,
 * fraction, or variable (`x`/`n`) coefficients, and trailing ionic charge signs. Element symbols
 * gate the match — within a longer string it needs at least two element/bracket "units" (so `KBr`
 * counts as `K`+`Br`) or a single element carrying a subscript/superscript, so ordinary prose isn't
 * mistaken for a formula. A lone element (e.g. `Na`, `K+`) is accepted only when it is the entire
 * trimmed input, so a bare symbol is never pulled out of a sentence.
 * @group Parsers
 * @category Science Helpers
 * @param text - The text string to search for a formula
 * @returns The formula with `<sub>`/`<sup>` tags converted to glyphs, or undefined if none is found
 * @example
 * ```typescript
 * findFormulaInText("C₃₃H₂₅N₃O₁₂S • ₄K")                 // "C₃₃H₂₅N₃O₁₂S • ₄K"
 * findFormulaInText("K<sub>2</sub>SO<sub>4</sub>")          // "K₂SO₄"
 * findFormulaInText("Here is a formula: C₁₀H₇KN₆O·xH₂O")  // "C₁₀H₇KN₆O·xH₂O"
 * findFormulaInText("Na")                                  // "Na" (lone element, whole input)
 * findFormulaInText("I love Nature")                       // undefined (not pulled from prose)
 * ```
 * @see https://regex101.com/r/h3ZnXX/4 - Regex pattern explanation
 * @source
 */
export const findFormulaInText = (text: string): string | undefined => {
  // A sub/superscript "number" (no leading zero), in each accepted representation.
  // Characters are enumerated rather than ranged so engines that don't compute
  // Unicode ranges (byte-oriented / non-Unicode modes) still match them.
  const glyphSub = "[₁₂₃₄₅₆₇₈₉][₀₁₂₃₄₅₆₇₈₉]*";
  const glyphSup = "[¹²³⁴⁵⁶⁷⁸⁹][⁰¹²³⁴⁵⁶⁷⁸⁹]*";
  // \u escape text (literal backslash-u-XXXX, e.g. before JSON.parse).
  const escSub = String.raw`\\u208[1-9](?:\\u208[0-9])*`;
  const escSup = String.raw`(?:\\u00[bB][239]|\\u207[4-9])(?:\\u2070|\\u00[bB][239]|\\u207[4-9])*`;
  // HTML numeric entities, decimal or hex, with optional leading zeros.
  const entSub = "&#(?:0*832[1-9]|[xX]0*208[1-9]);(?:&#(?:0*832[0-9]|[xX]0*208[0-9]);)*";
  const entSup =
    "&#(?:0*(?:178|179|185|830[89]|831[0-3])|[xX]0*(?:[bB][239]|207[4-9]));(?:&#(?:0*(?:178|179|185|8304|830[89]|831[0-3])|[xX]0*(?:2070|[bB][239]|207[4-9]));)*";
  // <sub>2</sub> / <sup>2</sup> tags.
  const tag = "<su[bp]>[1-9][0-9]*</su[bp]>";
  const subSup = `(?:${glyphSub}|${glyphSup}|${escSub}|${escSup}|${entSub}|${entSup}|${tag})`;

  // Polymer / repeat-unit index: a variable subscript (n, m, x), not a number — as in "(C₃H₃NaO₂)ₙ".
  // Glyph form (ₙ ₘ ₓ) or the <sub>n</sub> HTML form. Unambiguous → no prose-word risk.
  const repeatIndex = "(?:[ₙₘₓ]|<su[bp]>[nmx]</su[bp]>)";
  // Everything that can trail a unit as a "count": a real sub/sup number, or a repeat index.
  const trailingCount = `(?:${subSup}|${repeatIndex})`;

  // A lone element (e.g. "Na", "K+") is a valid formula, but only when it is the entire trimmed
  // input — anchoring keeps a bare symbol from being pulled out of prose (e.g. "I" from "I love …").
  const trimmed = text.trim();
  if (new RegExp(`^${FORMULA_ELEMENT_PATTERN}(?:[+-])?$`).test(trimmed)) {
    return trimmed;
  }

  // Collect every candidate and keep the most likely one, so a real formula isn't shadowed by a
  // two-letter coincidence earlier in the text (e.g. "IN"/"CS" inside "EINECS 243-669-6").
  const best = pickBestFormula(
    [...text.matchAll(buildFormulaPattern(trailingCount))].map((m) => m[0]),
  );
  if (best === undefined) {
    return;
  }
  return (
    best
      .replace(/<sub>(\d+)<\/sub>/g, (_match, p1) => subscript(p1 || ""))
      .replace(/<sup>(\d+)<\/sup>/g, (_match, p1) => superscript(p1 || ""))
      // Repeat-index tag → glyph, mirroring the digit-tag handling above.
      .replace(/<su[bp]>([nmx])<\/su[bp]>/g, (_match, p1: string) => REPEAT_INDEX_GLYPHS[p1] ?? p1)
      .replace(/\\u208[0-9](?:\\u208[0-9])*/g, (match) => subscriptGlyph(match))
      .replace(/(?:\\u00[bB][239]|\\u207[4-9])(?:\\u2070|\\u00[bB][239]|\\u207[4-9])*/g, (match) =>
        superscriptGlyph(match),
      )
  );
};

/**
 * Match for a chemical formula (with or without subscript tags) in a string of html, converting
 * `<sub>`/`<sup>` tags to unicode sub/superscripts. Numbers that aren't tagged (e.g. a salt/hydrate
 * coefficient denoting how many of the whole molecule) are matched but left as regular digits.
 *
 * Handles:
 * - multi-digit subscripts (`C<sub>18</sub>…`);
 * - parenthesised/bracketed groups (`KN(C(O)CH<sub>2</sub>)<sub>2</sub>`);
 * - salt/hydrate components after a `·`/`•`/`*` separator, with an optional leading coefficient
 *   that may be a number, a `<sub>`-tagged number, or a variable `x`/`n` (`…O·xH<sub>2</sub>O`,
 *   `… • <sub>4</sub>K`, `…O<sub>5</sub>·K`).
 *
 * Element symbols gate the match — at least two element/bracket "units" are required — so ordinary
 * prose isn't mistaken for a formula. A clean, subscript-free formula like `KBr` is a single unit
 * and is intentionally NOT matched here (callers store those verbatim via `isMoleForm`).
 *
 * @group Parsers
 * @category Science Helpers
 * @param html - The HTML string to search for a formula
 * @returns The formula with proper sub/superscript formatting, or undefined if none is found
 * @example
 * ```typescript
 * findFormulaInHtml('foobar K<sub>2</sub>Cr<sub>2</sub>O<sub>7</sub> baz') // "K₂Cr₂O₇"
 * findFormulaInHtml('C<sub>18</sub>H<sub>14</sub>N<sub>2</sub>O') // "C₁₈H₁₄N₂O"
 * findFormulaInHtml('C<sub>20</sub>H<sub>20</sub>O<sub>5</sub>·K') // "C₂₀H₂₀O₅·K"
 * findFormulaInHtml('Just some text') // undefined
 * ```
 * @see https://regex101.com/r/H6DXwK/6 - Regex pattern explanation
 * @source
 */
export const findFormulaInHtml = (html: string): string | undefined => {
  // Collect every candidate and keep the most likely one (see findFormulaInText). The subscript
  // token here is the HTML-only `<sub>`/`<sup>` tag; the rest of the grammar is shared.
  const taggedSub = "<su[bp]>[1-9][0-9]*</su[bp]>";
  const best = pickBestFormula([...html.matchAll(buildFormulaPattern(taggedSub))].map((m) => m[0]));
  if (best === undefined) {
    return;
  }
  return best
    .replace(/<sub>(\d+)<\/sub>/g, (_match, p1) => subscript(p1 || ""))
    .replace(/<sup>(\d+)<\/sup>/g, (_match, p1) => superscript(p1 || ""));
};

/**
 * Extracts a purity percentage from a string. Suppliers commonly bake the
 * purity into a product name or grade label (e.g. "Sodium borohydride, min
 * 95%"), so this finds the first percentage and returns it as a number when it
 * falls within the valid `(0, 100]` range — matching the values
 * `ProductBuilder.setPurity` accepts. Returns nothing when no valid percentage
 * is present.
 *
 * Tolerates the shapes suppliers use around the number: a leading qualifier
 * (`≥99.8%`), a European comma decimal (`99,5 %`), a trailing "or better" plus
 * (`99+%`, `99 +%`, `99.9 +%`), and whitespace before the `%`.
 * @group Parsers
 * @category Science Helpers
 * @param value - The string to extract the purity from
 * @returns The purity as a number (e.g. `95`), or nothing if none is found
 * @example
 * ```typescript
 * parsePurity("Sodium borohydride, min 95%")   // Returns 95
 * parsePurity("Hydroquinone ≥99.8%, extra pure") // Returns 99.8
 * parsePurity("Lithium Carbonate 99+% Extra Pure") // Returns 99
 * parsePurity("Potassium hydrogen tartrate ≥99,5 %") // Returns 99.5
 * parsePurity("Sodium carbonate 99.7 +%, pure")  // Returns 99.7
 * parsePurity("120%")             // Returns nothing (out of range)
 * parsePurity("no percentage here") // Returns nothing
 * ```
 * @source
 */
export const parsePurity = (value: string): number | void => {
  if (!value || typeof value !== "string") return;

  // Number (dot or comma decimal), an optional trailing "+" (with optional
  // spaces), then "%". Anchoring on "%" keeps stray digits (codes like "E515")
  // from being read as a purity.
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*\+?\s*%/);
  if (!match) return;

  const purity = Number(match[1].replace(",", "."));
  if (!Number.isNaN(purity) && purity > 0 && purity <= 100) return purity;
};

/**
 * Extracts a purity/grade descriptor from a string, as a string. Unlike {@link parsePurity} (which
 * returns only a numeric percentage), this keeps the qualifier — so a comparator percentage like
 * `"≥99.8%"` or `">99%"` is preserved verbatim — and, when no valid percentage is present, falls
 * back to a recognized chemical grade (`"ACS Grade"`, `"HPLC Grade"`, …) via {@link parseGrade},
 * which means an unrecognized string comes back as `"Ungraded"` rather than nothing. Only an empty
 * or non-string input returns nothing. Built for `ProductBuilder.setPurity`, whose Purity column
 * shows either kind.
 * @group Parsers
 * @category Science Helpers
 * @param value - The string to extract a purity/grade from (e.g. a product name)
 * @returns The percentage token (e.g. `"≥99.8%"`), a grade label (e.g. `"ACS Grade"`), or nothing
 * @example
 * ```typescript
 * findPurity("Sodium Metal ≥99.8%")            // "≥99.8%"
 * findPurity("Acetonitrile HPLC - 1 L")        // "HPLC Grade" (no percentage, grade fallback)
 * findPurity("Sodium, Reagent (ACS) - 500 G")  // "ACS Grade"
 * findPurity("Ships in 4-6 business days")     // "Ungraded"
 * findPurity("")                               // undefined
 * ```
 * @source
 */
export const findPurity = (value: string): string | undefined => {
  if (!value || typeof value !== "string") return;
  // Strip HTML first so inline CSS (e.g. style="width: 100%") isn't read as a purity.
  const clean = value.replace(/<[^>]+>/g, " ");
  // A percentage (with optional comparator) is the most specific signal, so it wins over a grade.
  // Same shapes parsePurity tolerates — comparator, European comma decimal, "or better" plus —
  // since both read the same supplier copy; only the return type differs.
  const token = clean.replace(/\s+/g, "").match(/[<>≤≥≈]?\d{1,3}(?:[.,]\d+)?\+?%/)?.[0];
  const numeric = Number(token?.match(/\d+(?:[.,]\d+)?/)?.[0].replace(",", "."));
  if (token && !Number.isNaN(numeric) && numeric > 0 && numeric <= 100) {
    return token;
  }
  return parseGrade(clean);
};

/**
 * Regex patterns used for parse classification values or labeled fields
 * @category Science Helpers
 * @group Types
 */
interface GradeRegexes {
  /** Classifies a grade token appearing anywhere in the string. */
  classifier: RegExp;
  /** Classifies a bare word-grade stem that follows an explicit "Grade:"/"Purity:" label. */
  labeled: RegExp;
}

/**
 * Build grade regexes
 * @category Science Helpers
 * @group Regex Patterns
 * @returns object with classifier regex and labeled regex
 * @source
 */
export const buildGradeRegexes = (): GradeRegexes => {
  // cases("grade") -> "(?:grade|Grade|grade|GRADE)"
  // Case aware character classes, so words can be upper, lower or ucfirst.
  // flag (which older V8 builds reject).
  // const ci = (word: string) =>
  //   [...word]
  //     .map((c) => (/[a-zA-Z]/i.test(c) ? `[${c.toUpperCase()}${c.toLowerCase()}]` : c))
  //     .join("");
  const cases = (word: string) => {
    const _c = new Set([word, ucfirst(word), word.toLowerCase(), word.toUpperCase()]);
    return `(?:${Array.from(_c).join("|")})`;
  };

  // acronym("ACS") -> "(?:ACS(?!\.)|A\.C\.S\.)"
  // Plain form (not followed by a dot, so "ACS." is rejected) OR dotted "A.C.S.".
  // Wrapped in (?:...) so the internal | can't leak into the surrounding
  // alternation — this is what makes the "BP/USP" combos parse correctly.
  const acronym = (word: string) => `(?:${word}(?!\\.)|${word.replaceAll(/([A-Z])/g, "$1\\.")})`;

  // ── Core reusable tokens ────────────────────────────────────────────────────
  const gradeTxt = cases("grade");
  const purityTxt = cases("purity");
  const qualityTxt = cases("quality");
  const reagentTxt = cases("reagent");

  // Optional trailing " grade" (lets "AR" also match "AR Grade").
  const optionalGrade = String.raw`(?:\s+${gradeTxt})?`;

  // Flexible "reagent"/"grade" tail in EITHER order.
  const rgFlex = String.raw`(?:${reagentTxt}(?:\s+${gradeTxt})?|${gradeTxt}(?:\s+${reagentTxt})?)`;

  // Pharma stem. The three endings are siblings, not nested — "cy"/"ceutical" branch off
  // "pharma", NOT off "pharmacop":
  //   pharma | pharmacop | pharmacopeia | pharmacopoeia | pharmacy | pharmaceutical
  const pharma = String.raw`${cases("pharma")}(?:${cases("cop")}(?:[Oo]?${cases("eia")})?|${cases("cy")}|${cases("ceutical")})?`;

  // ── Word-grade stems ────────────────────────────────────────────────────────
  // The bare qualifier word for each grade that has no acronym of its own. On its
  // own a stem is too weak to classify ("ultra pure water", "low prices"), so the
  // bodies below all pair it with a required reagent/grade tail. The one place a
  // bare stem IS decisive is after an explicit "Grade:"/"Purity:" label, which is
  // what buildLabeledGradeRegex reuses these for.
  const stems = {
    Guaranteed_Grade: cases("guaranteed"),
    Cosmetic_Grade: cases("cosmetic"),
    Extraction_Grade: cases("extraction"),
    Practical_Grade: cases("practical"),
    // [IiUu] absorbs the "indistrial" typo.
    Industrial_Grade: String.raw`${cases("ind")}[IiUu]${cases("strial")}`,
    Technical_Grade: String.raw`${cases("tech")}(?:${cases("nical")})?`,
    Reagent_Grade: reagentTxt,
    // "lab" or laboratory + its two common misspellings.
    Lab_Grade: String.raw`${cases("lab")}(?:${cases("oratory")}|${cases("oratiry")}|${cases("pratory")})?`,
    Pure_Grade: String.raw`${cases("pur")}(?:${cases("e")}|${cases("ified")})`,
    High_Purity_Grade: String.raw`(?:${cases("ultra")}\s+)?${cases("high")}\s+(?:${cases("purity")}|${qualityTxt}|${rgFlex})`,
    Pharma_Grade: pharma,
    Low_Grade: cases("low"),
  };

  // ── Per-grade group bodies ──────────────────────────────────────────────────
  const bodies = {
    AR_Grade: String.raw`(?:${acronym("AR")}|${cases("analytical")}(?:\s*${reagentTxt})?)${optionalGrade}`,
    ACS_Grade: String.raw`(?:${acronym("ACS")}|${cases("acs")}\s+${gradeTxt}|${cases("american")}\s+${cases("chem")}(?:${cases("ical")})?\s+${cases("society")})${optionalGrade}`,
    Guaranteed_Grade: String.raw`${stems.Guaranteed_Grade}\s+${rgFlex}`,
    Cosmetic_Grade: String.raw`${stems.Cosmetic_Grade}\s+${rgFlex}`,
    Extraction_Grade: String.raw`${stems.Extraction_Grade}\s+${rgFlex}`,
    NF_Grade: String.raw`(?:${acronym("NF")}|${cases("nf")}\s+${gradeTxt}|${cases("national")}\s+${cases("formulary")})${optionalGrade}`,
    FCC_Grade: String.raw`(?:${acronym("FCC")}|${cases("fcc")}\s+${gradeTxt}|${cases("food")}\s+(?:${cases("chem")}(?:${cases("icals")})?\s+${cases("codex")}|${rgFlex}))${optionalGrade}`,
    Practical_Grade: String.raw`${stems.Practical_Grade}\s+${rgFlex}`,
    Industrial_Grade: String.raw`${stems.Industrial_Grade}\s+${rgFlex}`,
    // "tech"/"technical" + flexible tail (any case), OR bare fully-uppercase
    // "TECHNICAL" / "TECHNICAL GRADE" (all-caps product titles).
    Technical_Grade: String.raw`(?:${stems.Technical_Grade}\s+${rgFlex}|TECHNICAL(?:\s+GRADE)?)`,
    // Bare "reagent grade". Qualifier-prefixed forms ("Practical/Technical/Pure/…
    // Reagent Grade") are claimed by those groups, which all consume the reagent
    // tail — so ordering keeps this from firing on them, no lookbehind needed.
    Reagent_Grade: String.raw`(?<!(CS|SP|CC|AR|BP|JP|PA|AL|al)\s)${stems.Reagent_Grade}${optionalGrade}(?!.*(ACS|(US|J|B)P|NF|FCC|HPLC).*)`,
    // "BP"/"B.P." — decline when "/USP" or "/U.S.P." follows so the combo routes
    // to USP. Or "britt?ish pharmacop..." (t? absorbs the "Brittish" typo).
    BP_Grade: String.raw`(?:${acronym("BP")}(?!\s*/\s*${acronym("USP")})|${cases("brit")}[Tt]?${cases("ish")}\s+${pharma})${optionalGrade}`,
    JP_Grade: String.raw`(?:${acronym("JP")}|${cases("japanese")}\s+${pharma})${optionalGrade}`,
    // Combined designations FIRST (so the whole "BP/USP" is captured), then
    // "USP"/"U.S.P." / "usp grade" / "United States|US pharmacop...".
    USP_Grade: String.raw`(?:${acronym("BP")}\s*/\s*${acronym("USP")}|${acronym("USP")}\s*/\s*${acronym("BP")}|${acronym("USP")}|${cases("usp")}\s+${gradeTxt}|(?:${cases("united")}\s+${cases("states")}|${acronym("US")})\s+${pharma})${optionalGrade}`,
    HPLC_Grade: String.raw`(?:${acronym("HPLC")}|${cases("hplc")}\s+${gradeTxt}|${cases("gradient")}\s+${gradeTxt}|${cases("high")}[-\s]+${cases("performance")}\s+${cases("liquid")}\s+${cases("chromatography")})${optionalGrade}`,
    Lab_Grade: String.raw`(?:${acronym("LR")}|${stems.Lab_Grade}\s+${rgFlex})`,
    Pure_Grade: String.raw`(?:${acronym("PA")}|${stems.High_Purity_Grade}|${stems.Pure_Grade}\s+${rgFlex})`,
    Pharma_Grade: String.raw`${stems.Pharma_Grade}\s+${rgFlex}`,
    Low_Grade: String.raw`${stems.Low_Grade}\s+(?:${rgFlex}|${purityTxt})`,
    Impure: String.raw`${cases("impure")}(?:\s+${reagentTxt})?`,
    Ungraded: String.raw`${cases("ungraded")}(?:\s+${cases("purity")})?(?:\s+${reagentTxt})?`,
  };

  // ── Assembly ────────────────────────────────────────────────────────────────
  // Order matters only for the BP -> USP fallthrough (BP declines "/USP" via the
  // lookahead, so USP wins). Other groups have distinct leading tokens.
  const order = [
    "AR_Grade",
    "ACS_Grade",
    "Guaranteed_Grade",
    "Cosmetic_Grade",
    "Extraction_Grade",
    "NF_Grade",
    "FCC_Grade",
    "Practical_Grade",
    "Industrial_Grade",
    "Technical_Grade",
    "Reagent_Grade",
    "BP_Grade",
    "JP_Grade",
    "USP_Grade",
    "HPLC_Grade",
    "Lab_Grade",
    "Pure_Grade",
    "Pharma_Grade",
    "Low_Grade",
    "Impure",
    "Ungraded",
  ] as const;

  const namedGroups = order.map((name) => `(?<${name}>${bodies[name]})`).join("|");

  // \b...(?!\w): matches a grade token anywhere. (?!\w) — rather than a trailing
  // \b — lets a token end on a dot ("A.R.", "U.S.P."). Swap the \b for ^ and the
  // (?!\w) for $ for a strict full-string match.
  const classifier = new RegExp(String.raw`\b(?:${namedGroups})(?!\w)`);

  // ── Labeled fallback ────────────────────────────────────────────────────────
  // Suppliers also write the grade as a labeled field: "Grade: Technical".
  // The word grades can't match that off `classifier` alone, because their bodies
  // require a reagent/grade tail to keep prose like "ultra pure water" from
  // classifying. An explicit "Grade:"/"Purity:"/"Quality:" label supplies that
  // missing signal, so here the bare stem is enough. Acronym grades never reach
  // this regex — they already match the classifier on their own.
  const labelPrefix = String.raw`\b(?:${gradeTxt}|${purityTxt}|${cases("quality")})\s*[:\-–]\s*`;
  const labeledGroups = Object.entries(stems)
    .map(([name, stem]) => `(?<${name}>${stem})`)
    .join("|");
  const labeled = new RegExp(String.raw`${labelPrefix}(?:${labeledGroups})(?!\w)`);

  const patterns = { classifier, labeled };

  return patterns;
};

const GRADE_REGEXES = buildGradeRegexes();

/**
 * The compiled classifier regex (built once).
 * @category Science Helpers
 * @group Regex Patterns
 * @document ./REAGENT_GRADE_PATTERN.md
 * @see https://regex101.com/r/BJV88C/11
 */
export const GRADE_REGEX = GRADE_REGEXES.classifier;

/**
 * Companion to {@link GRADE_REGEX} for labeled fields ("Grade: Technical"), where an
 * explicit label licenses a bare word-grade stem that would otherwise be too weak to
 * classify. Tried only when {@link GRADE_REGEX} finds nothing.
 *
 * @category Science Helpers
 * @group Regex Patterns
 */
export const LABELED_GRADE_REGEX = GRADE_REGEXES.labeled;

/**
 * The regex source string — paste into regex101 (ECMAScript flavor) to inspect.
 * @category Science Helpers
 * @group Regex Patterns
 * @document ./REAGENT_GRADE_PATTERN.md
 * @see https://regex101.com/r/BJV88C/11
 */
export const GRADE_REGEX_SOURCE = GRADE_REGEX.source;

/**
 * Extracts a chemical grade from a string. Recognizes the grade written inline in a product
 * title ("SODIUM, REAGENT (ACS) - 500 G") as well as written as a labeled field
 * ("Grade: Technical"). Falls back to `"Ungraded"` rather than `undefined`, so the Purity
 * column always has something to show.
 * @category Science Helpers
 * @group Parsers
 * @see https://regex101.com/r/BJV88C/11
 * @document ./REAGENT_GRADE_PATTERN.md
 * @param value - The string to extract the grade from (e.g. a product title)
 * @returns The grade label (e.g. `"ACS Grade"`), or `"Ungraded"` if none is found
 * @example
 * ```typescript
 * parseGrade("SODIUM, REAGENT (ACS) - 500 G")   // Returns "ACS Grade"
 * parseGrade("SODIUM CHLORITE, 80% TECHNICAL")  // Returns "Technical Grade"
 * parseGrade("Citric acid, BP/USP")             // Returns "USP Grade"
 * parseGrade("Grade: Technical")                // Returns "Technical Grade"
 * parseGrade("Sodium, Reagent (NF) - 500 G")    // Returns "NF Grade"
 * parseGrade("SODIUM NITRATE, 99.999% - 50 G")  // Returns "Ungraded"
 * ```
 * @source
 */
export const parseGrade = (value: string): string => {
  return matchGrade(value) ?? "Ungraded";
};

/**
 * Runs both grade regexes over a string and resolves the winning named group to its label.
 * The group *name* is the answer (`Reagent_Grade` becomes `"Reagent Grade"`), not the matched text, so
 * callers must never read a positional group — the bodies contain their own inner groups, which
 * makes `match[1]` meaningless. Shared by {@link parseGrade} and {@link extractGrade}; the
 * difference is only what they do with a miss.
 * @category Science Helpers
 * @group Parsers
 * @param value - The string to classify (a product title, or one line of product copy)
 * @returns The grade label (e.g. `"Reagent Grade"`), or `undefined` if nothing matched
 * @source
 */
const matchGrade = (value: string): string | undefined => {
  const trimmed = value.trim();
  // The classifier is the specific signal, so it wins; the labeled form only fills
  // the gap it leaves for bare word-grade stems ("Grade: Reagent").
  const matches = GRADE_REGEX.exec(trimmed) ?? LABELED_GRADE_REGEX.exec(trimmed);
  if (!matches?.groups) return undefined;

  const hits = Object.entries(matches.groups).filter(([, v]) => Boolean(v));
  if (hits.length === 0) return undefined;
  if (hits.length > 1) {
    console.warn(
      `Multiple grades found in "${value}": ${hits.map(([k]) => k).join(", ")}, returning first`,
    );
  }

  return hits[0][0].replace(/_/g, " ");
};

/**
 * Converts a purity grade to a representative percentage.
 *
 * NOTE: chemical grades are *specifications*, not fixed purities — the real
 * assay minimum for a given grade varies by chemical, and the lower grades
 * (lab/pure/practical/technical) have no formally defined standard at all.
 * These values are therefore representative figures chosen to rank grades in
 * the correct order, intended only for sorting/comparison — not as assays.
 * Ties within a tier are intentional (e.g. USP/BP/JP/NF are ~equivalent).
 *
 * Ordering follows the standard hierarchy (highest→lowest):
 * HPLC &gt; ACS &gt; Reagent ≈ AR ≈ Guaranteed &gt; USP ≈ BP ≈ JP ≈ NF &gt; Pharma ≈ FCC &gt;
 * Cosmetic ≈ Extraction ≈ Lab &gt; Pure ≈ Practical &gt; Technical ≈ Industrial &gt; Low &gt; Impure
 *
 * Note `"Impure"` maps to `0`, which is a value, not a miss — only `"Ungraded"` and
 * unrecognised labels return `undefined`.
 * @category Science Helpers
 * @group Converters
 * @param grade - The grade label (as returned by `parseGrade`, e.g. "ACS Grade")
 * @returns A representative purity %, or `undefined` if unrecognised
 * @example
 * ```typescript
 * purityGradeToPercentage("ACS Grade")       // 99.8
 * purityGradeToPercentage("USP Grade")       // 99.5
 * purityGradeToPercentage("Technical Grade") // 90
 * purityGradeToPercentage("Impure")          // 0
 * purityGradeToPercentage("Ungraded")        // undefined
 * ```
 * @source
 */
export const purityGradeToPercentage = (grade: string): number | undefined => {
  switch (grade) {
    // ── Instrumental / analytical: highest purity ──
    case "HPLC Grade": // low interfering impurities; solvents typically ≥99.9%
      return 99.9;
    case "ACS Grade": // meets/exceeds ACS reagent specs — top of the standard hierarchy
      return 99.8;
    case "AR Grade": // Analytical Reagent — high purity, ≈ ACS
    case "Guaranteed Grade": // "Guaranteed Reagent" (GR) — high purity, ≈ ACS
    case "Reagent Grade": // almost as stringent as ACS
      return 99.7;

    // ── Pharmacopeia (food/drug-acceptable) ──
    case "USP Grade": // meets US Pharmacopeia; equivalent to ACS for many drugs
    case "BP Grade": // British Pharmacopoeia
    case "JP Grade": // Japanese Pharmacopoeia
    case "NF Grade": // National Formulary
      return 99.5;
    case "Pharma Grade": // generic pharmaceutical
    case "FCC Grade": // Food Chemicals Codex — food-safe
      return 99.0;

    // ── Intermediate: good quality, no strict assay floor ──
    case "Cosmetic Grade":
    case "Extraction Grade": // rough guess — not part of a formal purity hierarchy
    case "Lab Grade": // high quality, exact impurities unknown; education use
      return 98.0;

    // ── No official standard ──
    case "Pure Grade": // "pure"/"purified" — good quality, meets no official standard
    case "Practical Grade": // same tier as purified
      return 95.0;

    // ── Commercial / industrial: lowest ──
    case "Technical Grade": // industrial/processing use; not for food/drug
    case "Industrial Grade":
      return 90.0;

    case "Low Grade":
      return 50.0;

    case "Impure":
      return 0.0;
    // "Ungraded" and anything unrecognised fall through to undefined.
    default:
      return undefined;
  }
};

/**
 * Recognized chemical grade / standard designations, in match-priority order. The first
 * pattern that matches wins, so specific standards (ACS, USP, …) precede the generic
 * "Reagent"/"Technical" grades they often accompany (e.g. "Reagent (ACS)" → "ACS").
 * Two-letter pharmacopoeia codes also accept their spelled-out names.
 */
// const GRADE_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
//   // ACS - Highest purity; often equals or exceeds the latest purity standards
//   // set by the American Chemical Society (ACS). This is the only universally
//   // accepted standard. Chemicals are of the highest purity attainable.
//   // @see https://regex101.com/r/K7K8pJ/1
//   { label: "ACS", pattern: /\bACS(?:\s+grade)?\b/i },
//   // AR grade chemicals, also known as Analytical Reagent grade chemicals, are
//   // chemicals that meet the specifications outlined for analytical applications
//   // in laboratories.
//   // @see https://regex101.com/r/aFQ8GL/1
//   { label: "AR", pattern: /\b(?:AR|(?:analytical(?:\s*reagent)?))(?:\s+grade)?\b/ },
//   // USP grade meets the purity levels set by the United States Pharmacopeia
//   // (USP). USP grade is equivalent to the ACS grade for many drugs.
//   // @see https://regex101.com/r/CcKeAu/1
//   {
//     label: "USP",
//     pattern: /\b(?:USP|(?:(?:united\s+states)|US)\s+(?:pharma(?:copeia)?))(?:\s+grade)?\b/,
//   },
//   // NF grade is a purity grade set by the National Formulary (NF). NF grade
//   // is equivalent to the ACS grade for many drugs.
//   // @see https://regex101.com/r/pDoGJH/1
//   { label: "NF", pattern: /\b(?:NF|national\s+formulary)(?:\s+grade)?\b/ },
//   // FCC Products meet the strength specifications and maximum impurity limit
//   // indicated in the Food Chemicals Codex (FCC) which is an internationally
//   // recognized purity and quality standard.
//   // @see https://regex101.com/r/12d90l/1
//   {
//     label: "FCC",
//     pattern: /\b(?:FCC|(?:fcc\s+grade)|(?:food\s+chem(?:icals)?\s+codex))(?:\s+grade)?\b/,
//   },
//   { label: "HPLC", pattern: /\bHPLC(?:\s+grade)?\b/i },
//   // British Pharmacopoeia: Meets or exceeds requirements set by the British
//   // Pharmacopoeia (BP). Can be used for food, drug, and medical purposes,
//   // and also for most laboratory purposes.
//   // @see https://regex101.com/r/sHLZka/2
//   { label: "BP", pattern: /\b(?:BP|(?:british\s+pharma(?:cop(?:o?eia)?)?))(?:\s+grade)?\b/ },
//   // Japanese Pharmacopeia: Meets or exceeds requirements set by the Japanese
//   // Pharmacopoeia (JP). Can be used for food, drug, and medical purposes, and
//   // also for most laboratory purposes.
//   // @ see https://regex101.com/r/zlAyX4/2
//   { label: "JP", pattern: /\b(?:JP|(?:japanese\s+pharma(?:cop(?:o?eia)?)?))(?:\s+grade|Grade)?\b/ },
//   // Good quality chemical grade used for many commercial and industrial purposes.
//   // @see https://regex101.com/r/O7DQWN/1
//   { label: "Technical", pattern: /\b(?:tech(?:nical)?(?:\s+grade)?)\b/i },
//   // Reagent grade is almost as stringent as the ACS grade.
//   { label: "Reagent", pattern: /\b(?:Reagent|Reagent Grade)\b/i },
//   // LR grade chemicals refer to chemicals that meet the specifications outlined
//   // by the Laboratory Reagent (LR) grade
//   { label: "Laboratory", pattern: /\bL(ab(oratory)|R)?\b/ },
// ];

/**
 * Extracts a chemical grade / standard designation from a string (typically a product
 * title), independent of {@link parsePurity}. Recognizes ACS, AR, USP, NF, FCC, HPLC, BP
 * (British Pharmacopoeia), JP (Japanese Pharmacopeia), Technical, and Reagent. When a
 * title carries more than one (e.g. "Reagent (ACS)"), the most specific standard wins.
 * Use only where grades are known to be meaningful (e.g. Chemsavers), since two-letter
 * codes are collision-prone in free text.
 * @category Science Helpers
 * @group Types
 * @param value - The string to extract the grade from
 * @returns The canonical grade label (e.g. `"ACS"`), or nothing if none is found
 * @example
 * ```typescript
 * parseGrade("SODIUM, REAGENT (ACS) - 500 G")      // Returns "ACS"
 * parseGrade("SODIUM CHLORITE, 80% TECHNICAL")     // Returns "Technical"
 * parseGrade("Citric acid, BP/USP")                // Returns "USP"
 * parseGrade("SODIUM NITRATE, 99.999% - 50 G")     // Returns nothing
 * ```
 * @source
 */
// export const parseGrade = (value: string): string | undefined => {
//   if (!value || typeof value !== "string") return;
//   for (const { label, pattern } of GRADE_PATTERNS) {
//     if (pattern.test(value)) return label;
//   }
// };

/**
 * Structured chemical properties pulled out of a supplier's free-form product copy.
 * Every field is optional — only the values actually present (and valid) are returned.
 * @category Science Helpers
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
  /** Grade as a string (e.g. "ACS Grade"). */
  grade?: string;
}

// Unicode subscript digit glyphs (₀–₉) mapped to ASCII so a formula written with real subscript
// characters (e.g. C₆H₅Na₃O₇) is captured whole rather than truncated at the first non-ASCII glyph
// ("C"). The variable repeat-unit indices (ₙ/ₘ/ₓ) are deliberately left as glyphs so
// findFormulaInText recognizes them as polymer repeat units; superscripts (charges) too.
const SUBSCRIPT_GLYPH_TO_ASCII: Record<string, string> = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
};

// Wix suppliers bury specs in HTML accordions and bullet lists. Flatten that markup to one value
// per line — break on block/list/break tags, drop remaining tags, decode entities, then collapse
// runs of non-newline whitespace — so the label/value matchers below work line-by-line.
const normalizeSpecText = (html: string): string =>
  decodeHTMLEntities(
    html
      // Drop sub/sup wrappers without inserting whitespace, so subscripted formulas stay intact
      // (e.g. C<sub>6</sub>H<sub>15</sub>NO<sub>3</sub> -> C6H15NO3 rather than "C 6 H 15 NO 3").
      .replace(/<\/?su[bp]\b[^>]*>/gi, "")
      .replace(/<\/(?:p|li|ul|ol|div|tr|h[1-6])>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[₀-₉]/g, (glyph) => SUBSCRIPT_GLYPH_TO_ASCII[glyph] ?? glyph)
    .replace(/[^\S\n]+/g, " ");

// A label — optionally carrying a parenthetical qualifier, e.g. "Chemical Formula (Repeating
// Unit)" — followed by an optional separator (":", "-", "#", "=", em/en dashes) and the value.
// The value may start with "(" and end in a repeat-unit index glyph (ₙ/ₘ/ₓ), so a parenthesized
// polymer repeating unit (e.g. "(C3H3NaO2)ₙ") is captured whole for findFormulaInText to validate.
const FORMULA_REGEX =
  /(?:molecular\s+formula|\bformula\b)(?:\s*\([^)]*\))?\s*[:#=–—-]*\s*([A-Za-z(][A-Za-z0-9()·.ₙₘₓ]*)/i;
const SMILES_LABEL_REGEX = /\bsmiles\b\s*[:#=–—-]*\s*(\S+)/i;
const PURITY_PERCENT_REGEX = /(\d{1,3}(?:\.\d+)?)\s*\+?\s*%/;

// --- Molar-mass matching (see findMolarMass) -------------------------------------------------
// Recognized molar-mass labels: full ("molecular weight/mass", "molar mass"), abbreviated
// ("mol. wt", "formula weight"), and symbols ("MW", "M.W.", "Mr", "RMM", "RFM", "FW"). Wrapped in
// letter boundaries at the call sites so short forms aren't matched inside longer words.
// The bare "mol" alternative only counts as a label when a ":"/"=" follows (as in this catalog's
// "mol : 247.18"), so it isn't matched inside a unit like "g/mol" or words like "moles".
const MOLAR_MASS_LABEL =
  "(?:molecular\\s+(?:weight|mass)|molar\\s+(?:mass|weight|wt)|mol(?:ecular)?\\.?\\s*(?:weight|wt|mass)|formula\\s+(?:weight|wt)|m\\.?\\s*w\\.?|m\\.?\\s*wt\\.?|mr|rmm|rfm|fw|mol(?=\\s*[:=]))";
// A molar-mass unit in its common spellings: g/mol, g·mol⁻¹, g mol-1, kg/mol, Da/kDa/dalton, amu.
const MOLAR_MASS_UNIT =
  "(?:g\\s*[./·⋅]?\\s*mol(?:e|s|ar)?(?:\\s*[-−⁻‑]\\s*(?:1|¹))?|kg\\s*[./·⋅]?\\s*mol(?:e|s)?|k?da(?:ltons?)?|amu)";
// Between label and value: optional parenthetical (e.g. "(M)"/"(Mr)") and punctuation separators.
const MOLAR_MASS_SEP = "\\s*(?:\\([^)]*\\))?\\s*[:#=–—-]*\\s*";
// A numeric value with optional grouping/decimal separators (US or EU), starting and ending on a
// digit so trailing punctuation isn't captured. parseLocalizedNumber disambiguates "," vs ".".
const MOLAR_MASS_NUMBER = "(\\d[\\d.,]*\\d|\\d)";
// Letter boundaries (case-insensitive) so "MW"/"Mr"/"FW" aren't matched mid-word.
const NOT_LETTER_BEFORE = "(?<![a-z])";
const NOT_LETTER_AFTER = "(?![a-z])";

// Tiered by confidence: labelled value with a unit, then a bare "<number> <unit>", then a labelled
// value without a unit. Earlier tiers are preferred so the most unambiguous reading wins.
const MOLAR_MASS_LABELED_UNIT = new RegExp(
  `${NOT_LETTER_BEFORE}${MOLAR_MASS_LABEL}${NOT_LETTER_AFTER}${MOLAR_MASS_SEP}${MOLAR_MASS_NUMBER}\\s*${MOLAR_MASS_UNIT}`,
  "i",
);
const MOLAR_MASS_UNIT_ONLY = new RegExp(`${MOLAR_MASS_NUMBER}\\s*${MOLAR_MASS_UNIT}`, "i");
const MOLAR_MASS_LABELED = new RegExp(
  `${NOT_LETTER_BEFORE}${MOLAR_MASS_LABEL}${NOT_LETTER_AFTER}${MOLAR_MASS_SEP}${MOLAR_MASS_NUMBER}`,
  "i",
);

// --- Molarity / concentration matching (see findMolarity) ------------------------------------
// A molar concentration written as "<number> M" or "<number> mol/L", optionally a range
// ("1-2 M"). Deliberately NOT case-insensitive: the unit must be a capital "M" (molar) so a
// lowercase "m" (milli, e.g. "500ml") is never mistaken for it, and "mol/L" is matched literally.
// The number is 1-2 integer digits with an optional decimal, so quantities like "150" (mL) don't
// start a match. Groups: 1 = low value, 2 = optional high value (range), 3 = unit.
const MOLARITY_REGEX =
  /\b([0-9]{1,2}(?:\.[0-9]+)?)\s*(?:(?:-|to)\s*([0-9]{1,2}(?:\.[0-9]+)?)\s*)?(M|mol\/L)\b/;

/**
 * Parses a numeric token that may use US or European grouping/decimal conventions into a number.
 * When both `.` and `,` are present the last-occurring one is treated as the decimal separator and
 * the other as thousands grouping; a single `,` or `.` is treated as a decimal point (so European
 * `149,19` reads as `149.19`); repeated separators of one kind are treated as grouping only.
 * @category Science Helpers
 * @group Parsers
 * @param raw - The numeric token (e.g. "149,19", "1.234,56", "1,234.56", "40")
 * @returns The parsed number (may be `NaN` if the token holds no digits)
 * @example
 * ```typescript
 * parseLocalizedNumber("149,19")    // 149.19
 * parseLocalizedNumber("1.234,56")  // 1234.56
 * parseLocalizedNumber("1,234.56")  // 1234.56
 * parseLocalizedNumber("40")        // 40
 * ```
 * @source
 */
export const parseLocalizedNumber = (raw: string): number => {
  const commaCount = (raw.match(/,/g) ?? []).length;
  const dotCount = (raw.match(/\./g) ?? []).length;
  // Both separators present: the last-occurring one is the decimal, the other groups thousands.
  if (commaCount > 0 && dotCount > 0) {
    const decimal = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? "," : ".";
    const grouping = decimal === "," ? /\./g : /,/g;
    return Number(raw.replace(grouping, "").replace(decimal, "."));
  }
  // A single comma or single dot is a decimal separator (handles EU "149,19" and US "140.22").
  if (commaCount === 1) return Number(raw.replace(",", "."));
  if (dotCount === 1) return Number(raw);
  // No separator, or repeated separators used purely for grouping (e.g. "1,234,567").
  return Number(raw.replace(/[.,]/g, ""));
};

/**
 * Finds the first molar mass / molecular weight in a free-form string and returns it as a number.
 * Built to be run over large, messy scraped text the way {@link findFormulaInText} is: labels,
 * separators, and unit spellings vary widely across suppliers and locales, so each is matched
 * tolerantly. Matching is tiered by confidence — a labelled value carrying a unit
 * (`Molar mass (M) 149,19 g/mol`), then a bare `<number> <unit>` (`58.44 g/mol`), then a labelled
 * value with no unit (`M.W. 415.6`) — and the value is parsed with {@link parseLocalizedNumber} so
 * European decimal commas are handled. Returns `undefined` when no plausible molar mass is present,
 * so unrelated numbers (melting points, densities, prose) are not mistaken for one.
 * @category Science Helpers
 * @group Parsers
 * @see https://regex101.com/r/8rqk6N/1
 * @param text - Raw text or HTML that may contain a molar mass anywhere within it
 * @returns The molar mass in g/mol as a positive number, or undefined when none is found
 * @example
 * ```typescript
 * findMolarMass("Molar mass (M) 149,19 g/mol")   // 149.19
 * findMolarMass("MW - 136.169 G/MOL")            // 136.169
 * findMolarMass("M.W. 415.6")                    // 415.6
 * findMolarMass("Mp : 288 - 296°C")              // undefined
 * ```
 * @source
 */
export const findMolarMass = (text: string): number | undefined => {
  if (!text || typeof text !== "string") return undefined;
  // Strip markup and decode entities so labels/values/units match on plain text.
  const clean = decodeHTMLEntities(text.replace(/<[^>]+>/g, " "));
  const match =
    clean.match(MOLAR_MASS_LABELED_UNIT) ??
    clean.match(MOLAR_MASS_UNIT_ONLY) ??
    clean.match(MOLAR_MASS_LABELED);
  if (!match) return undefined;
  const value = parseLocalizedNumber(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

/**
 * Pulls a molar concentration (molarity) out of free-form product copy — the "1.5M", "0.2M",
 * "1M", or "1.5 mol/L" that suppliers bake into titles and descriptions — and returns it as a
 * normalized string suitable for the product's `concentration` field. The unit must be a capital
 * "M" or literal "mol/L" (see `MOLARITY_REGEX`), so a lowercase "m" (milli, e.g. "500ml") is
 * never mistaken for molarity. Returns `undefined` when no molarity is present.
 * @category Science Helpers
 * @group Parsers
 * @see https://regex101.com/r/8rqk6N/1
 * @param text - Raw text (title or description) that may contain a molarity anywhere within it
 * @returns The molarity as a normalized string (e.g. `"1.5 M"`, `"1-2 M"`), or undefined
 * @example
 * ```typescript
 * findMolarity("Potassium Nitrate: EZ-Prep - Makes 150ml of 1.5M Solution") // "1.5 M"
 * findMolarity("demo kit with 12% hydrogen peroxide, 0.2M potassium iodate") // "0.2 M"
 * findMolarity("Potassium Iodide Solution, 1M, 500mL")                       // "1 M"
 * findMolarity("Sodium chloride, 500 g")                                     // undefined
 * ```
 * @source
 */
export const findMolarity = (text: string): string | undefined => {
  if (!text || typeof text !== "string") return undefined;
  const match = text.match(MOLARITY_REGEX);
  if (!match) return undefined;
  const [, low, high, unit] = match;
  const value = high ? `${low}-${high}` : low;
  return `${value} ${unit}`;
};

/**
 * Pulls a purity percentage from messy, multi-line product copy. Unlike {@link parsePurity}, this
 * only trusts a percentage that sits on a line mentioning "purity" — so a stray "50% brine" in a
 * description is ignored — and tolerates the `98%+`, `99+%`, and `99-100%` shapes suppliers use.
 * @category Science Helpers
 * @group Parsers
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
 * Extracts a grade from a line of text.
 * @category Science Helpers
 * @group Parsers
 * @param lines - The normalized, line-split product copy
 * @returns The grade as a string, or undefined if none is found
 * @source
 */
const extractGrade = (lines: string[]): string | undefined => {
  for (const line of lines) {
    if (!/grade/i.test(line)) continue;
    const grade = matchGrade(line);
    if (grade) return grade;
  }
  return undefined;
};

/**
 * Extracts structured chemical properties (purity, molecular formula, molecular weight, SMILES)
 * from a supplier's free-form, HTML-laced product copy. Built for Wix suppliers whose specs live
 * inside descriptions and additional-info accordions as loosely-labelled bullet lists — labels and
 * separators vary wildly (`MW -`, `Molecular mass :`, `Formula:`), so each field is matched
 * tolerantly and validated before being returned. CAS numbers are intentionally left to
 * `findCAS` (in helpers/cas), which already searches free text robustly.
 * @category Science Helpers
 * @group Parsers
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
  const grade = extractGrade(lines);

  if (purity !== undefined) specs.purity = purity;
  if (grade !== undefined) specs.grade = grade;

  // Iterate every "…formula…" match and keep the first candidate that validates: the copy may say
  // "the rough formula is C6H15NO3" (capturing the word "is") before the real "Empirical formula
  // C6H15NO3", and a single match would stop at the bogus first hit. Clean single formulas (e.g.
  // "NaOH") are kept verbatim; salts/adducts joined by a dot (e.g. "C6H15NO3.H3PO4") aren't valid
  // isMoleForm, so fall back to the tolerant finder.
  for (const formulaMatch of text.matchAll(new RegExp(FORMULA_REGEX.source, "gi"))) {
    const rawFormula = formulaMatch[1];
    const formula = isMoleForm(rawFormula) ? rawFormula : findFormulaInText(rawFormula);
    if (formula) {
      specs.formula = formatFormula(formula);
      break;
    }
  }

  const molecularWeight = findMolarMass(text);
  if (molecularWeight !== undefined) specs.molecularWeight = molecularWeight;

  const smilesMatch = text.match(SMILES_LABEL_REGEX);
  if (smilesMatch && looksLikeSmiles(smilesMatch[1])) specs.smiles = smilesMatch[1];

  return specs;
};

// The adduct/hydrate separator: U+22C5 "DOT OPERATOR".
const ADDUCT_DOT = "\u22C5";

// Characters that could be used as adduct dot operators (eg: ⋅᛫•‧⋄)
const TARGET_ADDUCT_DOTS = ["\\.", "\u00b7", "\u16eb", "\u2022", "\u2027", "\u22c4"];

/**
 * Formats a plain-ASCII chemical formula with proper Unicode notation: periods that join formula
 * units become an adduct/hydrate dot (⋅), and atom-count digits become subscripts. Digits that are
 * leading stoichiometric coefficients — those at the start of a unit, after a space, or right after
 * the adduct dot — are left full-size, since their preceding character isn't an atom or bracket.
 * Intended for formulas that arrive as plain text (no `<sub>` markup); tagged formulas should go
 * through {@link findFormulaInHtml} instead.
 * @category Science Helpers
 * @group Formatters
 * @param formula - A plain-ASCII formula, e.g. "C6H15NO3.5H3PO4"
 * @returns The formula with subscripted atom counts and adduct dots, e.g. "C₆H₁₅NO₃⋅5H₃PO₄"
 * @example
 * ```typescript
 * formatFormula("C6H15NO3")        // "C₆H₁₅NO₃"
 * formatFormula("C6H15NO3.H3PO4")  // "C₆H₁₅NO₃⋅H₃PO₄"
 * formatFormula("C6H15NO3.5H3PO4") // "C₆H₁₅NO₃⋅5H₃PO₄"
 * formatFormula("NaOH")            // "NaOH"
 * ```
 * @source
 */
export function formatFormula(formula: string): string {
  return (
    formula
      // 1. period(s) between formula units → adduct dot
      .replace(new RegExp(`(${TARGET_ADDUCT_DOTS.join("|")})`, "g"), ADDUCT_DOT)
      // 2. a run of digits directly after an atom (letter), ) or ] → subscript.
      //    Digits after the start, a space, or the adduct dot are stoichiometric
      //    coefficients, so their preceding char isn't a letter/bracket → skipped.
      .replace(/(?<=[A-Za-z)\]])\d+/g, subscript)
  );
}

/**
 * Converts a purity value — either a grade label or a percentage — to a number the Purity
 * column can sort on. Grades route through {@link purityGradeToPercentage}; everything else
 * is read as the FIRST number in the string, so a range sorts on its lower bound and a
 * trailing qualifier ("+", "or better") is ignored. Anything unreadable sorts as `0`.
 * @category Science Helpers
 * @group Converters
 * @param grade - The grade label or percentage to convert (e.g. `"ACS Grade"`, `"≥99.8%"`)
 * @returns A number in `[0, 100]`; `0` when no grade or number can be read
 * @example
 * ```typescript
 * sortablePurityGrade("95%")           // Returns 95
 * sortablePurityGrade("ACS Grade")     // Returns 99.8
 * sortablePurityGrade("USP Grade")     // Returns 99.5
 * sortablePurityGrade("99.9+%")        // Returns 99.9
 * sortablePurityGrade("99.9-100%")     // Returns 99.9 (lower bound of the range)
 * sortablePurityGrade("99,5%")         // Returns 99.5 (European comma decimal)
 * sortablePurityGrade("120%")          // Returns 100 (clamped)
 * sortablePurityGrade("Ungraded")      // Returns 0
 * ```
 * @source
 */
export function sortablePurityGrade(grade: string): number {
  if (grade.endsWith(" Grade")) return purityGradeToPercentage(grade) ?? 0;

  // First number only. Stripping every non-digit instead would splice a range's two
  // bounds into one bogus number ("99.9-100%" -> "99.9100").
  const match = grade.match(/\d+(?:[.,]\d+)?/);
  if (!match) return 0;

  const num = Number(match[0].replace(",", "."));
  if (Number.isNaN(num) || num < 0) return 0;
  return Math.min(num, 100);
}
