/**
 * Encodes a string to be used in a URL.
 * @param str - The string to encode
 * @returns The encoded string
 * @category Helpers
 * @example
 * ```typescript
 * const encoded = urlencode("Hello, world! - 95% ethanol");
 * // Returns a value with only safe characters:
 * //    "Hello%2C+world%21+-+95%25+ethanol"
 * ```
 */
export default function urlencode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/%20/g, "+");
}
