import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface Column<TData extends RowData, TValue> {
    getVisibleUniqueValues: () => (string | number)[];
    getVisibleRange: () => [number, number];
    getAllUniqueValues: () => (string | number)[];
    getFullRange: () => [number, number];
    getHeaderText: () => string | undefined;
    setFilterValueDebounced: (value: TValue) => void;
    setFilterValueThrottled: (value: TValue) => void;
    setColumnVisibility: (visible: boolean) => void;
  }

  //allows us to define custom properties for our columns
  interface ColumnMeta {
    filterVariant?: "text" | "range" | "select";
    uniqueValues?: string[];
    rangeValues?: number[];
    style?: CSSProperties;
  }
}
