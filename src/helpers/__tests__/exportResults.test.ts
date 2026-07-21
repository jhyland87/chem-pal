import { buildResultsWorkbook, type ExportContext } from "@/helpers/exportResults";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

const product = (fields: Partial<Product>): Product => fields as unknown as Product;

const baseCtx = (overrides: Partial<ExportContext> = {}): ExportContext => ({
  scope: "all",
  createdAt: 1_700_000_000_000,
  query: "acetone",
  appVersion: "9.9.9",
  activeFilters: [],
  groups: [{ parent: product({ title: "Acetone", url: "https://ex/p" }), variants: [] }],
  columnVisibility: {},
  ...overrides,
});

/** Reads a Blob to an ArrayBuffer via FileReader (jsdom's Blob lacks arrayBuffer()). */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/** Loads a generated `.xlsx` Blob back into an ExcelJS workbook for assertions. */
async function loadWorkbook(blob: Blob): Promise<ExcelJS.Workbook> {
  const buffer = await blobToArrayBuffer(blob);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

/** Flattens every cell value of a worksheet into a newline-joined string. */
function sheetText(sheet: ExcelJS.Worksheet): string {
  const values: string[] = [];
  sheet.eachRow((row) => row.eachCell((cell) => values.push(String(cell.value ?? ""))));
  return values.join("\n");
}

/** 1-based index of the header cell whose text matches, or -1. */
function headerColumn(sheet: ExcelJS.Worksheet, header: string): number {
  let found = -1;
  sheet.getRow(1).eachCell((cell, col) => {
    if (cell.value === header) found = col;
  });
  return found;
}

describe("buildResultsWorkbook", () => {
  it("produces a Summary and a Results worksheet", async () => {
    const workbook = await loadWorkbook(await buildResultsWorkbook(baseCtx()));
    expect(workbook.worksheets.map((w) => w.name)).toEqual(["Summary", "Results"]);
  });

  it("freezes the header row and first column of the Results sheet", async () => {
    const workbook = await loadWorkbook(await buildResultsWorkbook(baseCtx()));
    const results = workbook.getWorksheet("Results")!;
    expect(results.views[0]).toMatchObject({ state: "frozen", xSplit: 1, ySplit: 1 });
  });

  it("enables AutoFilter across the header row", async () => {
    const workbook = await loadWorkbook(await buildResultsWorkbook(baseCtx()));
    const results = workbook.getWorksheet("Results")!;
    expect(results.autoFilter).toBeTruthy();
  });

  it("colors the header light blue and the first data column light grey", async () => {
    const workbook = await loadWorkbook(await buildResultsWorkbook(baseCtx()));
    const results = workbook.getWorksheet("Results")!;
    const headerFill = results.getRow(1).getCell(1).fill;
    const firstColFill = results.getRow(2).getCell(1).fill;
    expect(headerFill).toMatchObject({ fgColor: { argb: "FFDDEBF7" } });
    expect(firstColFill).toMatchObject({ fgColor: { argb: "FFF2F2F2" } });
  });

  it("hides columns that are not visible in the table", async () => {
    const workbook = await loadWorkbook(
      await buildResultsWorkbook(baseCtx({ columnVisibility: { description: false } })),
    );
    const results = workbook.getWorksheet("Results")!;
    const descCol = headerColumn(results, "Description");
    expect(descCol).toBeGreaterThan(0);
    expect(results.getColumn(descCol).hidden).toBe(true);
  });

  it("keeps table-visible columns shown", async () => {
    const workbook = await loadWorkbook(await buildResultsWorkbook(baseCtx()));
    const results = workbook.getWorksheet("Results")!;
    const titleCol = headerColumn(results, "Title");
    expect(results.getColumn(titleCol).hidden).toBeFalsy();
  });

  it("renders variants as outline-level-1 subrows beneath their parent", async () => {
    const workbook = await loadWorkbook(
      await buildResultsWorkbook(
        baseCtx({
          groups: [
            {
              parent: product({ title: "Parent" }),
              variants: [product({ title: "Variant A", quantity: 5, uom: "g" })],
            },
          ],
        }),
      ),
    );
    const results = workbook.getWorksheet("Results")!;
    // Row 1 = header, row 2 = parent (level 0), row 3 = variant (level 1).
    expect(results.getRow(2).outlineLevel).toBe(0);
    expect(results.getRow(3).outlineLevel).toBe(1);
  });

  it("makes the product title a hyperlink to its URL", async () => {
    const workbook = await loadWorkbook(
      await buildResultsWorkbook(
        baseCtx({ groups: [{ parent: product({ title: "Acetone", url: "https://ex/p" }), variants: [] }] }),
      ),
    );
    const results = workbook.getWorksheet("Results")!;
    expect(results.getRow(2).getCell(1).value).toMatchObject({
      text: "Acetone",
      hyperlink: "https://ex/p",
    });
  });

  it("records version, query, scope, count, and no-filters on the Summary sheet", async () => {
    const workbook = await loadWorkbook(
      await buildResultsWorkbook(
        baseCtx({
          appVersion: "9.9.9",
          query: "acetone",
          groups: [
            { parent: product({ title: "A" }), variants: [] },
            { parent: product({ title: "B" }), variants: [] },
          ],
        }),
      ),
    );
    const text = sheetText(workbook.getWorksheet("Summary")!);
    expect(text).toContain("9.9.9");
    expect(text).toContain("acetone");
    expect(text).toContain("All results");
    expect(text).toContain("None");
  });

  it("lists active filters on the Summary sheet", async () => {
    const workbook = await loadWorkbook(
      await buildResultsWorkbook(
        baseCtx({ activeFilters: [{ label: "Supplier", value: "Loudwolf, Onyxmet" }] }),
      ),
    );
    const text = sheetText(workbook.getWorksheet("Summary")!);
    expect(text).toContain("Supplier");
    expect(text).toContain("Loudwolf, Onyxmet");
  });
});
