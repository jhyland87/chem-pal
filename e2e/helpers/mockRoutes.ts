import type { Page, Route } from "@playwright/test";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { getRequestHash } from "./requestHash";

interface MockResponse {
  contentType: string;
  content: string;
  _request?: {
    url: string;
    method: string;
  };
}

/**
 * Loads all mock response files from a directory.
 * Builds two lookup maps:
 *   1. By hash path (`hostname/hash.json`) for hash-based matching
 *   2. By URL for direct URL matching (when `_request` metadata is present)
 *
 * @param responsesDir - Path to the directory containing mock response files
 */
function loadMockResponses(responsesDir: string): {
  byHash: Map<string, MockResponse>;
  byUrl: Map<string, MockResponse>;
} {
  const byHash = new Map<string, MockResponse>();
  const byUrl = new Map<string, MockResponse>();

  if (!existsSync(responsesDir)) {
    console.warn(`[MockRoutes] Responses directory not found: ${responsesDir}`);
    return { byHash, byUrl };
  }

  for (const hostname of readdirSync(responsesDir)) {
    const hostDir = join(responsesDir, hostname);
    if (!statSync(hostDir).isDirectory()) continue;

    for (const file of readdirSync(hostDir)) {
      if (!file.endsWith(".json")) continue;

      const filePath = join(hostDir, file);
      try {
        const data = JSON.parse(readFileSync(filePath, "utf-8")) as MockResponse;
        byHash.set(`${hostname}/${file}`, data);

        // If the file has request metadata, index by normalized URL
        // (dynamic params stripped, remaining params sorted)
        if (data._request?.url) {
          const key = `${data._request.method}:${normalizeUrl(data._request.url)}`;
          byUrl.set(key, data);
        }
      } catch (err) {
        console.warn(`[MockRoutes] Failed to load ${filePath}:`, err);
      }
    }
  }

  console.log(
    `[MockRoutes] Loaded ${byHash.size} mock responses (${byUrl.size} with URL metadata) from ${responsesDir}`,
  );

  return { byHash, byUrl };
}

/**
 * Deserializes a base64-encoded URI-encoded string back to its original form.
 * Matches the `deserialize()` function in `src/helpers/utils.ts`.
 */
function deserialize(data: string): string {
  return decodeURIComponent(Buffer.from(data, "base64").toString("utf-8"));
}

/**
 * Query parameter names that contain dynamic/session-specific data.
 * Must match the list in `src/helpers/responseAggregate.ts`.
 */
const DYNAMIC_PARAMS = [
  "timestampe", // Macklin API (their typo for "timestamp")
  "timestamp",
  "_t",
  "_",
  "t",
  "nocache",
  "cachebust",
  "nonce",
  "rnd",
  "rand",
];

/**
 * Normalizes a URL for matching by stripping dynamic query parameters
 * and sorting the remaining ones. This ensures requests with different
 * timestamps/nonces still match the saved mock responses.
 */
function normalizeUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    for (const param of DYNAMIC_PARAMS) {
      url.searchParams.delete(param);
    }
    url.searchParams.sort();
    return `${url.origin}${url.pathname}?${url.searchParams.toString()}`;
  } catch {
    return urlStr;
  }
}

interface SetupOptions {
  /** Path to directory containing mock response files. Defaults to `tests/mock-requests/responses` */
  responsesDir?: string;
  /** What to do when no mock is found: "abort" (default) or "passthrough" */
  fallback?: "abort" | "passthrough";
  /** Log all intercepted requests for debugging. Defaults to false. */
  verbose?: boolean;
}

/**
 * Sets up Playwright route interception to serve mock responses.
 * Intercepts all HTTPS requests and matches them against saved response files.
 *
 * Matching strategy (tried in order):
 *   1. Exact URL match (using `_request.url` metadata if present in files)
 *   2. Normalized URL match (sorted query params)
 *   3. Hash-based match (MD5 of method + pathname + search + body)
 *
 * @param page - Playwright Page instance
 * @param options - Configuration options
 */
export async function setupMockRoutes(page: Page, options: SetupOptions = {}): Promise<void> {
  const {
    responsesDir = join(process.cwd(), "tests/mock-requests/responses"),
    fallback = "abort",
    verbose = false,
  } = options;

  const { byHash, byUrl } = loadMockResponses(responsesDir);

  let matchCount = 0;
  let missCount = 0;

  await page.route("https://**/*", async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = request.url();
    const postData = request.postData() ?? "";

    const normalizedKey = `${method}:${normalizeUrl(url)}`;

    // Strategy 1: Normalized URL match (dynamic params stripped, sorted)
    let mock = byUrl.get(normalizedKey);
    let matchStrategy = "url";

    // Strategy 2: Hash-based match (fallback for files without URL metadata)
    if (!mock) {
      const reqHash = getRequestHash(method, url, postData);
      mock = byHash.get(reqHash.file);
      matchStrategy = "hash";
    }

    if (mock) {
      matchCount++;
      if (verbose) {
        console.log(`[MockRoutes] MATCH #${matchCount} (${matchStrategy}): ${method} ${url}`);
        console.log(`  normalized: ${normalizedKey}`);
      }

      const body = deserialize(mock.content);
      const contentType = mock.contentType;

      await route.fulfill({
        status: 200,
        contentType,
        body,
        headers: {
          "x-mocked-response": "true",
        },
      });
    } else {
      missCount++;
      if (verbose) {
        console.warn(`[MockRoutes] MISS #${missCount}: ${method} ${url}`);
        console.warn(`  normalized: ${normalizedKey}`);
      }

      if (fallback === "passthrough") {
        await route.continue();
      } else {
        await route.abort("blockedbyclient");
      }
    }
  });
}
