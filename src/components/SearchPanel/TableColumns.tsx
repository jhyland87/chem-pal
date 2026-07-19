import { CountryFlagTooltip } from "@/components/StyledComponents";
import { default as Link } from "@/components/TabLink";
import { AVAILABILITY_OPTIONS, isShippingRange, SHIPPING_OPTIONS } from "@/constants/common";
import { SUPPLIER_COUNTRY_OPTIONS } from "@/constants/countries";
import { omit } from "@/helpers/collectionUtils";
import { getCountryName } from "@/helpers/country";
import { i18n } from "@/helpers/i18n";
import { formatDisplayPrice } from "@/helpers/price";
import { pubchemCasSearchUrl, pubchemCompoundUrl } from "@/helpers/pubchem";
import { formatUomForDisplay } from "@/helpers/quantity";
import ArrowDropDownIcon from "@/icons/ArrowDropDownIcon";
import ArrowRightIcon from "@/icons/ArrowRightIcon";
import COAIcon from "@/icons/COAIcon";
import SDSIcon from "@/icons/SDSIcon";
import TDSIcon from "@/icons/TDSIcon";
import { SupplierFactory } from "@/suppliers/SupplierFactory";
import { isAvailability } from "@/utils/typeGuards/productbuilder";
import { ColumnDef, type CellContext, type HeaderContext } from "@tanstack/react-table";
import { hasFlag } from "country-flag-icons";
import getUnicodeFlagIcon from "country-flag-icons/unicode";
import styles from "./TableColumns.module.scss";

/**
 * Localized label for a supplier {@link ShippingRange} (worldwide/international/
 * domestic/local). Falls back to the raw value for anything outside the known set.
 * @param range - The shipping range value.
 * @returns The translated label, or the raw value if unrecognized.
 * @example
 * ```ts
 * shippingLabel("worldwide"); // => "Worldwide" (en) / "Ogólnoświatowa" (pl)
 * ```
 * @source
 */
function shippingLabel(range: string): string {
  return isShippingRange(range) ? i18n(`shipping_${range}`) : range;
}

/**
 * Localized label for an {@link AVAILABILITY} value. Also covers the drawer's
 * grouped filter codes (`in_stock`, `out_of_stock`, …), which are a subset of the
 * enum values. Falls back to the raw value for anything outside the known set.
 * @param value - The availability value.
 * @returns The translated label, or the raw value if unrecognized.
 * @example
 * ```ts
 * availabilityLabel("in_stock"); // => "In Stock" (en) / "Dostępny" (pl)
 * ```
 * @source
 */
