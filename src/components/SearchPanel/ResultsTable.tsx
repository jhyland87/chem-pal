import { defaultSettings } from "@/../config.json";
import DrawerSystem from "@/components/DrawerSystem";
import LoadingBackdrop from "@/components/LoadingBackdrop";
import resultStyles from "@/components/ResultsPanel.module.scss";
import { CACHE } from "@/constants/common";
import { generatePageSizes } from "@/helpers/utils";
import { FOCUS_GLOBAL_FILTER_EVENT, TOGGLE_COLUMN_FILTERS_EVENT } from "@/hotkeys";
import BadgeAnimator from "@/utils/BadgeAnimator";
import { cstorage } from "@/utils/storage";
import { isInputElement } from "@/utils/typeGuards/common";
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  FilterList as FilterListIcon,
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  Settings as SettingsIcon,
  ViewColumn as ViewColumnIcon,
} from "@mui/icons-material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Column,
  ColumnFiltersState,
  flexRender,
  Header,
  Row,
  type TableState,
} from "@tanstack/react-table";
import debounce from "lodash/debounce";
import isEmpty from "lodash/isEmpty";
import React, {
  ComponentType,
  Dispatch,
  ReactElement,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BackButton,
  ColoredIconButton,
  ColumnMenuItemContainer,
  EmptyStateCell,
  ErrorContainer,
  ErrorRetryButton,
  FilterIconButton,
  FilterTableCell,
  GlobalFilterTextField,
  NavigationContainer,
  PageSizeContainer,
  PageSizeSelect,
  PaginationContainer,
  ResultsCountDisplay,
  ResultsHeaderContainer,
  SearchedQueryLabel,
  SearchResultsTable,
  StickyHeaderCell,
  StyledTableBody,
  StyledTableCell,
  StyledTableHead,
  SubRowTableRow,
} from "../StyledComponents";
import ContextMenu from "./ContextMenu";
import { useAppContext } from "./hooks/useContext";
import { useSearch } from "./hooks/useSearch";
import RangeColumnFilter from "./Inputs/RangeColumnFilter";
import SelectColumnFilter from "./Inputs/SelectColumnFilter";
import TextColumnFilter from "./Inputs/TextColumnFilter";
import styles from "./ResultsTable.module.scss";
import { useAutoColumnSizing } from "./useAutoColumnSizing.hook";
import { useContextMenu } from "./useContextMenu.hook";
import { useResultsTable } from "./useResultsTable.hook";

type FilterVariant = "text" | "range" | "select";

/**
 * Maps a column's `meta.filterVariant` to the input component that renders
 * inside the header filter row. `text` is the fallback so columns without
 * `meta.filterVariant` still get a filter.
 * @source
 */
const filterComponentMap: Record<FilterVariant, ComponentType<FilterVariantInputProps>> = {
  text: TextColumnFilter,
  range: RangeColumnFilter,
  select: SelectColumnFilter,
};

/**
 * Dispatches to the correct filter component based on the column's
 * `meta.filterVariant`. Rendered inside each header cell's filter row.
 * @source
 */
function FilterVariantCell({ header }: { header: Header<Product, unknown> }) {
  const variant = (header.column.columnDef.meta?.filterVariant ?? "text") as FilterVariant;
  const Component = filterComponentMap[variant];
  if (!Component) return null;
  return <Component column={header.column as CustomColumn<Product, unknown>} />;
}

interface ResultsTableProps {
  getRowCanExpand: (row: Row<Product>) => boolean;
  columnFilterFns: [ColumnFiltersState, Dispatch<SetStateAction<ColumnFiltersState>>];
}

/**
 * Enhanced ResultsTable component using chem-pal styling with local functionality
 *
 * Features:
 * - Modern table styling from chem-pal
 * - Local search functionality and streaming results
 * - Context menu for product rows
 * - Auto column sizing
 * - Pagination and filtering
 * - Drawer system integration
 * @source
 */
