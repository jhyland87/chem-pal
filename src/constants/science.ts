/**
 * @group Constants
 * @groupDescription Application-wide constants and enumerations used throughout the codebase.
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
