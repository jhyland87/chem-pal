import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CachedData } from "@/suppliers/SupplierBase";

const idbMocks = {
  deleteSupplierQueryCacheEntry: vi.fn(async (_key: string) => {}),
  getSupplierQueryCacheEntry: vi.fn(async (_key: string) => undefined as unknown),
  putSupplierQueryCacheEntry: vi.fn(async (_key: string, _entry: CachedData<unknown>) => {}),
  getSupplierProductDataCacheEntry: vi.fn(async (_key: string) => undefined as unknown),
  putSupplierProductDataCacheEntry: vi.fn(async () => {}),
  clearSupplierQueryCache: vi.fn(async () => {}),
  clearSupplierProductDataCache: vi.fn(async () => {}),
};

vi.mock("@/utils/idbCache", () => idbMocks);
vi.mock("@/utils/Logger", () => ({
  default: class MockLogger {
    debug() {}
    info() {}
    warn() {}
    error() {}
  },
}));

const SupplierCacheModule = await import("@/utils/SupplierCache");
const SupplierCache = SupplierCacheModule.default;

describe("SupplierCache", () => {
  beforeEach(() => {
    Object.values(idbMocks).forEach((fn) => fn.mockClear());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("cacheQueryResults", () => {
    it("writes the supplier display name and module class name into the cache metadata", async () => {
      const cache = new SupplierCache("Carolina", "SupplierCarolina");

      await cache.cacheQueryResults("acetone", [{ name: "x" }], 50);

      expect(idbMocks.putSupplierQueryCacheEntry).toHaveBeenCalledTimes(1);
      const [, entry] = idbMocks.putSupplierQueryCacheEntry.mock.calls[0];
      expect(entry.__cacheMetadata.supplier).toBe("Carolina");
      expect(entry.__cacheMetadata.supplierModule).toBe("SupplierCarolina");
      expect(entry.__cacheMetadata.query).toBe("acetone");
      expect(entry.__cacheMetadata.limit).toBe(50);
      expect(entry.__cacheMetadata.resultCount).toBe(1);
      expect(typeof entry.__cacheMetadata.version).toBe("number");
    });

    it("no-ops when the cache is disabled", async () => {
      const cache = new SupplierCache("Carolina", "SupplierCarolina", false);
      await cache.cacheQueryResults("acetone", [{}], 5);
      expect(idbMocks.putSupplierQueryCacheEntry).not.toHaveBeenCalled();
    });

    it("skips writing an empty result set when doNotCacheEmptyResults is true", async () => {
      const cache = new SupplierCache("Carolina", "SupplierCarolina", true, true);
      await cache.cacheQueryResults("nonexistent-chemical", [], 5);
      expect(idbMocks.putSupplierQueryCacheEntry).not.toHaveBeenCalled();
    });

    it("still caches non-empty results when doNotCacheEmptyResults is true", async () => {
      const cache = new SupplierCache("Carolina", "SupplierCarolina", true, true);
      await cache.cacheQueryResults("acetone", [{ name: "x" }], 5);
      expect(idbMocks.putSupplierQueryCacheEntry).toHaveBeenCalledTimes(1);
    });

    it("caches empty results when doNotCacheEmptyResults is false (default)", async () => {
      const cache = new SupplierCache("Carolina", "SupplierCarolina");
      await cache.cacheQueryResults("nonexistent-chemical", [], 5);
      expect(idbMocks.putSupplierQueryCacheEntry).toHaveBeenCalledTimes(1);
      const [, entry] = idbMocks.putSupplierQueryCacheEntry.mock.calls[0];
      expect(entry.__cacheMetadata.resultCount).toBe(0);
    });
  });

  describe("getCachedQueryEntry version-mismatch eviction", () => {
    it("returns the entry when the cached version matches the current CACHE_VERSION", async () => {
      const cache = new SupplierCache("Carolina", "SupplierCarolina");
      // Round-trip: write then read so the read picks up whatever version
      // the writer used (avoids hard-coding the constant in the test).
      let stored: CachedData<unknown> | undefined;
      idbMocks.putSupplierQueryCacheEntry.mockImplementationOnce(async (_key, entry) => {
        stored = entry;
      });
      await cache.cacheQueryResults("acetone", [{ a: 1 }], 10);
      idbMocks.getSupplierQueryCacheEntry.mockResolvedValueOnce(stored);

      const result = await cache.getCachedQueryEntry("any-key");

      expect(result).toBe(stored);
      expect(idbMocks.deleteSupplierQueryCacheEntry).not.toHaveBeenCalled();
    });

    it("evicts and returns undefined when the cached version differs", async () => {
      const cache = new SupplierCache("Carolina", "SupplierCarolina");
      const staleEntry: CachedData<unknown> = {
        data: [{ a: 1 }],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __cacheMetadata: {
          cachedAt: Date.now(),
          version: 0,
          query: "acetone",
          supplier: "Carolina",
          supplierModule: "SupplierCarolina",
          resultCount: 1,
          limit: 10,
        },
      };
      idbMocks.getSupplierQueryCacheEntry.mockResolvedValueOnce(staleEntry);

      const result = await cache.getCachedQueryEntry("stale-key");

      expect(result).toBeUndefined();
      expect(idbMocks.deleteSupplierQueryCacheEntry).toHaveBeenCalledExactlyOnceWith("stale-key");
    });

    it("returns undefined and skips IDB entirely when caching is disabled", async () => {
      const cache = new SupplierCache("Carolina", "SupplierCarolina", false);
      const result = await cache.getCachedQueryEntry("any-key");
      expect(result).toBeUndefined();
      expect(idbMocks.getSupplierQueryCacheEntry).not.toHaveBeenCalled();
      expect(idbMocks.deleteSupplierQueryCacheEntry).not.toHaveBeenCalled();
    });
  });
});
