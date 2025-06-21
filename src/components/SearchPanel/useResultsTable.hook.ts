import { matchPercentageSortingFn, priceSortingFn, quantitySortingFn } from "@/helpers/sorting";
import {
  getAllUniqueValues,
  getFullRange,
  getHeaderText,
  getVisibleRange,
  getVisibleUniqueValues,
  setColumnVisibility,
} from "@/mixins/tanstack";
import {
  ColumnDef,
  ColumnFiltersState,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedMinMaxValues,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  OnChangeFn,
  Row,
  useReactTable,
  type Table,
} from "@tanstack/react-table";
import { throttle } from "lodash";
import debounce from "lodash/debounce";
import { useMemo, useState } from "react";
import TableColumns from "./TableColumns";

/**
 * Custom filter function for multi-select columns.
 * Implements OR logic - shows rows that match ANY of the selected filter values.
 *
 * @param row - The table row being filtered
 * @param columnId - The ID of the column being filtered
 * @param filterValue - Array of selected filter values
 * @returns true if the row should be shown, false otherwise
 */
function multiSelectFilter(row: Row<Product>, columnId: string, filterValue: string[]): boolean {
  // If no filter values are selected, show all rows
  if (!Array.isArray(filterValue) || filterValue.length === 0) {
    return true;
  }

  const cellValue = row.getValue(columnId);

  // If cell value is null/undefined, don't show the row
  if (cellValue == null) {
    return false;
  }

  // Convert cell value to string for comparison
  const cellValueStr = String(cellValue);

  // Show row if cell value matches ANY of the selected filter values (OR logic)
  return filterValue.includes(cellValueStr);
}

/**
 * Configuration options for the useResultsTable hook.
 */
interface UseResultsTableProps {
  /** Array of product data to display in the table */
  showSearchResults: Product[];
  /** Tuple containing column filter state and setter function from useState */
  columnFilterFns: [ColumnFiltersState, OnChangeFn<ColumnFiltersState>];
  /** Function to determine if a row can be expanded to show sub-rows */
  getRowCanExpand: (row: Row<Product>) => boolean;
  /** User preferences and settings object containing display options */
  userSettings: UserSettings;
}

/**
 * Hook for managing the results table with TanStack Table configuration.
 * Co-located with ResultsTable.tsx since it's primarily used by that component.
 *
 * This hook configures and initializes a TanStack Table instance with:
 * - Column resizing capabilities
 * - Filtering and sorting functionality
 * - Pagination support
 * - Row expansion for product variants
 * - Custom column methods for filtering and data access
 * - Debounced and throttled filter updates
 *
 * @param props - Configuration options for the table setup
 * @returns Configured TanStack Table instance with all features enabled
 *
 * @example
 * ```tsx
 * const table = useResultsTable({
 *   showSearchResults: products,
 *   columnFilterFns: [filters, setFilters],
 *   getRowCanExpand: (row) => row.original.variants?.length > 0,
 *   userSettings: { currency: 'USD', ... }
 * });
 *
 * // Use table instance for rendering
 * table.getHeaderGroups().map(headerGroup => ...)
 * ```
 */
