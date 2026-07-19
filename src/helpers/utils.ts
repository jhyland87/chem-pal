import { languages as iso639Languages } from "countries-list";
import { md5 } from "js-md5";
import TurndownService from "turndown";

/**
 * Converts the first character of a string to uppercase.
 * @category Helpers
 * @param str - The string to convert.
 * @returns The string with the first character converted to uppercase.
 * @example
 * ```typescript
 * ucfirst("hello") // Returns "Hello"
 * ucfirst("world") // Returns "World"
 * ucfirst("") // Returns ""
 * ucfirst(null) // Returns null
 * ucfirst(undefined) // Returns undefined
 * ucfirst("123") // Returns "123"
 * ucfirst("123abc") // Returns "123abc"
 * ucfirst("123ABC") // Returns "123ABC"
 * ucfirst("123abcABC") // Returns "123abcABC"
 * ucfirst("123abcABC") // Returns "123abcABC"
 * ```
 * @source
 */
export function ucfirst(str: string): string {
  if (!str) {
    return str;
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * MD5 hash function that handles various input types.
 * Converts input to string representation before hashing.
 *
 * @category Helpers
 * @param input - The input to hash. Can be string, number, object, or null/undefined.
 * @returns The MD5 hash of the input as a string, or the input itself if null/undefined
 * @throws Error if input type is not supported (e.g., Symbol)
 *
 * @example
 * ```typescript
 * md5sum("hello") // Returns "5d41402abc4b2a76b9719d911017c592"
 * md5sum(123) // Returns "202cb962ac59075b964b07152d234b70"
 * md5sum({ foo: "bar" }) // Returns hash of stringified object
 * md5sum(null) // Returns null
 * ```
 * @source
 */
export function md5sum<T>(input: NonNullable<T>): string | T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === "object" && input !== null) {
    return md5(JSON.stringify(input));
  }

  if (typeof input === "number") {
    return md5(String(input));
  }

  if (typeof input !== "string") {
    throw new Error("Unexpected input type: " + typeof input);
  }

  return md5(input);
}

/**
 * Builds a URL-style query string from a plain object.
 * Keys are emitted in insertion order. Array values are comma-joined.
 *
 * @category Helpers
 * @param obj - Object whose entries become `key=value` pairs
 * @returns Query string without a leading `?`
 *
 * @example
 * ```typescript
 * objectToQueryString({ a: 1, b: [2, 3] }); // "a=1&b=2,3"
 * objectToQueryString({ foo: "bar" });      // "foo=bar"
 * ```
 * @source
 */
export function objectToQueryString(obj: Record<string, unknown>): string {
  let qs = "";
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const serialized = value == null ? "" : Array.isArray(value) ? value.join(",") : String(value);
    const part = `${key}=${serialized}`;
    qs = qs ? `${qs}&${part}` : part;
  }
  return qs;
}

/**
 * Base64-encodes a UTF-8 string (raw bytes, not URI-encoded).
 * ASCII-only input uses `btoa` directly.
 *
 * @category Helpers
 * @param str - String to encode
 * @returns Base64 representation
 *
 * @example
 * ```typescript
 * base64EncodeUtf8("hello"); // "aGVsbG8="
 * base64EncodeUtf8("098f6bcd4621d373cade4e832627b4f6"); // MD5 hex digest
 * ```
 * @source
 */
export function base64EncodeUtf8(str: string): string {
  // Intentionally matches the ASCII control range (0x00–0x7f) to detect pure-ASCII input.
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7f]*$/.test(str)) {
    return btoa(str);
  }

  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Opaque base-36 timestamp string (milliseconds + random suffix).
 * Used by some suppliers for cache-busting request IDs.
 *
 * @category Helpers
 * @param timestamp - The timestamp to use (defaults to current time)
 * @returns Base-36 timestamp string
 *
 * @example
 * ```typescript
 * base36Timestamp(); // e.g. "m5x2k1abc4"
 * base36Timestamp(Date.now()); // e.g. "m5x2k1abc4"
 * ```
 * @source
 */
export function base36Timestamp(timestamp: number = Date.now()): string {
  return timestamp.toString(36) + Math.random().toString(36).slice(3);
}

