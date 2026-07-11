import { cstorage } from "@/utils/storage";

/**
 * @group Helpers
 * @groupDescription Persistent, time-to-live caching for outbound API requests. Wraps an async
 * fetcher so results are served from `chrome.storage.local` first and only hit the network when
 * the cache is empty or stale — keeping ChemPal well under PubChem's 5-requests-per-second guidance.
 * @source
 */

/**
 * Three days in milliseconds — the default freshness window for a cached response.
 * @source
 */
export const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Prefix applied to every cache key written to `chrome.storage.local`, so cached entries are easy
 * to identify and never collide with unrelated keys.
 * @source
 */
const CACHE_KEY_PREFIX = "pubchem-cache";

/**
 * A cached value together with the epoch-ms timestamp at which it was stored.
 * @source
 */
interface CacheEntry<Result> {
  cachedAt: number;
  value: Result;
}

/**
 * Options controlling a {@link withTtlCache} wrapper.
 * @source
 */
export interface TtlCacheOptions<Args extends unknown[]> {
  /** Namespace segment separating one wrapped function's keys from another's. */
  namespace: string;
  /** How long a cached entry stays fresh, in ms. Defaults to {@link THREE_DAYS_MS}. */
  ttlMs?: number;
  /** Derives the cache key from the call arguments. Defaults to `JSON.stringify(args)`. */
  keyFromArgs?: (...args: Args) => string;
}

/**
 * Narrows an arbitrary value read back from storage to a {@link CacheEntry}. The `Result` type is
 * unchecked at runtime (as with any deserialized value); it reflects what the wrapped function
 * returned when the entry was written.
 * @param value - The value read from `chrome.storage.local`
 * @returns True if `value` has the cache-entry shape
 * @source
 */
function isCacheEntry<Result>(value: unknown): value is CacheEntry<Result> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "cachedAt") === "number" &&
    "value" in value
  );
}

/**
 * Wraps an async function with a persistent, time-to-live cache backed by `chrome.storage.local`.
 * The returned function checks the cache first and only invokes `fn` on a miss or when the cached
 * entry has expired. Only defined results are cached, so a failed or empty lookup (`undefined`) is
 * never negatively cached. Any storage error is swallowed and the call falls through to `fn`, so
 * the wrapper can never break a caller that runs without `chrome.storage`.
 * @param fn - The async function to cache
 * @param options - Cache configuration; see {@link TtlCacheOptions}
 * @returns A drop-in replacement for `fn` that serves from cache when possible
 * @example
 * ```typescript
 * const getCidsByCas = withTtlCache(getCidsByCasUncached, { namespace: "cidsByCas" });
 * await getCidsByCas("15681-89-7"); // fetches, then caches for 3 days
 * await getCidsByCas("15681-89-7"); // served from cache, no network call
 * ```
 * @source
 */
export function withTtlCache<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: TtlCacheOptions<Args>,
): (...args: Args) => Promise<Result> {
  const { namespace, ttlMs = THREE_DAYS_MS } = options;
  const keyFromArgs = options.keyFromArgs ?? ((...args: Args) => JSON.stringify(args));

  return async (...args: Args): Promise<Result> => {
    const storageKey = `${CACHE_KEY_PREFIX}:${namespace}:${keyFromArgs(...args)}`;

    // Try the cache first; any storage failure falls through to the source.
    try {
      const stored = await cstorage.local.get(storageKey);
      const entry = stored[storageKey];
      if (isCacheEntry<Result>(entry) && Date.now() - entry.cachedAt < ttlMs) {
        return entry.value;
      }
    } catch (error) {
      console.debug(`Cache read failed for "${storageKey}"; querying source`, error);
    }

    const result = await fn(...args);

    // Skip caching undefined so failed/empty lookups aren't negatively cached for the whole TTL.
    if (result !== undefined) {
      try {
        await cstorage.local.set({ [storageKey]: { cachedAt: Date.now(), value: result } });
      } catch (error) {
        console.debug(`Cache write failed for "${storageKey}"`, error);
      }
    }

    return result;
  };
}
