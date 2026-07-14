import { Logger } from "@/utils/Logger";
import {
  clearSupplierProductDataCache,
  clearSupplierQueryCache,
  deleteSupplierQueryCacheEntry,
  getSupplierProductDataCacheEntry,
  getSupplierQueryCacheEntry,
  putSupplierProductDataCacheEntry,
  putSupplierQueryCacheEntry,
} from "@/utils/idbCache";
import { getProductIdentityKey } from "@/helpers/productIdentity";

/**
 * Utility class for managing supplier data caching in IndexedDB.
 * Provides a robust caching system for both query results and product detail data.
 *
 * @remarks
 * The cache system uses two IndexedDB object stores:
 * 1. `supplierQueryCache` - Stores search query results (one record per query+supplier)
 * 2. `supplierProductDataCache` - Stores detailed product data (one record per product)
 *
 * Each store supports max 100 entries with LRU eviction handled by idbCache.
 * @category Utils
 * @typeParam T - The type of data being cached
 * @source
 */
export class SupplierCache {
  //The version of the cache format. Bumped 2 -> 3 when the product-data cache
  //moved from URL-based keys to supplier + unique-product-identity keys, so
  //stale query entries evict on read and repopulate under the new scheme. Bumped
  //3 -> 4 when per-product purchaseRestriction parsing was added, so pre-feature
  //entries (which lack it and would show as unrestricted) evict and re-parse.
  //
  //Deprecated as the invalidation lever: do NOT bump this for future format
  //changes. Cache-format changes are now expressed as migration steps under
  //src/migrations/steps (e.g. a step that calls clearSupplierQueryCache). The
  //read-time guard below is kept only as a lazy safety net for pre-migration
  //caches on existing installs, and can be removed once the app_meta version
  //marker is universally present.
  private static readonly CACHE_VERSION = 4;

  // The logger instance.
  private logger: Logger;

  // Name of the supplier this cache is bound to. Mixed into query keys and
  // product-data keys so two suppliers that happen to share a URL or query
  // string don't collide.
  private supplierName: string;

  // Class name of the supplier module that owns this cache (e.g.
  // "SupplierCarolina"). Stored on each cache entry's metadata to make it
  // possible to trace an entry back to the exact module that wrote it,
  // independent of the human-readable display name.
  private supplierModule: string;

  // When false, all reads return undefined and all writes no-op. Lets callers
  // honor userSettings.caching without every cache-call site needing its own
  // guard.
  private enabled: boolean;

  // Mirrors userSettings.doNotCacheEmptyResults. When true, a query that
  // returns zero results is not written to the cache, so a previously
  // out-of-stock supplier surfaces fresh results on the next search instead
  // of returning the cached empty list.
  private doNotCacheEmptyResults: boolean;

  // Mirrors userSettings.cacheTtlMinutes, stored here in milliseconds for
  // direct comparison against `Date.now() - cachedAt`. A value of 0 disables
  // TTL expiration (preserves the original behavior where entries live until
  // LRU eviction or version-mismatch eviction).
  private cacheTtlMs: number;

  constructor(
    supplierName: string,
    supplierModule: string,
    enabled: boolean = true,
    doNotCacheEmptyResults: boolean = false,
    cacheTtlMinutes: number = 0,
  ) {
    this.logger = new Logger(supplierName);
    this.supplierName = supplierName;
    this.supplierModule = supplierModule;
    this.enabled = enabled;
    this.doNotCacheEmptyResults = doNotCacheEmptyResults;
    // Coerce here so callers can hand us a string from a TextField without
    // every call site needing to remember to parse first. Negative or NaN
    // values fall back to 0 (TTL disabled).
    const minutes = Number(cacheTtlMinutes);
    this.cacheTtlMs = Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : 0;
    this.logger.debug("SupplierCache initialized", {
      supplierName,
      supplierModule,
      enabled,
      doNotCacheEmptyResults,
      cacheTtlMinutes,
      cacheTtlMs: this.cacheTtlMs,
    });
  }

  /**
   * Generates a cache key based on the query and the bound supplier name.
   * The limit is intentionally excluded as it only affects how many results are returned,
   * not the actual search results themselves.
   * @source
   */
  generateCacheKey(query: string): string {
    const data = `${query || ""}:${this.supplierName}`;
    this.logger.debug("Generating cache key with:", {
      query,
      supplierName: this.supplierName,
      data,
    });
    try {
      // Try browser's btoa first
      const key = btoa(data);
      this.logger.debug("Generated cache key:", key);
      return key;
    } catch {
      try {
        // Fallback to Node's Buffer if available
        if (typeof Buffer !== "undefined") {
          const key = Buffer.from(data).toString("base64");
          this.logger.debug("Generated cache key (Buffer):", { key });
          return key;
        }
        // If neither is available, use a simple hash function
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
          const char = data.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        const key = hash.toString(36);
        this.logger.debug("Generated cache key (hash):", { key });
        return key;
      } catch (error) {
        this.logger.error("Error generating cache key:", error);
        // Fallback to a simple string if all else fails
        const key = data.replace(/[^a-zA-Z0-9]/g, "_");
        this.logger.debug("Generated cache key (fallback):", { key });
        return key;
      }
    }
  }

