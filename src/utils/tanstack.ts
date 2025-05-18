import { Column, StringOrTemplateHeader, Table } from "@tanstack/react-table";
import { debounce, throttle } from "lodash";

/**
 * Implements custom methods for Tanstack Table columns
 *
 * @param table - The table instance
 * @typeParam TData - The type of data in the table
 */
export function implementCustomMethods<TData>(table: Table<TData>) {
  // Add custom column methods to each column
  table.getAllColumns().forEach((column: Column<TData, unknown>) => {
    // Get the displayable header text. This is needed because the header text is not always a string.
    // Sometimes it's an HTML or React element.
    if (!column.getHeaderText) {
      column.getHeaderText = () => {
        const header = column.columnDef.header as StringOrTemplateHeader<TData, unknown>;
        if (header === undefined) return "";
        if (typeof header === "string") return header;
        if (typeof header === "function")
          // maximum jank to override the linter error
          return (header as () => { props?: { children?: string } })()?.props?.children;

        return header;
      };
    }

    // Get a sorted unique list of values for a column - Only returns the visible values (eg: if another
    // filter has been applied, the filtered out results wont be included here)
    if (!column.getVisibleUniqueValues) {
      column.getVisibleUniqueValues = (): (string | number)[] => {
        const values = new Set<string | number>();

        table.getRowModel().rows.forEach((row) => {
          const value = row.getValue(column.id);
          if (value !== undefined && value !== null) values.add(value as string | number);
        });

        return Array.from(values).sort((a, b) => {
          if (typeof a === "number" && typeof b === "number") return a - b;

          return String(a).localeCompare(String(b));
        });
      };
    }

    // Get a sorted unique list of values for a column - Returns all values, including the filtered out ones
    if (!column.getAllUniqueValues) {
      column.getAllUniqueValues = (): (string | number)[] => {
        const uniqueValues = table.options.data.reduce<string[]>((accu: string[], row: TData) => {
          const value = row[column.id as keyof TData] as string;
          if (value !== undefined && accu.indexOf(value) === -1) accu.push(value);

          return accu;
        }, []);

        return uniqueValues.sort((a, b) => {
          if (typeof a === "number" && typeof b === "number") return a - b;

          return String(a).localeCompare(String(b));
        });
      };
    }

    // Get the range of values for a column - Returns all values, including the filtered out ones
    if (!column.getFullRange) {
      column.getFullRange = (): [number, number] => {
        const values = column.getAllUniqueValues();
        return [values[0] as number, values[values.length - 1] as number];
      };
    }

    // Get the range of values for a column - Only returns the visible values (eg: if another
    // filter has been applied, the filtered out results wont be included here)
    if (!column.getVisibleRange) {
      column.getVisibleRange = (): [number, number] => {
        const values = column.getVisibleUniqueValues();
        return [values[0] as number, values[values.length - 1] as number];
      };
    }

    if (!column.setFilterValueDebounced) {
      column.setFilterValueDebounced = debounce(column.setFilterValue, 500);
    }

    if (!column.setFilterValueThrottled) {
      column.setFilterValueThrottled = throttle(column.setFilterValue, 500);
    }

    // Explicitly set the visibility of a column
    if (!column.setColumnVisibility) {
      column.setColumnVisibility = (visible: boolean) => {
        if (column.getCanHide() === false) return;
        if (visible) {
          if (!column.getIsVisible()) column.toggleVisibility(true);
        } else {
          if (column.getIsVisible()) column.toggleVisibility(false);
        }
      };
    }
  });
}
