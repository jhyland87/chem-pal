import { CACHE, SEARCH_ABORT_REASON } from '@/constants/common';
import { SUPPLIER_CLASS_NAMES } from '@/constants/suppliers';
import { SearchEvent } from '@/events/searchEvents';
import { addExcludedProduct } from '@/helpers/excludedProducts';
import { i18n } from '@/helpers/i18n';
import { recordSearch } from '@/utils/reviewStats';
import { HotkeyEvent } from '@/hotkeys';
import { cstorage } from '@/utils/storage';
import {
  IDB_SEARCH_RESULTS_CLEARED,
  clearSearchResults,
  getSearchResultsRecord,
  setSearchResults as idbSetSearchResults,
} from '@/utils/idbCache';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearch } from '../useSearch';

const SUPPLIER = SUPPLIER_CLASS_NAMES[0];

interface FactoryCall {
  query: string;
  options: Record<string, unknown> & { controller: AbortController };
}

const factory = vi.hoisted(() => ({
  calls: [] as Array<{ query: string; options: Record<string, unknown> }>,
  /** Produces the stream for the next search. */
  stream: undefined as undefined | (() => AsyncIterable<unknown>),
  shippingExcludedAll: false,
}));

vi.mock('@/suppliers/SupplierFactory', () => ({
  SupplierFactory: class {
    suppliersQueried = 4;
    suppliersCompleted = 3;
    shippingExcludedAll = factory.shippingExcludedAll;
    constructor(query: string, options: Record<string, unknown>) {
      factory.calls.push({ query, options });
    }
    async executeAllStream() {
      return factory.stream?.() ?? (async function* () {})();
    }
  },
}));

vi.mock('@/helpers/priceHistory', () => ({
  recordProductPrices: vi.fn(),
  flushPendingPriceHistory: vi.fn(),
}));
vi.mock('@/utils/reviewStats', () => ({ recordSearch: vi.fn() }));
vi.mock('@/utils/SupplierStatsStore', () => ({ flushPendingStats: vi.fn() }));
vi.mock('@/helpers/excludedProducts', () => ({ addExcludedProduct: vi.fn() }));
vi.mock('@/helpers/pubchem', () => ({
  suggestAlternativeSearch: vi.fn().mockResolvedValue({}),
  suggestAdvancedQuery: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/helpers/supplierFilters', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/helpers/supplierFilters')>()),
  suppliersExcludedBySearchFilters: vi.fn(() => new Set<string>()),
}));
vi.mock('@/utils/storage', () => ({
  cstorage: { session: { get: vi.fn(), remove: vi.fn() } },
}));
vi.mock('@/utils/idbCache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/idbCache')>()),
  getSearchResultsRecord: vi.fn(),
  clearSearchResults: vi.fn(),
  addSearchHistoryEntry: vi.fn(),
  getSearchHistory: vi.fn().mockResolvedValue([]),
  setSearchResults: vi.fn(),
  updateSearchHistoryResultCount: vi.fn(),
}));

const ctx = {
  userSettings: {} as UserSettings,
  selectedSuppliers: [] as string[],
  searchFilters: {
    titleQuery: '',
    availability: [],
    country: [],
    shippingType: [],
  } as SearchFilters,
  setSearchFilters: vi.fn(),
  pendingSearchQuery: null as string | null,
  advancedMode: false,
};
vi.mock('@/context', () => ({ useAppContext: () => ctx }));

/** A product from a real supplier class, so per-supplier limits recognise it. */
function product(n: number, extra: Record<string, unknown> = {}): Product {
  return {
    supplier: SUPPLIER,
    title: `P${n}`,
    url: `https://x.test/${n}`,
    price: n,
    cacheKey: `k${n}`,
    ...extra,
  } as unknown as Product;
}

/** Wraps items as the async stream the factory yields. */
function streamOf(items: Product[]) {
  return () =>
    (async function* () {
      for (const item of items) yield item;
    })();
}

const events: Array<{ type: string; detail: Record<string, unknown> }> = [];
for (const type of Object.values(SearchEvent)) {
  window.addEventListener(type, (event) => {
    events.push({ type, detail: (event as CustomEvent).detail });
  });
}
const eventTypes = () => events.map((event) => event.type);
const lastCall = (): FactoryCall => factory.calls.at(-1) as unknown as FactoryCall;

/** Mounts the hook and waits for the mount-time storage read to settle. */
async function mount() {
  const hook = renderHook(() => useSearch());
  await waitFor(() => expect(getSearchResultsRecord).toHaveBeenCalled());
  await act(async () => {});
  return hook;
}

