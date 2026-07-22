import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const idbMocks = {
  deleteSupplierQueryCacheEntry: vi.fn(async (_key: string) => {}),
  getSupplierQueryCacheEntry: vi.fn(async (_key: string) => undefined as unknown),
  putSupplierQueryCacheEntry: vi.fn(async (_key: string, _entry: CachedData<unknown>) => {}),
  getSupplierProductDataCacheEntry: vi.fn(async (_key: string) => undefined as unknown),
  putSupplierProductDataCacheEntry: vi.fn(async () => {}),
  clearSupplierQueryCache: vi.fn(async () => {}),
  clearSupplierProductDataCache: vi.fn(async () => {}),
};

vi.mock('@/utils/idbCache', () => idbMocks);
vi.mock('@/utils/Logger', () => ({
  Logger: class MockLogger {
    debug() {}
    info() {}
    warn() {}
    error() {}
  },
}));

const { SupplierCache } = await import('@/utils/SupplierCache');

describe('SupplierCache', () => {
  beforeEach(() => {
    Object.values(idbMocks).forEach((fn) => fn.mockClear());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cacheQueryResults', () => {
    it('writes the supplier display name and module class name into the cache metadata', async () => {
      const cache = new SupplierCache('Carolina', 'SupplierCarolina');

      await cache.cacheQueryResults('acetone', [{ name: 'x' }], 50);

      expect(idbMocks.putSupplierQueryCacheEntry).toHaveBeenCalledTimes(1);
      const [, entry] = idbMocks.putSupplierQueryCacheEntry.mock.calls[0];
      expect(entry.__cacheMetadata.supplier).toBe('Carolina');
      expect(entry.__cacheMetadata.supplierModule).toBe('SupplierCarolina');
      expect(entry.__cacheMetadata.query).toBe('acetone');
      expect(entry.__cacheMetadata.limit).toBe(50);
      expect(entry.__cacheMetadata.resultCount).toBe(1);
      expect(typeof entry.__cacheMetadata.version).toBe('number');
    });

    it('no-ops when the cache is disabled', async () => {
      const cache = new SupplierCache('Carolina', 'SupplierCarolina', false);
      await cache.cacheQueryResults('acetone', [{}], 5);
      expect(idbMocks.putSupplierQueryCacheEntry).not.toHaveBeenCalled();
    });

    it('skips writing an empty result set when doNotCacheEmptyResults is true', async () => {
      const cache = new SupplierCache('Carolina', 'SupplierCarolina', true, true);
      await cache.cacheQueryResults('nonexistent-chemical', [], 5);
      expect(idbMocks.putSupplierQueryCacheEntry).not.toHaveBeenCalled();
    });

    it('still caches non-empty results when doNotCacheEmptyResults is true', async () => {
      const cache = new SupplierCache('Carolina', 'SupplierCarolina', true, true);
      await cache.cacheQueryResults('acetone', [{ name: 'x' }], 5);
      expect(idbMocks.putSupplierQueryCacheEntry).toHaveBeenCalledTimes(1);
    });

    it('caches empty results when doNotCacheEmptyResults is false (default)', async () => {
      const cache = new SupplierCache('Carolina', 'SupplierCarolina');
      await cache.cacheQueryResults('nonexistent-chemical', [], 5);
      expect(idbMocks.putSupplierQueryCacheEntry).toHaveBeenCalledTimes(1);
      const [, entry] = idbMocks.putSupplierQueryCacheEntry.mock.calls[0];
      expect(entry.__cacheMetadata.resultCount).toBe(0);
    });
  });

  describe('getProductIdentityCacheKey', () => {
    it('is deterministic for the same identity and supplier', () => {
      const cache = new SupplierCache('Carolina', 'SupplierCarolina');
      expect(cache.getProductIdentityCacheKey('FAM_889460')).toBe(
        cache.getProductIdentityCacheKey('FAM_889460'),
      );
    });

    it('differs across suppliers for the same identity', () => {
      const carolina = new SupplierCache('Carolina', 'SupplierCarolina');
      const macklin = new SupplierCache('Macklin', 'SupplierMacklin');
      expect(carolina.getProductIdentityCacheKey('12345')).not.toBe(
        macklin.getProductIdentityCacheKey('12345'),
      );
    });

    it('differs across identities for the same supplier', () => {
      const cache = new SupplierCache('Carolina', 'SupplierCarolina');
      expect(cache.getProductIdentityCacheKey('FAM_889460')).not.toBe(
        cache.getProductIdentityCacheKey('FAM_888880'),
      );
    });
  });

  describe('getCachedQueryEntry version-mismatch eviction', () => {
    it('returns the entry when the cached version matches the current CACHE_VERSION', async () => {
      const cache = new SupplierCache('Carolina', 'SupplierCarolina');
      // Round-trip: write then read so the read picks up whatever version
      // the writer used (avoids hard-coding the constant in the test).
      let stored: CachedData<unknown> | undefined;
      idbMocks.putSupplierQueryCacheEntry.mockImplementationOnce(async (_key, entry) => {
        stored = entry;
      });
      await cache.cacheQueryResults('acetone', [{ a: 1 }], 10);
      idbMocks.getSupplierQueryCacheEntry.mockResolvedValueOnce(stored);

      const result = await cache.getCachedQueryEntry('any-key');

      expect(result).toBe(stored);
      expect(idbMocks.deleteSupplierQueryCacheEntry).not.toHaveBeenCalled();
    });

    it('evicts and returns undefined when the cached version differs', async () => {
      const cache = new SupplierCache('Carolina', 'SupplierCarolina');
      const staleEntry: CachedData<unknown> = {
        data: [{ a: 1 }],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __cacheMetadata: {
          cachedAt: Date.now(),
          version: 0,
          query: 'acetone',
          supplier: 'Carolina',
          supplierModule: 'SupplierCarolina',
          resultCount: 1,
          limit: 10,
        },
      };
      idbMocks.getSupplierQueryCacheEntry.mockResolvedValueOnce(staleEntry);

      const result = await cache.getCachedQueryEntry('stale-key');

      expect(result).toBeUndefined();
      expect(idbMocks.deleteSupplierQueryCacheEntry).toHaveBeenCalledExactlyOnceWith('stale-key');
    });

    it('returns undefined and skips IDB entirely when caching is disabled', async () => {
      const cache = new SupplierCache('Carolina', 'SupplierCarolina', false);
      const result = await cache.getCachedQueryEntry('any-key');
      expect(result).toBeUndefined();
      expect(idbMocks.getSupplierQueryCacheEntry).not.toHaveBeenCalled();
      expect(idbMocks.deleteSupplierQueryCacheEntry).not.toHaveBeenCalled();
    });
  });

  describe('getCachedQueryEntry TTL eviction', () => {
    /**
     * Build a fresh cache entry whose `cachedAt` is `ageMinutes` minutes
     * before now. Uses the current CACHE_VERSION (round-tripped via a write)
     * so the version-mismatch check doesn't fire first and mask the TTL path.
     */
    const buildEntryAgedMinutes = async (ageMinutes: number): Promise<CachedData<unknown>> => {
      const cache = new SupplierCache('Carolina', 'SupplierCarolina');
      let stored: CachedData<unknown> | undefined;
      idbMocks.putSupplierQueryCacheEntry.mockImplementationOnce(async (_key, entry) => {
        stored = entry;
      });
      await cache.cacheQueryResults('acetone', [{ a: 1 }], 10);
      // Backdate the entry. Round-tripping the write captures the real
      // CACHE_VERSION so we don't have to hard-code it.
      stored!.__cacheMetadata.cachedAt = Date.now() - ageMinutes * 60_000;
      idbMocks.putSupplierQueryCacheEntry.mockClear();
      return stored!;
    };

    it('does not expire entries when cacheTtlMinutes is 0 (the default)', async () => {
      const entry = await buildEntryAgedMinutes(120); // 2 hours old
      idbMocks.getSupplierQueryCacheEntry.mockResolvedValueOnce(entry);

      const cache = new SupplierCache('Carolina', 'SupplierCarolina', true, false, 0);
      const result = await cache.getCachedQueryEntry('any-key');

      expect(result).toBe(entry);
      expect(idbMocks.deleteSupplierQueryCacheEntry).not.toHaveBeenCalled();
    });

    it('returns the entry when its age is within the TTL', async () => {
      const entry = await buildEntryAgedMinutes(5);
      idbMocks.getSupplierQueryCacheEntry.mockResolvedValueOnce(entry);

      const cache = new SupplierCache('Carolina', 'SupplierCarolina', true, false, 60);
      const result = await cache.getCachedQueryEntry('fresh-key');

      expect(result).toBe(entry);
      expect(idbMocks.deleteSupplierQueryCacheEntry).not.toHaveBeenCalled();
    });

    it('evicts and returns undefined when the entry is older than the TTL', async () => {
      const entry = await buildEntryAgedMinutes(120); // 2 hours old
      idbMocks.getSupplierQueryCacheEntry.mockResolvedValueOnce(entry);

      const cache = new SupplierCache('Carolina', 'SupplierCarolina', true, false, 60);
      const result = await cache.getCachedQueryEntry('expired-key');

      expect(result).toBeUndefined();
      expect(idbMocks.deleteSupplierQueryCacheEntry).toHaveBeenCalledExactlyOnceWith('expired-key');
    });

    it('treats negative or non-finite TTL inputs as disabled', async () => {
      const entry = await buildEntryAgedMinutes(120);
      idbMocks.getSupplierQueryCacheEntry.mockResolvedValueOnce(entry);

      const cache = new SupplierCache('Carolina', 'SupplierCarolina', true, false, -5);
      const result = await cache.getCachedQueryEntry('any-key');

      expect(result).toBe(entry);
      expect(idbMocks.deleteSupplierQueryCacheEntry).not.toHaveBeenCalled();
    });
  });
});
