import "@tanstack/react-table";
import { UserSettings } from "./common";

declare module "@tanstack/react-table" {
  interface TableMeta {
    userSettings: UserSettings;
  }

  interface Table {
    /** User settings associated with this table */
    userSettings?: UserSettings;
    /** Function to update user settings */
    setUserSettings?: (settings: UserSettings) => void;
    /** Function to sort table rows by match percentage */
    sortByMatchPercentage?: (order?: "asc" | "desc") => void;
    /** Function to check if table is currently sorted by match percentage */
    isSortedByMatchPercentage?: () => boolean;
    /** Function to get current match percentage sort order */
    getMatchPercentageSortOrder?: () => "asc" | "desc" | null;
    /** Internal state for custom sorting */
    _customSort?: { type: string; order: "asc" | "desc" };
  }

  interface Column<TValue> {
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
     * Explicitly sets the visibility state of the column.
     * Only works if the column is configured to be hideable.
     * @param visible - Whether the column should be visible
     */
    setColumnVisibility: (visible: boolean) => void;

    /** User settings associated with this column */
    userSettings?: UserSettings;
  }

  interface ColumnMeta {
    /** The type of filter to use for this column */
    filterVariant?: "text" | "range" | "select";
    /** Array of unique values for select-type filters */
    uniqueValues?: string[];
    /** Array of range values for range-type filters */
    rangeValues?: number[];
    /** CSS properties to apply to the column */
    style?: CSSProperties;
  }
}

declare global {
  interface Window {
    resultsTable?: object;
  }
}

export {};
