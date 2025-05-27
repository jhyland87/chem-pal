/**
 * Core MD5 hash function implementation.
 * Follows the MD5 specification for message digest calculation.
 *
 * @param input - The string to hash
 * @returns MD5 hash of the input string
 *
 * @example
 * ```typescript
 * md5("hello") // Returns "5d41402abc4b2a76b9719d911017c592"
 * md5("") // Returns "d41d8cd98f00b204e9800998ecf8427e"
 * ```
 */
function md5(input: string) {
  const hc = "0123456789abcdef";
  function rh(n: number) {
    let j,
      s = "";
    for (j = 0; j <= 3; j++)
      s += hc.charAt((n >> (j * 8 + 4)) & 0x0f) + hc.charAt((n >> (j * 8)) & 0x0f);
    return s;
  }
  function ad(x: number, y: number) {
    const l = (x & 0xffff) + (y & 0xffff);
    const m = (x >> 16) + (y >> 16) + (l >> 16);
    return (m << 16) | (l & 0xffff);
  }
  function rl(n: number, c: number) {
    return (n << c) | (n >>> (32 - c));
  }
  function cm(q: number, a: number, b: number, x: number, s: number, t: number) {
    return ad(rl(ad(ad(a, q), ad(x, t)), s), b);
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cm((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cm((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cm(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cm(c ^ (b | ~d), a, b, x, s, t);
  }
  function sb(x: string) {
    let i;
    const nblk = ((x.length + 8) >> 6) + 1;
    const blks = new Array(nblk * 16);
    for (i = 0; i < nblk * 16; i++) blks[i] = 0;
    for (i = 0; i < x.length; i++) blks[i >> 2] |= x.charCodeAt(i) << ((i % 4) * 8);
    blks[i >> 2] |= 0x80 << ((i % 4) * 8);
    blks[nblk * 16 - 2] = x.length * 8;
    return blks;
  }
  const x = sb("" + input);
  let a = 1732584193,
    b = -271733879,
    c = -1732584194,
    d = 271733878,
    olda,
    oldb,
    oldc,
    oldd;
  for (let i = 0; i < x.length; i += 16) {
    olda = a;
    oldb = b;
    oldc = c;
    oldd = d;
    a = ff(a, b, c, d, x[i + 0], 7, -680876936);
    d = ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = ff(c, d, a, b, x[i + 10], 17, -42063);
    b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = gg(b, c, d, a, x[i + 0], 20, -373897302);
    a = gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = hh(a, b, c, d, x[i + 5], 4, -378558);
    d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = hh(d, a, b, c, x[i + 0], 11, -358537222);
    c = hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = ii(a, b, c, d, x[i + 0], 6, -198630844);
    d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = ad(a, olda);
    b = ad(b, oldb);
    c = ad(c, oldc);
    d = ad(d, oldd);
  }
  return rh(a) + rh(b) + rh(c) + rh(d);
}

/**
 * MD5 hash function that handles various input types.
 * Converts input to string representation before hashing.
 *
 * @category Helper
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
 * @category Helper
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
 * @category Helper
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
 * @category Helper
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
 * @category Helper
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
 * @category Helper
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
 * @category Helper
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
  return items.map(fn).filter((result): result is R => result !== undefined && result !== null);
}

/**
 * Decodes HTML entities in a string.
 *
 * @category Helper
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
