import { render, screen, waitFor } from '@testing-library/react';
import type { ColumnFiltersState } from '@tanstack/react-table';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Controllable stand-ins for the heavy hooks ResultsTable depends on.
const h = vi.hoisted(() => {
  const executeSearch = vi.fn();
  const sessionGet = vi.fn(async () => ({}) as Record<string, unknown>);
  const ctx: Record<string, unknown> = {};
  const search: Record<string, unknown> = {};
  return { executeSearch, sessionGet, ctx, search };
});

vi.mock('../hooks/useContext', () => ({ useAppContext: () => h.ctx }));
vi.mock('../hooks/useSearch', () => ({ useSearch: () => h.search }));
vi.mock('../useResultsTable.hook', () => ({ useResultsTable: () => makeTable() }));
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

/** Minimal TanStack-table stand-in: enough methods for an empty ResultsTable to render. */
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
  return {
    initialState: state,
    options: { meta: {} },
    getState: () => state,
    setOptions: vi.fn(),
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
  render(<ResultsTable {...(props as unknown as ComponentProps<typeof ResultsTable>)} />);
  return { setColumnFilters };
}

beforeEach(() => {
  vi.clearAllMocks();
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
    h.sessionGet.mockResolvedValue({ table_state: { columnFilters: stored, columnVisibility: { cas: false } } });
    const { setColumnFilters } = renderTable();

    // The load effect restores the stored filters as-is…
    await waitFor(() => expect(setColumnFilters).toHaveBeenCalledWith(stored));
    // …and never clears them, because reopening the panel is not a new search.
    expect(setColumnFilters).not.toHaveBeenCalledWith([]);
    expect(h.executeSearch).not.toHaveBeenCalled();
  });
});
