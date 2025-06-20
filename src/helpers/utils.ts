import { md5 } from "js-md5";

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
 */
export function firstMap<T, R>(fn: (arg: T) => R | void, properties: T[]): R | void {
  try {
    for (const prop of properties) {
      const result = fn(prop);
      if (result !== undefined && result !== null) {
        return result;
      }
    }
    return undefined;
  } catch (error) {
    console.error("ERROR in firstMap:", error);
    return undefined;
  }
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
 *
 * const users = [{name: "Alice"}, null, {name: "Bob"}];
 * const getName = (user: any) => user?.name;
 * mapDefined(users, getName) // Returns ["Alice", "Bob"]
 * ```
 */
export function mapDefined<T, R>(items: T[], fn: (arg: T) => R | null | undefined): R[] {
  return items.map(fn).filter((result): result is R => {
    if (result === undefined || result === null) {
      return false;
    }

    if (Array.isArray(result)) {
      return result.length > 0;
    }

    if (typeof result === "object") {
      return Object.keys(result).length > 0;
    }

    if (typeof result === "string") {
      return result.trim().length > 0;
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
 * Tries to parse a JSON string. If it fails, it returns the original string.
 *
 * @param data - The data to parse
 * @returns The parsed JSON or false if it fails
 *
 * @example
 * ```typescript
 * tryParseJson('{"name": "John", "age": 30}') // { name: 'John', age: 30 }
 * tryParseJson('not a json string') // false
 * ```
 */
export function tryParseJson(data: unknown): unknown | false {
  try {
    return JSON.parse(data as string);
  } catch {
    return false;
  }
}

/**
 * Gets the user's country from the browser's i18n API. This just splits the locale
 * by the "-" character and returns the second part. This is a simple way to get the
 * country code from the locale.
 *
 * @returns The user's country as a CountryCode. (defaults to "US")
 *
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
 * @param html - The HTML string to strip
 * @returns The string with HTML tags removed
 *
 * @example
 * ```typescript
 * stripHTML("<p>Hello <b>world</b></p>") // Returns "Hello world"
 * ```
 */
export function stripHTML(html: string) {
  if (typeof document === "undefined") {
    return html;
  }
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}
