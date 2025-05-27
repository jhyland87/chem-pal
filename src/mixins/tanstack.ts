import { Column, Table } from "@tanstack/react-table";
import debounce from "lodash/debounce";
import throttle from "lodash/throttle";

import { StringOrTemplateHeader } from "@tanstack/react-table";

/**
 * Gets the displayable header text for a column.
 * This is needed because the header text is not always a string.
 * Sometimes it's an HTML or React element.
 *
 * @param column - The column to get the header text from
 * @returns The displayable header text as a string
 */
export function getHeaderText<TData>(column: Column<TData, unknown>): string {
  const header = column.columnDef.header as StringOrTemplateHeader<TData, unknown>;
  if (header === undefined) return "";
  if (typeof header === "string") return header;
  if (typeof header === "function") {
    const result = (header as () => { props?: { children?: string } })()?.props?.children;
    return result ?? "";
  }
  return String(header);
}

/**
 * Gets a sorted unique list of values for a column from visible rows.
 * Only returns the visible values (e.g., if another filter has been applied,
 * the filtered out results won't be included here).
 *
 * @param column - The column to get values from
 * @param table - The table instance
 * @returns A sorted array of unique values
 */
export function getVisibleUniqueValues<TData>(
  column: Column<TData, unknown>,
  table: Table<TData>,
): (string | number)[] {
  const values = new Set<string | number>();

  table.getRowModel().rows.forEach((row) => {
    const value = row.getValue(column.id);
    if (value !== undefined && value !== null) values.add(value as string | number);
  });

  return Array.from(values).sort((a, b) => {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b));
  });
}

/**
 * Gets a sorted unique list of values for a column from all rows.
 * Returns all values, including the filtered out ones.
 *
 * @param column - The column to get values from
 * @param table - The table instance
 * @returns A sorted array of unique values
 */
export function getAllUniqueValues<TData>(
  column: Column<TData, unknown>,
  table: Table<TData>,
): (string | number)[] {
  const uniqueValues = table.options.data.reduce<string[]>((accu: string[], row: TData) => {
    const value = row[column.id as keyof TData] as string;
    if (value !== undefined && accu.indexOf(value) === -1) accu.push(value);
    return accu;
  }, []);

  return uniqueValues.sort((a, b) => {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b));
  });
}

/**
 * Gets the range of values for a column from all rows.
 * Returns all values, including the filtered out ones.
 *
 * @param column - The column to get the range from
 * @param table - The table instance
 * @returns A tuple containing the minimum and maximum values
 */
export function getFullRange<TData>(
  column: Column<TData, unknown>,
  table: Table<TData>,
): [number, number] {
  const values = getAllUniqueValues(column, table);
  return [values[0] as number, values[values.length - 1] as number];
}

/**
 * Gets the range of values for a column from visible rows.
 * Only returns the visible values (e.g., if another filter has been applied,
 * the filtered out results won't be included here).
 *
 * @param column - The column to get the range from
 * @param table - The table instance
 * @returns A tuple containing the minimum and maximum values
 */
export function getVisibleRange<TData>(
  column: Column<TData, unknown>,
  table: Table<TData>,
): [number, number] {
  const values = getVisibleUniqueValues(column, table);
  return [values[0] as number, values[values.length - 1] as number];
}

/**
 * Sets the visibility of a column.
 *
 * @param column - The column to set visibility for
 * @param visible - Whether the column should be visible
 */
export function setColumnVisibility<TData>(column: Column<TData, unknown>, visible: boolean): void {
  if (column.getCanHide() === false) return;
  if (visible) {
    if (!column.getIsVisible()) column.toggleVisibility(true);
  } else {
    if (column.getIsVisible()) column.toggleVisibility(false);
  }
}

/**
 * Implements custom methods for Tanstack Table columns.
 *
 * This function extends each column in the table with additional utility methods.
 * Each column will be enhanced with the following methods:
 *
 * - `getHeaderText()` - Gets the displayable header text
 * - `getVisibleUniqueValues()` - Gets unique values from visible rows
 * - `getAllUniqueValues()` - Gets all unique values regardless of filters
 * - `getFullRange()` - Gets the min/max range of all values
 * - `getVisibleRange()` - Gets the min/max range of visible values
 * - `setFilterValueDebounced()` - Debounced filter value setter
 * - `setFilterValueThrottled()` - Throttled filter value setter
 * - `setColumnVisibility()` - Sets column visibility
 *
 * @param TData - The type of data in the table rows
 * @param table - The table instance to extend with custom methods
 */
export function implementCustomMethods<TData>(table: Table<TData>) {
  // Add custom column methods to each column
  table.getAllColumns().forEach((column: Column<TData, unknown>) => {
    if (!column.getHeaderText) {
      column.getHeaderText = () => getHeaderText(column);
    }

    if (!column.getVisibleUniqueValues) {
      column.getVisibleUniqueValues = () => getVisibleUniqueValues(column, table);
    }

    if (!column.getAllUniqueValues) {
      column.getAllUniqueValues = () => getAllUniqueValues(column, table);
    }

    if (!column.getFullRange) {
      column.getFullRange = () => getFullRange(column, table);
    }

    if (!column.getVisibleRange) {
      column.getVisibleRange = () => getVisibleRange(column, table);
    }

    if (!column.setFilterValueDebounced) {
      column.setFilterValueDebounced = debounce(column.setFilterValue, 500);
    }

    if (!column.setFilterValueThrottled) {
      column.setFilterValueThrottled = throttle(column.setFilterValue, 500);
    }

    if (!column.setColumnVisibility) {
      column.setColumnVisibility = (visible: boolean) => setColumnVisibility(column, visible);
    }
  });
}
