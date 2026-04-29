import "@tanstack/react-table";
import { UserSettings } from "./common";

/**
 * TanStack Table types.
 */
declare module "@tanstack/react-table" {
  /**
   * Table meta data.
   */
  interface TableMeta {
    userSettings: UserSettings;
  }

  /**
   * Table interface
   */
  interface Table<TData extends RowData> {
    /** User settings associated with this table */
    userSettings?: UserSettings;
    /** Function to update user settings */
    setUserSettings?: (settings: UserSettings) => void;
    /** Function to sort table rows by match percentage (fuzz match, Levenshtein distance, basically) */
    sortByMatchPercentage?: (order?: "asc" | "desc") => void;
    /** Function to check if table is currently sorted by match percentage */
    isSortedByMatchPercentage?: () => boolean;
    /** Function to get current match percentage sort order */
    getMatchPercentageSortOrder?: () => "asc" | "desc" | null;
    /** Internal state for custom sorting */
    _customSort?: { type: string; order: "asc" | "desc" };
    /** Function to update the badge with current row count */
    updateBadgeCount?: () => void;
  }

  /**
   * Column interface
   */
  interface Column<TData extends RowData, TValue> {
    /**
     * Returns a sorted array of unique values from the currently visible rows in the column.
     * This excludes values from rows that are filtered out by other column filters.
     * @returns Array of unique string or number values, sorted in ascending order
     */
    getVisibleUniqueValues: () => (string | number)[];

    /**
     * Returns the minimum and maximum values from the currently visible rows in the column.
     * This excludes values from rows that are filtered out by other column filters.
     * @returns Tuple containing [min, max] values
     */
    getVisibleRange: () => [number, number];

    /**
     * Returns a sorted array of all unique values in the column, regardless of current filters.
     * @returns Array of unique string or number values, sorted in ascending order
     */
    getAllUniqueValues: () => (string | number)[];

    /**
     * Returns the minimum and maximum values from all rows in the column, regardless of current filters.
     * @returns Tuple containing [min, max] values
     */
    getFullRange: () => [number, number];

    /**
     * Returns the display text of the column header.
     * Handles cases where the header might be a string, function, or React element.
     * @returns The header text as a string, or undefined if no header text is available
     */
    getHeaderText: () => string | undefined;

    /**
     * Sets the filter value for the column with a 500ms debounce.
     * Useful for text input filters to prevent excessive filtering operations.
     * @param value - The new filter value to set
     */
    setFilterValueDebounced: (value: TValue) => void;

    /**
     * Sets the filter value for the column with a 500ms throttle.
     * Useful for range filters to limit the frequency of filter updates.
     * @param value - The new filter value to set
     */
    setFilterValueThrottled: (value: TValue) => void;

    /**
     * Sets the visibility of the column.
     * @param visible - Whether the column should be visible
     */
    setColumnVisibility: (visible: boolean) => void;

    /** User settings associated with this column */
    userSettings?: UserSettings;
  }

  /**
   * Configuration metadata for table columns.
   * Used to customize column behavior and appearance.
   *
   * @example
   * ```typescript
   * const columnMeta: ColumnMeta = {
   *   filterVariant: "range",
   *   uniqueValues: ["ACS", "Technical", "USP"],
   *   rangeValues: [0, 1000],
   *   style: { width: "200px" }
   * };
   * ```
   */
  interface ColumnMeta {
    /**
     * Type of filter to use for this column
     * @example "range"
     */
    filterVariant?: "range" | "select" | "text";

    /**
     * List of all possible unique values for select filters
     * @example ["ACS", "Technical", "USP"]
     */
    uniqueValues?: string[];

    /**
     * Minimum and maximum values for range filters
     * @example [0, 1000]
     */
    rangeValues?: number[];

    /**
     * Custom CSS styles to apply to the column
     * @example \{ width: "200px" \}
     */
    style?: CSSProperties;

    /**
     * Size of the filter input
     * @example 6
     */
    filterInputSize?: number;

    /**
     * Placeholder text for the filter input
     * @example "Search..."
     */
    filterPlaceholder?: string;

    /**
     * Optional drawer-section configuration. When present, DrawerSearchPanel
     * renders an accordion entry for this column, bound to a slice of app
     * state (`searchFilters`, `selectedSuppliers`, or `userSettings`).
     * Columns without this field do not appear in the drawer.
     */
    drawer?: ColumnDrawerConfig;

    /**
     * Optional per-option renderer for `filterVariant: "select"` columns.
     * When defined, `SelectColumnFilter` uses it to render each value in both
     * the dropdown list and the selected-chip area (overriding the default
     * collapsed count chip) — useful when text codes (e.g. country codes like
     * `"US"`) would read better as icons (e.g. a flag).
     */
    renderSelectOption?: (value: string) => import("react").ReactNode;
  }

  // Register our custom sorting functions by augmenting the `SortingFns`
  // interface. TanStack resolves `SortingFnOption<TData>` via `keyof SortingFns`,
  // so adding keys here makes them valid `sortingFn` string literals. The set
  // must match what's actually registered on the table in
  // `useResultsTable.hook.ts` — keys listed here become *required* in the
  // table's `sortingFns` option.
  // Type aliases can't be merged, so this is the only way to extend the union.
  interface SortingFns {
    matchPercentage: SortingFn<RowData>;
    priceSortingFn: SortingFn<RowData>;
    quantitySortingFn: SortingFn<RowData>;
  }

  // Register our custom filter functions by augmenting the `FilterFns`
  // interface. Same reasoning as `SortingFns` above — `FilterFnOption<TData>`
  // is derived from `keyof FilterFns`.
  interface FilterFns {
    multiSelect: FilterFn<RowData>;
    includeHierarchy: FilterFn<RowData>;
    inNumberRangeHierarchy: FilterFn<RowData>;
  }
}

declare global {
  interface Window {
    resultsTable?: object;
  }
}

export {};