/**
 * Generates an array of page sizes based on the total number of rows.
 * The array starts with the base size and doubles each time until it reaches the total.
 * @category Helpers
 * @param total - The total number of rows
 * @param base - The base size
 * @returns An array of page sizes
 * @example
 * ```typescript
 * generatePageSizes(123);           // [10, 20, 40, 80, 123]
 * generatePageSizes(500, 10, 4);    // [10, 20, 40, 500]
 * generatePageSizes(1000, 10, 3);   // [10, 20, 1000]
 * generatePageSizes(1000, 10, 1);   // [1000]
 * generatePageSizes(1000, 10, 0);   // [1000]
 * ```
 * @source
 */
export function generatePageSizes(total: number, base: number = 10, limit: number = 5): number[] {
  const sizes: number[] = [];

  for (let n = base; n < total; n *= 2) sizes.push(n);

  return [...sizes.slice(0, limit - 1), total];
}

/**
 * Serializes a string to a base64 encoded string.
 * Useful for safely storing strings that may contain special characters.
 * First URI encodes the string, then base64 encodes it.
 *
 * @category Helpers
 * @param data - The string to serialize
 * @returns A base64 encoded string that can be safely stored/transmitted
 *
 * @example
 * ```typescript
 * serialize("Hello World") // Returns "SGVsbG8gV29ybGQ="
 * serialize("Special chars: !@#$") // Returns safely encoded string
 * serialize("Unicode: 你好") // Handles unicode characters
 * ```
 * @source
 */
export function serialize(data: string): string {
  return btoa(encodeURIComponent(data));
}

/**
 * Deserializes a base64 encoded string back to its original form.
 * Reverses the serialize() operation by first base64 decoding,
 * then URI decoding the result.
 *
 * @category Helpers
 * @param data - The base64 encoded string to deserialize
 * @returns The original string that was serialized
 *
 * @example
 * ```typescript
 * deserialize("SGVsbG8gV29ybGQ=") // Returns "Hello World"
 * deserialize(serialize("Special!")) // Returns "Special!"
 * deserialize(serialize("你好")) // Returns "你好"
 * ```
 * @source
 */
export function deserialize(data: string): string {
  return decodeURIComponent(atob(data));
}

/**
 * Creates a promise that resolves after the specified delay.
 * Useful for adding delays in async operations or rate limiting.
 *
 * @category Helpers
 * @param ms - The number of milliseconds to sleep
 * @returns A promise that resolves after the specified delay
 *
 * @example
 * ```typescript
 * async function example() {
 *   console.log("Start");
 *   await sleep(1000); // Waits 1 second
 *   console.log("End"); // Prints after delay
 * }
 *
 * // For rate limiting:
 * for (const item of items) {
 *   await processItem(item);
 *   await sleep(100); // Wait 100ms between items
 * }
 * ```
 * @source
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Delays the execution of an action by the specified number of milliseconds.
 * Combines sleep() with a callback function for cleaner async code.
 *
 * @category Helpers
 * @param ms - The number of milliseconds to delay
 * @param action - The function to execute after the delay
 * @returns A promise that resolves after the action is executed
 *
 * @example
 * ```typescript
 * // Simple delay
 * await delayAction(1000, () => console.log("Delayed message"));
 *
 * // With complex function
 * await delayAction(500, () => {
 *   processData();
 *   updateUI();
 * });
 *
 * // In a sequence
 * await delayAction(100, step1);
 * await delayAction(200, step2);
 * ```
 * @source
 */
export async function delayAction(ms: number, action: () => void): Promise<void> {
  await sleep(ms);
  action();
}

/**
 * Takes a function and an array of values, applies the function to each value in sequence,
 * and returns the first non-undefined/null result. Useful for trying multiple possible inputs
 * until finding one that produces a valid result.
 *
 * @category Helpers
 * @param fn - The function to apply to each value
 * @param properties - Array of values to try the function on
 * @returns The first non-undefined/null result from applying the function, or undefined if all attempts fail
 *
 * @example
 * ```typescript
 * // Parse number from different formats
 * const getNumber = (s: string) => s.match(/\d+/)?.[0];
 * firstMap(getNumber, ["no nums", "abc123", "def"]) // Returns "123"
 *
 * // Find first valid item
 * const isValid = (x: number) => x > 10 ? x : undefined;
 * firstMap(isValid, [5, 8, 15, 20]) // Returns 15
 *
 * // Complex transformations
 * const parseDate = (s: string) => {
 *   const date = new Date(s);
 *   return isNaN(date.getTime()) ? undefined : date;
 * };
 * firstMap(parseDate, ["invalid", "2023-01-01", "also invalid"])
 * ```
 * @source
 */
