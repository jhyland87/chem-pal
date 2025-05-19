import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import IconButton from "@mui/material/IconButton";
import { ColumnDef, type Row, type SortingFn } from "@tanstack/react-table";
import { Product, ProductRow } from "types";
import { default as Link } from "../TabLink";
import "./TableColumns.scss";

/**
 * BookmarkIconButton component that renders a bookmark icon button for each row.
 * Currently only logs the row data when clicked.
 *
 * @component
 * @param {ProductRow} props - Component props containing the row data
 * @param {Row<Product>} props.row - The table row data
 */
const BookmarkIconButton = ({ row }: ProductRow) => {
  return (
    <IconButton
      size="small"
      onClick={() => console.log(row.original)}
      className="boookmark-icon boookmark-button"
    >
      <BookmarkIcon fontSize="small" className="boookmark-button boookmark-icon" />
    </IconButton>
  );
};

const priceSortingFn: SortingFn<Product> = (
  rowA: Row<Product>,
  rowB: Row<Product>,
  columnId: string,
) => {
  const a = rowA.original.usdPrice as number;
  const b = rowB.original.usdPrice as number;
  return a > b ? 1 : a < b ? -1 : 0;
};

/**
 * Defines the column configuration for the product results table.
 * Each column specifies its display properties, filtering capabilities,
 * and cell rendering behavior.
 *
 * @returns {ColumnDef<Product, unknown>[]} Array of column definitions
 *
 * @example
 * ```tsx
 * const columns = TableColumns();
 * ```
 */
export default function TableColumns(): ColumnDef<Product, unknown>[] {
  return [
    {
      id: "bookmark",
      accessorKey: "bookmark",
      header: () => null,
      cell: ({ row }: ProductRow) => <BookmarkIconButton row={row} />,
      enableHiding: false,
      enableSorting: false,
      enableColumnFilter: false,
      enableResizing: false,
      size: 3,
      minSize: 10,
      maxSize: 10,
    },
    {
      id: "expander",
      header: () => null,
      cell: ({ row }: ProductRow) => {
        return row.getCanExpand() ? (
          <IconButton
            size="small"
            onClick={row.getToggleExpandedHandler()}
            className="expand-row-details"
          >
            {row.getIsExpanded() ? (
              <ArrowDropDownIcon fontSize="small" />
            ) : (
              <ArrowRightIcon fontSize="small" />
            )}
          </IconButton>
        ) : (
          "🔵"
        );
      },
      enableHiding: false,
      enableSorting: false,
      enableColumnFilter: false,
      enableResizing: false,
      size: 20,
      minSize: 20,
      maxSize: 20,
    },
    {
      id: "title",
      accessorKey: "title",
      header: () => <span>Title</span>,
      cell: ({ row }: ProductRow) => {
        return <Link href={row.original.url}>{row.original.title}</Link>;
      },
      enableHiding: false,
      minSize: 220,
      meta: {
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "supplier",
      header: () => <span>Supplier</span>,
      accessorKey: "supplier",
      cell: (info) => info.getValue(),
      meta: {
        filterVariant: "select",
      },
      minSize: 150,
    },
    {
      accessorKey: "description",
      header: "Description",
      meta: {
        filterVariant: "text",
      },
      minSize: 215,
    },
    {
      id: "price",
      header: "Price",
      accessorKey: "price",
      cell: ({ row }: ProductRow) => {
        //const price = Number(parseFloat(row.original.price.toString()).toFixed(2)).toLocaleString();
        //return `${row.original.currencySymbol as string}${row.original.price}`;
        return new Intl.NumberFormat((row.original?.currencyCode as string) || "USD", {
          style: "currency",
          currency: (row.original?.currencyCode as string) || "USD",
        }).format(row.original.price);
      },
      sortingFn: priceSortingFn,
      meta: {
        filterVariant: "range",
      },
      maxSize: 80,
    },
    {
      id: "quantity",
      header: "Qty",
      accessorKey: "quantity",
      meta: {
        filterVariant: "range",
      },
      cell: ({ row }: ProductRow) => {
        return `${row.original.quantity} ${row.original.uom}`;
      },
      maxSize: 50,
    },
    {
      id: "uom",
      header: "Unit",
      accessorKey: "uom",
      meta: {
        filterVariant: "select",
      },
      maxSize: 50,
    },
  ];
}

/**
 * Creates a configuration object for column filtering based on the column definitions.
 * Each filterable column gets an entry with its filter variant and an empty array for filter data.
 *
 * @returns {Record<string, { filterVariant: string; filterData: unknown[] }>} Object mapping column IDs to their filter configurations
 *
 * @example
 * ```tsx
 * const filterConfig = getColumnFilterConfig();
 * // Returns: { title: { filterVariant: "text", filterData: [] }, ... }
 * ```
 */
export function getColumnFilterConfig() {
  const filterableColumns = TableColumns().reduce<
    Record<string, { filterVariant: string; filterData: unknown[] }>
  >((accu, column: ColumnDef<Product, unknown>) => {
    const meta = column.meta as { filterVariant?: string };
    if (meta?.filterVariant === undefined || !column.id) return accu;

    accu[column.id] = {
      filterVariant: meta.filterVariant,
      filterData: [],
    };
    return accu;
  }, {});

  return filterableColumns;
}
