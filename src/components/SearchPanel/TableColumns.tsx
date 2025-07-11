import { omit } from "@/helpers/collectionUtils";
import ArrowDropDownIcon from "@/icons/ArrowDropDownIcon";
import ArrowRightIcon from "@/icons/ArrowRightIcon";
import {
  ColumnDef,
  type CellContext,
  type FilterFnOption,
  type SortingFnOption,
} from "@tanstack/react-table";
import { hasFlag } from "country-flag-icons";
import getUnicodeFlagIcon from "country-flag-icons/unicode";
import { locations } from "../../../config.json";
import { CountryFlagTooltip } from "../StyledComponents";
import { default as Link } from "../TabLink";
import "./TableColumns.scss";

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
      minSize: 10,
      maxSize: 10,
      size: 10,
      enableSorting: false,
      enableColumnFilter: false,
      enableResizing: false,
    },
    {
      id: "title",
      accessorKey: "title",
      header: () => <span>Title</span>,
      cell: ({ row }: ProductRow) => {
        return (
          <Link
            history={{
              type: "product",
              data: omit(row.original, "variants") as Omit<Product, "variants">,
            }}
            href={row.original.url}
          >
            {row.original.title}
          </Link>
        );
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
      filterFn: "multiSelect" as FilterFnOption<Product>,
      meta: {
        filterVariant: "select",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "country",
      header: () => <span>Country</span>,
      accessorKey: "supplierCountry",
      cell: (info) => {
        const country = info.getValue() as string;
        const countryName = locations[country as keyof typeof locations]?.name;
        return hasFlag(country) ? (
          <CountryFlagTooltip title={countryName ?? country} placement="top">
            <span>{getUnicodeFlagIcon(country)}</span>
          </CountryFlagTooltip>
        ) : (
          country
        );
      },
      filterFn: "multiSelect" as FilterFnOption<Product>,
      meta: {
        filterVariant: "select",
        style: {
          textAlign: "center",
        },
      },
    },
    {
      id: "shipping",
      header: () => <span>Shipping</span>,
      accessorKey: "supplierShipping",
      cell: (info) => info.getValue(),
      filterFn: "multiSelect" as FilterFnOption<Product>,
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
      cell: ({ row, table }: CellContext<Product, unknown>) => {
        //console.log("cell:", row.id, { row, table });
        const userSettings = table.options.meta?.userSettings;
        const currency = userSettings?.currency ?? "USD";
        const currencyRate = userSettings?.currencyRate ?? 1;
        const thisRow = row?.original;
        let price = thisRow?.usdPrice ?? (thisRow?.price as number);

        // If the currency is not in USD...
        if (thisRow.currencyCode !== "USD") {
          // Then check if there is a USD price generated to use (this may have a different converstion
          // rate than the users current currency)
          if (!thisRow.usdPrice) {
            // If there isn't any, then just use the original currency
            console.error("Non-USD product is missing USD price", row.original);
            return new Intl.NumberFormat(thisRow.currencyCode ?? "USD", {
              style: "currency",
              currency: thisRow.currencyCode ?? "USD",
            }).format(thisRow.price as number);
          }
          // If there is a usdPrice already generatd, thens witch to that.
          else {
            price = thisRow.usdPrice;
          }
        }

        return new Intl.NumberFormat(currency, {
          style: "currency",
          currency: currency,
        }).format(price * currencyRate);
      },
      sortingFn: "priceSortingFn" as SortingFnOption<Product>,
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
      sortingFn: "quantitySortingFn" as SortingFnOption<Product>,
      minSize: 50,
    },
    {
      id: "uom",
      header: "Unit",
      accessorKey: "uom",
      filterFn: "multiSelect" as FilterFnOption<Product>,
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
