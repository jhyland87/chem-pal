import { getCountryName } from "@/helpers/country";
import { i18n } from "@/helpers/i18n";
import { formatDisplayPrice } from "@/helpers/price";
import { availabilityLabel, shippingLabel } from "@/helpers/productLabels";
import { formatUomForDisplay } from "@/helpers/quantity";
import type ExcelJS from "exceljs";

/**
 * MIME type for the OOXML spreadsheet (`.xlsx`) format, used when wrapping the
 * generated workbook buffer in a {@link Blob}.
 * @category Export Helpers
 */
export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** ARGB light-blue fill for the Results-sheet header row. */
const HEADER_FILL_ARGB = "FFDDEBF7";
/** ARGB very-light-grey fill for the Results-sheet first (title) column. */
const FIRST_COLUMN_FILL_ARGB = "FFF2F2F2";

/**
 * Triggers a browser download of a {@link Blob} under the given filename using a
 * transient object URL + anchor click (no `downloads` permission required).
 * Works in the extension's document context.
 * @param blob - The file contents to download.
 * @param filename - The suggested filename (e.g. `chempal-export.xlsx`).
 * @example
 * ```ts
 * downloadBlob(await buildResultsWorkbook(ctx), "chempal-export.xlsx");
 * ```
 * @category Export Helpers
 * @source
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * A single Results-sheet cell value: plain text/number, or a hyperlink pair that
 * ExcelJS renders as a clickable link.
 * @group Export Types
 */
type ExportCellValue = string | number | { text: string; hyperlink: string };

/**
 * One exportable column: a stable id, a localized header, and a getter that
 * derives the display value for a product (or variant) row. Mirrors the visible
 * column order of the on-screen results table (see `TableColumns.tsx`), minus
 * the utility `expander` column.
 * @group Export Types
 */
interface ExportColumn {
  /** Stable column id, matching the on-screen table column id (drives hidden-column mapping). */
  id: string;
  /** Localized column header shown in row 1 of the Results sheet. */
  header: string;
  /** Approximate column width in Excel character units. */
  width: number;
  /** Derives the cell value for a product/variant row. */
  value: (product: Product, userSettings: UserSettings | undefined) => ExportCellValue;
}

/**
 * A parent product together with the variant rows that should render beneath it
 * as collapsible Excel outline-level-1 subrows.
 * @group Export Types
 */
export interface ExportGroup {
  /** The top-level product row. */
  parent: Product;
  /** Variant rows shown indented and grouped under {@link ExportGroup.parent}. */
  variants: Variant[];
}

/**
 * A single label/value pair describing one active filter, shown on the Summary
 * sheet (e.g. `{ label: "Supplier", value: "Loudwolf, Onyxmet" }`).
 * @group Export Types
 */
export interface ExportFilterSummary {
  /** Localized filter label. */
  label: string;
  /** Human-readable filter value(s). */
  value: string;
}

/**
 * Everything {@link buildResultsWorkbook} needs to render both worksheets. Kept
 * free of DOM/DB/table coupling so the builder is a pure, unit-testable function.
 * @group Export Types
 */
export interface ExportContext {
  /** Whether the export covers all results or only the currently-filtered view. */
  scope: "all" | "filtered";
  /** Epoch milliseconds the export was created (shown on the Summary sheet). */
  createdAt: number;
  /** The originating search query, if any. */
  query?: string;
  /** Running ChemPal version (`__APP_VERSION__`). */
  appVersion: string;
  /** User settings, used to format prices in the user's selected currency. */
  userSettings?: UserSettings;
  /** Active filters to list on the Summary sheet. */
  activeFilters: ExportFilterSummary[];
  /** Parent products plus their variant subrows, in display order. */
  groups: ExportGroup[];
  /** Map of column id to on-screen visibility; not-visible columns export hidden. */
  columnVisibility: Record<string, boolean>;
}

/**
 * Ordered export columns mirroring the on-screen results table. Link columns
 * (title, SDS/TDS/COA) emit hyperlinks; the rest emit display-friendly text via
 * the same helpers the table cells use, so the spreadsheet matches what the user
 * saw. Excludes the `expander` utility column.
 * @source
 */
