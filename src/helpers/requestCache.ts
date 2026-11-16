import { chemicalInfo } from '@/../config.json';
import { cstorage } from '@/utils/storage';
import { Logger } from '@/utils/Logger';

const logger = new Logger('requestCache');

/**
 * @group Helpers
 * @groupDescription Persistent, time-to-live caching for outbound API requests. Wraps an async
 * fetcher so results are served from `chrome.storage.local` first and only hit the network when
 * the cache is empty or stale — keeping ChemPal well under PubChem's 5-requests-per-second guidance.
 * @source
 */

/**
 * Default freshness window for a cached response, in ms (`chemicalInfo.cacheTtlDays` in
 * config.json).
 * @category Helpers
 * @source
 */
export const DEFAULT_CACHE_TTL_MS = chemicalInfo.cacheTtlDays * 24 * 60 * 60 * 1000;

/**
 * Prefix applied to every cache key written to `chrome.storage.local`, so cached entries are easy
 * to identify and never collide with unrelated keys.
 * @source
 */
const CACHE_KEY_PREFIX = 'pubchem-cache';

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
 * @category Helpers
 * @source
 */
export interface TtlCacheOptions<Args extends unknown[]> {
  /** Namespace segment separating one wrapped function's keys from another's. */
  namespace: string;
  /** How long a cached entry stays fresh, in ms. Defaults to {@link DEFAULT_CACHE_TTL_MS}. */
  ttlMs?: number;
  /** Derives the cache key from the call arguments. Defaults to `JSON.stringify(args)`. */
  keyFromArgs?: (...args: Args) => string;
}

/**
 * Calls `fetch` with a timeout. The abort also covers reading the body, so a stalled response
 * can't hang a caller; the rejection is a `TimeoutError` `DOMException`.
 * @category Helpers
 * @param input - The URL or request to fetch
 * @param init - Extra fetch options; any `signal` is replaced by the timeout signal
 * @param timeoutMs - Milliseconds before aborting. Defaults to `chemicalInfo.sourceTimeoutMs`.
 * @returns The response
 * @example
 * ```typescript
 * const response = await fetchWithTimeout("https://pubchem.ncbi.nlm.nih.gov/rest/pug/...");
 * // Rejects with a TimeoutError after 8 s without a complete response
 * ```
 * @source
 */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = chemicalInfo.sourceTimeoutMs,
): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
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
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'cachedAt') === 'number' &&
    'value' in value
  );
}

/**
 * Wraps an async function with a persistent, time-to-live cache backed by `chrome.storage.local`.
 * The returned function checks the cache first and only invokes `fn` on a miss or when the cached
 * entry has expired. Only defined results are cached, so a failed or empty lookup (`undefined`) is
 * never negatively cached. Any storage error is swallowed and the call falls through to `fn`, so
 * the wrapper can never break a caller that runs without `chrome.storage`.
 * @category Helpers
 * @param fn - The async function to cache
 * @param options - Cache configuration; see {@link TtlCacheOptions}
 * @returns A drop-in replacement for `fn` that serves from cache when possible
 * @example
 * ```typescript
 * const getCidsByCas = withTtlCache(getCidsByCasUncached, { namespace: "cidsByCas" });
 * await getCidsByCas("15681-89-7"); // fetches, then caches for 3 days (the default)
 * await getCidsByCas("15681-89-7"); // served from cache, no network call
 * ```
 * @source
 */
export function withTtlCache<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: TtlCacheOptions<Args>,
): (...args: Args) => Promise<Result> {
  const { namespace, ttlMs = DEFAULT_CACHE_TTL_MS } = options;
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
      logger.debug(`Cache read failed for "${storageKey}"; querying source`, { error });
    }

    const result = await fn(...args);

    // Skip caching undefined so failed/empty lookups aren't negatively cached for the whole TTL.
    if (result !== undefined) {
      try {
        await cstorage.local.set({ [storageKey]: { cachedAt: Date.now(), value: result } });
      } catch (error) {
        logger.debug(`Cache write failed for "${storageKey}"`, { error });
      }
    }

    return result;
  };
}
