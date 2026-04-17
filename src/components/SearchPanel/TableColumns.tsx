import { locations } from "@/../config.json";
import { CountryFlagTooltip } from "@/components/StyledComponents";
import { default as Link } from "@/components/TabLink";
import {
  SHIPPING_OPTIONS,
  SUPPLIER_COUNTRY_OPTIONS,
} from "@/constants/common";
import { omit } from "@/helpers/collectionUtils";
import ArrowDropDownIcon from "@/icons/ArrowDropDownIcon";
import ArrowRightIcon from "@/icons/ArrowRightIcon";
import SupplierFactory from "@/suppliers/SupplierFactory";
import { ColumnDef, type CellContext } from "@tanstack/react-table";
import { hasFlag } from "country-flag-icons";
import getUnicodeFlagIcon from "country-flag-icons/unicode";
import styles from "./TableColumns.module.scss";

// Narrows a runtime string to a known location key so `locations[code]` can be
// indexed without a cast.
const isLocationCode = (code: string): code is keyof typeof locations => code in locations;

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
 * @source
 */
export default function TableColumns(): ColumnDef<Product, unknown>[] {
  return [
    {
      id: "expander",
      header: () => null,
      cell: ({ row }: ProductRow) => {
        if (!row?.original?.variants || row.original.variants.length === 0) {
          return;
        }
        return row.getCanExpand() ? (
          <button
            {...{
              onClick: row.getToggleExpandedHandler(),
              style: { cursor: "pointer" },
            }}
            className={styles["svg-button-icon"]}
          >
            {row.getIsExpanded() ? (
              <ArrowDropDownIcon fontSize="small" />
            ) : (
              <ArrowRightIcon fontSize="small" />
            )}
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
      header: "Title",
      cell: ({ row }: ProductRow) => {
        // Indent variant rows so the hierarchy is visually obvious — 16px per
        // depth level, matching the chevron column width.
        const indent = row.depth > 0 ? row.depth * 16 : 0;
        return (
          <span style={{ paddingLeft: indent, display: "inline-block" }}>
            <Link
              history={{
                type: "product",
                data: omit(row.original, "variants"),
              }}
              href={row.original.url}
            >
              {row.original.title}
            </Link>
          </span>
        );
      },
      enableHiding: false,
      meta: {
        filterPlaceholder: "Title...",
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "supplier",
      header: "Supplier",
      accessorKey: "supplier",
      cell: (info) => info.getValue(),
      filterFn: "multiSelect",
      meta: {
        filterPlaceholder: "BVV, HiMedia, etc...",
        filterVariant: "select",
        style: {
          textAlign: "left",
        },
        drawer: {
          label: "Search Suppliers",
          widget: "autocompleteStrings",
          options: SupplierFactory.supplierList(),
          optionLabels: SupplierFactory.supplierDisplayNames(),
          emptyHelperText: "All suppliers included by default",
          placeholder: "Type supplier name",
          bind: { kind: "selectedSuppliers" },
        },
      },
    },
    {
      id: "country",
      header: "Country",
      accessorKey: "supplierCountry",
      cell: ({ row }: ProductRow) => {
        const country = row.original.supplierCountry;
        if (!country) return null;
        if (!hasFlag(country)) return country;
        const countryName = isLocationCode(country) ? locations[country].name : country;
        return (
          <CountryFlagTooltip title={countryName} placement="top">
            <span>{getUnicodeFlagIcon(country)}</span>
          </CountryFlagTooltip>
        );
      },
      filterFn: "multiSelect",
      meta: {
        filterPlaceholder: "🇺🇸 🇨🇳 …",
        filterVariant: "select",
        style: {
          textAlign: "center",
        },
        renderSelectOption: (code) => (hasFlag(code) ? getUnicodeFlagIcon(code) : code),
        drawer: {
          label: "Country",
          widget: "autocompleteObjects",
          options: SUPPLIER_COUNTRY_OPTIONS,
          emptyHelperText: "All countries included by default",
          placeholder: "Type country or code",
          bind: { kind: "searchFilters", key: "country" },
        },
      },
    },
    {
      id: "shipping",
      header: "Shipping",
      accessorKey: "supplierShipping",
      cell: (info) => info.getValue(),
      filterFn: "multiSelect",
      meta: {
        filterPlaceholder: "Shipping...",
        filterVariant: "select",
        drawer: {
          label: "Shipping Type",
          widget: "chips",
          options: SHIPPING_OPTIONS,
          formatChipLabel: (option) => option.charAt(0).toUpperCase() + option.slice(1),
          bind: { kind: "searchFilters", key: "shippingType" },
        },
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      meta: {
        filterPlaceholder: "Description...",
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
        const { usdPrice, price: rawPrice, currencyCode } = row.original;
        const userSettings = table.options.meta?.userSettings;
        const currency = userSettings?.currency ?? "USD";
        const currencyRate = userSettings?.currencyRate ?? 1;

        // Non-USD product without a USD anchor: we can't convert into the
        // user's chosen currency, so render the native price as-is.
        if (currencyCode !== "USD" && usdPrice === undefined) {
          console.error("Non-USD product is missing USD price", { row });
          const fallbackCurrency = currencyCode ?? "USD";
          return new Intl.NumberFormat(fallbackCurrency, {
            style: "currency",
            currency: fallbackCurrency,
          }).format(Number(rawPrice));
        }

        const priceInUsd = usdPrice ?? Number(rawPrice);
        return new Intl.NumberFormat(currency, {
          style: "currency",
          currency,
        }).format(priceInUsd * currencyRate);
      },
      sortingFn: "priceSortingFn",
      filterFn: "inNumberRange",
      meta: {
        filterPlaceholder: "1.00 - 1000.00",
        filterVariant: "range",
        style: {
          textAlign: "left",
        },
        drawer: {
          label: "Price Range",
          widget: "numberRange",
          adornment: "currency",
          bind: {
            kind: "userSettingsRange",
            minKey: "priceMin",
            maxKey: "priceMax",
          },
        },
      },
    },
    {
      id: "quantity",
      header: "Qty",
      accessorKey: "quantity",
      meta: {
        filterPlaceholder: "1 - 100",
        filterVariant: "range",
        style: {
          textAlign: "left",
        },
      },
      cell: ({ row }: ProductRow) => {
        return `${row.original.quantity} ${row.original.uom}`;
      },
      sortingFn: "quantitySortingFn",
      filterFn: "inNumberRange",
      minSize: 50,
    },
    {
      id: "uom",
      header: "Unit",
      accessorKey: "uom",
      filterFn: "multiSelect",
      meta: {
        filterPlaceholder: "Unit",
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
 * @source
 */
export function getColumnFilterConfig() {
  return TableColumns().reduce<Record<string, { filterVariant: string; filterData: unknown[] }>>(
    (accu, column) => {
      const filterVariant = column.meta?.filterVariant;
      if (filterVariant === undefined || !column.id) return accu;

      accu[column.id] = {
        filterVariant,
        filterData: [],
      };
      return accu;
    },
    {},
  );
}
