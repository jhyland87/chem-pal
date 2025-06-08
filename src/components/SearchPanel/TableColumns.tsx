import ArrowDropDownIcon from "@/icons/ArrowDropDownIcon";
import ArrowRightIcon from "@/icons/ArrowRightIcon";
import { ColumnDef, type Row, type SortingFn } from "@tanstack/react-table";
import { hasFlag } from "country-flag-icons";
import getUnicodeFlagIcon from "country-flag-icons/unicode";
import { default as Link } from "../TabLink";
import "./TableColumns.scss";

/**
 * Custom sorting function for price comparison between two product rows.
 * Compares the USD prices of products and returns a sort order value.
 *
 * @returns Returns 1 if rowA -gt rowB, -1 if rowA -lt rowB, 0 if equal
 */
const priceSortingFn: SortingFn<Product> = (rowA: Row<Product>, rowB: Row<Product>) => {
  const a = rowA.original.usdPrice as number;
  const b = rowB.original.usdPrice as number;
  return a > b ? 1 : a < b ? -1 : 0;
};

/**
 * Custom sorting function for quantity comparison between two product rows.
 * Compares the base quantity or regular quantity of products and returns a sort order value.
 *
 * @returns Returns 1 if rowA -gt rowB, -1 if rowA -lt rowB, 0 if equal
 */
const quantitySortingFn: SortingFn<Product> = (rowA: Row<Product>, rowB: Row<Product>) => {
  const a = (rowA.original.baseQuantity ?? rowA.original.quantity) as number;
  const b = (rowB.original.baseQuantity ?? rowB.original.quantity) as number;
  return a > b ? 1 : a < b ? -1 : 0;
};

/**
 * Defines the column configuration for the product results table.
 * Each column specifies its display properties, filtering capabilities,
 * and cell rendering behavior.
 *
 * @returns Array of column definitions
 *
 * @example
 * ```tsx
 * const columns = TableColumns();
 * ```
 */
export default function TableColumns(): ColumnDef<Product, unknown>[] {
  return [
    {
      id: "expander",
      header: () => null,
      cell: ({ row }: ProductRow) => {
        console.log("ROW:", row);
        console.log("original:", row.original);
        if (!row?.originalSubRows || row?.originalSubRows?.length === 0) {
          return;
        }
        return row.getCanExpand() ? (
          <button
            {...{
              onClick: row.getToggleExpandedHandler(),
              style: { cursor: "pointer" },
            }}
            className="svg-button-icon"
          >
            {row.getIsExpanded() ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
          </button>
        ) : null;
      },
      enableHiding: false,
      minSize: 20,
      enableSorting: false,
      enableColumnFilter: false,
      enableResizing: false,
    },
    {
      id: "title",
      accessorKey: "title",
      header: () => <span>Title</span>,
      cell: ({ row }: ProductRow) => {
        return <Link href={row.original.url}>{row.original.title}</Link>;
      },
      enableHiding: false,
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
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "Country",
      header: () => <span>Country</span>,
      accessorKey: "supplierCountry",
      cell: (info) => {
        const country = info.getValue() as string;
        return hasFlag(country) ? getUnicodeFlagIcon(country) : country;
      },
      meta: {
        filterVariant: "select",
        style: {
          textAlign: "center",
        },
      },
    },
    {
      id: "Shipping",
      header: () => <span>Shipping</span>,
      accessorKey: "supplierShipping",
      cell: (info) => info.getValue(),
      meta: {
        filterVariant: "select",
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      meta: {
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "price",
      header: "Price",
      accessorKey: "price",
      cell: ({ row }: ProductRow) => {
        console.log("PRICE:", row.original.price, row.original);
        return new Intl.NumberFormat("USD", {
          style: "currency",
          currency: "USD",
        }).format(row.original.usdPrice as number);
      },
      sortingFn: priceSortingFn,
      meta: {
        filterVariant: "range",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "quantity",
      header: "Qty",
      accessorKey: "quantity",
      meta: {
        filterVariant: "range",
        style: {
          textAlign: "left",
        },
      },
      cell: ({ row }: ProductRow) => {
        return `${row.original.quantity} ${row.original.uom}`;
      },
      sortingFn: quantitySortingFn,
      minSize: 50,
    },
    {
      id: "uom",
      header: "Unit",
      accessorKey: "uom",
      meta: {
        filterVariant: "select",
        style: {
          textAlign: "left",
        },
      },
    },
  ];
}

/**
 * Creates a configuration object for column filtering based on the column definitions.
 * Each filterable column gets an entry with its filter variant and an empty array for filter data.
 *
 * @returns Object mapping column IDs to their filter configurations
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
