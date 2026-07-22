import { type Column, type ColumnDef, type Table } from '@tanstack/react-table';
import { i18n } from '@/helpers/i18n';

/**
 * Narrows an unknown value to the primitive column value types handled here.
 *
 * @param value - The value to check
 * @returns True if `value` is a string or number
 */
function isStringOrNumber(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

/**
 * Reads the `accessorKey` from a column definition when it is an accessor column.
 *
 * @param columnDef - The column definition to inspect
 * @returns The accessor key, or undefined for non-accessor columns
 */
function getAccessorKey<TData>(columnDef: ColumnDef<TData, unknown>): keyof TData | undefined {
  if ('accessorKey' in columnDef) {
    const key = columnDef.accessorKey;
    if (typeof key === 'string' || typeof key === 'number' || typeof key === 'symbol') {
      // TanStack types accessorKey as its own deep-key union; narrow to this data's keys.
      return key as keyof TData;
    }
  }
  return undefined;
}

/**
 * Extracts the string `children` from the element a functional header returns.
 *
 * @param rendered - The value produced by invoking a functional header template
 * @returns The children string, or an empty string when it isn't a string-children element
 */
function getRenderedHeaderText(rendered: unknown): string {
  if (
    typeof rendered === 'object' &&
    rendered !== null &&
    'props' in rendered &&
    typeof rendered.props === 'object' &&
    rendered.props !== null &&
    'children' in rendered.props &&
    typeof rendered.props.children === 'string'
  ) {
    return rendered.props.children;
  }
  return '';
}

/**
 * Gets the displayable header text for a column.
 * This is needed because the header text is not always a string.
 * Sometimes it's an HTML or React element.
 *
 * @param column - The column to get the header text from
 * @returns The displayable header text as a string
 * @source
 */
export function getHeaderText<TData>(column: Column<TData, unknown>): string {
  const header = column.columnDef.header;
  if (header === undefined) return '';
  if (typeof header === 'string') return header;
  if (typeof header === 'function') {
    // TanStack's functional header expects a `HeaderContext` we don't have here.
    // Some headers read it (e.g. the price column derives its currency from
    // `table.options.meta`) and throw when invoked context-free, so guard the
    // call and fall back to the column-id label — the same label the
    // column-visibility menu uses for functional headers.
    try {
      const rendered: unknown = (header as (...args: unknown[]) => unknown)();
      return getRenderedHeaderText(rendered);
    } catch {
      return i18n(`column_${column.id}`);
    }
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
 * @source
 */
export function getVisibleUniqueValues<TData>(
  column: Column<TData, unknown>,
  table: Table<TData>,
): (string | number)[] {
  const values = new Set<string | number>();

  table.getRowModel().rows.forEach((row) => {
    const value: unknown = row.getValue(column.id);
    if (isStringOrNumber(value)) values.add(value);
  });

  return Array.from(values).sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
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
 * @source
 */
export function getAllUniqueValues<TData>(
  column: Column<TData, unknown>,
  table: Table<TData>,
): (string | number)[] {
  const accessorKey = getAccessorKey<TData>(column.columnDef);
  if (accessorKey === undefined) return [];

  const uniqueValues = table.options.data.reduce<(string | number)[]>((accu, row) => {
    const value: unknown = row[accessorKey];
    if (isStringOrNumber(value) && !accu.includes(value)) {
      accu.push(value);
    }
    return accu;
  }, []);

  return uniqueValues.sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
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
 * @source
 */
export function getFullRange<TData>(
  column: Column<TData, unknown>,
  table: Table<TData>,
): [number, number] {
  const values = getAllUniqueValues(column, table);
  // Range helpers are only called on numeric columns, so the endpoints are numbers.
  return [values[0] as number, values.at(-1) as number];
}

/**
 * Gets the range of values for a column from visible rows.
 * Only returns the visible values (e.g., if another filter has been applied,
 * the filtered out results won't be included here).
 *
 * @param column - The column to get the range from
 * @param table - The table instance
 * @returns A tuple containing the minimum and maximum values
 * @source
 */
export function getVisibleRange<TData>(
  column: Column<TData, unknown>,
  table: Table<TData>,
): [number, number] {
  const values = getVisibleUniqueValues(column, table);
  // Range helpers are only called on numeric columns, so the endpoints are numbers.
  return [values[0] as number, values.at(-1) as number];
}

/**
 * Determines whether a value counts as data when deciding if a column is empty.
 *
 * @param value - The cell/field value to test
 * @returns False for null/undefined, blank strings, and empty arrays; true
 *   otherwise (numbers including 0 and booleans count as data)
 */
function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Returns the ids of hideable columns that contain no data in ANY row — across
 * variant sub-rows and rows filtered out of the current view, not just the
 * visible page — so callers can auto-hide columns irrelevant to a result set.
 * Accessor columns (with `accessorKey` or `accessorFn`) are read via each row's
 * value; display columns without an accessor are read from the product fields
 * named in their `meta.dataKeys`. Columns that can't be hidden, and display
 * columns without `meta.dataKeys` (whose emptiness can't be determined), are
 * never reported.
 * @param table - The table instance to inspect
 * @returns The ids of hideable columns that have no data in any row
 * @example
 * ```typescript
 * // A result set where no product has a CAS number or SDS link:
 * getEmptyHideableColumnIds(table); // ["cas", "sds"]
 * ```
 * @source
 */
export function getEmptyHideableColumnIds<TData>(table: Table<TData>): string[] {
  const rows = table.getCoreRowModel().flatRows;
  const emptyColumnIds: string[] = [];

  for (const column of table.getAllColumns()) {
    if (!column.getCanHide()) continue;

    const columnDef = column.columnDef;
    const isAccessorColumn = 'accessorKey' in columnDef || 'accessorFn' in columnDef;
    const dataKeys = columnDef.meta?.dataKeys ?? [];
    // A display column with no accessor and no declared dataKeys can't be judged.
    if (!isAccessorColumn && dataKeys.length === 0) continue;

    const hasData = rows.some((row) => {
      if (isAccessorColumn) return hasValue(row.getValue(column.id));
      const original = row.original as Record<string, unknown>;
      return dataKeys.some((key) => hasValue(original[key]));
    });

    if (!hasData) emptyColumnIds.push(column.id);
  }

  return emptyColumnIds;
}

/**
 * Sets the visibility of a column.
 *
 * @param column - The column to set visibility for
 * @param visible - Whether the column should be visible
 * @source
 */
export function setColumnVisibility<TData>(column: Column<TData, unknown>, visible: boolean): void {
  if (column.getCanHide() === false) return;
  if (visible) {
    if (!column.getIsVisible()) column.toggleVisibility(true);
  } else {
    if (column.getIsVisible()) column.toggleVisibility(false);
  }
}