  /**
   * Generates a cache key for product detail data from the supplier's stable
   * product identity (`SupplierBase.getUniqueProductKey`) and the bound
   * supplier name. The key is independent of the product URL, so a product
   * enriched under one search hydrates any other search that surfaces it — even
   * when the URL varies between the query and detail phases. Shares its shape
   * with the exclusion key ({@link getProductIdentityKey}) so cache and
   * exclusion agree.
   * @source
   */
  getProductIdentityCacheKey(identity: string): string {
    return getProductIdentityKey(identity, this.supplierName);
  }

  /**
   * Stores query results in the cache.
   * LRU eviction (max 100 entries) is handled by idbCache.
   * @source
   */
  async cacheQueryResults(query: string, results: unknown[], limit: number): Promise<void> {
    if (!this.enabled) return;
    if (this.doNotCacheEmptyResults && results.length === 0) {
      this.logger.debug("Skipping empty-result cache write per doNotCacheEmptyResults", {
        query,
        supplierName: this.supplierName,
      });
      return;
    }
    this.logger.debug("[SupplierCache] Caching query results", {
      query,
      supplierName: this.supplierName,
      results,
      limit,
    });

    try {
      const key = this.generateCacheKey(query);

      const entry: CachedData<unknown> = {
        data: results,
        __cacheMetadata: {
          cachedAt: Date.now(),
          version: SupplierCache.CACHE_VERSION,
          query,
          supplier: this.supplierName,
          supplierModule: this.supplierModule,
          resultCount: results.length,
          limit,
        },
      };

      this.logger.debug("Cached query results", {
        key,
        metadata: entry.__cacheMetadata,
      });

      await putSupplierQueryCacheEntry(key, entry);
    } catch (error) {
      this.logger.error("Error storing query results in cache:", { error });
    }
  }

  /**
   * Retrieves cached product data for a given key.
   * Updates the timestamp on access to prevent premature eviction.
   * @source
   */
  async getCachedProductData(key: string): Promise<Maybe<Record<string, unknown>>> {
    if (!this.enabled) return undefined;
    this.logger.debug("[SupplierCache] Getting cached product data", { key });
    try {
      const cached = await getSupplierProductDataCacheEntry(key);
      if (cached) {
        // Refresh timestamp on access
        await putSupplierProductDataCacheEntry(key, {
          data: cached.data,
          timestamp: Date.now(),
        });
        return cached.data;
      }
      return undefined;
    } catch (error) {
      this.logger.error("Error retrieving product data from cache:", { error });
      return undefined;
    }
  }

  /**
   * Stores product data in the cache.
   * LRU eviction (max 100 entries) is handled by idbCache.
   * @source
   */
  async cacheProductData(key: string, data: Record<string, unknown>): Promise<void> {
    if (!this.enabled) return;
    this.logger.debug("Caching product data", { key, data });
    try {
      await putSupplierProductDataCacheEntry(key, {
        data,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error("Error storing product data in cache:", { error });
    }
  }

  /**
   * Retrieves a cached query entry by key.
   * @source
   */
  async getCachedQueryEntry(key: string): Promise<CachedData<unknown> | undefined> {
    if (!this.enabled) return undefined;
    this.logger.debug("Getting cached query entry", { key });
    try {
      const cached = await getSupplierQueryCacheEntry(key);
      if (cached && cached.__cacheMetadata.version !== SupplierCache.CACHE_VERSION) {
        this.logger.debug("Evicting stale cache entry due to version mismatch", {
          key,
          cachedVersion: cached.__cacheMetadata.version,
          currentVersion: SupplierCache.CACHE_VERSION,
        });
        await deleteSupplierQueryCacheEntry(key);
        return undefined;
      }
      if (cached && this.cacheTtlMs > 0) {
        const age = Date.now() - cached.__cacheMetadata.cachedAt;
        if (age > this.cacheTtlMs) {
          this.logger.debug("Evicting expired cache entry due to TTL", {
            key,
            ageMs: age,
            ttlMs: this.cacheTtlMs,
          });
          await deleteSupplierQueryCacheEntry(key);
          return undefined;
        }
      }
      return cached;
    } catch (error) {
      this.logger.error("Error retrieving query cache entry:", { error });
      return undefined;
    }
  }

  /**
   * Clears both the query cache and product data cache from IndexedDB.
   * @source
   */
  static async clearAll(): Promise<void> {
    await Promise.all([clearSupplierQueryCache(), clearSupplierProductDataCache()]);
  }
}
