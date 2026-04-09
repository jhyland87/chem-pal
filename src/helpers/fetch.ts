import { addCapturedResponse, initConsoleApi } from "@/helpers/responseAggregate";

declare const __RESPONSE_AGGREGATE__: boolean;

/**
 * Response type that extends the standard Response with additional properties
 * for data and request hash tracking.
 * @source
 */
export type FetchDecoratorResponse = Response & { data: unknown; requestHash: string };

// Initialize the console API when in aggregate mode
if (typeof __RESPONSE_AGGREGATE__ !== "undefined" && __RESPONSE_AGGREGATE__) {
  initConsoleApi();
}

/**
 * Generates a simple hash from a string using the djb2 algorithm.
 * This is a non-cryptographic hash function suitable for request identification.
 *
 * @param str - The string to hash
 * @returns A hexadecimal string representing the hash
 * @example
 * ```typescript
 * const hash = generateSimpleHash("test string");
 * console.log(hash); // "a5d7d2a9"
 * ```
 * @source
 */
export function generateSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Generates a unique hash for a request based on its URL, method, headers, and body.
 * This hash can be used to identify and track unique requests.
 *
 * @param input - The request URL or Request object
 * @param options - Optional request configuration
 * @returns A promise that resolves to a unique hash string
 * @example
 * ```typescript
 * // With URL string
 * const hash1 = await generateRequestHash("https://api.example.com/data", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ name: "test" })
 * });
 *
 * // With Request object
 * const request = new Request("https://api.example.com/data", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ name: "test" })
 * });
 * const hash2 = await generateRequestHash(request);
 * ```
 * @source
 */
export async function generateRequestHash(
  input: RequestInfo | URL,
  options?: RequestInit,
): Promise<string> {
  const url = input instanceof Request ? input.url : input.toString();
  const method = input instanceof Request ? input.method : options?.method || "GET";
  const headers = input instanceof Request ? input.headers : options?.headers || {};
  const body = input instanceof Request ? input.body : options?.body || "";
  const contentType =
    input instanceof Request
      ? input.headers.get("content-type") || ""
      : (headers instanceof Headers ? headers.get("content-type") : (headers as Record<string, string>)?.["content-type"]) ?? "";

  const data = {
    url,
    method,
    headers,
    body,
    contentType,
  };

  const dataString = JSON.stringify(data);
  return generateSimpleHash(dataString);
}

/**
 * A decorator function that wraps the native fetch API with additional features:
 * - Automatic response parsing based on content type
 * - Request hash generation for tracking
 * - Error handling
 * - Response cloning to prevent body stream consumption
 *
 * @param input - The request URL or Request object
 * @param init - Optional request configuration
 * @returns A promise that resolves to a FetchDecoratorResponse
 * @throws Error if the response is not ok (status not in 200-299 range)
 * @example
 * ```typescript
 * // Basic GET request
 * const response = await fetchDecorator("https://api.example.com/data");
 * console.log(response.data); // Parsed response data
 * console.log(response.requestHash); // Unique request hash
 *
 * // POST request with JSON body
 * const response = await fetchDecorator("https://api.example.com/data", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ name: "test" })
 * });
 *
 * // Using Request object
 * const request = new Request("https://api.example.com/data", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ name: "test" })
 * });
 * const response = await fetchDecorator(request);
 *
 * // Handling different response types
 * const response = await fetchDecorator("https://api.example.com/data");
 * if (response.headers.get("content-type")?.includes("application/json")) {
 *   // Data is already parsed as JSON
 *   console.log(response.data);
 * } else if (response.headers.get("content-type")?.includes("text/")) {
 *   // Data is already parsed as text
 *   console.log(response.data);
 * } else {
 *   // Data is a Blob
 *   const blob = response.data as Blob;
 *   // Handle blob data
 * }
 * ```
 * @source
 */
export async function fetchDecorator(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<FetchDecoratorResponse> {
  const requestHash = await generateRequestHash(input, init);
  console.debug(`Request Hash: ${requestHash}`);

  // Clone the request for aggregate capture BEFORE fetch() consumes it.
  // For POST requests, fetch() reads the request body, making it impossible
  // to clone afterward.
  let aggregateRequestClone: Request | undefined;
  if (typeof __RESPONSE_AGGREGATE__ !== "undefined" && __RESPONSE_AGGREGATE__) {
    aggregateRequestClone =
      input instanceof Request ? input.clone() : new Request(input.toString(), init);
  }

  const response = await fetch(input, init);
  // So we can return the original response
  const clonedResponse = response.clone();

  // Clone the response for aggregate capture BEFORE the body is transferred
  // to enhancedResponse (which makes the original response disturbed).
  // Done before the !response.ok check so error responses (4xx, 5xx) are also captured.
  let aggregateResponseClone: Response | undefined;
  if (typeof __RESPONSE_AGGREGATE__ !== "undefined" && __RESPONSE_AGGREGATE__) {
    aggregateResponseClone = response.clone();
  }

  if (!response.ok) {
    // Still capture error responses for mocking in tests
    if (aggregateRequestClone && aggregateResponseClone) {
      await addCapturedResponse(aggregateRequestClone, aggregateResponseClone);
    }
    throw new Error(`HTTP Error: ${clonedResponse.status} ${clonedResponse.statusText}`);
  }

  const contentType = clonedResponse.headers.get("content-type") || "";
  let data: unknown;

  try {
    if (contentType.includes("application/json")) {
      data = await clonedResponse.clone().json();
    } else if (contentType.includes("text/") || contentType.includes("json-amazonui-streaming")) {
      data = await clonedResponse.clone().text();
    } else {
      data = await clonedResponse.clone().blob();
    }
  } catch {
    console.debug("clonedResponse:", clonedResponse);
    data = await clonedResponse.clone().text();
  }

  // Create a new Response object that inherits all prototype methods
  const enhancedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });

  // Add our custom properties
  Object.defineProperties(enhancedResponse, {
    data: { value: data },
    requestHash: { value: requestHash },
  });

  // Capture response when in aggregate mode.
  // Awaited to ensure the capture completes before the clones are GC'd.
  if (aggregateRequestClone && aggregateResponseClone) {
    await addCapturedResponse(aggregateRequestClone, aggregateResponseClone);
  }

  return enhancedResponse as FetchDecoratorResponse;
}
