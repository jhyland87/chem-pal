import { getAllPriceSeries } from '@/utils/idbCache';
import type { ColumnFiltersState } from '@tanstack/react-table';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useResultsTable } from '../useResultsTable.hook';

vi.mock('@/utils/idbCache', () => ({ getAllPriceSeries: vi.fn() }));

/** Builds a minimal product; extra fields override. */
function product(fields: Record<string, unknown>): Product {
  return {
    supplier: 'ACME',
    title: 'Item',
    price: 10,
    quantity: 1,
    uom: 'g',
    ...fields,
  } as Product;
}

const settings = (groupProductVariants: boolean) =>
  ({ search: { groupProductVariants } }) as unknown as UserSettings;

interface HookProps {
  rows: Product[];
  filters?: ColumnFiltersState;
  global?: string;
  group?: boolean;
}

/** Renders the hook with controlled filter state supplied through props. */
function setup(initial: HookProps) {
  const onFilters = vi.fn();
  const onGlobal = vi.fn();
  const hook = renderHook(
    ({ rows, filters = [], global = '', group = true }: HookProps) =>
      useResultsTable({
        showSearchResults: rows,
        columnFilterFns: [filters, onFilters],
        globalFilterFns: [global, onGlobal],
        getRowCanExpand: (row) => (row.original.variants?.length ?? 0) > 0,
        userSettings: settings(group),
      }),
    { initialProps: initial },
  );
  return { ...hook, onFilters, onGlobal };
}

/**
 * Mounts unfiltered, then applies `next`, as in the app. TanStack's hierarchy lookups
 * (`getParentRow`) re-enter the filtered model, which only has a stale value to fall back on
 * once it has been computed at least once.
 */
function setupFiltered(rows: Product[], next: Pick<HookProps, 'filters' | 'global'>) {
  const hook = setup({ rows });
  hook.result.current.getFilteredRowModel();
  hook.rerender({ rows, ...next });
  return hook;
}

/** Ids of the top-level rows left after filtering. */
const filteredIds = (table: ReturnType<typeof useResultsTable>) =>
  table.getFilteredRowModel().rows.map((row) => row.id);

