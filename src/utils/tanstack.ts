import { Column, StringOrTemplateHeader, Table } from "@tanstack/react-table";
export function extendColumnWithUniqueValues<TData>(table: Table<TData>) {
  // Add getUniqueValues method to each column
  table.getAllColumns().forEach((column: Column<TData, unknown>) => {
    if (!column.getUniqueValues) {
      column.getUniqueValues = () => {
        const values = new Set<string | number>();

        table.getRowModel().rows.forEach((row) => {
          const value = row.getValue(column.id);
          if (value !== undefined && value !== null) {
            values.add(value as string | number);
          }
        });

        return Array.from(values).sort((a, b) => {
          if (typeof a === "number" && typeof b === "number") {
            return a - b;
          }
          return String(a).localeCompare(String(b));
        });
      };
    }

    if (!column.getHeaderText) {
      column.getHeaderText = () => {
        const header = column.columnDef.header as StringOrTemplateHeader<TData, unknown>;
        if (header === undefined) return "";
        if (typeof header === "string") return header;
        if (typeof header === "function") {
          // maximum jank to override the linter error
          return (header as () => { props?: { children?: string } })()?.props?.children;
        }
        return header;
      };
    }
  });
}
