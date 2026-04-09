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
  Typography,
} from "@mui/material";

import DrawerSystem from "@/components/DrawerSystem";
import LoadingBackdrop from "@/components/LoadingBackdrop";
import resultStyles from "@/components/ResultsPanel.module.scss";
import { generatePageSizes } from "@/helpers/utils";
import { useDebouncedCallback } from "@/shared/hooks";
import { Column, ColumnFiltersState, flexRender, Header, Row } from "@tanstack/react-table";
import { isEmpty } from "lodash";
import React, { Dispatch, ReactElement, SetStateAction, useEffect, useState } from "react";
import {
  BackButton,
  ColoredIconButton,
  ColumnMenuItemContainer,
  EmptyStateCell,
  ErrorContainer,
  ErrorRetryButton,
  FilterIconButton,
  FilterTableCell,
  FilterTextField,
  GlobalFilterTextField,
  NavigationContainer,
  PageSizeContainer,
  PageSizeSelect,
  PaginationContainer,
  ResultsCountDisplay,
  ResultsHeaderContainer,
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
import styles from "./ResultsTable.module.scss";
import { useAutoColumnSizing } from "./useAutoColumnSizing.hook";
import { useContextMenu } from "./useContextMenu.hook";
import { useResultsTable } from "./useResultsTable.hook";

const FILTER_DEBOUNCE_MS = 250;

/**
 * Filter input that debounces column filter updates.
 * Maintains local state for responsive typing while delaying
 * the actual table filter application by {@link FILTER_DEBOUNCE_MS}.
 * @param header - The TanStack table header containing the column to filter
 * @source
 */
function DebouncedFilterInput({ header }: { header: Header<Product, unknown> }) {
  const [localValue, setLocalValue] = useState((header.column.getFilterValue() as string) ?? "");

  const applyFilter = useDebouncedCallback((value: string) => {
    let filterValue: unknown = value;
    if (
      (typeof header.column.columnDef?.filterFn === "string" &&
        header.column.columnDef.filterFn === "inNumberRange") ||
      header.column.columnDef.meta?.filterVariant === "range"
    ) {
      filterValue = value.split(/[-\s]+/).map(Number) as unknown as [number, number];
    } else if (header.column.columnDef.meta?.filterVariant === "select") {
      filterValue = value
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map(String);
    }
    console.info("Filter applied (debounced):", filterValue);
    header.column.setFilterValue(filterValue);
  }, FILTER_DEBOUNCE_MS);

  return (
    <FilterTextField
      size="small"
      variant="outlined"
      placeholder="Search..."
      value={localValue}
      onChange={(e) => {
        console.debug("Filter keystroke:", e.target.value);
        setLocalValue(e.target.value);
        applyFilter(e.target.value);
      }}
    />
  );
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

  // Enhanced search hook that maintains streaming behavior
  const { searchResults, isLoading, error, executeSearch, handleStopSearch, tableText } =
    useSearch();

  // Watch for pending search queries triggered from HistoryPanel
  useEffect(() => {
    if (appContext?.pendingSearchQuery) {
      executeSearch(appContext.pendingSearchQuery);
      appContext.setPendingSearchQuery(null);
    }
  }, [appContext?.pendingSearchQuery, executeSearch, appContext]);

  // Context menu functionality
  const { contextMenu, handleContextMenu, handleCloseContextMenu } = useContextMenu();

  // Global filter logic
  const filteredResults = globalFilter.trim()
    ? searchResults.filter((row) =>
        Object.values(row).join(" ").toLowerCase().includes(globalFilter.trim().toLowerCase()),
      )
    : searchResults;

  // Use filteredResults instead of searchResults for optimisticResults
  const optimisticResults = filteredResults;

  const table = useResultsTable({
    showSearchResults: optimisticResults,
    columnFilterFns,
    getRowCanExpand,
    userSettings: appContext?.userSettings || {
      showHelp: false,
      caching: true,
      autocomplete: true,
      currency: "USD",
      currencyRate: 1.0,
      location: "US",
      shipsToMyLocation: false,
      foo: "bar",
      jason: false,
      antoine: true,
      popupSize: "small",
      supplierResultLimit: 5,
      autoResize: true,
      someSetting: false,
      suppliers: [],
      theme: "light",
      showColumnFilters: true,
      showAllColumns: false,
      hideColumns: ["description", "uom"],
      columnFilterConfig: {},
    },
  });

  // Initialize column visibility - this effect is still needed
  useEffect(() => {
    if (appContext && !isEmpty(appContext.userSettings.hideColumns)) {
      table.getAllLeafColumns().map((column: Column<Product>) => {
        if (appContext.userSettings.hideColumns.includes(column.id)) {
          column.toggleVisibility(false);
        }
      });
    }
  }, [appContext?.userSettings.hideColumns, table]);

  // Auto column sizing
  const { getMeasurementTableProps } = useAutoColumnSizing(table, optimisticResults);

  const handleSearch = (query: string) => {
    if (query.trim()) {
      executeSearch(query.trim());
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      const target = event.target as HTMLInputElement;
      handleSearch(target.value);
    }
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  return (
    <>
      <LoadingBackdrop
        open={isLoading}
        resultCount={optimisticResults.length}
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

        {/* <div className="results-title">Search Results ({optimisticResults.length} found)</div> */}

        <ResultsHeaderContainer>
          <ResultsCountDisplay>Results: {optimisticResults.length}</ResultsCountDisplay>
          {/* Only show the global filter if there are results */}
          {table.getRowModel().rows.length > 0 && (
            <GlobalFilterTextField
              size="small"
              variant="outlined"
              placeholder="Filter results..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
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
            <thead>
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
            <tbody>
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
                table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={`${headerGroup.id}-filters`}>
                    {headerGroup.headers.map((header) => (
                      <FilterTableCell key={`${header.id}-filter`} cellWidth={header.getSize()}>
                        {header.column.getCanFilter() ? (
                          <DebouncedFilterInput header={header} />
                        ) : null}
                      </FilterTableCell>
                    ))}
                  </TableRow>
                ))}
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
                    {optimisticResults.length === 0
                      ? tableText || "No search query"
                      : table.getState().columnFilters.length > 0
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
          {table.getPageCount() > 1 && (
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
                    {generatePageSizes(table.getFilteredRowModel().rows.length, 10, 5).map(
                      (pageSize) => (
                        <MenuItem key={pageSize} value={pageSize}>
                          {pageSize === table.getFilteredRowModel().rows.length ? "All" : pageSize}
                        </MenuItem>
                      ),
                    )}
                  </PageSizeSelect>
                </FormControl>
                <Typography variant="body2">rows</Typography>
              </PageSizeContainer>

              {/* Page Info */}
              <Typography variant="body2">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} (
                {table.getFilteredRowModel().rows.length} total results)
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
          />
        )}
      </div>
    </>
  );
}
