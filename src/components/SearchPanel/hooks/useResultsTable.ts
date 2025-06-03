import {
  getAllUniqueValues,
  getFullRange,
  getHeaderText,
  getVisibleRange,
  getVisibleUniqueValues,
  setColumnVisibility,
} from "@/mixins/tanstack";
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
import TableColumns from "../TableColumns";

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
    _features: [
      {
        createColumn: (column, table) => {
          // Just gets the header text of the column
          column.getHeaderText = () => getHeaderText(column);

          // Function to set the visibility of the column
          column.setColumnVisibility = (visible: boolean) => setColumnVisibility(column, visible);

          // Function to count the number of unique values in the visible rows of the column
          column.getVisibleUniqueValues = () => getVisibleUniqueValues(column, table);

          // Same as getVisibleUniqueValues, but for all rows
          column.getAllUniqueValues = () => getAllUniqueValues(column, table);

          // Get the minimum and maximum values from a column (for range filters)
          column.getFullRange = () => getFullRange(column, table);

          // Visible range of values in the column
          column.getVisibleRange = () => getVisibleRange(column, table);
        },
      },
    ],
  });

  return table;
}
