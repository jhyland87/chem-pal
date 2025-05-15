import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface Column<TData extends RowData, TValue> {
    getUniqueValues: () => (string | number)[];
    getHeaderText: () => string | undefined;
  }
}
