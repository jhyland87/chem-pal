import { md5 } from "js-md5";

/**
 * Metadata about cached results including timestamp and version information.
 * This helps determine if cached data is stale or needs to be refreshed.
 */
export interface CacheMetadata {
  /** When the data was cached */
  cachedAt: number;
  /** Version of the cache format - useful for cache invalidation */
  version: number;
  /** Original query that produced these results */
  query?: string;
  /** Supplier that provided these results */
  supplier: string;
  /** Number of results in the cache */
  resultCount: number;
}

/**
 * Type for cached data including the results and metadata
 */
export interface CachedData<T> {
  /** The actual cached results */
  data: T[];
  /** Metadata about the cache entry */
  __cacheMetadata: CacheMetadata;
}

export const CACHE_VERSION = 1;
export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
export const CACHE_SIZE = 100;

/**
 * Determines if a cache entry is stale based on its metadata.
 * @param metadata - The cache metadata to check
 * @returns true if the cache entry should be considered stale
 */
export function isCacheStale(metadata: CacheMetadata): boolean {
  if (metadata.version !== CACHE_VERSION) {
    return true;
  }
  const age = Date.now() - metadata.cachedAt;
  if (age > CACHE_MAX_AGE) {
    return true;
  }
  return false;
}

/**
 * Generates a cache key for query results based on the query string and supplier name.
 * The limit is intentionally excluded as it only affects how many results are returned,
 * not the actual search results themselves.
 * @param query - The search query
 * @param supplierName - The supplier name
 * @returns A string hash that uniquely identifies this search query
 */
export function getQueryCacheKey(query: string, supplierName: string): string {
  const data = `${query}:${supplierName}`;
  return md5(data);
}

/**
 * Removes timestamp-like parameters from an object (timestamp, timestampe, _),
 * but never removes a parameter named 'code'.
 * Used to ensure cache keys are not affected by volatile timestamp params.
 * Does not mutate the original object.
 */
export function stripTimestampParams<T extends Record<string, any>>(params: T): Partial<T> {
  const forbidden = ["timestamp", "timestampe", "_"];
  return Object.fromEntries(
    Object.entries(params).filter(
      ([key]) => key === "code" || !forbidden.includes(key.toLowerCase()),
    ),
  ) as Partial<T>;
}

/**
 * Generates a cache key for product detail data based only on the HTTP request URL and params.
 * This ensures that identical detail requests (even from different queries) share the same cache entry.
 * Do NOT include the original search query or any unrelated context.
 *
 * @param url - The product detail URL
 * @param params - The params used in the actual HTTP request for product details
 * @param supplierName - The supplier name
 * @returns A stable cache key for the product detail fetch
 */
export function getProductDataCacheKey(
  url: string,
  params: Record<string, string> | undefined,
  supplierName: string,
): string {
  // Remove timestamp params for cache key only
  const cleanParams = params ? stripTimestampParams(params) : {};
  const data = {
    url,
    params: cleanParams,
    supplier: supplierName,
  };
  return md5(JSON.stringify(data));
}
