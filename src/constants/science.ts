/**
 * @group Constants
 * @groupDescription Application-wide constants and enumerations used throughout the codebase.
 * @source
 */

/**
 * A mapping of regular characters to their Unicode subscript equivalents.
 * Used for converting numbers and basic mathematical symbols to subscript format.
 *
 * @example
 * ```typescript
 * SUBSCRIPTS["2"] // Returns "₂"
 * SUBSCRIPTS["+"] // Returns "₊"
 *
 * // Usage in strings
 * const formula = "H" + SUBSCRIPTS["2"] + "O" // Returns "H₂O"
 * ```
 * @source
 */
export const SUBSCRIPTS: { [key: string]: string } = {
  /* eslint-disable */
  /* tslint:disable */
  "0": "\u2080",
  "1": "\u2081",
  "2": "\u2082",
  "3": "\u2083",
  "4": "\u2084",
  "5": "\u2085",
  "6": "\u2086",
  "7": "\u2087",
  "8": "\u2088",
  "9": "\u2089",
  /* eslint-enable */
  /* tslint:enable */
} as const;

/**
 * A mapping of regular characters to their Unicode superscript equivalents.
 * Used for converting numbers and basic mathematical symbols to superscript format.
 * Commonly used for exponents, powers, and scientific notation.
 *
 * @example
 * ```typescript
 * SUPERSCRIPTS["2"] // Returns "²"
 * SUPERSCRIPTS["3"] // Returns "³"
 *
 * // Usage in strings
 * const squared = "x" + SUPERSCRIPTS["2"] // Returns "x²"
 * const scientific = "1.2 × 10" + SUPERSCRIPTS["3"] // Returns "1.2 × 10³"
 * ```
 * @source
 */
export const SUPERSCRIPTS: { [key: string]: string } = {
  /* eslint-disable */
  /* tslint:disable */
  "0": "\u2070",
  "1": "\u00B9",
  "2": "\u00B2",
  "3": "\u00B3",
  "4": "\u2074",
  "5": "\u2075",
  "6": "\u2076",
  "7": "\u2077",
  "8": "\u2078",
  "9": "\u2079",
  /* eslint-enable */
  /* tslint:enable */
} as const;

/**
 * A mapping of ASCII digits to their Unicode subscript glyphs, written as the
 * literal characters (`₀`–`₉`) rather than the `\uXXXX` escapes used
 * by {@link SUBSCRIPTS}. The mapped values are identical to `SUBSCRIPTS` for the
 * digit keys — this is purely the literal-glyph spelling, handy where a source
 * regex needs the visible characters.
 * @example
 * ```typescript
 * SUBSCRIPT_GLYPHS["2"] // Returns "₂"
 * const formula = "H" + SUBSCRIPT_GLYPHS["2"] + "O" // Returns "H₂O"
 * ```
 * @source
 */
export const SUBSCRIPT_GLYPHS: { [key: string]: string } = {
  /* eslint-disable */
  /* tslint:disable */
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  /* eslint-enable */
  /* tslint:enable */
} as const;

/**
 * A mapping of ASCII digits to their Unicode superscript glyphs, written as the
 * literal characters (`⁰`–`⁹`) rather than the `\uXXXX` escapes used
 * by {@link SUPERSCRIPTS}. The mapped values are identical to `SUPERSCRIPTS` for
 * the digit keys — this is purely the literal-glyph spelling, handy where a
 * source regex needs the visible characters.
 * @example
 * ```typescript
 * SUPERSCRIPT_GLYPHS["2"] // Returns "²"
 * const squared = "x" + SUPERSCRIPT_GLYPHS["2"] // Returns "x²"
 * ```
 * @source
 */
export const SUPERSCRIPT_GLYPHS: { [key: string]: string } = {
  /* eslint-disable */
  /* tslint:disable */
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  /* eslint-enable */
  /* tslint:enable */
} as const;
