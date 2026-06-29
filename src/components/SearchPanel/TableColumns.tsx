import { CountryFlagTooltip } from "@/components/StyledComponents";
import { default as Link } from "@/components/TabLink";
import {
  AVAILABILITY_OPTIONS,
  SHIPPING_OPTIONS,
  SUPPLIER_COUNTRY_OPTIONS,
} from "@/constants/common";
import { omit } from "@/helpers/collectionUtils";
import { getCountryName } from "@/helpers/country";
import ArrowDropDownIcon from "@/icons/ArrowDropDownIcon";
import ArrowRightIcon from "@/icons/ArrowRightIcon";
import SDSIcon from "@/icons/SDSIcon";
import TDSIcon from "@/icons/TDSIcon";
import { SupplierFactory } from "@/suppliers/SupplierFactory";
import { ColumnDef, type CellContext } from "@tanstack/react-table";
import { hasFlag } from "country-flag-icons";
import getUnicodeFlagIcon from "country-flag-icons/unicode";
import styles from "./TableColumns.module.scss";

/**
 * Defines the column configuration for the product results table. Each
 * column declares its accessor, cell renderer, sort/filter functions, and
 * (optionally) `meta.drawer` to opt into a pre-search drawer accordion.
 *
 * The returned order is the render order in both the table header and the
 * drawer's column-backed sections (see `DrawerSearchPanel`).
 * @returns Ordered TanStack column definitions for the `Product` row type.
 * @example
 * ```tsx
 * const columns = TableColumns();
 * useReactTable({ columns, data, ... });
 * // columns.map(c => c.id) →
 * //   ["expander", "title", "supplier", "country", "shipping",
 * //    "availability", "description", "price", "quantity", "uom",
 * //    "sds", "specs", "cas", "formula", "moleweight", "purity", "concentration"]
 * // columns.filter(c => c.meta?.drawer).map(c => c.id) →
 * //   ["supplier", "country", "shipping", "availability", "price"]
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
      filterFn: "includeHierarchy",
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
        const countryName = getCountryName(country) ?? country;
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
      id: "availability",
      header: "Availability",
      accessorKey: "availability",
      cell: (info) => info.getValue(),
      filterFn: "multiSelect",
      meta: {
        filterPlaceholder: "Availability...",
        filterVariant: "select",
        style: {
          textAlign: "left",
        },
        drawer: {
          label: "Availability",
          widget: "chips",
          options: AVAILABILITY_OPTIONS,
          bind: { kind: "searchFilters", key: "availability" },
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
        // Read userSettings from table meta rather than context so
        // TableColumns() stays hook-free — it's called from both React
        // renders and non-render code paths (getColumnFilterConfig,
        // DrawerSearchPanel's useMemo), and calling useAppContext() from
        // those paths would violate the Rules of Hooks.
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
      filterFn: "inNumberRangeHierarchy",
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
      filterFn: "inNumberRangeHierarchy",
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
    {
      id: "sds",
      header: "SDS",
      cell: ({ row }: ProductRow) => {
        const url = row.original.sdsUrl;
        if (!url) return null;
        return (
          <Link href={url} aria-label="Safety data sheet (SDS)" title="Safety data sheet (SDS)">
            <SDSIcon fontSize="small" />
          </Link>
        );
      },
      enableSorting: false,
      enableColumnFilter: false,
      minSize: 40,
      maxSize: 40,
      meta: {
        style: {
          textAlign: "center",
        },
      },
    },
    {
      id: "specs",
      header: "Specs",
      cell: ({ row }: ProductRow) => {
        const url = row.original.specSheetUrl;
        if (!url) return null;
        return (
          <Link
            href={url}
            aria-label="Technical Data Sheet (TDS)"
            title="Technical Data Sheet (TDS)"
          >
            <TDSIcon fontSize="small" />
          </Link>
        );
      },
      enableSorting: false,
      enableColumnFilter: false,
      minSize: 40,
      maxSize: 40,
      meta: {
        style: {
          textAlign: "center",
        },
      },
    },
    {
      id: "cas",
      header: "CAS",
      accessorKey: "cas",
      cell: (info) => info.getValue(),
      filterFn: "includeHierarchy",
      meta: {
        filterPlaceholder: "CAS...",
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "formula",
      header: "Formula",
      accessorKey: "formula",
      // The formula is stored with sub/superscripts already converted to
      // unicode (see ProductBuilder.setFormula), so render it as plain text.
      cell: (info) => info.getValue(),
      filterFn: "includeHierarchy",
      meta: {
        filterPlaceholder: "Formula...",
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "moleweight",
      header: "M.W.",
      accessorKey: "moleweight",
      cell: (info) => info.getValue(),
      filterFn: "inNumberRangeHierarchy",
      meta: {
        filterPlaceholder: "0 - 1000",
        filterVariant: "range",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "purity",
      header: "Purity",
      accessorKey: "purity",
      cell: ({ row }: ProductRow) => {
        const purity = row.original.purity;
        if (purity == null) return null;
        // Purity is already a percentage string (may include a comparator / %), so render as-is.
        return purity;
      },
      filterFn: "includeHierarchy",
      meta: {
        filterPlaceholder: "Purity...",
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "concentration",
      header: "Conc.",
      accessorKey: "concentration",
      cell: (info) => info.getValue(),
      filterFn: "includeHierarchy",
      meta: {
        filterPlaceholder: "Concentration...",
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
  ];
}

/**
 * Builds a seed filter-config object from the column definitions, keyed by
 * column id. Each filterable column contributes one entry with its
 * `filterVariant` and an empty `filterData` array ready to be populated as
 * search results stream in.
 * @returns Record of `{ [columnId]: { filterVariant, filterData: [] } }` for
 *          every column whose `meta.filterVariant` is defined and that has
 *          a non-empty `id`.
 * @example
 * ```tsx
 * const filterConfig = getColumnFilterConfig();
 * // => {
 * //   title:        { filterVariant: "text",   filterData: [] },
 * //   supplier:     { filterVariant: "select", filterData: [] },
 * //   country:      { filterVariant: "select", filterData: [] },
 * //   shipping:     { filterVariant: "select", filterData: [] },
 * //   availability: { filterVariant: "select", filterData: [] },
 * //   description:  { filterVariant: "text",   filterData: [] },
 * //   price:         { filterVariant: "range",  filterData: [] },
 * //   quantity:      { filterVariant: "range",  filterData: [] },
 * //   uom:           { filterVariant: "select", filterData: [] },
 * //   formula:       { filterVariant: "text",   filterData: [] },
 * //   moleweight:    { filterVariant: "range",  filterData: [] },
 * //   purity:        { filterVariant: "range",  filterData: [] },
 * //   concentration: { filterVariant: "text",   filterData: [] },
 * // }
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
