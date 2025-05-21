import { ColumnDef, ColumnFiltersState, OnChangeFn, Row } from "@tanstack/react-table";

export interface SearchTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  renderSubComponent: (props: { row: Row<TData> }) => React.ReactElement;
  getRowCanExpand: (row: Row<TData>) => boolean;
  rerender: () => void;
  refreshData: () => void;
  columnFilterFns: [ColumnFiltersState, OnChangeFn<ColumnFiltersState>];
}