export function firstMap<T, R>(fn: (arg: T) => R | void, properties: T[]): R | void {
  for (const prop of properties) {
    const result = fn(prop);
    if (result !== undefined && result !== null) {
      return result;
    }
  }
  return undefined;
}

/**
 * Maps an array of items using a function and filters out any null or undefined results.
 *
 * @category Helpers
 * @param fn - The mapping function that may return undefined/null
 * @param items - Array of items to map
 * @returns Array of non-null/undefined results after mapping
 *
 * @example
 * ```typescript
 * const nums = ["1", "a", "2", "b", "3"];
 * const parseNum = (s: string) => isNaN(Number(s)) ? undefined : Number(s);
 * mapDefined(nums, parseNum) // Returns [1, 2, 3]
 * ```
 * @example
 * ```typescript
 * const users = [{name: "Alice"}, null, {name: "Bob"}];
 * const getName = (user: any) => user?.name;
 * mapDefined(users, getName) // Returns ["Alice", "Bob"]
 * ```
 * @source
 */
export function mapDefined<T, R>(items: T[], fn: (arg: T) => R | null | undefined | void): R[] {
  return items.map(fn).filter((result): result is R => {
    if (result === undefined || result === null) {
      return false;
    }
    if (Array.isArray(result)) {
      return result.length > 0;
    }
    return true;
  });
}

/**
 * Decodes HTML entities in a string.
 *
 * @category Helpers
 * @param text - The string to decode
 * @returns The decoded string
 *
 * @example
 * ```typescript
 * decodeHTMLEntities("&lt;div&gt;Hello &amp; World&lt;/div&gt;") // Returns "<div>Hello & World</div>"
 * decodeHTMLEntities("&#39;Hello&#39;") // Returns "'Hello'"
 * ```
 * @source
 */
export function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&cent;": "¢",
    "&pound;": "£",
    "&yen;": "¥",
    "&euro;": "€",
    "&copy;": "©",
    "&reg;": "®",
  } as const;

  return text
    .replace(/&[a-z]+;/gi, (match) => entities[match] || match)
    .replace(/&#(\d+);/gi, (match, dec) => String.fromCharCode(dec));
}

// Block-level tags whose closing tag should become a line break, so their text
// doesn't run into the following block (e.g. a heading against the next paragraph).
const BLOCK_CLOSE_REGEX =
  /<\/(?:p|div|h[1-6]|li|ul|ol|dl|dd|dt|tr|td|th|blockquote|section|article|header|footer|figcaption|pre|address)>/gi;

/**
 * Converts HTML to ASCII. Closing block-level tags (paragraphs, headings, list
 * items, table rows/cells, …) and `<br>` become line breaks; every other tag is
 * stripped and the common HTML entities are decoded. Runs of blank lines left by
 * empty or nested blocks are collapsed to a single line break.
 * @category Helpers
 * @param html - The HTML string to convert
 * @returns The ASCII string
 * @example
 * ```typescript
 * htmlToAscii("<h2>Title</h2><p>Hello <b>world</b></p><ul><li>one</li><li>two</li></ul>")
 * // Returns "Title\nHello world\none\ntwo"
 * ```
 * @source
 */
