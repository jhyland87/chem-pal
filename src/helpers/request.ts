import { md5sum, serialize } from "@/helpers/utils";
import * as contentType from "content-type";

/**
 * @group Helpers
 * @groupDescription HTTP request utilities for making API calls and handling responses.
 */

/**
 * Generates a unique hash for a given Request object based on its method, URL path, search parameters, and body.
 * This hash can be used to identify and cache requests. This is used to store the mocked response body
 * at a location with a unique filename (based on the hash).
 * This is necessary because the only other way to differentiate between request really is to store the file in
 * a location that contains the hostname, request method, request path and then some way to differentiate between
 * the request body and parameters. But even trying that causes issues. Trying to dynamically import the file
 * `./responses/${reqUrl.hostname}/${reqUrl.path}/${searchQuery}.json` throws the exception:
 *
 * ```
 * Error: Unknown variable dynamic import: ./responses/www.biofuranchem.com/_api/wix-ecommerce-storefront-web/api/acid.json.
 * Note that variables only represent file names one level deep.
 * ```
 *
 * So instead, we just use the hash to store the file in a location that is guaranteed to be unique. This is the
 * same way that the python request_cache library works, and that worked pretty well.
 *
 * @param  request - The Request object to generate a hash for
 * @returns A RequestHashObject containing:
 *          - hash: The MD5 hash of the request
 *          - file: The suggested file location for caching the request
 *          - url: The parsed URL object from the request
 * @example
 * ```typescript
 * const request = new Request('https://api.example.com/data?q=test', {
 *   method: 'GET'
 * });
 * const hashObj = getRequestHash(request);
 * // Returns: {
 * //   hash: '01b5190db0c0f8c232d2ad4d8957d5f4',
 * //   file: 'api.example.com/01b5190db0c0f8c232d2ad4d8957d5f4.json',
 * //   url: {
 * //     href: "https://api.example.com/data?q=test",
 * //     host: "api.example.com",
 * //     hostname:"api.example.com",
 * //     pathname: "/data",
 * //     search: "?q=test"
 * //     searchParams: URLSearchParams,
 * //     origin: "https://api.example.com",
 * //     protocol: "https:",
 * //     ...other URL properties
 * //   }
 * // }
 * ```
 * @category Helpers
 */
export function getRequestHash(request: Request): RequestHashObject {
  const url = new URL(request.url);
  const resultHash = md5sum(
    // POST
    request.method + (url.pathname ?? "") + (url.search ?? "") + (request.body ?? ""),
  );

  return {
    hash: resultHash,
    file: `${url.hostname}/${resultHash}.json`,
    url: url,
  } satisfies RequestHashObject;
}

/**
 * Creates a cacheable response object from a Request and Response pair.
 * This function serializes the response content based on its content type
 * and generates a hash for the request to be used as a cache key.
 *
 * @param request - The original Request object
 * @param response - The Response object to be cached
 * @returns A Promise that resolves to a CacheResponse object containing:
 *          - hash: The RequestHashObject with request details and hash
 *          - data: A SerializedResponse containing the content type and serialized content
 * @example
 * ```typescript
 * const request = new Request('https://api.example.com/data');
 * const response = await fetch(request);
 * const cacheResponse = await getCachableResponse(request, response);
 * // Returns: {
 * //   hash: {
 * //     hash: '01b5190db0c0f8c232d2ad4d8957d5f4',
 * //     file: 'api.example.com/01b5190db0c0f8c232d2ad4d8957d5f4.json',
 * //     url: URL object
 * //   },
 * //   data: {
 * //     contentType: 'application/json',
 * //     content: '{"serialized":"content"}'
 * //   }
 * // }
 * ```
 * @category Helpers
 */
export async function getCachableResponse(
  request: Request,
  response: Response,
): Promise<CacheResponse> {
  const reqHash = getRequestHash(request);

  // Generate a serialized object to be saved
  const dataType = contentType.parse(response.headers.get("content-type")?.toString() ?? "");

  const serializedResponse: SerializedResponse = {
    contentType: dataType.type,
  };

  const clonedResponse = response.clone();

  if (serializedResponse.contentType === "application/json") {
    // Json gets stringified
    serializedResponse.content = serialize(JSON.stringify(await clonedResponse.json()));
  } else {
    // Everything else is treated as text
    serializedResponse.content = serialize(await clonedResponse.text());
  }

  return {
    hash: reqHash,
    data: serializedResponse,
  } satisfies CacheResponse;
}

/**
 * Checks if a value is a full URL.
 * @param val - The value to check
 * @returns True if the value is a full URL, false otherwise
 * @category Helpers
 * @example
 * ```typescript
 * const isUrl = isFullURL("https://www.google.com");
 * // Returns: true
 * ```
 */
export function isFullURL(val: unknown): val is URL {
  try {
    new URL(val as string);
    return true;
  } catch {
    return false;
  }
}

export function isRequest(req: unknown): req is Request {
  return req instanceof Request;
}

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
export function urlencode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/%20/g, "+");
}

export { fetchDecorator, generateRequestHash, generateSimpleHash } from "./fetch";
