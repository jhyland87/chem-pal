import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  FilterList as FilterListIcon,
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  ViewColumn as ViewColumnIcon,
} from "@mui/icons-material";
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Column, flexRender } from "@tanstack/react-table";
import { isEmpty } from "lodash";
import React, { ReactElement, useEffect, useState } from "react";

import DrawerSystem from "../DrawerSystem";
import LoadingBackdrop from "../LoadingBackdrop";
import {
  ColoredIconButton,
  ColumnMenuItemContainer,
  EmptyStateCell,
  FilterIconButton,
  FilterTableCell,
  FilterTextField,
  HeaderLeft,
  HeaderRight,
  HeaderSearchField,
  NavigationContainer,
  PageSizeContainer,
  PageSizeSelect,
  PaginationContainer,
  ResultsContainer,
  ResultsHeader,
  ResultsPaper,
  ResultsTitle,
  SortableTableHeaderCell,
  StyledTableCell,
  StyledTableRow,
  SubRowTableRow,
} from "../StyledComponents";
import ContextMenu from "./ContextMenu";
import { useAppContext } from "./hooks/useContext";
import { useSearch } from "./hooks/useSearch";
import { useAutoColumnSizing } from "./useAutoColumnSizing.hook";
import { useContextMenu } from "./useContextMenu.hook";
import { useResultsTable } from "./useResultsTable.hook";

interface ResultsTableProps {
  getRowCanExpand: (row: any) => boolean;
  columnFilterFns: any;
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);

  // Enhanced search hook that maintains streaming behavior
  const {
    searchResults,
    isLoading,
    statusLabel,
    error,
    resultCount,
    executeSearch,
    handleStopSearch,
  } = useSearch();

  // Context menu functionality
  const { contextMenu, handleContextMenu, handleCloseContextMenu } = useContextMenu();

  // Use searchResults directly - they're already streaming in real-time
  const optimisticResults = searchResults;

  // Optional: Log current result count for debugging
  if (resultCount > 0) {
    console.debug(`Currently showing ${resultCount} results`);
  }

  const table = useResultsTable({
    showSearchResults: optimisticResults,
    columnFilterFns,
    getRowCanExpand,
    userSettings: appContext?.userSettings,
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

  function columnSizeVars() {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
  }

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  const handleDrawerToggle = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

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
      <DrawerSystem isOpen={isDrawerOpen} onClose={handleDrawerClose} />

      <ResultsContainer>
        <ResultsHeader>
          <HeaderLeft>
            <HeaderSearchField
              size="small"
              variant="outlined"
              placeholder="Search for products..."
              onKeyPress={handleKeyPress}
              InputProps={{
                endAdornment: (
                  <IconButton onClick={() => handleSearch("")} size="small">
                    <SearchIcon />
                  </IconButton>
                ),
              }}
            />
          </HeaderLeft>
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
            <ColoredIconButton onClick={handleDrawerToggle} size="small" iconColor="#666">
              <SettingsIcon />
            </ColoredIconButton>
          </HeaderRight>
        </ResultsHeader>

        <ResultsTitle variant="h6">Search Results ({optimisticResults.length} found)</ResultsTitle>

        <ResultsPaper>
          {/* Hidden measurement table for auto-sizing */}
          <table {...getMeasurementTableProps()} style={{ display: "none" }}>
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

          <Table style={columnSizeVars()}>
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <SortableTableHeaderCell
                      key={header.id}
                      canSort={header.column.getCanSort()}
                      cellWidth={header.getSize()}
                      onClick={header.column.getToggleSortingHandler()}
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
            </TableHead>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <SubRowTableRow
                    key={row.id}
                    isSubRow={row.depth > 0}
                    onContextMenu={(e) => handleContextMenu(e, row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <StyledTableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </StyledTableCell>
                    ))}
                  </SubRowTableRow>
                ))
              ) : (
                <StyledTableRow>
                  <EmptyStateCell colSpan={table.getAllColumns().length}>
                    {optimisticResults.length === 0
                      ? "No search query"
                      : table.getState().columnFilters.length > 0
                        ? "No results matching your filter values"
                        : "No results found"}
                  </EmptyStateCell>
                </StyledTableRow>
              )}
            </TableBody>
          </Table>

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
        </ResultsPaper>

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
      </ResultsContainer>
    </>
  );
}