const EXPORT_COLUMNS: readonly ExportColumn[] = [
  {
    id: "title",
    header: i18n("column_title"),
    width: 44,
    value: (p) => {
      const href = p.permalink ?? p.url;
      const text = p.title ?? "";
      return href ? { text, hyperlink: href } : text;
    },
  },
  { id: "supplier", header: i18n("column_supplier"), width: 20, value: (p) => p.supplier ?? "" },
  {
    id: "country",
    header: i18n("column_country"),
    width: 16,
    value: (p) =>
      p.supplierCountry ? (getCountryName(p.supplierCountry) ?? p.supplierCountry) : "",
  },
  {
    id: "shipping",
    header: i18n("column_shipping"),
    width: 16,
    value: (p) => (p.supplierShipping ? shippingLabel(p.supplierShipping) : ""),
  },
  {
    id: "availability",
    header: i18n("column_availability"),
    width: 16,
    value: (p) => (p.availability ? availabilityLabel(p.availability) : ""),
  },
  {
    id: "description",
    header: i18n("column_description"),
    width: 44,
    value: (p) => p.description ?? "",
  },
  {
    // Header is rewritten with the user's currency code at build time.
    id: "price",
    header: i18n("column_price_currency", ["USD"]),
    width: 14,
    value: (p, settings) => formatDisplayPrice(p, settings),
  },
  {
    id: "quantity",
    header: i18n("column_quantity"),
    width: 14,
    value: (p) => (p.quantity == null ? "" : `${p.quantity} ${formatUomForDisplay(p.uom)}`),
  },
  { id: "uom", header: i18n("column_unit"), width: 10, value: (p) => formatUomForDisplay(p.uom) },
  {
    id: "sds",
    header: i18n("column_sds"),
    width: 12,
    value: (p) => (p.sdsUrl ? { text: i18n("column_sds"), hyperlink: p.sdsUrl } : ""),
  },
  {
    id: "specs",
    header: i18n("column_specs"),
    width: 12,
    value: (p) => (p.specSheetUrl ? { text: i18n("column_specs"), hyperlink: p.specSheetUrl } : ""),
  },
  {
    id: "coa",
    header: i18n("column_coa"),
    width: 12,
    value: (p) => (p.coaUrl ? { text: i18n("column_coa"), hyperlink: p.coaUrl } : ""),
  },
  { id: "cas", header: i18n("column_cas"), width: 14, value: (p) => p.cas ?? "" },
  {
    id: "pubchem",
    header: i18n("column_pubchem"),
    width: 12,
    value: (p) => (p.pubchemId == null ? "" : Number(p.pubchemId)),
  },
  { id: "formula", header: i18n("column_formula"), width: 16, value: (p) => p.formula ?? "" },
  {
    id: "moleweight",
    header: i18n("column_moleweight"),
    width: 12,
    value: (p) => p.moleweight ?? "",
  },
  {
    id: "purity",
    header: i18n("column_purity"),
    width: 14,
    value: (p) => p.grade ?? p.purity ?? "",
  },
  {
    id: "concentration",
    header: i18n("column_concentration"),
    width: 14,
    value: (p) => p.concentration ?? "",
  },
] as const;

/**
 * Fixed 1-based index of the price column in {@link EXPORT_COLUMNS}, used to
 * rewrite its header with the user's currency code at build time.
 */
const PRICE_COLUMN_INDEX = EXPORT_COLUMNS.findIndex((c) => c.id === "price");

/**
 * Total row count (parents + variants) across all groups.
 * @param groups - The export groups.
 * @returns The number of data rows the Results sheet will contain.
 * @example
 * ```ts
 * countExportRows([{ parent: p, variants: [v1, v2] }]); // => 3
 * ```
 * @source
 */
export function countExportRows(groups: ExportGroup[]): number {
  return groups.reduce((total, group) => total + 1 + group.variants.length, 0);
}

/**
 * Writes the Summary worksheet: a label/value list capturing the export's
 * provenance (ChemPal version, query, scope, date, result count) followed by any
 * active filters.
 * @param sheet - The Summary worksheet to populate.
 * @param ctx - The export context.
 * @source
 */