export default function ResultsTable({
  getRowCanExpand,
  columnFilterFns,
}: ResultsTableProps): ReactElement {
  const appContext = useAppContext();
  const [showFilters, setShowFilters] = useState(false);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const globalFilterInputRef = useRef<HTMLInputElement>(null);

  // Bridge hotkeys (fired from App.tsx) into local state/refs.
  useEffect(() => {
    const onFocus = () => {
      const el = globalFilterInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    };
    const onToggle = () => setShowFilters((v) => !v);
    window.addEventListener(FOCUS_GLOBAL_FILTER_EVENT, onFocus);
    window.addEventListener(TOGGLE_COLUMN_FILTERS_EVENT, onToggle);
    return () => {
      window.removeEventListener(FOCUS_GLOBAL_FILTER_EVENT, onFocus);
      window.removeEventListener(TOGGLE_COLUMN_FILTERS_EVENT, onToggle);
    };
  }, []);

  // Enhanced search hook that maintains streaming behavior
  const {
    searchResults,
    isLoading,
    error,
    executeSearch,
    handleStopSearch,
    excludeProduct,
    tableText,
    executedQuery,
  } = useSearch();

  // Watch for pending search queries triggered from HistoryPanel or the drawer.
  // The ref guard dedupes against:
  //   1. StrictMode double-invoke of effects on mount (dev only)
  //   2. The `appContext` dep in the array — context object identity changes on
  //      every context state update, so this effect re-fires whenever anything
  //      in AppContext changes, not just `pendingSearchQuery`.
  //   3. `executeSearch` / `appContext` not being stable references, which
  //      would otherwise cause spurious re-runs.
  // Without the guard, a single submitted query fires `executeSearch` twice
  // (and two sets of supplier HTTP requests).
  const lastHandledPendingQueryRef = useRef<string | null>(null);
  useEffect(() => {
    const pending = appContext?.pendingSearchQuery;
    if (!pending) {
      // Reset so the same query can be submitted again later.
      lastHandledPendingQueryRef.current = null;
      return;
    }
    if (lastHandledPendingQueryRef.current === pending) return;
    lastHandledPendingQueryRef.current = pending;
    executeSearch(pending);
    appContext?.setPendingSearchQuery(null);
  }, [appContext?.pendingSearchQuery, executeSearch, appContext]);

  // Context menu functionality
  const { contextMenu, handleContextMenu, handleCloseContextMenu } = useContextMenu();

  const table = useResultsTable({
    showSearchResults: searchResults,
    columnFilterFns,
    globalFilterFns: [globalFilter, setGlobalFilter],
    getRowCanExpand,
    userSettings: appContext?.userSettings ?? (defaultSettings as UserSettings),
  });

  // ── Table state persistence ──────────────────────────────────────────
  // Uses the TanStack "fully controlled state" pattern: take over the
  // table's state via `table.setOptions`, persist the slices we care about
  // (sorting, pagination, expanded rows, column visibility) to
  // chrome.storage.session, and restore them on mount.
  const [tableState, setTableState] = useState<TableState>(table.initialState);
  const isStateLoadedRef = useRef(false);

  // Collapse all variant rows whenever a new search begins. Without this,
  // the persisted `expanded` state from the previous search can leak into
  // the new results when row IDs happen to collide (e.g. both searches
  // include a product at the same index).
  const prevIsLoadingRef = useRef(false);
  useEffect(() => {
    if (isLoading && !prevIsLoadingRef.current) {
      setTableState((prev) => ({ ...prev, expanded: {} }));
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading]);

  // Load persisted state once on mount
  useEffect(() => {
    const load = async () => {
      try {
        const data = await cstorage.session.get([CACHE.TABLE_STATE]);
        const stored = data[CACHE.TABLE_STATE] as
          | (Partial<TableState> & { globalFilter?: string; showFilters?: boolean })
          | undefined;
        if (stored && typeof stored === "object") {
          if (typeof stored.globalFilter === "string") {
            setGlobalFilter(stored.globalFilter);
          }
          if (typeof stored.showFilters === "boolean") {
            setShowFilters(stored.showFilters);
          }
          if (Array.isArray(stored.columnFilters)) {
            columnFilterFns[1](stored.columnFilters);
          }
          setTableState((prev) => ({ ...prev, ...stored }));
        }
      } catch (error) {
        console.warn("Failed to load table state from session storage:", { error });
      }
      isStateLoadedRef.current = true;
    };
    load();
  }, []);

  // Override state management — the table reads state from our local
  // `tableState` and pushes every change back through `setTableState`.
  // Column filters and global filter remain externally controlled.
  table.setOptions((prev) => ({
    ...prev,
    state: {
      ...tableState,
      columnFilters: columnFilterFns[0],
      globalFilter,
    },
    onStateChange: setTableState,
  }));

  // Debounced save — only persist the slices we care about restoring
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveTableState = useCallback(
    debounce(async (s: TableState & { showFilters?: boolean }) => {
      try {
        await cstorage.session.set({
          [CACHE.TABLE_STATE]: {
            sorting: s.sorting,
            pagination: s.pagination,
            expanded: s.expanded,
            columnVisibility: s.columnVisibility,
            columnFilters: s.columnFilters,
            globalFilter: s.globalFilter,
            showFilters: s.showFilters,
          },
        });
      } catch (error) {
        console.warn("Failed to persist table state:", { error });
      }
    }, 300),
    [],
  );

  // Persist whenever controlled state changes (skip until initial load
  // completes to avoid overwriting stored state with defaults).
  // globalFilter, columnFilters, and showFilters are managed externally
  // but still persisted alongside table state.
  useEffect(() => {
    if (!isStateLoadedRef.current) return;
    saveTableState({
      ...tableState,
      globalFilter,
      columnFilters: columnFilterFns[0],
      showFilters,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableState, globalFilter, columnFilterFns[0], showFilters, saveTableState]);

  // Clamp pageSize synchronously so the MUI Select never renders with an
  // out-of-range value (e.g. persisted pageSize=36 when valid options are
  // [10, 20, 40, 74]). Must happen during render, not in a useEffect,
  // because MUI warns before effects run.
  const filteredRowCount = table.getRowModel().rows.filter((row) => row.depth === 0).length;
  const totalRowCount = table.getFilteredRowModel().rows.length;

  // Mirror the table's filtered row count onto the extension's badge. This
  // is the single source of truth for the counter — it covers streaming
  // results (each append triggers a re-render), search completion, product
  // exclusion, AND user-applied column/global filters uniformly. Keep the
  // effect skipped while the table is empty so the BadgeAnimator's
  // "Searching…" ellipsis animation (started in useSearch.performSearch)
  // isn't immediately overwritten with "0".
  useEffect(() => {
    if (totalRowCount === 0) return;
    BadgeAnimator.setText(totalRowCount.toString());
  }, [filteredRowCount, totalRowCount]);

  // Compute valid page sizes from the *filter-applied total* (totalRowCount)
  // rather than the page-visible count (filteredRowCount) — feeding the
  // page-visible count here creates a self-reinforcing collapse when a prior
  // search left pageSize larger than the new search's result count: valid
  // sizes would shrink to `[page-visible]`, which forces pageSize down,
  // which keeps only that many rows visible, etc. The options Select below
  // (line ~572) correctly uses the total as well.
  if (totalRowCount > 0) {
    const validSizes = generatePageSizes(totalRowCount, 10, 5);
    const currentPageSize = tableState.pagination?.pageSize ?? 10;
    if (!validSizes.includes(currentPageSize)) {
      const best = validSizes.filter((s) => s <= currentPageSize).pop() ?? validSizes.at(-1)!;
      table.setPageSize(best);
    }
  }

  // Initialize column visibility - this effect is still needed
  useEffect(() => {
    if (appContext && !isEmpty(appContext.userSettings.hideColumns)) {
      table.getAllLeafColumns().map((column: Column<Product>) => {
        if (appContext.userSettings?.hideColumns?.includes(column.id)) {
          column.toggleVisibility(false);
        }
      });
    }
  }, [appContext?.userSettings.hideColumns, table]);

  // Auto column sizing is driven by the raw searchResults (not the filtered
  // row model) so that filter input keystrokes don't trigger column remeasuring.
  const { getMeasurementTableProps } = useAutoColumnSizing(table, searchResults);

  const handleSearch = (query: string) => {
    if (query.trim()) {
      executeSearch(query.trim());
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && isInputElement(event.target)) {
      handleSearch(event.target.value);
    }
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  return (
    <>
      <LoadingBackdrop
        open={isLoading}
        // Count top-level rows only — `searchResults.length` can double-count
        // when suppliers yield variants as flat products rather than nested.
        // `getFilteredRowModel().rows.length` is the committed parent-row count
        // (sub-rows live on each row's `.subRows`), which is what users see.
        resultCount={totalRowCount}
        onClick={handleStopSearch}
      />
      <DrawerSystem />

      <div className={resultStyles["results-container"]}>
        <div className={resultStyles["results-header"]}>
          <div className={resultStyles["header-left"]}>
            {appContext?.setPanel && (
              <BackButton
                onClick={() => appContext.setPanel!(0)}
                size="small"
                aria-label="Back to search home"
              >
                <ArrowBackIcon />
              </BackButton>
            )}
            {executedQuery && (
              <SearchedQueryLabel variant="body2" title={`Searched for: ${executedQuery}`}>
                {executedQuery}
              </SearchedQueryLabel>
            )}
          </div>
          <div className={resultStyles["header-right"]}>
            <FilterIconButton
              onClick={toggleFilters}
              size="small"
              isActive={showFilters}
              activeColor="#007bff"
              textColor="#666"
            >
              <FilterListIcon />
            </FilterIconButton>
            <ColoredIconButton
              onClick={(e) => setColumnMenuAnchor(e.currentTarget)}
              size="small"
              iconColor="#666"
            >
              <ViewColumnIcon />
            </ColoredIconButton>
            <ColoredIconButton
              onClick={() => appContext?.toggleDrawer()}
              size="small"
              iconColor="#666"
            >
              <SettingsIcon />
            </ColoredIconButton>
          </div>
        </div>

        {/* <div className="results-title">Search Results ({searchResults.length} found)</div> */}

        <ResultsHeaderContainer>
          <ResultsCountDisplay>
            Results: {filteredRowCount}
            {filteredRowCount !== totalRowCount && ` of ${totalRowCount}`}
          </ResultsCountDisplay>
          {/* Only show the global filter if there are results. Based on
              searchResults (not the filtered row model) so the input doesn't
              vanish once the user's filter query matches zero rows. */}
          {searchResults.length > 0 && (
            <GlobalFilterTextField
              size="small"
              variant="outlined"
              placeholder="Filter results..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              inputRef={globalFilterInputRef}
              slotProps={{
                input: {
                  onKeyDown: handleKeyPress,
                  "aria-label": "Filter results",
                },
              }}
            />
          )}
        </ResultsHeaderContainer>

        <Box
          className={`${resultStyles["results-paper"]} ${resultStyles["results-paper-container"]}`}
        >
          {/* Hidden measurement table for auto-sizing */}
          <table
            className={resultStyles["hidden-measurement-table"]}
            {...getMeasurementTableProps()}
          >
            <thead className="results-table-column-headers">
              <tr>
                {table.getAllLeafColumns().map((col) => (
                  <th key={col.id}>
                    {typeof col.columnDef.header === "function"
                      ? col.id
                      : (col.columnDef.header ?? col.id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="results-table-body">
              {table
                .getRowModel()
                .rows.slice(0, 5)
                .map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {typeof cell.column.columnDef.cell === "function"
                          ? cell.column.columnDef.cell(cell.getContext())
                          : ""}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>

          <SearchResultsTable>
            {/* Table Head */}
            <StyledTableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <StickyHeaderCell
                      key={header.id}
                      canSort={header.column.getCanSort()}
                      cellWidth={header.getSize()}
                      onClick={header.column.getToggleSortingHandler()}
                      style={header.column.columnDef.meta?.style}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </StickyHeaderCell>
                  ))}
                </TableRow>
              ))}

              {/* Filter Row */}
              {showFilters &&
                table.getHeaderGroups().map((headerGroup) => {
                  return (
                    <TableRow key={`${headerGroup.id}-filters`}>
                      {headerGroup.headers.map((header) => {
                        if (header.column.id === "expander") {
                          return (
                            <FilterTableCell
                              key={`${header.id}-filter`}
                              cellWidth={27.5}
                              sx={{ flexShrink: 0 }}
                            >
                              <Tooltip title="Clear all filters">
                                <IconButton
                                  size="small"
                                  onClick={() => columnFilterFns[1]([])}
                                  aria-label="Clear all filters"
                                  sx={{ flexShrink: 0 }}
                                >
                                  <SearchOffIcon fontSize="small" sx={{ flexShrink: 0 }} />
                                </IconButton>
                              </Tooltip>
                            </FilterTableCell>
                          );
                        }
                        return (
                          <FilterTableCell key={`${header.id}-filter`} cellWidth={header.getSize()}>
                            {header.column.getCanFilter() ? (
                              <FilterVariantCell header={header} />
                            ) : null}
                          </FilterTableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
            </StyledTableHead>

            {/* Table Body */}
            <StyledTableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <SubRowTableRow
                    key={row.id}
                    isSubRow={row.depth > 0}
                    onContextMenu={(e) => handleContextMenu(e, row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <StyledTableCell
                        key={cell.id}
                        className={resultStyles["styled-table-cell"]}
                        style={{
                          textAlign: cell.column.columnDef.meta?.style?.textAlign,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </StyledTableCell>
                    ))}
                  </SubRowTableRow>
                ))
              ) : (
                <TableRow className={resultStyles["styled-table-row"]}>
                  <EmptyStateCell colSpan={table.getAllColumns().length}>
                    {searchResults.length === 0
                      ? isLoading
                        ? "Searching..."
                        : tableText || "No search query"
                      : table.getState().columnFilters.length > 0 || table.getState().globalFilter
                        ? "No results matching your filter values"
                        : "No results found"}
                  </EmptyStateCell>
                </TableRow>
              )}
            </StyledTableBody>
          </SearchResultsTable>

          {/* Enhanced error handling */}
          {error && (
            <ErrorContainer className={resultStyles["error-container"]}>
              <p>Error: {error}</p>
              <ErrorRetryButton
                onClick={() => window.location.reload()}
                className={resultStyles["error-retry-button"]}
              >
                Retry
              </ErrorRetryButton>
            </ErrorContainer>
          )}

          {/* Pagination Controls - Only show if more than 1 page */}
          {totalRowCount > 10 && (
            <PaginationContainer>
              {/* Page Size Selector */}
              <PageSizeContainer>
                <Typography variant="body2">Show:</Typography>
                <FormControl size="small">
                  <PageSizeSelect
                    value={table.getState().pagination.pageSize}
                    onChange={(e) => table.setPageSize(Number(e.target.value))}
                    aria-label="rows per page"
                  >
                    {generatePageSizes(totalRowCount, 10, 5).map((pageSize) => (
                      <MenuItem key={pageSize} value={pageSize}>
                        {pageSize === totalRowCount ? "All" : pageSize}
                      </MenuItem>
                    ))}
                  </PageSizeSelect>
                </FormControl>
                <Typography variant="body2">rows</Typography>
              </PageSizeContainer>

              {/* Page Info — "Showing N of M" surfaces the post-filter vs
                  pre-filter delta when the user narrows the results with a
                  column / global filter. When no filter is active (filtered
                  === total) it collapses back to the plain total form. */}
              <Typography variant="body2">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                {filteredRowCount === totalRowCount
                  ? ` (${totalRowCount} total results)`
                  : ` (Showing ${filteredRowCount} of ${totalRowCount} results)`}
              </Typography>

              {/* Navigation Buttons */}
              <NavigationContainer>
                <IconButton
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  size="small"
                >
                  <FirstPageIcon />
                </IconButton>
                <IconButton
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  size="small"
                >
                  <ChevronLeftIcon />
                </IconButton>
                <IconButton
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  size="small"
                >
                  <ChevronRightIcon />
                </IconButton>
                <IconButton
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  size="small"
                >
                  <LastPageIcon />
                </IconButton>
              </NavigationContainer>
            </PaginationContainer>
          )}
        </Box>

        {/* Column Visibility Menu */}
        <Menu
          anchorEl={columnMenuAnchor}
          open={Boolean(columnMenuAnchor)}
          onClose={() => setColumnMenuAnchor(null)}
          className={styles["column-visibility-menu"]}
        >
          {table
            .getAllLeafColumns()
            .filter((column) => column.getCanHide())
            .map((column) => (
              <ColumnMenuItemContainer key={column.id}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                    />
                  }
                  label={<ListItemText primary={String(column.columnDef.header || column.id)} />}
                />
              </ColumnMenuItemContainer>
            ))}
        </Menu>

        {/* Context Menu */}
        {contextMenu && contextMenu.product && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            product={contextMenu.product}
            onClose={handleCloseContextMenu}
            onExcludeProduct={excludeProduct}
          />
        )}
      </div>
    </>
  );
}
