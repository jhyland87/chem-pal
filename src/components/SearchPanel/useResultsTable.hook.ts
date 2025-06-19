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
import TableColumns from "./TableColumns";

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
  const resultsTable = useReactTable({
    data: showSearchResults,
    enableColumnResizing: true,
    columnResizeDirection: "ltr",
    defaultColumn: {
      // Removed minSize and maxSize for more flexibility
    },
    columnResizeMode: "onChange",
    columns: TableColumns() as ColumnDef<Product, unknown>[],
    filterFns: {},
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
          table.userSettings = userSettings;
          /**
           * Updates the user settings on the table instance.
           * @param userSettings - New user settings to apply
           */
          table.setUserSettings = (userSettings: UserSettings) => {
            table.userSettings = userSettings;
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
