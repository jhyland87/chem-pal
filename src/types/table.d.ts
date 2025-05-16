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
}
