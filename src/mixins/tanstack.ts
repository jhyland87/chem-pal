import { type Column, type StringOrTemplateHeader, type Table } from "@tanstack/react-table";

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
