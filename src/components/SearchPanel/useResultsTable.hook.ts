import { matchPercentageSortingFn, priceSortingFn, quantitySortingFn } from "@/helpers/sorting";
import {
  getAllUniqueValues,
  getFullRange,
  getHeaderText,
  getVisibleRange,
  getVisibleUniqueValues,
  setColumnVisibility,
} from "@/mixins/tanstack";
import BadgeAnimator from "@/utils/BadgeAnimator";
import {
  ColumnDef,
  ColumnFiltersState,
  filterFns,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  OnChangeFn,
  Row,
  useReactTable,
  type FilterFn,
  type Table,
} from "@tanstack/react-table";
import debounce from "lodash/debounce";
import throttle from "lodash/throttle";
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
 * @source
 */
const multiSelectBase: FilterFn<Product> = (row, columnId, filterValue) => {
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
  return filterValue.some((value) => value.toLowerCase() === cellValueStr.toLowerCase());
};

const includesTextBase: FilterFn<Product> = (row, columnId, filterValue) => {
  const search = String(filterValue ?? "")
    .toLowerCase()
    .trim();
  if (!search) return true;
  const cellValue = row.getValue(columnId);
  if (cellValue == null) return false;
  return String(cellValue).toLowerCase().includes(search);
};

/**
 * Higher-order filter that makes any base filter "hierarchy aware" across
 * the parent/variant row tree:
 *
 * - If THIS row's cell passes the base filter, include it.
 * - If ANY ANCESTOR passes the base filter, include this row too (so a
 *   matching parent pulls all its variants along).
 * - If ANY DESCENDANT passes the base filter, include this row too (so a
 *   matching variant pulls its parent along — non-matching siblings stay
 *   hidden because they fail on all three checks).
 *
 * Used as a wrapper in `filterFns` so every column filter and the global
 * filter behave consistently with respect to the parent ↔ variant
 * relationship. Works with `filterFromLeafRows: false` (the default).
 */
function withHierarchy<T>(base: FilterFn<T>): FilterFn<T> {
  const fn: FilterFn<T> = (row, columnId, filterValue, addMeta) => {
    if (base(row, columnId, filterValue, addMeta)) return true;

    let parent = row.getParentRow();
    while (parent) {
      if (base(parent, columnId, filterValue, addMeta)) return true;
      parent = parent.getParentRow();
    }

    const anyDescendant = (r: Row<T>): boolean => {
      for (const sub of r.subRows) {
        if (base(sub, columnId, filterValue, addMeta)) return true;
        if (anyDescendant(sub)) return true;
      }
      return false;
    };
    return anyDescendant(row);
  };
  // Preserve `resolveFilterValue` / `autoRemove` hooks that the base filter
  // may define (e.g. the built-in `inNumberRange` relies on these to parse
  // min/max values). Without this passthrough, `inNumberRangeHierarchy`
  // would never receive a parsed tuple and would reject every row.
  fn.resolveFilterValue = base.resolveFilterValue;
  fn.autoRemove = base.autoRemove;
  return fn;
}

const multiSelectFilter = withHierarchy(multiSelectBase);
const includeHierarchyTextFilter = withHierarchy(includesTextBase);
const inNumberRangeHierarchyFilter = withHierarchy(filterFns.inNumberRange);

/**
 * Configuration options for the useResultsTable hook.
 * @source
 */
interface UseResultsTableProps {
  /** Array of product data to display in the table */
  showSearchResults: Product[];
  /** Tuple containing column filter state and setter function from useState */
  columnFilterFns: [ColumnFiltersState, OnChangeFn<ColumnFiltersState>];
  /** Tuple containing global filter state and setter function from useState */
  globalFilterFns: [string, OnChangeFn<string>];
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
 * @source
 */
export function useResultsTable({
  showSearchResults,
  columnFilterFns,
  globalFilterFns,
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
      const sorted = [...showSearchResults].sort((a, b) => {
        const aVal = a.matchPercentage ?? 0;
        const bVal = b.matchPercentage ?? 0;

        if (customSort.order === "desc") return bVal - aVal;
        return aVal - bVal;
      });

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
    // Passed through TanStack's `meta` so hook-free cell renderers (see the
    // price column in TableColumns.tsx) can read userSettings without
    // calling useAppContext() themselves.
    meta: { userSettings },
    filterFns: {
      multiSelect: multiSelectFilter,
      includeHierarchy: includeHierarchyTextFilter,
      inNumberRangeHierarchy: inNumberRangeHierarchyFilter,
    },
    sortingFns: {
      matchPercentage: matchPercentageSortingFn,
      priceSortingFn: priceSortingFn,
      quantitySortingFn: quantitySortingFn,
    },
    state: {
      columnFilters: columnFilterFns[0],
      globalFilter: globalFilterFns[0],
    },
    globalFilterFn: includeHierarchyTextFilter,
    // Columns that should start hidden — users can opt them in via the
    // column-visibility menu. Overridden by any persisted visibility state
    // in chrome.storage on mount.
    initialState: {
      columnVisibility: {
        availability: false,
      },
    },
    // Each row is filtered independently by our `withHierarchy` wrapper
    // (self / ancestors / descendants). Setting `filterFromLeafRows: true`
    // would short-circuit that — parents of matching leaves would always
    // be kept regardless of whether we matched them, which breaks the
    // "show only matching variants" requirement.
    filterFromLeafRows: false,
    onColumnFiltersChange: columnFilterFns[1],
    onGlobalFilterChange: globalFilterFns[1],
    getSubRows: (row) => row?.variants as Product[],
    getRowCanExpand: (row: Row<Product>) => getRowCanExpand(row),
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getFacetedRowModel: getFacetedRowModel(),
    paginateExpandedRows: false,
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
           * @source
           */
          table.setUserSettings = (userSettings: UserSettings) => {
            table.userSettings = userSettings;
          };

          /**
           * Sorts the table rows by match percentage.
           * @param order - Sort order: 'asc' for ascending, 'desc' for descending
           * @source
           */
          table.sortByMatchPercentage = (order: "asc" | "desc" = "desc") => {
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
           * @source
           */
          table.isSortedByMatchPercentage = () => {
            return table._customSort?.type === "matchPercentage";
          };

          /**
           * Gets the current match percentage sort order.
           * @returns 'asc', 'desc', or null if not sorted by match percentage
           * @source
           */
          table.getMatchPercentageSortOrder = () => {
            if (!table.isSortedByMatchPercentage?.()) return null;
            return table._customSort?.order || null;
          };

          /**
           * Updates the badge with the current row count from the table.
           * @source
           */
          table.updateBadgeCount = () => {
            const rowCount = table.getRowCount();
            BadgeAnimator.setText(rowCount.toString());
          };
        },
        /**
         * Custom feature that extends table and column instances with additional methods.
         * Adds utility functions for filtering, data access, and user settings management.
         *
         * @param column - The column instance to extend
         * @param table - The table instance to extend
         * @source
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

  window.resultsTable = resultsTable;
  return resultsTable;
}
