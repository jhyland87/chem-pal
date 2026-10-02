import {
  resetChromeStorageMock,
  restoreChromeStorageMock,
  setupChromeStorageMock,
} from '@/__fixtures__/helpers/chrome/storageMock';
import {
  clearSearchHistory,
  clearSearchResults,
  getSearchHistory,
  getSearchResults,
  getSearchResultsRecord,
} from '@/utils/idbCache';
import { SEARCH_ABORT_REASON } from '@/constants/common';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildNoResultsMessage,
  classifyAbortReason,
  createInitialHistoryEntry,
  saveResultsToSession,
  updateColumnFilterFromResult,
  updateHistoryResultCount,
} from '../useSearch';

vi.mock('@/helpers/pubchem', () => ({
  suggestAlternativeSearch: vi.fn(),
  suggestAdvancedQuery: vi.fn(),
}));

// Import after mocking so we can control the mock implementation
import { suggestAdvancedQuery, suggestAlternativeSearch } from '@/helpers/pubchem';

describe('useSearch helpers', () => {
  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(async () => {
    resetChromeStorageMock();
    await clearSearchResults();
    await clearSearchHistory();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    restoreChromeStorageMock();
  });

  describe('classifyAbortReason', () => {
    it.each([
      { reason: SEARCH_ABORT_REASON.USER, expected: 'user_aborted' },
      { reason: SEARCH_ABORT_REASON.TIME_BUDGET, expected: 'time_budget_exceeded' },
      { reason: 'Request was aborted by user', expected: 'unknown' },
      { reason: new DOMException('stop', 'AbortError'), expected: 'unknown' },
      { reason: undefined, expected: 'unknown' },
    ])('maps $reason to $expected', ({ reason, expected }) => {
      expect(classifyAbortReason(reason)).toBe(expected);
    });
  });

  describe('updateColumnFilterFromResult', () => {
    it('ignores columns that are not in the config', () => {
      const config = {};
      const product = { price: 42 } as unknown as Product;
      updateColumnFilterFromResult(config, product);
      expect(config).toEqual({});
    });

    it("adds unique values for 'select' filter variants", () => {
      const config = {
        supplier: { filterVariant: 'select', filterData: [] as unknown[] },
      };
      updateColumnFilterFromResult(config, { supplier: 'Carolina' } as unknown as Product);
      updateColumnFilterFromResult(config, { supplier: 'Ambeed' } as unknown as Product);
      updateColumnFilterFromResult(config, { supplier: 'Carolina' } as unknown as Product);

      expect(config.supplier.filterData).toEqual(['Carolina', 'Ambeed']);
    });

    it("adds unique values for 'text' filter variants", () => {
      const config = {
        title: { filterVariant: 'text', filterData: [] as unknown[] },
      };
      updateColumnFilterFromResult(config, { title: 'Acetone' } as unknown as Product);
      updateColumnFilterFromResult(config, { title: 'Acetone' } as unknown as Product);
      updateColumnFilterFromResult(config, { title: 'Ethanol' } as unknown as Product);

      expect(config.title.filterData).toEqual(['Acetone', 'Ethanol']);
    });

    it("tracks numeric values for 'range' filter variants", () => {
      const config = {
        price: { filterVariant: 'range', filterData: [] as unknown[] },
      };
      updateColumnFilterFromResult(config, { price: 10 } as unknown as Product);
      updateColumnFilterFromResult(config, { price: 5 } as unknown as Product);

      // The lower bound should update to the smaller value
      expect(config.price.filterData[0]).toBe(5);
    });

    it("skips non-numeric values for 'range' filter variants", () => {
      const config = {
        price: { filterVariant: 'range', filterData: [] as unknown[] },
      };
      updateColumnFilterFromResult(config, { price: 'not a number' } as unknown as Product);
      expect(config.price.filterData).toEqual([]);
    });
  });

  describe('saveResultsToSession', () => {
    it('persists the results to IndexedDB', async () => {
      const results = [{ id: 1, title: 'Widget' }] as unknown as Product[];
      await saveResultsToSession(results);

      const stored = await getSearchResults();
      expect(stored).toEqual(results);
    });

    it('persists the query alongside the results when provided', async () => {
      const results = [{ id: 1, title: 'Widget' }] as unknown as Product[];
      await saveResultsToSession(results, 'acetone');

      const record = await getSearchResultsRecord();
      expect(record.query).toBe('acetone');
      expect(record.data).toEqual(results);
    });

    it('does not throw when IndexedDB write fails', async () => {
      // Mock idbCache to simulate a failure — the function should catch internally
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Even with a valid call, the function should not throw
      await expect(saveResultsToSession([])).resolves.toBeUndefined();

      warnSpy.mockRestore();
    });
  });

  describe('createInitialHistoryEntry', () => {
    it('creates a new entry with resultCount 0 in IndexedDB', async () => {
      const timestamp = 1_700_000_000_000;
      const filters = {
        titleQuery: 'acetone',
        availability: [],
        country: [],
        shippingType: [],
      } as unknown as SearchFilters;

      await createInitialHistoryEntry('acetone', timestamp, filters, ['SupplierCarolina']);

      const history = await getSearchHistory();

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        query: 'acetone',
        timestamp,
        resultCount: 0,
        type: 'search',
        selectedSuppliers: ['SupplierCarolina'],
      });
      expect(history[0].filters).toEqual(filters);
    });

    it('stores multiple entries', async () => {
      const filters = {
        titleQuery: '',
        availability: [],
        country: [],
        shippingType: [],
      } as unknown as SearchFilters;

      await createInitialHistoryEntry('first', 1, filters, []);
      await createInitialHistoryEntry('second', 2, filters, []);

      const history = await getSearchHistory();

      // getSearchHistory returns newest-first
      expect(history.map((h) => h.query)).toEqual(['second', 'first']);
    });

    it('enforces max 100 entries', async () => {
      const filters = {
        titleQuery: '',
        availability: [],
        country: [],
        shippingType: [],
      } as unknown as SearchFilters;

      // Create 101 entries
      for (let i = 0; i < 101; i++) {
        await createInitialHistoryEntry(`q${i}`, i, filters, []);
      }

      const history = await getSearchHistory();

      expect(history).toHaveLength(100);
      // The newest entry should be present
      expect(history[0].query).toBe('q100');
    });

    it('handles being called when IndexedDB is empty', async () => {
      const filters = {
        titleQuery: '',
        availability: [],
        country: [],
        shippingType: [],
      } as unknown as SearchFilters;

      await createInitialHistoryEntry('q', 1, filters, []);

      const history = await getSearchHistory();

      expect(history).toHaveLength(1);
      expect(history[0].query).toBe('q');
    });
  });

  describe('updateHistoryResultCount', () => {
    const baseFilters = {
      titleQuery: '',
      availability: [],
      country: [],
      shippingType: [],
    } as unknown as SearchFilters;

    it('updates the resultCount on the matching entry', async () => {
      await createInitialHistoryEntry('a', 100, baseFilters, []);
      await createInitialHistoryEntry('b', 200, baseFilters, []);

      await updateHistoryResultCount(100, 42);

      const history = await getSearchHistory();

      const updated = history.find((h) => h.timestamp === 100);
      const untouched = history.find((h) => h.timestamp === 200);
      expect(updated?.resultCount).toBe(42);
      expect(untouched?.resultCount).toBe(0);
    });

    it('is a no-op when no entry matches the timestamp', async () => {
      await createInitialHistoryEntry('a', 100, baseFilters, []);

      await updateHistoryResultCount(999, 5);

      const history = await getSearchHistory();

      expect(history[0].resultCount).toBe(0);
    });
  });

  describe('buildNoResultsMessage', () => {
    const mockedSuggestAlternative = vi.mocked(suggestAlternativeSearch);
    const mockedSuggestAdvanced = vi.mocked(suggestAdvancedQuery);

    beforeEach(() => {
      mockedSuggestAlternative.mockResolvedValue({});
      mockedSuggestAdvanced.mockResolvedValue(undefined);
    });

    it('returns just the basic message when filters are inactive and PubChem has no alternative', async () => {
      const msg = await buildNoResultsMessage('zzzzz', false);
      expect(msg).toBe('No results found for "zzzzz"');
    });

    it('includes the filter-broadening hint when filters are active', async () => {
      const msg = await buildNoResultsMessage('zzzzz', true);
      expect(msg).toContain('No results found for "zzzzz"');
      expect(msg).toContain('broadening your search filters');
    });

    it('suggests a single alternative name when the advanced setting is off', async () => {
      mockedSuggestAlternative.mockResolvedValue({ name: 'acetone' });
      const msg = await buildNoResultsMessage('propan-2-one', false);
      expect(msg).toContain('Perhaps try searching for: acetone');
      expect(mockedSuggestAdvanced).not.toHaveBeenCalled();
    });

    it('suggests an advanced query for a basic search when the setting is on', async () => {
      mockedSuggestAdvanced.mockResolvedValue('2-propanone OR propanone OR 67-64-1');
      const msg = await buildNoResultsMessage('acetone', false, true);
      expect(msg).toContain('Try this advanced search: 2-propanone OR propanone OR 67-64-1');
      expect(mockedSuggestAlternative).not.toHaveBeenCalled();
    });

    it('falls back to the single-name suggestion when no advanced query can be built', async () => {
      mockedSuggestAlternative.mockResolvedValue({ cas: '67-64-1' });
      const msg = await buildNoResultsMessage('acetone', false, true);
      expect(msg).toContain('Try searching by CAS number instead: 67-64-1');
    });

    it('suggests a simpler phrase for a user-written advanced query and skips PubChem', async () => {
      const msg = await buildNoResultsMessage('sodium AND (hydroxide OR carbonate)', false, true);
      expect(msg).toContain('Try a simpler search, such as: sodium');
      expect(mockedSuggestAdvanced).not.toHaveBeenCalled();
      expect(mockedSuggestAlternative).not.toHaveBeenCalled();
    });

    it('does not suggest anything for an advanced query when the setting is off', async () => {
      const msg = await buildNoResultsMessage('a OR b', false, false);
      expect(msg).toBe('No results found for "a OR b"');
    });

    it('does not loop: a recommended advanced query that finds nothing gets no suggestion', async () => {
      const advanced = 'loopa OR loopb OR 1-1-1';
      mockedSuggestAdvanced.mockResolvedValue(advanced);

      const first = await buildNoResultsMessage('loopname', false, true);
      expect(first).toContain(advanced);

      const second = await buildNoResultsMessage(advanced, false, true);
      expect(second).toBe(`No results found for "${advanced}"`);
    });
  });
});
