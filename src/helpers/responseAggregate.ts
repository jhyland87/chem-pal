import JSZip from "jszip";
import { getCachableResponse } from "@/helpers/request";

declare const __RESPONSE_AGGREGATE__: boolean;

interface CapturedEntry {
  contentType: string;
  content: string;
  url: string;
  method: string;
  timestamp: number;
}

/**
 * Query parameter names that contain dynamic/session-specific data.
 * These are stripped from stored URLs so that mock matching works
 * across different sessions and timestamps.
 * @source
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
 * Strips dynamic query parameters from a URL so mock files can be
 * matched across sessions regardless of timestamps, nonces, etc.
 * @source
 */
function stripDynamicParams(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of DYNAMIC_PARAMS) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * In-memory store for captured HTTP request/response pairs.
 * Only active when built with `--mode=aggregate`.
 * @source
 */
const captured = new Map<string, CapturedEntry>();

/**
 * Capture a request/response pair and store it keyed by `{hostname}/{hash}.json`.
 * Uses the same serialization as the MSW mock handler expects: `{ contentType, content }`.
 *
 * @param request - The original Request object
 * @param response - A **cloned** Response (body must not be consumed)
 * @source
 */
export async function addCapturedResponse(request: Request, response: Response): Promise<void> {
  try {
    const cacheResponse = await getCachableResponse(request, response);
    const filePath = cacheResponse.hash.file; // e.g. "www.carolina.com/6dbb7f0d.json"

    captured.set(filePath, {
      contentType: cacheResponse.data.contentType ?? "unknown",
      content: cacheResponse.data.content ?? "",
      url: request.url,
      method: request.method,
      timestamp: Date.now(),
    });

    const normalized = stripDynamicParams(request.url);
    console.log(
      `[ResponseAggregate] Captured ${request.method} ${request.url} → ${filePath} (${captured.size} total)`,
    );
    console.log(
      `[ResponseAggregate]   normalized: ${request.method}:${normalized}`,
    );
  } catch (err) {
    console.error("[ResponseAggregate] FAILED to capture:", request.method, request.url);
    console.error("[ResponseAggregate]   error:", err);
  }
}

/**
 * Download all captured responses as a zip file.
 * The zip structure mirrors `src/__mocks__/responses/{hostname}/{hash}.json`.
 * @source
 */
export async function downloadAsZip(): Promise<void> {
  if (captured.size === 0) {
    console.warn("[ResponseAggregate] No responses captured yet.");
    return;
  }

  const zip = new JSZip();

  for (const [filePath, entry] of captured) {
    // Include request metadata alongside the MSW-compatible fields so
    // the e2e mock route handler can match by URL without recomputing hashes.
    const fileContent = JSON.stringify(
      {
        contentType: entry.contentType,
        content: entry.content,
        _request: {
          url: entry.url,
          method: entry.method,
        },
      },
      null,
      2,
    );
    zip.file(filePath, fileContent);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `response-aggregate-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`[ResponseAggregate] Downloaded zip with ${captured.size} responses.`);
}

/**
 * List all captured response paths in the console.
 * @source
 */
export function list(): string[] {
  const paths = Array.from(captured.keys());
  console.table(
    Array.from(captured.entries()).map(([path, entry]) => ({
      path,
      method: entry.method,
      url: entry.url,
      contentType: entry.contentType,
    })),
  );
  return paths;
}

/**
 * Clear all captured responses.
 * @source
 */
export function clear(): void {
  const count = captured.size;
  captured.clear();
  console.log(`[ResponseAggregate] Cleared ${count} captured responses.`);
}

/**
 * Get the number of captured responses.
 * @source
 */
export function count(): number {
  return captured.size;
}

/**
 * Expose console API on `window.__responseAggregate` when in aggregate mode.
 * @source
 */
export function initConsoleApi(): void {
  if (typeof __RESPONSE_AGGREGATE__ !== "undefined" && __RESPONSE_AGGREGATE__) {
    const api = {
      download: downloadAsZip,
      list,
      clear,
      get count() {
        return captured.size;
      },
    };

    (window as unknown as Record<string, unknown>).__responseAggregate = api;

    console.log(
      "%c[ResponseAggregate] Capture mode enabled!",
      "color: #4CAF50; font-weight: bold; font-size: 14px;",
    );
    console.log("Available commands:");
    console.log("  window.__responseAggregate.download() - Download captured responses as zip");
    console.log("  window.__responseAggregate.list()     - List all captured responses");
    console.log("  window.__responseAggregate.clear()    - Clear captured responses");
    console.log("  window.__responseAggregate.count      - Number of captured responses");
  }
}
