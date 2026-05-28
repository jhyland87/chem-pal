import type { UOM } from "@/constants/common";

declare global {
  /**
   * Metadata about cached results including timestamp and version information.
   * Helps determine if cached data is stale or needs to be refreshed.
   */
  interface CacheMetadata {
    /** When the data was cached */
    cachedAt: number;
    /** Version of the cache format — useful for cache invalidation */
    version: number;
    /** Original query that produced these results */
    query: string;
    /** Supplier display name that provided these results */
    supplier: string;
    /** Supplier module class name (e.g. "SupplierCarolina") that produced this entry */
    supplierModule: string;
    /** Number of results in the cache */
    resultCount: number;
    /** Limit used to generate this cache */
    limit: number;
  }

  /**
   * Cached data envelope: the results plus their associated metadata.
   */
  interface CachedData<T> {
    /** The actual cached results */
    data: T[];
    /** Metadata about the cache entry */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __cacheMetadata: CacheMetadata;
  }

  /**
   * Default values applied to a supplier's products; overridden when
   * matching fields are found in the parsed product data.
   */
  interface ProductDefaults {
    currencyCode?: CurrencyCode;
    currencySymbol?: CurrencySymbol;
    uom?: UOM;
    quantity?: number;
  }
}

export {};