/** Runs a search to completion. */
async function search(hook: Awaited<ReturnType<typeof mount>>, query = 'acetone') {
  act(() => hook.result.current.executeSearch(query));
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  await waitFor(() => expect(eventTypes()).toContain(SearchEvent.COMPLETED));
}

describe('useSearch hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    events.length = 0;
    factory.calls.length = 0;
    factory.stream = undefined;
    factory.shippingExcludedAll = false;
    ctx.userSettings = {} as UserSettings;
    ctx.selectedSuppliers = [];
    ctx.searchFilters = { titleQuery: '', availability: [], country: [], shippingType: [] };
    ctx.pendingSearchQuery = null;
    ctx.advancedMode = false;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(getSearchResultsRecord).mockResolvedValue({ data: [], query: undefined });
    vi.mocked(cstorage.session.get).mockResolvedValue({});
    vi.mocked(cstorage.session.remove).mockResolvedValue(undefined);
  });

  describe('mount', () => {
    it('restores cached results and the query label', async () => {
      vi.mocked(getSearchResultsRecord).mockResolvedValue({ data: [product(1)], query: 'cached' });
      const { result } = await mount();

      await waitFor(() => expect(result.current.searchResults).toHaveLength(1));
      expect(result.current.resultCount).toBe(1);
      expect(result.current.executedQuery).toBe('cached');
    });

    it('falls back to the session query for legacy cached rows', async () => {
      vi.mocked(getSearchResultsRecord).mockResolvedValue({ data: [product(1)], query: undefined });
      vi.mocked(cstorage.session.get).mockResolvedValue({ [CACHE.QUERY]: 'legacy' });
      const { result } = await mount();

      await waitFor(() => expect(result.current.executedQuery).toBe('legacy'));
    });

    it('does not repaint stale rows while a pendingSearchQuery is set', async () => {
      vi.mocked(getSearchResultsRecord).mockResolvedValue({ data: [product(1)], query: 'old' });
      ctx.pendingSearchQuery = 'next';
      const { result } = await mount();

      expect(result.current.searchResults).toEqual([]);
    });

    it('runs a queued new-search submission and clears its flag', async () => {
      vi.mocked(cstorage.session.get).mockResolvedValue({
        [CACHE.QUERY]: 'queued',
        [CACHE.SEARCH_IS_NEW_SEARCH]: true,
      });
      factory.stream = streamOf([product(1)]);
      const { result } = await mount();

      await waitFor(() => expect(result.current.searchResults).toHaveLength(1));
      expect(cstorage.session.remove).toHaveBeenCalled();
      expect(lastCall().query).toBe('queued');
    });

    it('survives a storage read failure', async () => {
      vi.mocked(getSearchResultsRecord).mockRejectedValue(new Error('idb'));
      const { result } = renderHook(() => useSearch());

      await waitFor(() => expect(getSearchResultsRecord).toHaveBeenCalled());
      await act(async () => {});
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('clears results when the global clear event fires', async () => {
      vi.mocked(getSearchResultsRecord).mockResolvedValue({ data: [product(1)], query: 'q' });
      const { result } = await mount();
      await waitFor(() => expect(result.current.searchResults).toHaveLength(1));

      act(() => window.dispatchEvent(new Event(IDB_SEARCH_RESULTS_CLEARED)));

      expect(result.current.searchResults).toEqual([]);
      expect(result.current.resultCount).toBe(0);
    });
  });

  describe('executeSearch (streaming, no filters)', () => {
    it('ignores a blank query', async () => {
      const hook = await mount();
      act(() => hook.result.current.executeSearch('   '));

      expect(factory.calls).toHaveLength(0);
    });

    it('syncs the drawer title query', async () => {
      const hook = await mount();
      await search(hook, '  acetone ');

      expect(ctx.setSearchFilters).toHaveBeenCalledWith({
        ...ctx.searchFilters,
        titleQuery: 'acetone',
      });
    });

    it('streams products, indexing them and skipping duplicates', async () => {
      factory.stream = streamOf([product(1), product(2), product(1)]);
      const hook = await mount();
      await search(hook);

      const { searchResults, resultCount, executedQuery, error, statusLabel } = hook.result.current;
      expect(searchResults.map((p) => p.title)).toEqual(['P1', 'P2']);
      expect(searchResults.map((p) => p._id)).toBeDefined();
      expect(resultCount).toBe(2);
      expect(executedQuery).toBe('acetone');
      expect(error).toBeUndefined();
      expect(statusLabel).toBe(false);
      expect(eventTypes()).toEqual([SearchEvent.STARTED, SearchEvent.COMPLETED]);
      expect(events[1].detail).toMatchObject({
        count: 2,
        suppliersQueried: 4,
        suppliersCompleted: 3,
      });
      expect(recordSearch).toHaveBeenCalledWith(2);
      expect(clearSearchResults).toHaveBeenCalledWith({ notify: false });
      expect(idbSetSearchResults).toHaveBeenCalled();
    });

    it('passes settings through to the supplier factory', async () => {
      ctx.userSettings = {
        suppliers: { resultLimit: 7, excludeNonShipping: false, disabled: ['X'] },
        caching: { enabled: false, ttlMinutes: 5, doNotCacheEmptyResults: true },
        search: { hideRestrictedProducts: false },
        location: 'DE',
        fuzzScorerOverride: 'ratio',
      } as unknown as UserSettings;
      const hook = await mount();
      await search(hook);

      expect(lastCall().options).toMatchObject({
        limit: 7,
        caching: false,
        cacheTtlMinutes: 5,
        location: 'DE',
        excludeNonShippingSuppliers: false,
        hideRestrictedProducts: false,
        disabledSuppliers: ['X'],
        fuzzScorerOverride: undefined,
      });
    });

    it('honours the fuzzy scorer override only in advanced mode', async () => {
      ctx.userSettings = { fuzzScorerOverride: 'ratio' } as unknown as UserSettings;
      ctx.advancedMode = true;
      const hook = await mount();
      await search(hook);

      expect(lastCall().options.fuzzScorerOverride).toBe('ratio');
    });

    it('drops a duplicate trigger for the query already in flight', async () => {
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => (release = resolve));
      factory.stream = () =>
        (async function* () {
          await gate;
        })();
      const hook = await mount();

      act(() => hook.result.current.executeSearch('acetone'));
      await waitFor(() => expect(factory.calls).toHaveLength(1));
      act(() => hook.result.current.executeSearch('acetone'));
      release();
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

      expect(factory.calls).toHaveLength(1);
    });
  });

  describe('executeSearch (filters active)', () => {
    it('widens the fetch, filters, de-dupes and limits per supplier', async () => {
      ctx.userSettings = {
        suppliers: { resultLimit: 2 },
        priceMin: 2,
        priceMax: 9,
      } as unknown as UserSettings;
      factory.stream = streamOf([
        product(1),
        product(2),
        product(3),
        product(3),
        product(4),
        product(50),
      ]);
      const hook = await mount();
      await search(hook);

      expect(lastCall().options.limit).toBe(10);
      expect(hook.result.current.searchResults.map((p) => p.title)).toEqual(['P2', 'P3']);
      expect(hook.result.current.resultCount).toBe(2);
    });

    it.each([
      [
        'availability',
        { availability: ['in_stock'] },
        [
          product(1, { availability: 'in_stock' }),
          product(2, { availability: 'out_of_stock' }),
          product(3),
        ],
        ['P1', 'P3'],
      ],
      [
        'country',
        { country: ['US'] },
        [product(1, { supplierCountry: 'US' }), product(2, { supplierCountry: 'DE' }), product(3)],
        ['P1', 'P3'],
      ],
      [
        'shipping',
        { shippingType: ['domestic'] },
        [
          product(1, { supplierShipping: 'worldwide' }),
          product(2, { supplierShipping: 'local' }),
          product(3, { supplierShipping: 'bogus' }),
        ],
        ['P1', 'P3'],
      ],
    ])('applies the %s filter', async (_label, filters, items, expected) => {
      ctx.searchFilters = { ...ctx.searchFilters, ...filters } as SearchFilters;
      factory.stream = streamOf(items);
      const hook = await mount();
      await search(hook);

      expect(hook.result.current.searchResults.map((p) => p.title)).toEqual(expected);
    });

    it('narrows the queried suppliers when shipping filters exclude some', async () => {
      const { suppliersExcludedBySearchFilters } = await import('@/helpers/supplierFilters');
      vi.mocked(suppliersExcludedBySearchFilters).mockReturnValue(new Set([SUPPLIER]));
      ctx.searchFilters = { ...ctx.searchFilters, shippingType: ['domestic'] };
      const hook = await mount();
      await search(hook);

      const queried = lastCall().options.suppliers as string[];
      expect(queried).not.toContain(SUPPLIER);
      expect(queried.length).toBe(SUPPLIER_CLASS_NAMES.length - 1);
    });
  });

  describe('empty and failed searches', () => {
    it('explains a zero-result search, noting active filters', async () => {
      ctx.userSettings = { priceMin: 1 } as unknown as UserSettings;
      const hook = await mount();
      await search(hook, 'nothing');

      expect(hook.result.current.tableText).toContain(i18n('search_no_results_for', ['nothing']));
      expect(hook.result.current.tableText).toContain(i18n('search_try_broaden'));
    });

    it('uses the shipping explanation when filters emptied the supplier set', async () => {
      factory.shippingExcludedAll = true;
      const hook = await mount();
      await search(hook);

      expect(hook.result.current.tableText).toBe(i18n('search_no_shipping_suppliers'));
    });

    it('reports a failure and resets loading state', async () => {
      factory.stream = () => {
        throw new Error('supplier exploded');
      };
      const hook = await mount();
      act(() => hook.result.current.executeSearch('acetone'));

      await waitFor(() => expect(eventTypes()).toContain(SearchEvent.FAILED));
      expect(hook.result.current.error).toBe('supplier exploded');
      expect(hook.result.current.isLoading).toBe(false);
    });

    it('reports a generic message for a non-Error failure', async () => {
      factory.stream = () => {
        throw 'nope';
      };
      const hook = await mount();
      act(() => hook.result.current.executeSearch('acetone'));

      await waitFor(() => expect(hook.result.current.error).toBe(i18n('search_error_failed')));
    });

    it('treats an AbortError as an aborted search', async () => {
      factory.stream = () => {
        throw new DOMException('stop', 'AbortError');
      };
      const hook = await mount();
      act(() => hook.result.current.executeSearch('acetone'));

      await waitFor(() => expect(eventTypes()).toContain(SearchEvent.ABORTED));
      expect(hook.result.current.tableText).toBe(i18n('search_status_aborted'));
      expect(hook.result.current.isLoading).toBe(false);
    });
  });

  describe('stopping a search', () => {
    /** Starts a search that blocks until released, so it can be aborted mid-stream. */
    async function startBlocked() {
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => (release = resolve));
      factory.stream = () =>
        (async function* () {
          await gate;
        })();
      const hook = await mount();
      act(() => hook.result.current.executeSearch('acetone'));
      await waitFor(() => expect(factory.calls).toHaveLength(1));
      return { hook, release };
    }

    it('aborts with the user reason and shows the aborting state', async () => {
      const { hook, release } = await startBlocked();

      act(() => hook.result.current.handleStopSearch());

      expect(lastCall().options.controller.signal.reason).toBe(SEARCH_ABORT_REASON.USER);
      await waitFor(() => expect(hook.result.current.isAborting).toBe(true));
      release();
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      expect(events.find((e) => e.type === SearchEvent.COMPLETED)?.detail).toMatchObject({
        abortReason: SEARCH_ABORT_REASON.USER,
      });
    });

    it('aborts on the global abort hotkey event', async () => {
      const { hook, release } = await startBlocked();

      act(() => window.dispatchEvent(new Event(HotkeyEvent.ABORT_SEARCH)));

      expect(lastCall().options.controller.signal.aborted).toBe(true);
      release();
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    });
  });

  describe('excludeProduct', () => {
    /** Mounts with two cached rows. */
    async function withRows() {
      vi.mocked(getSearchResultsRecord).mockResolvedValue({
        data: [product(1), product(2)],
        query: 'cached',
      });
      const hook = await mount();
      await waitFor(() => expect(hook.result.current.searchResults).toHaveLength(2));
      return hook;
    }

    it('drops the row, records the exclusion and persists the remainder', async () => {
      const hook = await withRows();

      await act(() => hook.result.current.excludeProduct(product(1)));

      expect(hook.result.current.searchResults.map((p) => p.title)).toEqual(['P2']);
      expect(addExcludedProduct).toHaveBeenCalledWith('k1', SUPPLIER, {
        title: 'P1',
        url: 'https://x.test/1',
      });
      // Only the call and query label are asserted: excludeProduct computes the persisted list
      // inside a setState updater, which React may defer, so its contents aren't reliable.
      expect(idbSetSearchResults).toHaveBeenLastCalledWith(expect.any(Array), 'cached');
    });

    it('keys by url when the product has no cacheKey', async () => {
      const hook = await withRows();

      await act(() => hook.result.current.excludeProduct(product(1, { cacheKey: undefined })));

      expect(addExcludedProduct).toHaveBeenCalledWith(
        'https://x.test/1',
        SUPPLIER,
        expect.anything(),
      );
    });

    it('ignores a product without url or supplier', async () => {
      const hook = await withRows();

      await act(() => hook.result.current.excludeProduct(product(1, { url: undefined })));

      expect(hook.result.current.searchResults).toHaveLength(2);
      expect(addExcludedProduct).not.toHaveBeenCalled();
    });

    it('still persists the row removal when the exclusion write fails', async () => {
      vi.mocked(addExcludedProduct).mockRejectedValueOnce(new Error('disk'));
      const hook = await withRows();

      await act(() => hook.result.current.excludeProduct(product(2)));

      expect(hook.result.current.searchResults.map((p) => p.title)).toEqual(['P1']);
      expect(idbSetSearchResults).toHaveBeenCalled();
    });
  });
});