export function useResultsTable({
  showSearchResults,
  columnFilterFns,
  getRowCanExpand,
  userSettings,
}: UseResultsTableProps) {
  // State to track custom sorting
  const [customSort, setCustomSort] = useState<{ type: string; order: "asc" | "desc" } | null>(
    null,
  );

  // Apply custom sorting to data if needed
  const sortedData = useMemo(() => {
    if (customSort?.type === "matchPercentage") {
      console.log("🔄 Applying match percentage sort:", customSort.order);
      console.log(
        "📊 Before sorting - first 5 products:",
        showSearchResults.slice(0, 5).map((item) => ({
          title: item.title?.substring(0, 30) + "...",
          matchPercentage: item.matchPercentage,
        })),
      );

      const sorted = [...showSearchResults].sort((a, b) => {
        const aVal = a.matchPercentage ?? 0;
        const bVal = b.matchPercentage ?? 0;

        if (customSort.order === "desc") {
          return bVal - aVal;
        } else {
          return aVal - bVal;
        }
      });

      console.log(
        "📈 After sorting - first 5 products:",
        sorted.slice(0, 5).map((item) => ({
          title: item.title?.substring(0, 30) + "...",
          matchPercentage: item.matchPercentage,
        })),
      );

      return sorted;
    }
    return showSearchResults;
  }, [showSearchResults, customSort]);

  const resultsTable = useReactTable({
    data: sortedData,
    enableColumnResizing: true,
    columnResizeDirection: "ltr",
    defaultColumn: {
      // Removed minSize and maxSize for more flexibility
    },
    columnResizeMode: "onChange",
    columns: TableColumns() as ColumnDef<Product, unknown>[],
    filterFns: {
      multiSelect: multiSelectFilter,
    },
    sortingFns: {
      matchPercentage: matchPercentageSortingFn,
      priceSortingFn: priceSortingFn,
      quantitySortingFn: quantitySortingFn,
    },
    state: {
      columnFilters: columnFilterFns[0],
    },
    onColumnFiltersChange: columnFilterFns[1],
    getSubRows: (row) => row?.variants as Product[],
    getRowCanExpand: (row: Row<Product>) => getRowCanExpand(row),
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    debugTable: false,
    debugHeaders: false,
    debugColumns: false,
    _features: [
      {
        createTable: (table: Table<Product>) => {
          window.resultsTable = table;
          table.userSettings = userSettings;
          /**
           * Updates the user settings on the table instance.
           * @param userSettings - New user settings to apply
           */
          table.setUserSettings = (userSettings: UserSettings) => {
            table.userSettings = userSettings;
          };

          /**
           * Sorts the table rows by match percentage.
           * @param order - Sort order: 'asc' for ascending, 'desc' for descending
           */
          table.sortByMatchPercentage = (order: "asc" | "desc" = "desc") => {
            console.log("🔍 Initiating match percentage sort:", order);

            // Clear existing table sorting first
            table.resetSorting();

            // Set custom sort state which will trigger re-render via useMemo
            setCustomSort({
              type: "matchPercentage",
              order: order,
            });

            // Store state on table for API compatibility
            table._customSort = {
              type: "matchPercentage",
              order: order,
            };
          };

          /**
           * Checks if the table is currently sorted by match percentage.
           * @returns boolean indicating if match percentage sorting is active
           */
          table.isSortedByMatchPercentage = () => {
            return table._customSort?.type === "matchPercentage";
          };

          /**
           * Gets the current match percentage sort order.
           * @returns 'asc', 'desc', or null if not sorted by match percentage
           */
          table.getMatchPercentageSortOrder = () => {
            if (!table.isSortedByMatchPercentage?.()) return null;
            return table._customSort?.order || null;
          };
        },
        /**
         * Custom feature that extends table and column instances with additional methods.
         * Adds utility functions for filtering, data access, and user settings management.
         *
         * @param column - The column instance to extend
         * @param table - The table instance to extend
         */
        createColumn: (column, table) => {
          // Just gets the header text of the column
          column.getHeaderText = () => getHeaderText(column);

          // Function to set the visibility of the column
          column.setColumnVisibility = (visible: boolean) => setColumnVisibility(column, visible);

          // Function to count the number of unique values in the visible rows of the column
          column.getVisibleUniqueValues = () => getVisibleUniqueValues(column, table);

          // Same as getVisibleUniqueValues, but for all rows
          column.getAllUniqueValues = () => getAllUniqueValues(column, table);

          // Get the minimum and maximum values from a column (for range filters)
          column.getFullRange = () => getFullRange(column, table);

          // Visible range of values in the column
          column.getVisibleRange = () => getVisibleRange(column, table);

          // Debounced filter value setter
          column.setFilterValueDebounced = debounce(column.setFilterValue, 500);

          // Throttled filter value setter
          column.setFilterValueThrottled = throttle(column.setFilterValue, 500);
        },
      },
    ],
  });

  return resultsTable;
}
