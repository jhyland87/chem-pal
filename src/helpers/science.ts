import {
  SUBSCRIPT_GLYPHS,
  SUBSCRIPTS,
  SUPERSCRIPT_GLYPHS,
  SUPERSCRIPTS,
} from "@/constants/science";
import { looksLikeSmiles } from "@/helpers/smiles";
import { decodeHTMLEntities, isMoleForm } from "@/helpers/utils";

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
  // Subscript digits are contiguous from U+2080 (₀), so ₀–₉ is just 0x2080 + the digit.
  return str.replace(/[0-9]/g, (d) => String.fromCodePoint(0x2080 + Number(d)));
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
  // Valid element symbols (all 118). Gates the match so prose isn't read as a formula.
  const element =
    "(?:H[eogsf]?|L[iavru]|B[eahkri]?|C[arofmusenld]?|N[eiahopdb]?|O[sg]?|F[rlem]?|M[godtcn]|A[lrsgutmc]|S[icerngmb]?|P[uabotmrd]?|Kr?|T[icebmsalh]|V|Z[nr]|G[ade]|R[buhenagf]|Yb?|I[nr]?|Xe|E[urs]|D[ysb]|W|U)";

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

  // The looser "sub/sup or inline digit" count used inside a unit.
  const subPart = `(?:${subSup}|[1-9][0-9]*)`;
  // One "unit": a run of elements/brackets, then any trailing subscripts.
  const unit = `(?:(?:${element}|[()\\[\\]])+(?:${subPart})*)`;
  // The head must look like a formula and not prose: either ≥2 element/bracket units, or a single
  // element carrying a subscript/superscript (e.g. "H₂"). A lone bare element, or a single element
  // with only an inline digit (e.g. "B12" in prose), is intentionally not enough.
  const head = `(?:(?:${unit}){2,}|(?:${element}|[()\\[\\]])+${subSup})`;
  // An optional ionic charge sign. The lookahead (not followed by a letter/digit) keeps it from
  // grabbing an ordinary hyphen inside a word like "CO-op", while still allowing "K+", "…F₃-.K+".
  const charge = "(?:[+-](?![A-Za-z0-9]))?";
  // Salt/hydrate separator: a spaced dot ("·"/"•"/"‧"/"∙"/"⋅"/"・"/"･"/"*"), OR a tight "." that is
  // immediately followed by a component (so it ignores sentence periods and decimal points). The
  // several dot code points cover the visually identical characters different data sources emit.
  const separator = "(?:\\s*[·•‧∙⋅・･*]\\s*|\\.(?=[A-Za-z(\\[]))";
  // A leading coefficient after a separator: a sub/sup number, an integer or fraction (e.g. "12",
  // "1/2"), or a variable hydrate count (x/n).
  const coefficient = `(?:${subSup}|[1-9][0-9]*(?:/[1-9][0-9]*)?|[xn])`;

  // A lone element (e.g. "Na", "K+") is a valid formula, but only when it is the entire trimmed
  // input — anchoring keeps a bare symbol from being pulled out of prose (e.g. "I" from "I love …").
  const trimmed = text.trim();
  if (new RegExp(`^${element}${charge}$`).test(trimmed)) {
    return trimmed;
  }

  // The whole formula: the head (+optional charge), then any number of
  // "separator coefficient? units (+optional charge)" salt/hydrate components.
  const pattern = new RegExp(
    `((?![^<>]*>)${head}${charge}(?:${separator}(?:${coefficient})?${unit}+${charge})*)`,
  );

  const match = text.match(pattern);
  if (!match) {
    return;
  }
  return match[0]
    .replace(/<sub>(\d+)<\/sub>/g, (_match, p1) => subscript(p1 || ""))
    .replace(/<sup>(\d+)<\/sup>/g, (_match, p1) => superscript(p1 || ""))
    .replace(/\\u208[0-9](?:\\u208[0-9])*/g, (match) => subscriptGlyph(match))
    .replace(/(?:\\u00[bB][239]|\\u207[4-9])(?:\\u2070|\\u00[bB][239]|\\u207[4-9])*/g, (match) =>
      superscriptGlyph(match),
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
  // Valid element symbols. Gates the match so prose isn't read as a formula.
  const element =
    "(?:H[eogsf]?|L[iavru]|B[eahkri]?|C[arofmusenld]?|N[eiahopdb]?|O[sg]?|F[rle]?|M[godtcn]|A[lrsgutmc]|S[icerngmb]?|P[uabotmrd]?|Kr?|T[icebmsalh]|V|Z[nr]|G[ade]|R[buhenagf]|Yb?|I[nr]?|Xe|E[urs]|D[ysb]|W|U)";
  // A <sub>/<sup>-tagged subscript, and the looser "tagged or inline" subscript.
  const taggedSub = "<su[bp]>[1-9][0-9]*</su[bp]>";
  const subPart = `(?:${taggedSub}|[1-9][0-9]*)`;
  // One "unit": a run of elements/brackets, then any trailing subscripts.
  const unit = `(?:(?:${element}|[()\\[\\]])+(?:${subPart})*)`;
  // The head must look like a formula and not prose: either ≥2 element/bracket units, or a single
  // element carrying a *tagged* subscript (e.g. "H<sub>2</sub>"). A lone bare element, or a single
  // element with only an inline digit (e.g. "B12" in prose), is intentionally not enough — those
  // clean cases are handled by isMoleForm upstream.
  const head = `(?:(?:${unit}){2,}|(?:${element}|[()\\[\\]])+${taggedSub})`;
  // An optional ionic charge sign. The lookahead (not followed by a letter/digit) keeps it from
  // grabbing an ordinary hyphen inside a word like "CO-op", while still allowing "K+", "…F₃-.K+".
  const charge = "(?:[+-](?![A-Za-z0-9]))?";
  // Salt/hydrate separator: a spaced "·"/"•"/"*", OR a tight "." that is immediately followed by
  // a component (so it ignores sentence periods and decimal points).
  const separator = "(?:\\s*[·•*]\\s*|\\.(?=[A-Za-z(\\[]))";
  // A leading coefficient after a separator: a <sub>number</sub>, an integer or fraction (e.g.
  // "12", "1/2"), or a variable hydrate count (x/n).
  const coefficient = "(?:<su[bp]>[1-9][0-9]*</su[bp]>|[1-9][0-9]*(?:/[1-9][0-9]*)?|[xn])";
  // The whole formula: the head (+optional charge), then any number of
  // "separator coefficient? units (+optional charge)" salt/hydrate components.
  const pattern = new RegExp(
    `((?![^<>]*>)${head}${charge}(?:${separator}(?:${coefficient})?${unit}+${charge})*)`,
  );
  const match = html.match(pattern);
  if (!match) {
    return;
  }
  return match[0]
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
 * Recognized chemical grade / standard designations, in match-priority order. The first
 * pattern that matches wins, so specific standards (ACS, USP, …) precede the generic
 * "Reagent"/"Technical" grades they often accompany (e.g. "Reagent (ACS)" → "ACS").
 * Two-letter pharmacopoeia codes also accept their spelled-out names.
 */
const GRADE_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "ACS", pattern: /\bACS\b/i },
  { label: "AR", pattern: /\bAR\b/i },
  { label: "USP", pattern: /\bUSP\b|\bUnited States Pharmacop\w+/i },
  { label: "NF", pattern: /\bNF\b/i },
  { label: "FCC", pattern: /\bFCC\b/i },
  { label: "HPLC", pattern: /\bHPLC\b/i },
  { label: "BP", pattern: /\bBP\b|\bBritish Pharmacop\w+/i },
  { label: "JP", pattern: /\bJP\b|\bJapanese Pharmacop\w+/i },
  { label: "Technical", pattern: /\bTechnical\b/i },
  { label: "Reagent", pattern: /\bReagent\b/i },
];

