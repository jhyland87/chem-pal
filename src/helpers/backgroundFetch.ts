// Client side of the background-worker fetch proxy. The matching message handler
// lives in `src/service-worker.ts`. Routing a request through the service worker
// sidesteps the page CORS restrictions that apply to extension pages (e.g. the side
// panel), as long as the target host is granted in the manifest `host_permissions`.

import { MESSAGE_TYPE } from "@/constants/common";

/**
 * Serializable subset of `RequestInit` accepted by {@link backgroundFetch}. Only
 * structured-cloneable fields are supported; `body` must already be a string (callers
 * stringify JSON themselves).
 * @source
 */
export interface BackgroundFetchInit {
  method?: string;
  headers?: HeadersInit;
  body?: string;
  credentials?: RequestCredentials;
  referrer?: string;
  mode?: RequestMode;
  redirect?: RequestRedirect;
}

/** Message sent to the service worker. Mirrors the contract documented in the worker. */
interface BackgroundFetchMessage {
  type: MESSAGE_TYPE.BACKGROUND_FETCH;
  url: string;
  init?: Omit<BackgroundFetchInit, "headers"> & { headers?: Record<string, string> };
}

/** Successful serialized response returned by the worker. */
interface BackgroundFetchSuccess {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

/** Result the worker sends back: a serialized response or an error envelope. */
type BackgroundFetchResult = BackgroundFetchSuccess | { error: string };

/**
 * Flattens any `HeadersInit` form into a plain, structured-cloneable record so it
 * survives `chrome.runtime.sendMessage`.
 * @param headers - Headers as a `Headers` instance, entry array, or plain object.
 * @returns A plain `Record<string, string>`, or `undefined` when no headers were given.
 * @example
 * ```typescript
 * normalizeHeaders(new Headers({ "x-a": "1" })); // => { "x-a": "1" }
 * normalizeHeaders([["x-b", "2"]]);              // => { "x-b": "2" }
 * normalizeHeaders(undefined);                   // => undefined
 * ```
 * @source
 */
function normalizeHeaders(headers?: HeadersInit): Record<string, string> | undefined {
  if (headers === undefined) {
    return undefined;
  }
  const result: Record<string, string> = {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key] = value;
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key] = value;
    }
  } else {
    Object.assign(result, headers);
  }
  return result;
}

/**
 * Narrows a `chrome.runtime.sendMessage` reply to a successful proxied response.
 * @param result - The unknown value returned by the service worker.
 * @returns `true` when `result` is a {@link BackgroundFetchSuccess}.
 * @source
 */
function isBackgroundFetchSuccess(result: unknown): result is BackgroundFetchSuccess {
  return (
    typeof result === "object" &&
    result !== null &&
    "body" in result &&
    "status" in result &&
    "headers" in result
  );
}

/**
 * Performs an HTTP request from the extension's background service worker instead of the
 * calling context, then reconstructs a real {@link Response} from the serialized reply.
 *
 * Use this when a page-context `fetch` is blocked by CORS: the worker is exempt from page
 * CORS as long as the target host is listed in the manifest `host_permissions`. The
 * returned `Response` works like a normal one for text/JSON bodies (`.ok`, `.status`,
 * `.text()`, `.json()`); binary bodies are not supported.
 *
 * @param url - The absolute URL to request.
 * @param init - Optional serializable request options (see {@link BackgroundFetchInit}).
 * @returns A `Response` reconstructed from the worker's reply.
 * @throws Error if the worker reports a fetch failure or returns an unrecognized reply.
 * @example
 * ```typescript
 * // GET reading text
 * const res = await backgroundFetch("https://example.com/");
 * const html = await res.text();
 *
 * // POST with a JSON body reading JSON
 * const res2 = await backgroundFetch("https://api.example.com/search", {
 *   method: "POST",
 *   headers: { "content-type": "application/json" },
 *   body: JSON.stringify({ q: "acid" }),
 * });
 * if (res2.ok) {
 *   const data = await res2.json();
 * }
 * ```
 * @source
 */
export async function backgroundFetch(
  url: string,
  init?: BackgroundFetchInit,
): Promise<Response> {
  const message: BackgroundFetchMessage = {
    type: MESSAGE_TYPE.BACKGROUND_FETCH,
    url,
    init: init ? { ...init, headers: normalizeHeaders(init.headers) } : undefined,
  };

  const result: BackgroundFetchResult = await chrome.runtime.sendMessage(message);

  if (isBackgroundFetchSuccess(result)) {
    return new Response(result.body, {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
    });
  }

  const reason =
    typeof result === "object" && result !== null && "error" in result
      ? result.error
      : "Unknown background fetch failure";
  throw new Error(`backgroundFetch| ${reason}`);
}