function availabilityLabel(value: string): string {
  return isAvailability(value) ? i18n(`availability_${value}`) : value;
}

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
 * //    "sds", "specs", "coa", "cas", "pubchem", "formula", "moleweight",
 * //    "purity", "concentration"]
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
        // `getCanExpand` (backed by hasExpandableDetail) already gates whether
        // there's anything to show in the panel — image, variants, or details.
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
      header: i18n("column_title"),
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
              href={row.original.permalink ?? row.original.url}
            >
              {row.original.title}
            </Link>
          </span>
        );
      },
      enableHiding: false,
      filterFn: "includeHierarchy",
      meta: {
        filterPlaceholder: i18n("filter_placeholder_title"),
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "supplier",
      header: i18n("column_supplier"),
      accessorKey: "supplier",
      cell: (info) => info.getValue(),
      filterFn: "multiSelect",
      meta: {
        filterPlaceholder: i18n("filter_placeholder_supplier"),
        filterVariant: "select",
        style: {
          textAlign: "left",
        },
        drawer: {
          label: i18n("drawer_supplier_label"),
          widget: "autocompleteStrings",
          options: SupplierFactory.supplierList(),
          optionLabels: SupplierFactory.supplierDisplayNames(),
          emptyHelperText: i18n("drawer_supplier_empty_helper"),
          placeholder: i18n("drawer_supplier_placeholder"),
          bind: { kind: "selectedSuppliers" },
        },
      },
    },
    {
      id: "country",
      header: i18n("column_country"),
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
        filterPlaceholder: i18n("filter_placeholder_country"),
        filterVariant: "select",
        style: {
          textAlign: "center",
        },
        renderSelectOption: (code) => (hasFlag(code) ? getUnicodeFlagIcon(code) : code),
        drawer: {
          label: i18n("drawer_country_label"),
          widget: "autocompleteObjects",
          options: SUPPLIER_COUNTRY_OPTIONS,
          emptyHelperText: i18n("drawer_country_empty_helper"),
          placeholder: i18n("drawer_country_placeholder"),
          bind: { kind: "searchFilters", key: "country" },
        },
      },
    },
    {
      id: "shipping",
      header: i18n("column_shipping"),
      accessorKey: "supplierShipping",
      cell: ({ row }: ProductRow) => {
        const shipping = row.original.supplierShipping;
        return shipping ? shippingLabel(shipping) : null;
      },
      filterFn: "multiSelect",
      meta: {
        filterPlaceholder: i18n("filter_placeholder_shipping"),
        filterVariant: "select",
        renderSelectOption: (value) => shippingLabel(value),
        drawer: {
          label: i18n("drawer_shipping_label"),
          widget: "chips",
          options: SHIPPING_OPTIONS,
          formatChipLabel: (option) => shippingLabel(option),
          bind: { kind: "searchFilters", key: "shippingType" },
        },
      },
    },
    {
      id: "availability",
      header: i18n("column_availability"),
      accessorKey: "availability",
      cell: ({ row }: ProductRow) => {
        const availability = row.original.availability;
        return availability ? availabilityLabel(availability) : null;
      },
      filterFn: "multiSelect",
      meta: {
        filterPlaceholder: i18n("filter_placeholder_availability"),
        filterVariant: "select",
        renderSelectOption: (value) => availabilityLabel(value),
        style: {
          textAlign: "left",
        },
        drawer: {
          label: i18n("drawer_availability_label"),
          widget: "chips",
          options: AVAILABILITY_OPTIONS,
          formatChipLabel: (option) => availabilityLabel(option),
          bind: { kind: "searchFilters", key: "availability" },
        },
      },
    },
    {
      accessorKey: "description",
      header: i18n("column_description"),
      meta: {
        filterPlaceholder: i18n("filter_placeholder_description"),
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "price",
      // Prices are all converted to the user's selected currency, so surface that
      // code in the header — it disambiguates symbols shared across currencies
      // (e.g. "£" = GBP/GIP/…, "$" = USD/SRD).
      header: ({ table }: HeaderContext<Product, unknown>) =>
        i18n("column_price_currency", [table.options.meta?.userSettings?.currency ?? "USD"]),
      accessorKey: "price",
      // Read userSettings from table meta rather than context so TableColumns()
      // stays hook-free — it's called from both React renders and non-render
      // code paths (getColumnFilterConfig, DrawerSearchPanel's useMemo), where
      // calling useAppContext() would violate the Rules of Hooks. The shared
      // formatDisplayPrice helper keeps this in sync with the variant list in
      // the expanded detail panel.
      cell: ({ row, table }: CellContext<Product, unknown>) =>
        formatDisplayPrice(row.original, table.options.meta?.userSettings),
      sortingFn: "priceSortingFn",
      filterFn: "inNumberRangeHierarchy",
      meta: {
        filterPlaceholder: i18n("filter_placeholder_price"),
        filterVariant: "range",
        style: {
          textAlign: "left",
        },
        drawer: {
          label: i18n("drawer_price_label"),
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
      header: i18n("column_quantity"),
      accessorKey: "quantity",
      meta: {
        filterPlaceholder: i18n("filter_placeholder_quantity"),
        filterVariant: "range",
        style: {
          textAlign: "left",
        },
      },
      cell: ({ row }: ProductRow) => {
        return `${row.original.quantity} ${formatUomForDisplay(row.original.uom)}`;
      },
      sortingFn: "quantitySortingFn",
      filterFn: "inNumberRangeHierarchy",
      minSize: 50,
    },
    {
      id: "uom",
      header: i18n("column_unit"),
      cell: (info) => formatUomForDisplay(info.getValue()),
      accessorKey: "uom",
      filterFn: "multiSelect",
      meta: {
        filterPlaceholder: i18n("filter_placeholder_unit"),
        filterVariant: "select",
        renderSelectOption: (value) => formatUomForDisplay(value),
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "sds",
      header: i18n("column_sds"),
      cell: ({ row }: ProductRow) => {
        const url = row.original.sdsUrl;
        if (!url) return null;
        return (
          <Link
            href={url}
            aria-label={i18n("product_detail_sds")}
            title={i18n("product_detail_sds")}
          >
            <SDSIcon fontSize="small" />
          </Link>
        );
      },
      //enableSorting: true,
      enableColumnFilter: false,
      minSize: 40,
      maxSize: 40,
      meta: {
        dataKeys: ["sdsUrl"],
        style: {
          textAlign: "center",
        },
      },
    },
    {
      id: "specs",
      header: i18n("column_specs"),
      cell: ({ row }: ProductRow) => {
        const url = row.original.specSheetUrl;
        if (!url) return null;
        return (
          <Link
            href={url}
            aria-label={i18n("product_detail_tds")}
            title={i18n("product_detail_tds")}
          >
            <TDSIcon fontSize="small" />
          </Link>
        );
      },
      //enableSorting: true,
      enableColumnFilter: false,
      minSize: 40,
      maxSize: 40,
      meta: {
        dataKeys: ["specSheetUrl"],
        style: {
          textAlign: "center",
        },
      },
    },
    {
      id: "coa",
      header: i18n("column_coa"),
      cell: ({ row }: ProductRow) => {
        const url = row.original.coaUrl;
        if (!url) return null;
        return (
          <Link
            href={url}
            aria-label={i18n("product_detail_coa")}
            title={i18n("product_detail_coa")}
          >
            <COAIcon fontSize="small" />
          </Link>
        );
      },
      //enableSorting: true,
      enableColumnFilter: false,
      minSize: 40,
      maxSize: 40,
      meta: {
        dataKeys: ["coaUrl"],
        style: {
          textAlign: "center",
        },
      },
    },
    {
      id: "cas",
      header: i18n("column_cas"),
      accessorKey: "cas",
      // Link the CAS number to PubChem: straight to the compound page when the CID is known,
      // otherwise to a CAS search that resolves to the matching compound.
      cell: ({ row }: ProductRow) => {
        const cas = row.original.cas;
        if (!cas) return null;
        const cid = row.original.pubchemId;
        const href = cid ? pubchemCompoundUrl(cid) : pubchemCasSearchUrl(cas);
        return (
          <Link
            href={href}
            title={i18n("product_detail_pubchem_view")}
            aria-label={`${cas} — ${i18n("product_detail_pubchem_view")}`}
          >
            {cas}
          </Link>
        );
      },
      filterFn: "includeHierarchy",
      meta: {
        filterPlaceholder: i18n("filter_placeholder_cas"),
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "pubchem",
      header: i18n("column_pubchem"),
      accessorKey: "pubchemId",
      cell: ({ row }: ProductRow) => {
        const cid = row.original.pubchemId;
        if (!cid) return null;
        return (
          <Link
            href={pubchemCompoundUrl(cid)}
            aria-label={i18n("product_detail_pubchem_cid", [String(cid)])}
            title={i18n("product_detail_pubchem_view")}
          >
            {cid}
          </Link>
        );
      },
      enableColumnFilter: true,
      meta: {
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "formula",
      header: i18n("column_formula"),
      accessorKey: "formula",
      // The formula is stored with sub/superscripts already converted to
      // unicode (see ProductBuilder.setFormula), so render it as plain text.
      cell: (info) => info.getValue(),
      filterFn: "includeHierarchy",
      meta: {
        filterPlaceholder: i18n("filter_placeholder_formula"),
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "moleweight",
      header: i18n("column_moleweight"),
      accessorKey: "moleweight",
      cell: (info) => info.getValue(),
      filterFn: "inNumberRangeHierarchy",
      meta: {
        filterPlaceholder: i18n("filter_placeholder_moleweight"),
        filterVariant: "range",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "purity",
      header: i18n("column_purity"),
      // Prefer the chemical grade (e.g. "ACS"); fall back to the purity % when no grade is
      // set. Using an accessor keeps the displayed value, sorting, and filtering in sync.
      accessorFn: (product) => product.grade ?? product.purity ?? i18n("purity_ungraded"),
      cell: (info) => info.getValue() ?? null,
      filterFn: "includeHierarchy",
      // The column mixes grades and percentages, so a string sort would interleave them
      // ("ACS Grade" before "95%"). puritySortingFn ranks both on one numeric scale.
      sortingFn: "puritySortingFn",
      meta: {
        filterPlaceholder: i18n("filter_placeholder_purity"),
        filterVariant: "text",
        style: {
          textAlign: "left",
        },
      },
    },
    {
      id: "concentration",
      header: i18n("column_concentration"),
      accessorKey: "concentration",
      cell: (info) => info.getValue(),
      filterFn: "includeHierarchy",
      meta: {
        filterPlaceholder: i18n("filter_placeholder_concentration"),
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