export function htmlToAscii(html: string): string {
  return (
    html
      .replace(BLOCK_CLOSE_REGEX, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Trim trailing spaces per line and collapse blank-line runs from empty blocks.
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim()
  );
}

// Matches the href of the first PDF link in a block of HTML.
const PDF_HREF_REGEX = /href\s*=\s*["']([^"']*\.pdf[^"']*)["']/i;

/**
 * Finds the href of the first PDF-linking anchor in a block of HTML. Useful for pulling out
 * linked documents such as Safety Data Sheets or spec sheets that suppliers attach as
 * `<a href="….pdf">` inside descriptions or info sections.
 * @category Helpers
 * @param html - Raw HTML that may contain an anchor linking to a PDF
 * @returns The PDF URL, or undefined if none is found
 * @example
 * ```typescript
 * findPdfHref('<a href="https://x.com/sds.pdf" target="_blank">Safety Data Sheet</a>')
 * // "https://x.com/sds.pdf"
 * findPdfHref("<p>No documents here</p>") // undefined
 * ```
 * @source
 */
export function findPdfHref(html: string): string | undefined {
  if (!html || typeof html !== "string") return undefined;
  return html.match(PDF_HREF_REGEX)?.[1];
}

/**
 * Tries to parse a JSON string. If it fails, it returns the original string.
 *
 * @category Helpers
 * @param data - The data to parse
 * @returns The parsed JSON or undefined if it fails
 * @example
 * ```typescript
 * tryParseJson('{"name": "John", "age": 30}') // { name: 'John', age: 30 }
 * tryParseJson('not a json string') // undefined
 * ```
 * @source
 */
export function tryParseJson(data: unknown): unknown | undefined {
  try {
    return JSON.parse(String(data));
  } catch {
    return undefined;
  }
}

/**
 * Extracts and parses the first top-level JSON array or object from a string
 * that may contain trailing non-JSON content (e.g. delimiters like "&&&").
 * @category Helpers
 * @param data - The string containing JSON with possible trailing junk
 * @returns The parsed JSON value
 * @throws Error if no JSON array/object is found or if the JSON is malformed
 * @example
 * ```typescript
 * parseJsonFromDirtyString('[ "a", "b" ]\n&&&\n') // Returns ["a", "b"]
 * parseJsonFromDirtyString('{"key": "val"} some junk') // Returns {key: "val"}
 * ```
 * @source
 */
export function parseJsonFromDirtyString(data: string): unknown {
  const trimmed = data.trim();
  const openBracket = trimmed.search(/[[{]/);
  if (openBracket === -1) throw new Error("No JSON array or object found in string");

  const openChar = trimmed[openBracket];
  const closeChar = openChar === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = openBracket; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === openChar) depth++;
    else if (ch === closeChar) depth--;
    if (depth === 0) {
      return JSON.parse(trimmed.slice(openBracket, i + 1));
    }
  }

  throw new Error("Unterminated JSON in string");
}

/**
 * Gets the user's location (two-letter country code) from the browser's i18n
 * API. This just splits the locale by the "-" character and returns the second
 * part. This is a simple way to get the country code from the locale.
 *
 * @category Helpers
 * @returns The user's location as a CountryCode. (defaults to "US")
 * @example
 * ```typescript
 * // If the locale is "en-US"
 * getUserLocation() // Returns "US" (United States)
 *
 * // If the locale is "en-GB"
 * getUserLocation() // Returns "GB" (United Kingdom)
 *
 * // If the locale is "en-CA"
 * getUserLocation() // Returns "CA" (Canada)
 * ```
 * @source
 */
export function getUserLocation(): CountryCode {
  if (typeof chrome === "undefined" || typeof chrome.i18n === "undefined") {
    return "US";
  }
  return chrome.i18n.getUILanguage().split("-")[1];
}

/**
 * Gets the user's preferred UI language locale from the browser's i18n API.
 * Used to seed the `language` user setting. Falls back to `"en-US"` outside an
 * extension context (e.g. tests).
 * @category Helpers
 * @returns The browser UI language locale, e.g. `"en-US"` or `"de-DE"`
 * @example
 * ```typescript
 * getUserLanguage() // Returns "en-US"
 * ```
 * @source
 */
export function getUserLanguage(): string {
  if (typeof chrome === "undefined" || typeof chrome.i18n === "undefined") {
    return "en-US";
  }
  return chrome.i18n.getUILanguage();
}

/**
 * Resolves a locale code to a human-readable language name using the
 * `countries-list` language data. The native name is preferred (e.g. "Deutsch"),
 * falling back to the English name and finally the raw code.
 * @category Helpers
 * @param locale - A locale or language code, e.g. `"de-DE"` or `"de"`; undefined yields undefined
 * @returns The language's display name, or undefined when no locale is given
 * @example
 * ```typescript
 * getLanguageName("en-US") // Returns "English"
 * getLanguageName("de-DE") // Returns "Deutsch"
 * getLanguageName(undefined) // Returns undefined
 * ```
 * @source
 */
export function getLanguageName(locale?: string): string | undefined {
  if (!locale) {
    return undefined;
  }
  const base = locale.split("-")[0].toLowerCase();
  const entry = (iso639Languages as Record<string, { name: string; native: string }>)[base];
  return entry?.native ?? entry?.name ?? locale;
}

/**
 * Strips HTML tags from a string.
 *
 * @category Helpers
 * @param html - The HTML string to strip
 * @returns The string with HTML tags removed
 * @example
 * ```typescript
 * stripHTML("<p>Hello <b>world</b></p>") // Returns "Hello world"
 * ```
 * @source
 */
export function stripHTML(html: string): string {
  if (typeof document === "undefined") {
    return html;
  }
  const tempDiv = document.createElement("DIV");
  tempDiv.innerHTML = html;
  return tempDiv.textContent || "";
}

/**
 * Converts HTML to Markdown using TurndownService.
 *
 * @category Helpers
 * @param html - The HTML string to convert
 * @returns The Markdown string
 * @example
 * ```typescript
 * formatFromHtmlTurndown("<b>Bold</b>") // Returns "**Bold**"
 * ```
 * @source
 */
export function formatFromHtmlTurndown(html: string): string {
  const turndownService = new TurndownService();
  return turndownService.turndown(html);
}

/**
 * Formats HTML into a readable plain text string, handling paragraphs, lists, and links.
 *
 * @category Helpers
 * @param html - The HTML string to format
 * @returns The formatted plain text string
 * @example
 * ```typescript
 * formatFromHtml("<ul><li>Item 1</li><li>Item 2</li></ul>") // Returns "- Item 1\n- Item 2"
 * ```
 * @source
 */
export function formatFromHtml(html: string): string {
  const tempDiv = document.createElement("DIV");
  tempDiv.innerHTML = html;

  if (tempDiv.children.length === 0) {
    return tempDiv.textContent || "";
  }

  const result = Array.from(tempDiv.children).flatMap((child) => {
    switch (child.nodeName) {
      // Paragraphs just get their own lines.
      case "P":
        return `${child.textContent}\n`;
      case "UL":
        return Array.from(child.children).map((e) => `- ${e.textContent}`);
      case "OL":
        return Array.from(child.children).map((e, idx) => `${idx + 1}) ${e.textContent}`);
      case "A":
        return `${child.textContent} (${child.getAttribute("href")})`;
      default:
        return child.textContent;
    }
  });

  return result.filter((x) => x !== undefined).join("\n");
}

/**
 * Format a Unix epoch timestamp (in milliseconds) as a short, locale-aware
 * "month day, hour:minute" string for UI surfaces like the history and
 * excluded-products lists in the settings drawer. Shared so both panels
 * render the same shape without drifting over time.
 * @category Helpers
 * @group Formatters
 * @param epochMs - Timestamp in milliseconds since the Unix epoch.
 * @returns A locale-formatted string such as `"Mar 26, 2:15 PM"`.
 * @example
 * ```ts
 * formatTimestamp(1711468500000);
 * // => "Mar 26, 2:15 PM"  (en-US locale)
 * ```
 * @source
 */
export function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format a byte count as a short, human-readable size string using binary
 * (1024-based) units. Used by the settings panel to show how much storage the
 * caches and price history occupy.
 * @category Helpers
 * @group Formatters
 * @param bytes - The number of bytes.
 * @returns A compact size string such as `"0 B"`, `"1.5 KB"`, or `"2.3 MB"`.
 * @example
 * ```ts
 * formatBytes(0);       // => "0 B"
 * formatBytes(1536);    // => "1.5 KB"
 * formatBytes(2411724); // => "2.3 MB"
 * ```
 * @source
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const formatted = exponent === 0 ? String(value) : value.toFixed(1);
  return `${formatted} ${units[exponent]}`;
}

