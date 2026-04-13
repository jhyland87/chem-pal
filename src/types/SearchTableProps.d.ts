import { ColumnDef, ColumnFiltersState, OnChangeFn, Row } from "@tanstack/react-table";

declare global {
  /**
   * Props interface for the SearchTable component.
   * Generic type parameter TData represents the type of data being displayed in the table.
   */
  interface SearchTableProps<TData> {
    /** Array of data items to display in the table */
    data: TData[];
    /** Array of column definitions that specify how to display each column */
    columns: ColumnDef<TData>[];
    /** Function to render a sub-component for expandable rows */
    renderSubComponent: (props: { row: Row<TData> }) => React.ReactElement;
    /** Function to determine if a row can be expanded */
    getRowCanExpand: (row: Row<TData>) => boolean;
    /** Function to trigger a re-render of the table */
    rerender: () => void;
    /** Function to refresh the table data */
    refreshData: () => void;
    /** Tuple containing the current column filter state and a function to update it */
    columnFilterFns: [ColumnFiltersState, OnChangeFn<ColumnFiltersState>];
  }
}

// This export is needed to make the file a module
export {};
