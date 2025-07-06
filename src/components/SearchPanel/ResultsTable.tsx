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
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Column, ColumnFiltersState, flexRender, Row } from "@tanstack/react-table";
import { isEmpty } from "lodash";
import React, { Dispatch, ReactElement, SetStateAction, useEffect, useState } from "react";

import DrawerSystem from "../DrawerSystem";
import LoadingBackdrop from "../LoadingBackdrop";
import "../ResultsPanel.scss";
import {
  ColoredIconButton,
  ColumnMenuItemContainer,
  EmptyStateCell,
  FilterIconButton,
  FilterTableCell,
  FilterTextField,
  HeaderRight,
  NavigationContainer,
  PageSizeContainer,
  PageSizeSelect,
  PaginationContainer,
  SortableTableHeaderCell,
  StyledTable,
  StyledTableBody,
  StyledTableCell,
  StyledTableHead,
  SubRowTableRow,
} from "../StyledComponents";
import ContextMenu from "./ContextMenu";
import { useAppContext } from "./hooks/useContext";
import { useSearch } from "./hooks/useSearch";
import { useAutoColumnSizing } from "./useAutoColumnSizing.hook";
import { useContextMenu } from "./useContextMenu.hook";
import { useResultsTable } from "./useResultsTable.hook";

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
 */
export default function ResultsTable({
  getRowCanExpand,
  columnFilterFns,
}: ResultsTableProps): ReactElement {
  const appContext = useAppContext();
  const theme = useTheme();
  const [showFilters, setShowFilters] = useState(false);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
  const [globalFilter, setGlobalFilter] = useState("");

  // Enhanced search hook that maintains streaming behavior
  const { searchResults, isLoading, error, resultCount, executeSearch, handleStopSearch } =
    useSearch();

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

  // Optional: Log current result count for debugging
  if (resultCount > 0) {
    console.debug(`Currently showing ${resultCount} results`);
  }

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

      <div className="results-container">
        <div className="results-header">
          <div className="header-left">
            {appContext?.setPanel && (
              <IconButton
                onClick={() => appContext.setPanel!(0)}
                size="small"
                sx={{ color: theme.palette.text.primary }}
                aria-label="Back to search home"
              >
                <ArrowBackIcon />
              </IconButton>
            )}
          </div>
          <HeaderRight>
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
          </HeaderRight>
        </div>

        {/* <div className="results-title">Search Results ({optimisticResults.length} found)</div> */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 16px 0 16px",
            background: theme.palette.background.paper,
            borderTopLeftRadius: theme.shape?.borderRadius ?? 0,
            borderTopRightRadius: theme.shape?.borderRadius ?? 0,
          }}
        >
          <div style={{ fontWeight: 600, color: theme.palette.text.primary }}>
            Results: {optimisticResults.length}
          </div>
          <TextField
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
            sx={{
              background: theme.palette.background.default,
              color: theme.palette.text.primary,
              minWidth: 180,
            }}
          />
        </div>

        <div className="results-paper" style={{ overflowX: "auto", width: "100%" }}>
          {/* Hidden measurement table for auto-sizing */}
          <table
            {...getMeasurementTableProps()}
            style={{
              visibility: "hidden",
              position: "absolute",
              left: "-9999px",
              height: 0,
              overflow: "hidden",
            }}
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

          <StyledTable
            style={{ minWidth: 650 /* allow table to grow as needed, remove width: 100% */ }}
          >
            <StyledTableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <SortableTableHeaderCell
                      key={header.id}
                      canSort={header.column.getCanSort()}
                      cellWidth={header.getSize()}
                      onClick={header.column.getToggleSortingHandler()}
                      sx={{
                        position: "sticky",
                        top: 0,
                        background: theme.palette.background.paper,
                        //zIndex: 2,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </SortableTableHeaderCell>
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
                          <FilterTextField
                            size="small"
                            variant="outlined"
                            placeholder={`Search...`}
                            value={(header.column.getFilterValue() as string) ?? ""}
                            onChange={(e) => header.column.setFilterValue(e.target.value)}
                          />
                        ) : null}
                      </FilterTableCell>
                    ))}
                  </TableRow>
                ))}
            </StyledTableHead>
            <StyledTableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <SubRowTableRow
                    key={row.id}
                    isSubRow={row.depth > 0}
                    onContextMenu={(e) => handleContextMenu(e, row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <StyledTableCell key={cell.id} className="styled-table-cell">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </StyledTableCell>
                    ))}
                  </SubRowTableRow>
                ))
              ) : (
                <TableRow className="styled-table-row">
                  <EmptyStateCell colSpan={table.getAllColumns().length}>
                    {optimisticResults.length === 0
                      ? "No search query"
                      : table.getState().columnFilters.length > 0
                        ? "No results matching your filter values"
                        : "No results found"}
                  </EmptyStateCell>
                </TableRow>
              )}
            </StyledTableBody>
          </StyledTable>

          {/* Enhanced error handling */}
          {error && (
            <div className="text-center p-4 text-red-500">
              <p>Error: {error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                Retry
              </button>
            </div>
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
                  >
                    {[5, 10, 20, 50].map((pageSize) => (
                      <MenuItem key={pageSize} value={pageSize}>
                        {pageSize}
                      </MenuItem>
                    ))}
                  </PageSizeSelect>
                </FormControl>
                <Typography variant="body2">rows</Typography>
              </PageSizeContainer>

              {/* Page Info */}
              <Typography variant="body2">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}(
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
        </div>

        {/* Column Visibility Menu */}
        <Menu
          anchorEl={columnMenuAnchor}
          open={Boolean(columnMenuAnchor)}
          onClose={() => setColumnMenuAnchor(null)}
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
                  label={
                    <ListItemText primary={(column.columnDef.header as string) || column.id} />
                  }
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