/**
 * Resolves a value out of a nested object/array using a key path.
 *
 * Traversal is forgiving: if any segment is `null` or `undefined` (or the
 * parent isn't indexable), resolution short-circuits and returns the same
 * nullish value rather than throwing. An empty path returns `obj` as-is.
 * Paths can mix string and numeric segments — numeric segments index arrays
 * via the same bracket access as object keys.
 * @category Helpers
 * @param obj - Root object / array / primitive to read from.
 * @param path - Ordered list of keys / indexes to traverse.
 * @returns The value at the resolved path, or `undefined` when any segment
 *   of the path is missing.
 * @example
 * ```typescript
 * getPath({ a: { b: { c: 1 } } }, ["a", "b", "c"]); // 1
 * getPath({ a: { b: 1 } }, ["a", "x"]);             // undefined
 * getPath({ items: [10, 20, 30] }, ["items", 1]);   // 20
 * getPath({ a: null }, ["a", "b"]);                 // null (short-circuits)
 * getPath({ a: 1 }, []);                            // { a: 1 }
 * ```
 * @source
 */
export function getPath(obj: unknown, path: readonly PropertyKey[]): unknown {
  return path.reduce<unknown>((acc, key) => (acc == null ? acc : Reflect.get(acc, key)), obj);
}

