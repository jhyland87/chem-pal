/**
 * Generates a simple non-cryptographic hash from a string using the djb2 algorithm.
 * Produces a hexadecimal string suitable for use as a cache key or request identifier.
 *
 * @remarks
 * This is intentionally a fast, non-cryptographic hash. It is not suitable for
 * security-sensitive use cases but works well for deduplicating HTTP requests.
 *
 * @param str - The input string to hash
 * @returns A hexadecimal string representation of the hash
 * @source
 */
function generateSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Generates a deterministic hash for an HTTP request based on its URL, method,
 * headers, body, and content type. Two requests with identical parameters will
 * always produce the same hash, making this suitable for cache keying and
 * request deduplication.
 *
 * @param url - The request URL
 * @param options - The request options (method, headers, body, etc.)
 * @returns A hexadecimal hash string uniquely identifying the request
 *
 * @example
 * ```typescript
 * const hash = await generateRequestHash('https://api.example.com/data', {
 *   method: 'POST',
 *   headers: { 'content-type': 'application/json' },
 *   body: JSON.stringify({ query: 'borohydride' }),
 * });
 * ```
 * @source
 */
export async function generateRequestHash(url: string, options: any): Promise<string> {
  const data = {
    url,
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body || "",
    contentType: options.headers?.["content-type"] || "",
  };

  const dataString = JSON.stringify(data);
  return generateSimpleHash(dataString);
}

/**
 * A lightweight fetch wrapper that automatically parses response bodies based on
 * their `Content-Type` header and attaches a deterministic request hash to each
 * response. Supports JSON, text, and binary (blob) content types.
 *
 * @remarks
 * This is the utility-layer fetch decorator used in `src/utils/`. For the
 * primary application fetch decorator with LRU caching, response aggregation,
 * and richer error handling, see {@link module:helpers/fetch.fetchDecorator}.
 *
 * @param url - The URL to fetch
 * @param options - Standard {@link RequestInit} options forwarded to `fetch()`
 * @returns An object spreading the original response with `data` (parsed body)
 *          and `requestHash` (hex hash of the request parameters)
 * @throws {Error} If the response status is not OK (non-2xx)
 *
 * @example
 * ```typescript
 * const result = await fetchDecorator('https://api.example.com/compounds', {
 *   method: 'GET',
 *   headers: { Accept: 'application/json' },
 * });
 * console.log(result.data);        // parsed JSON body
 * console.log(result.requestHash); // e.g. "a1b2c3d4"
 * ```
 * @source
 */
export async function fetchDecorator(url: string, options: RequestInit = {}): Promise<any> {
  const requestHash = await generateRequestHash(url, options);

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    return { ...response, data, requestHash };
  }

  if (contentType.includes("text/")) {
    const data = await response.text();
    return { ...response, data, requestHash };
  }

  // For binary data (images, files, etc)
  const data = await response.blob();
  return { ...response, data, requestHash };
}
