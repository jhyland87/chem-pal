import { act, render, screen, waitFor } from '@testing-library/react';
import type { ColumnFiltersState } from '@tanstack/react-table';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Controllable stand-ins for the heavy hooks ResultsTable depends on.
const h = vi.hoisted(() => {
  const executeSearch = vi.fn();
  const sessionGet = vi.fn(async () => ({}) as Record<string, unknown>);
  const ctx: Record<string, unknown> = {};
  const search: Record<string, unknown> = {};
  const holder: { table?: ReturnType<typeof makeTable> } = {};
  return { executeSearch, sessionGet, ctx, search, holder };
});

vi.mock('../hooks/useContext', () => ({ useAppContext: () => h.ctx }));
vi.mock('../hooks/useSearch', () => ({ useSearch: () => h.search }));
vi.mock('../useResultsTable.hook', () => ({
  useResultsTable: () => (h.holder.table ??= makeTable()),
}));
vi.mock('../useContextMenu.hook', () => ({
  useContextMenu: () => ({
    contextMenu: null,
    handleContextMenu: vi.fn(),
    handleCloseContextMenu: vi.fn(),
  }),
}));
vi.mock('../useAutoColumnSizing.hook', () => ({
  useAutoColumnSizing: () => ({ getMeasurementTableProps: () => ({}), autoSizeColumns: vi.fn() }),
}));
vi.mock('@/mixins/tanstack', () => ({ getEmptyHideableColumnIds: () => new Set() }));
vi.mock('@/components/TabLink', () => ({
  default: ({ children, href }: Record<string, unknown>) => (
    <a href={href as string}>{children as React.ReactNode}</a>
  ),
}));

// Session storage: no persisted table state unless a test overrides it.
vi.mock('@/utils/storage', () => ({
  cstorage: {
    session: { get: h.sessionGet, set: vi.fn(async () => {}), remove: vi.fn(async () => {}) },
    local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
  },
}));

/**
 * Minimal TanStack-table stand-in: enough methods for an empty ResultsTable to render.
 * `setOptions` applies ResultsTable's updater so `getState()` and `options.onStateChange`
 * reflect the component's controlled table state, as the real table does.
 */
function makeTable() {
  const state = {
    columnFilters: [] as ColumnFiltersState,
    globalFilter: '',
    sorting: [],
    pagination: { pageIndex: 0, pageSize: 20 },
    expanded: {},
    columnVisibility: {},
  };
  const emptyRowModel = { rows: [] as unknown[] };
  const table = {
    initialState: state,
    options: { meta: {}, data: [] } as Record<string, any>,
    getState: () => table.options.state ?? state,
    setOptions: vi.fn((updater: (prev: Record<string, any>) => Record<string, any>) => {
      table.options = updater(table.options);
    }),
    getRowModel: () => emptyRowModel,
    getFilteredRowModel: () => emptyRowModel,
    getPreFilteredRowModel: () => emptyRowModel,
    getHeaderGroups: () => [],
    getFlatHeaders: () => [],
    getAllColumns: () => [],
    getAllLeafColumns: () => [],
    getColumn: () => undefined,
    getCanNextPage: () => false,
    getCanPreviousPage: () => false,
    getPageCount: () => 1,
    nextPage: vi.fn(),
    previousPage: vi.fn(),
    setExpanded: vi.fn(),
    setPageIndex: vi.fn(),
    setPageSize: vi.fn(),
  };
  return table;
}

import ResultsTable from '../ResultsTable';
import { i18n } from '@/helpers/i18n';

/** Renders ResultsTable with a controllable column-filter tuple; returns the setter spy. */
function renderTable(initialFilters: ColumnFiltersState = []) {
  const setColumnFilters = vi.fn();
  const props = {
    getRowCanExpand: () => false,
    columnFilterFns: [initialFilters, setColumnFilters],
  };
  const element = () => (
    <ResultsTable {...(props as unknown as ComponentProps<typeof ResultsTable>)} />
  );
  const { rerender } = render(element());
  return { setColumnFilters, rerender: () => rerender(element()) };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.holder.table = makeTable();
  h.sessionGet.mockResolvedValue({});
  Object.assign(h.ctx, {
    pendingSearchQuery: null,
    setPendingSearchQuery: vi.fn(),
    selectedSuppliers: [],
    searchFilters: { country: [], shippingType: [], availability: [] },
    userSettings: {},
    setSelectedSuppliers: vi.fn(),
    setSearchFilters: vi.fn(),
    setUserSettings: vi.fn(),
    setPanel: vi.fn(),
    toggleDrawer: vi.fn(),
  });
  Object.assign(h.search, {
    searchResults: [],
    isLoading: false,
    isAborting: false,
    error: undefined,
    executeSearch: h.executeSearch,
    handleStopSearch: vi.fn(),
    excludeProduct: vi.fn(),
    tableText: '',
    executedQuery: '',
    supplierOutcomes: [],
  });
});