// Matches the real zod `$ZodIssue.path` shape (PropertyKey[]), which can
// include `symbol` segments. `getPath` ignores those (they never index a
// JSON-shaped settings object), but the constraint has to be wide enough to
// accept what zod actually hands us.
// Intentionally no index signature: zod's concrete issue types (e.g.
// `$ZodIssueInvalidType`) have closed shapes that don't satisfy a
// `[key: string]: unknown` signature, and we only need to *read* the `path`
// field here — any extra fields just pass through via the spread in the
// caller.
interface PathedIssue {
  path: readonly PropertyKey[];
}

/**
 * Enriches a list of zod issues (or any `{ path }`-shaped records) with the
 * actual value found at each issue's path in the source object. Useful when
 * logging validation failures — stock zod issues only say "expected X at
 * path Y", and knowing what *was* there makes debugging drastically faster.
 *
 * The original issue objects are spread shallowly, so extra zod fields
 * (`code`, `message`, `expected`, etc.) pass through untouched; only the new
 * `actual` key is added.
 * @category Helpers
 * @param issues - Array of issue records; each must have a `path` array.
 * @param obj - The value that was validated — used as the root for `getPath`.
 * @returns A new array of issues, each augmented with an `actual` field.
 * @example
 * ```typescript
 * const issues = [
 *   { path: ["user", "age"], code: "invalid_type", message: "Expected number" },
 * ];
 * const obj = { user: { age: "forty" } };
 * zodAddActualValueToIssues(issues, obj);
 * // [
 * //   {
 * //     path: ["user", "age"],
 * //     code: "invalid_type",
 * //     message: "Expected number",
 * //     actual: "forty",
 * //   },
 * // ]
 *
 * // Missing path → `actual` is undefined
 * zodAddActualValueToIssues([{ path: ["missing"] }], {});
 * // [{ path: ["missing"], actual: undefined }]
 * ```
 * @source
 */
export function zodAddActualValueToIssues<T extends PathedIssue>(
  issues: readonly T[],
  obj: unknown,
): Array<T & { actual: unknown }> {
  return issues.map((issue) => ({
    ...issue,
    actual: getPath(obj, issue.path),
  }));
}

/**
 * Preloads a list of images and returns a promise that resolves to an array of results.
 * @category Helpers
 * @param images - The list of images to preload.
 * @returns A promise that resolves to an array of images that were successfully preloaded.
 * @example
 * ```typescript
 * preloadImages(["https://example.com/image.jpg"]);
 * // Returns a promise that resolves to an array of results.
 * ```
 * @source
 */
export async function preloadImages(images: string[]): Promise<string[]> {
  const results = await Promise.allSettled(
    images.map((image) => {
      return new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.src = image;
        // Resolve with the URL string instead of the Event object
        img.onload = () => resolve(image);
        img.onerror = (e: unknown) =>
          reject(
            new Error(`Failed to load: ${image}: ${e instanceof Error ? e.message : String(e)}`),
          );
      });
    }),
  );

  // Filter out failures and map to just the successful string values
  return results
    .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
    .map((result) => result.value);
}
