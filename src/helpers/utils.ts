import { md5 } from "js-md5";
import TurndownService from "turndown";

/**
 * MD5 hash function that handles various input types.
 * Converts input to string representation before hashing.
 *
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
    return md5(input.toString());
  }

  if (typeof input !== "string") {
    throw new Error("Unexpected input type: " + typeof input);
  }

  return md5(input);
}

/**
 * Generates an array of page sizes based on the total number of rows.
 * The array starts with the base size and doubles each time until it reaches the total.
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
export function sleep(ms: number) {
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
export async function delayAction(ms: number, action: () => void) {
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
  //try {
  for (const prop of properties) {
    const result = fn(prop);
    if (result !== undefined && result !== null) {
      return result;
    }
  }
  return undefined;
  // } catch (error) {
  //   //console.error("ERROR in firstMap:", error);
  //   throw
  //   return undefined;
  // }
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
export function decodeHTMLEntities(text: string) {
  const entities: Record<string, string> = {
    /* eslint-disable */
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
    /* eslint-enable */
  } as const;

  return text
    .replace(/&[a-z]+;/gi, (match) => entities[match] || match)
    .replace(/&#(\d+);/gi, (match, dec) => String.fromCharCode(dec));
}

/**
 * Converts HTML to ASCII.
 * @category Helpers
 * @param html - The HTML string to convert
 * @returns The ASCII string
 * @example
 * ```typescript
 * htmlToAscii("<p>Hello <b>world</b></p><p>This is a test</p>")
 * // Returns "Hello world\nThis is a test"
 * ```
 * @source
 */
export function htmlToAscii(html: string): string {
  return html
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
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
  const openBracket = trimmed.search(/[\[{]/);
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
 * Gets the user's country from the browser's i18n API. This just splits the locale
 * by the "-" character and returns the second part. This is a simple way to get the
 * country code from the locale.
 *
 * @category Helpers
 * @returns The user's country as a CountryCode. (defaults to "US")
 * @example
 * ```typescript
 * // If the locale is "en-US"
 * getUserCountry() // Returns "US" (United States)
 *
 * // If the locale is "en-GB"
 * getUserCountry() // Returns "GB" (United Kingdom)
 *
 * // If the locale is "en-CA"
 * getUserCountry() // Returns "CA" (Canada)
 * ```
 * @source
 */
export function getUserCountry(): CountryCode {
  if (typeof chrome === "undefined" || typeof chrome.i18n === "undefined") {
    return "US";
  }
  return chrome.i18n.getUILanguage().split("-")[1] as CountryCode;
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
 * Resolves a value out of a nested object/array using a key path.
 *
 * Traversal is forgiving: if any segment is `null` or `undefined` (or the
 * parent isn't indexable), resolution short-circuits and returns the same
 * nullish value rather than throwing. An empty path returns `obj` as-is.
 * Paths can mix string and numeric segments — numeric segments index arrays
 * via the same bracket access as object keys.
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
  return path.reduce<unknown>(
    (acc, key) =>
      acc == null ? acc : (acc as Record<PropertyKey, unknown>)[key],
    obj,
  );
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