describe('ResultsTable', () => {
  it('renders without crashing when there are no results', () => {
    renderTable();
    // With no query yet, the empty table body shows the "no search query" prompt.
    expect(screen.getByText(i18n('results_status_no_search_query'))).toBeInTheDocument();
  });

  it('clears column filters and runs the search when a pending query arrives', async () => {
    h.ctx.pendingSearchQuery = 'acetone';
    const { setColumnFilters } = renderTable([{ id: 'supplier', value: ['Loudwolf'] }]);

    await waitFor(() => expect(h.executeSearch).toHaveBeenCalledWith('acetone'));
    // A real search wipes the per-column filters…
    expect(setColumnFilters).toHaveBeenCalledWith([]);
    // …and consumes the pending query so it doesn't re-fire.
    expect(h.ctx.setPendingSearchQuery).toHaveBeenCalledWith(null);
  });

  it('preserves persisted column filters on restore (no search runs)', async () => {
    const stored = [{ id: 'supplier', value: ['Loudwolf'] }];
    h.sessionGet.mockResolvedValue({
      table_state: { columnFilters: stored, columnVisibility: { cas: false } },
    });
    const { setColumnFilters } = renderTable();

    // The load effect restores the stored filters as-is…
    await waitFor(() => expect(setColumnFilters).toHaveBeenCalledWith(stored));
    // …and never clears them, because reopening the panel is not a new search.
    expect(setColumnFilters).not.toHaveBeenCalledWith([]);
    expect(h.executeSearch).not.toHaveBeenCalled();
  });
});

describe('ResultsTable auto-showing the Trend column', () => {
  /** The current visibility of the price-trend column in the controlled table state. */
  const trendVisibility = () => h.holder.table?.getState().columnVisibility.priceTrend;

  /** Puts a result set in the table, with or without a price change, plus loaded history. */
  function setResults(priceTrendValue: number | undefined) {
    const table = h.holder.table!;
    h.search.searchResults = [{ title: 'Acetone' }];
    table.options.data = [{ title: 'Acetone', priceTrendValue }];
    // A fresh map each time, as each history reload in useResultsTable produces one.
    table.options.meta = { priceHistory: new Map([['series', { points: [] }]]) };
  }

  /** Simulates a search: loading, then settled with the given result set. */
  function runSearch(rerender: () => void, priceTrendValue: number | undefined) {
    h.search.isLoading = true;
    rerender();
    h.search.isLoading = false;
    setResults(priceTrendValue);
    rerender();
  }

  it('shows the column when a finished search has a price change', async () => {
    const { rerender } = renderTable();
    runSearch(rerender, 12.5);
    await waitFor(() => expect(trendVisibility()).toBe(true));
  });

  it('leaves the column alone when the search has no price change', async () => {
    const { rerender } = renderTable();
    runSearch(rerender, 0);
    // Let the effects flush before asserting nothing changed.
    await waitFor(() => expect(h.holder.table?.options.state).toBeDefined());
    expect(trendVisibility()).toBeUndefined();
  });

  it('does not show the column for restored results without a new search', async () => {
    // A page refresh: cached results with a price change, but no search ran.
    setResults(12.5);
    const { rerender } = renderTable();
    rerender();
    await waitFor(() => expect(h.holder.table?.options.state).toBeDefined());
    expect(trendVisibility()).toBeUndefined();
  });

  it('keeps the column hidden after the user hides it, until the next search', async () => {
    const { rerender } = renderTable();
    runSearch(rerender, 12.5);
    await waitFor(() => expect(trendVisibility()).toBe(true));

    // The user hides it, then price history reloads for the same result set.
    act(() => {
      h.holder.table?.options.onStateChange((prev: Record<string, any>) => ({
        ...prev,
        columnVisibility: { ...prev.columnVisibility, priceTrend: false },
      }));
    });
    setResults(12.5);
    rerender();
    expect(trendVisibility()).toBe(false);

    // A new search with a price change shows it again.
    runSearch(rerender, -4);
    await waitFor(() => expect(trendVisibility()).toBe(true));
  });

  it('restores the prior visibility after a later search with no price change', async () => {
    const { rerender } = renderTable();
    runSearch(rerender, 12.5);
    await waitFor(() => expect(trendVisibility()).toBe(true));

    runSearch(rerender, 0);
    await waitFor(() => expect(trendVisibility()).toBeUndefined());
  });
});
