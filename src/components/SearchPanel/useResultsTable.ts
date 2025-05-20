import {
  ColumnDef,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  useReactTable,
} from "@tanstack/react-table";
import { Product } from "types";
import { implementCustomMethods } from "../../utils/tanstack";
import TableColumns from "./TableColumns";

interface UseResultsTableProps {
  showSearchResults: Product[];
  columnFilterFns: [any, any];
  getRowCanExpand: (row: Row<Product>) => boolean;
}

export function useResultsTable({
  showSearchResults,
  columnFilterFns,
  getRowCanExpand,
}: UseResultsTableProps) {
  const table = useReactTable({
    data: showSearchResults,
    enableColumnResizing: true,
    defaultColumn: {
      minSize: 60,
      maxSize: 800,
    },
    columnResizeMode: "onChange",
    columns: TableColumns() as ColumnDef<Product, unknown>[],
    filterFns: {},
    state: {
      columnFilters: columnFilterFns[0],
    },
    onColumnFiltersChange: columnFilterFns[1],
    getRowCanExpand: (row: Row<Product>) => getRowCanExpand(row),
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    debugTable: false,
    debugHeaders: false,
    debugColumns: false,
  });

  // Extend columns with getUniqueVisibleValues method
  implementCustomMethods(table);

  return table;
}