describe('useResultsTable', () => {
  beforeEach(() => {
    vi.mocked(getAllPriceSeries).mockReset().mockResolvedValue([]);
  });

  describe('row ids', () => {
    it('uses supplier:cacheKey, suffixing duplicates and namespacing variants', () => {
      const rows = [
        product({ cacheKey: '1', variants: [{ cacheKey: 'v', title: 'V' }] }),
        product({ cacheKey: '1' }),
        product({ url: 'https://x.test/p' }),
        product({}),
      ];
      const { result } = setup({ rows });

      expect(result.current.getCoreRowModel().rows.map((row) => row.id)).toEqual([
        'ACME:1',
        'ACME:1#1',
        'https://x.test/p',
        '3',
      ]);
      expect(result.current.getCoreRowModel().rows[0].subRows[0].id).toBe('ACME:1>undefined:v');
    });
  });

  describe('variant grouping', () => {
    const rows = [product({ cacheKey: '1', variants: [{ cacheKey: 'v', title: 'V', price: 5 }] })];

    it('nests variants as sub-rows when grouped', () => {
      const { result } = setup({ rows });

      expect(result.current.getCoreRowModel().rows[0].subRows).toHaveLength(1);
    });

    it('flattens variants into top-level rows when ungrouped', () => {
      const { result } = setup({ rows, group: false });

      expect(result.current.getCoreRowModel().rows).toHaveLength(2);
      expect(result.current.getCoreRowModel().rows.every((row) => row.subRows.length === 0)).toBe(
        true,
      );
    });

    it('expands only rows that report variants', () => {
      const { result } = setup({ rows: [...rows, product({ cacheKey: '2' })] });
      const [withVariants, without] = result.current.getCoreRowModel().rows;

      expect(withVariants.getCanExpand()).toBe(true);
      expect(without.getCanExpand()).toBe(false);
    });
  });

  describe('filters', () => {
    const rows = [
      product({ cacheKey: 'a', title: 'Acetone', supplier: 'ACME', price: 5 }),
      product({
        cacheKey: 'b',
        title: 'Ethanol',
        supplier: 'Bolt',
        price: 50,
        variants: [
          { cacheKey: 'b1', title: 'Ethanol 1L', price: 50 },
          { cacheKey: 'b2', title: 'Other 5L', price: 90 },
        ],
      }),
      product({
        cacheKey: 'c',
        title: 'Benzene',
        supplier: 'Cord',
        price: 500,
        matchPercentage: 3,
      }),
    ];

    it('multiSelect matches any selected value, case-insensitively', () => {
      const { result } = setupFiltered(rows, {
        filters: [{ id: 'supplier', value: ['acme', 'BOLT'] }],
      });

      expect(filteredIds(result.current)).toEqual(['ACME:a', 'Bolt:b']);
    });

    it('multiSelect with no values keeps every row', () => {
      const { result } = setupFiltered(rows, { filters: [{ id: 'supplier', value: [] }] });

      expect(filteredIds(result.current)).toHaveLength(3);
    });

    it('includeHierarchy pulls a parent along with a matching variant only', () => {
      const { result } = setupFiltered(rows, { filters: [{ id: 'title', value: '1l' }] });

      expect(filteredIds(result.current)).toEqual(['Bolt:b']);
      const parent = result.current.getFilteredRowModel().rows[0];
      expect(parent.subRows.map((sub) => sub.original.title)).toEqual(['Ethanol 1L']);
    });

    it('includeHierarchy pulls variants along with a matching parent', () => {
      const { result } = setupFiltered(rows, { filters: [{ id: 'title', value: 'ethanol' }] });

      expect(result.current.getFilteredRowModel().rows[0].subRows).toHaveLength(2);
    });

    it('applies the global filter with the same hierarchy rules', () => {
      const { result } = setupFiltered(rows, { global: 'benzene' });

      expect(filteredIds(result.current)).toEqual(['Cord:c']);
    });

    it('inNumberRangeHierarchy keeps rows inside the range', () => {
      const { result } = setupFiltered(rows, { filters: [{ id: 'price', value: [1, 60] }] });

      expect(filteredIds(result.current)).toEqual(['ACME:a', 'Bolt:b']);
    });

    it('does not match rows with a missing cell value', () => {
      const { result } = setupFiltered([product({ cacheKey: 'n', cas: undefined })], {
        filters: [{ id: 'cas', value: '64-17-5' }],
      });

      expect(filteredIds(result.current)).toEqual([]);
    });
  });

  describe('match percentage sorting', () => {
    const rows = [
      product({ cacheKey: 'lo', matchPercentage: 10 }),
      product({ cacheKey: 'hi', matchPercentage: 90 }),
      product({ cacheKey: 'none' }),
    ];
    const order = (table: ReturnType<typeof useResultsTable>) =>
      table.getCoreRowModel().rows.map((row) => row.id);

    it('is inactive by default', () => {
      const { result } = setup({ rows });

      expect(result.current.isSortedByMatchPercentage?.()).toBe(false);
      expect(result.current.getMatchPercentageSortOrder?.()).toBeNull();
    });

    it.each([
      ['desc', ['ACME:hi', 'ACME:lo', 'ACME:none']],
      ['asc', ['ACME:none', 'ACME:lo', 'ACME:hi']],
    ] as const)('sorts %s and reports the order', (direction, expected) => {
      const { result } = setup({ rows });

      act(() => result.current.sortByMatchPercentage?.(direction));

      expect(order(result.current)).toEqual(expected);
      expect(result.current.isSortedByMatchPercentage?.()).toBe(true);
      expect(result.current.getMatchPercentageSortOrder?.()).toBe(direction);
    });

    it('defaults to descending', () => {
      const { result } = setup({ rows });

      act(() => result.current.sortByMatchPercentage?.());

      expect(result.current.getMatchPercentageSortOrder?.()).toBe('desc');
    });
  });

  describe('table instance extensions', () => {
    it('publishes itself on window.resultsTable', () => {
      const { result } = setup({ rows: [product({ cacheKey: '1' })] });

      expect(window.resultsTable).toBe(result.current);
    });

    it('stores user settings and lets them be replaced', () => {
      const { result } = setup({ rows: [] });
      const next = settings(false);

      result.current.setUserSettings?.(next);

      expect(result.current.userSettings).toBe(next);
    });

    it('adds helper methods and debounced setters to columns', () => {
      const { result } = setup({
        rows: [
          product({ cacheKey: '1', supplier: 'ACME' }),
          product({ cacheKey: '2', supplier: 'Bolt' }),
        ],
      });
      const column = result.current.getColumn('supplier');

      expect(typeof column?.getHeaderText).toBe('function');
      expect(typeof column?.setFilterValueDebounced).toBe('function');
      expect(typeof column?.setFilterValueThrottled).toBe('function');
      expect(column?.getAllUniqueValues?.()).toEqual(expect.arrayContaining(['ACME', 'Bolt']));
    });

    it('starts with availability and priceTrend hidden', () => {
      const { result } = setup({ rows: [] });

      expect(result.current.getColumn('availability')?.getIsVisible()).toBe(false);
      expect(result.current.getColumn('priceTrend')?.getIsVisible()).toBe(false);
    });

    it('forwards filter changes to the supplied setters', () => {
      const { result, onFilters } = setup({ rows: [product({ cacheKey: '1' })] });

      act(() => result.current.getColumn('supplier')?.setFilterValue(['ACME']));

      expect(onFilters).toHaveBeenCalled();
    });
  });

  describe('price history', () => {
    const series: PriceHistoryEntry = {
      id: 'series-1',
      productKey: 'series-1',
      supplier: 'ACME',
      title: 'Item',
      points: [
        { t: 1, usd: 10 },
        { t: 2, usd: 15 },
      ],
      updatedAt: 2,
    };

    it('stamps priceTrendValue from recorded history and exposes it in meta', async () => {
      vi.mocked(getAllPriceSeries).mockResolvedValue([series]);
      const { result } = setup({
        rows: [product({ cacheKey: '1', priceSeriesKey: 'series-1' }), product({ cacheKey: '2' })],
      });

      await waitFor(() =>
        expect(result.current.getCoreRowModel().rows[0].original.priceTrendValue).toBeCloseTo(50),
      );
      expect(result.current.getCoreRowModel().rows[1].original.priceTrendValue).toBeUndefined();
      expect(result.current.options.meta?.priceHistory?.get('series-1')).toEqual(series);
    });

    it('leaves rows untouched when there is no history', async () => {
      const rows = [product({ cacheKey: '1' })];
      const { result } = setup({ rows });

      await waitFor(() => expect(getAllPriceSeries).toHaveBeenCalled());
      expect(result.current.getCoreRowModel().rows[0].original).toBe(rows[0]);
    });

    it('reloads history when the result set changes', async () => {
      const { rerender } = setup({ rows: [product({ cacheKey: '1' })] });
      await waitFor(() => expect(getAllPriceSeries).toHaveBeenCalledTimes(1));

      rerender({ rows: [product({ cacheKey: '2' })] });

      await waitFor(() => expect(getAllPriceSeries).toHaveBeenCalledTimes(2));
    });
  });
});