/**
 * Extracts a chemical grade / standard designation from a string (typically a product
 * title), independent of {@link parsePurity}. Recognizes ACS, AR, USP, NF, FCC, HPLC, BP
 * (British Pharmacopoeia), JP (Japanese Pharmacopeia), Technical, and Reagent. When a
 * title carries more than one (e.g. "Reagent (ACS)"), the most specific standard wins.
 * Use only where grades are known to be meaningful (e.g. Chemsavers), since two-letter
 * codes are collision-prone in free text.
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
export const parseGrade = (value: string): string | undefined => {
  if (!value || typeof value !== "string") return;
  for (const { label, pattern } of GRADE_PATTERNS) {
    if (pattern.test(value)) return label;
  }
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
      // Drop sub/sup wrappers without inserting whitespace, so subscripted formulas stay intact
      // (e.g. C<sub>6</sub>H<sub>15</sub>NO<sub>3</sub> -> C6H15NO3 rather than "C 6 H 15 NO 3").
      .replace(/<\/?su[bp]\b[^>]*>/gi, "")
      .replace(/<\/(?:p|li|ul|ol|div|tr|h[1-6])>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  ).replace(/[^\S\n]+/g, " ");

// A label followed by an optional separator (":", "-", "#", "=", em/en dashes) and the value.
const FORMULA_REGEX =
  /(?:molecular\s+formula|\bformula\b)\s*[:#=–—-]*\s*([A-Za-z][A-Za-z0-9()·.]*)/i;
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

/**
 * Parses a numeric token that may use US or European grouping/decimal conventions into a number.
 * When both `.` and `,` are present the last-occurring one is treated as the decimal separator and
 * the other as thousands grouping; a single `,` or `.` is treated as a decimal point (so European
 * `149,19` reads as `149.19`); repeated separators of one kind are treated as grouping only.
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
const parseLocalizedNumber = (raw: string): number => {
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
 * @category Helpers
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
 * `findCAS` (in helpers/cas), which already searches free text robustly.
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

  // Iterate every "…formula…" match and keep the first candidate that validates: the copy may say
  // "the rough formula is C6H15NO3" (capturing the word "is") before the real "Empirical formula
  // C6H15NO3", and a single match would stop at the bogus first hit. Clean single formulas (e.g.
  // "NaOH") are kept verbatim; salts/adducts joined by a dot (e.g. "C6H15NO3.H3PO4") aren't valid
  // isMoleForm, so fall back to the tolerant finder.
  for (const formulaMatch of text.matchAll(new RegExp(FORMULA_REGEX.source, "gi"))) {
    const rawFormula = formulaMatch[1];
    const formula = isMoleForm(rawFormula) ? rawFormula : findFormulaInText(rawFormula);
    if (formula) {
      specs.formula = formula;
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

/**
 * Formats a plain-ASCII chemical formula with proper Unicode notation: periods that join formula
 * units become an adduct/hydrate dot (⋅), and atom-count digits become subscripts. Digits that are
 * leading stoichiometric coefficients — those at the start of a unit, after a space, or right after
 * the adduct dot — are left full-size, since their preceding character isn't an atom or bracket.
 * Intended for formulas that arrive as plain text (no `<sub>` markup); tagged formulas should go
 * through {@link findFormulaInHtml} instead.
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
      .replace(/\./g, ADDUCT_DOT)
      // 2. a run of digits directly after an atom (letter), ) or ] → subscript.
      //    Digits after the start, a space, or the adduct dot are stoichiometric
      //    coefficients, so their preceding char isn't a letter/bracket → skipped.
      .replace(/(?<=[A-Za-z)\]])\d+/g, subscript)
  );
}