function writeSummarySheet(sheet: ExcelJS.Worksheet, ctx: ExportContext): void {
  sheet.columns = [
    { key: "label", width: 22 },
    { key: "value", width: 60 },
  ];

  const scopeLabel =
    ctx.scope === "all" ? i18n("export_summary_scope_all") : i18n("export_summary_scope_filtered");

  const rows: [string, ExportCellValue][] = [
    [i18n("export_summary_version"), ctx.appVersion],
    [i18n("export_summary_query"), ctx.query ?? ""],
    [i18n("export_summary_scope"), scopeLabel],
    [i18n("export_summary_date"), new Date(ctx.createdAt).toLocaleString()],
    [i18n("export_summary_result_count"), ctx.groups.length],
  ];

  for (const [label, value] of rows) {
    const row = sheet.addRow({ label, value });
    row.getCell("label").font = { bold: true };
  }

  const filterHeader = sheet.addRow({ label: i18n("export_summary_filters"), value: "" });
  filterHeader.getCell("label").font = { bold: true };

  if (ctx.activeFilters.length === 0) {
    sheet.addRow({ label: "", value: i18n("export_summary_no_filters") });
    return;
  }
  for (const filter of ctx.activeFilters) {
    sheet.addRow({ label: filter.label, value: filter.value });
  }
}

/**
 * Applies the light-blue fill + bold font to the Results-sheet header row.
 * @param sheet - The Results worksheet.
 * @source
 */
function styleHeaderRow(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL_ARGB },
    };
  });
}

/**
 * Writes one product or variant row to the Results sheet, applying the
 * first-column grey fill and (for variants) outline grouping + title indent.
 * @param sheet - The Results worksheet.
 * @param product - The product/variant to write.
 * @param ctx - The export context (for currency-aware price formatting).
 * @param isVariant - Whether this is a variant subrow (outline level 1, indented).
 * @source
 */
function writeDataRow(
  sheet: ExcelJS.Worksheet,
  product: Product,
  ctx: ExportContext,
  isVariant: boolean,
): void {
  const rowData: Record<string, ExportCellValue> = {};
  for (const column of EXPORT_COLUMNS) {
    rowData[column.id] = column.value(product, ctx.userSettings);
  }

  const row = sheet.addRow(rowData);

  // Grey the first (title) column on data rows; the header keeps its blue fill.
  row.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: FIRST_COLUMN_FILL_ARGB },
  };

  if (isVariant) {
    row.outlineLevel = 1;
    row.getCell(1).alignment = { indent: 2 };
  }
}

/**
 * Builds the two-sheet `.xlsx` workbook (Summary + Results) for a set of results
 * and returns it as a downloadable {@link Blob}. The Results sheet freezes the
 * header row and first column, colors the header light blue and the first column
 * light grey, enables AutoFilter, hides columns not visible in the table, and
 * renders variants as collapsible outline-level-1 subrows beneath their parent.
 * @param ctx - The export context: rows, scope, query, filters, visibility.
 * @returns A promise resolving to the `.xlsx` file as a {@link Blob}.
 * @example
 * ```ts
 * const blob = await buildResultsWorkbook({
 *   scope: "filtered",
 *   createdAt: Date.now(),
 *   query: "acetone",
 *   appVersion: "1.3.0",
 *   activeFilters: [{ label: "Supplier", value: "Loudwolf" }],
 *   groups: [{ parent: product, variants: [] }],
 *   columnVisibility: { description: false },
 * });
 * // blob.type === XLSX_MIME_TYPE; opens with a Summary and Results sheet.
 * ```
 * @source
 */
export async function buildResultsWorkbook(ctx: ExportContext): Promise<Blob> {
  // Lazy-loaded so the ~1 MB ExcelJS bundle is code-split out of the main chunk
  // and only fetched when the user actually exports.
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ChemPal";
  workbook.created = new Date(ctx.createdAt);

  writeSummarySheet(workbook.addWorksheet(i18n("export_sheet_summary")), ctx);

  const sheet = workbook.addWorksheet(i18n("export_sheet_results"), {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
    properties: { outlineLevelRow: 1 },
  });
  // Parent rows act as the group header above their variant subrows.
  sheet.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

  // Defining `header` here creates row 1; the price header carries the currency.
  sheet.columns = EXPORT_COLUMNS.map((column, index) => ({
    header:
      index === PRICE_COLUMN_INDEX
        ? i18n("column_price_currency", [ctx.userSettings?.currency ?? "USD"])
        : column.header,
    key: column.id,
    width: column.width,
    hidden: ctx.columnVisibility[column.id] === false,
  }));

  for (const group of ctx.groups) {
    writeDataRow(sheet, group.parent, ctx, false);
    for (const variant of group.variants) {
      // Variants inherit the parent's product-level context (supplier, country,
      // documents) while overriding their own quantity / price / etc.
      const merged: Product = { ...group.parent, ...variant };
      writeDataRow(sheet, merged, ctx, true);
    }
  }

  styleHeaderRow(sheet);

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: EXPORT_COLUMNS.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_MIME_TYPE });
}
