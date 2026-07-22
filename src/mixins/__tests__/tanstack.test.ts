import { type Table } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { createMockColumn, createMockTable, mockData } from "../__mocks__/tanstack";
import {
  getAllUniqueValues,
  getEmptyHideableColumnIds,
  getFullRange,
  getHeaderText,
  getVisibleRange,
  getVisibleUniqueValues,
  setColumnVisibility,
} from "../tanstack";

describe("Tanstack Mixins", () => {
  describe("getHeaderText", () => {
    it("should return empty string for undefined header", () => {
      const column = createMockColumn("test", undefined);
      expect(getHeaderText(column)).toBe("");
    });

    it("should return string header as is", () => {
      const column = createMockColumn("test", "Test Header");
      expect(getHeaderText(column)).toBe("Test Header");
    });

    it("should extract text from function header with children", () => {
      const column = createMockColumn("test", () => ({ props: { children: "Function Header" } }));
      expect(getHeaderText(column)).toBe("Function Header");
    });

    it("should convert non-string header to string", () => {
      const column = createMockColumn("test", 123);
      expect(getHeaderText(column)).toBe("123");
    });

    it("should return empty string when a function header has no children", () => {
      const column = createMockColumn("test", () => ({ props: {} }));
      expect(getHeaderText(column)).toBe("");
    });

    it("should not throw when a function header reads its context", () => {
      // Mirrors the real `price` column header `({ table }) => ...`, which
      // throws when invoked without a HeaderContext. getHeaderText must guard
      // the call and fall back to a string label instead of crashing.
      const column = createMockColumn("price", ({ table }: { table: { id: string } }) => table.id);
      expect(() => getHeaderText(column)).not.toThrow();
      expect(typeof getHeaderText(column)).toBe("string");
    });
  });

  describe("getVisibleUniqueValues", () => {
    it("should return unique values from visible rows", () => {
      const column = createMockColumn("age", "Age");
      const table = createMockTable(mockData);
      const values = getVisibleUniqueValues(column, table);
      expect(values).toEqual([25, 30, 35]);
    });

    it("should handle empty data", () => {
      const column = createMockColumn("age", "Age");
      const table = createMockTable([]);
      const values = getVisibleUniqueValues(column, table);
      expect(values).toEqual([]);
    });
  });

  describe("getAllUniqueValues", () => {
    it("should return all unique values regardless of visibility", () => {
      const column = createMockColumn("name", "Name");
      const table = createMockTable(mockData);
      const values = getAllUniqueValues(column, table);
      expect(values).toEqual(["Alice", "Bob", "Charlie"]);
    });

    it("should handle empty data", () => {
      const column = createMockColumn("name", "Name");
      const table = createMockTable([]);
      const values = getAllUniqueValues(column, table);
      expect(values).toEqual([]);
    });

    it("should return an empty array when the column has no accessorKey", () => {
      const column = { ...createMockColumn("name", "Name"), columnDef: { header: "Name" } };
      const table = createMockTable(mockData);
      expect(getAllUniqueValues(column, table)).toEqual([]);
    });

    it("should sort numeric values numerically, not lexicographically", () => {
      const data = [{ n: 2 }, { n: 100 }, { n: 30 }];
      const column = createMockColumn("n", "N");
      const values = getAllUniqueValues(column, createMockTable(data));
      expect(values).toEqual([2, 30, 100]);
    });
  });

  describe("getFullRange", () => {
    it("should return min and max values from all rows", () => {
      const column = createMockColumn("age", "Age");
      const table = createMockTable(mockData);
      const [min, max] = getFullRange(column, table);
      expect(min).toBe(25);
      expect(max).toBe(35);
    });

    it("should return undefined for min and max when data is empty", () => {
      const column = createMockColumn("age", "Age");
      const table = createMockTable([]);
      const [min, max] = getFullRange(column, table);
      expect(min).toBeUndefined();
      expect(max).toBeUndefined();
    });
  });

  describe("getVisibleRange", () => {
    it("should return min and max values from visible rows", () => {
      const column = createMockColumn("age", "Age");
      const table = createMockTable(mockData);
      const [min, max] = getVisibleRange(column, table);
      expect(min).toBe(25);
      expect(max).toBe(35);
    });

    it("should return undefined for min and max when data is empty", () => {
      const column = createMockColumn("age", "Age");
      const table = createMockTable([]);
      const [min, max] = getVisibleRange(column, table);
      expect(min).toBeUndefined();
      expect(max).toBeUndefined();
    });
  });

  describe("getEmptyHideableColumnIds", () => {
    type MockColumnSpec = {
      id: string;
      canHide?: boolean;
      accessorKey?: string;
      accessorFn?: (row: Record<string, unknown>) => unknown;
      dataKeys?: string[];
    };

    const buildTable = (
      data: Record<string, unknown>[],
      specs: MockColumnSpec[],
    ): Table<Record<string, unknown>> => {
      const columns = specs.map((spec) => ({
        id: spec.id,
        getCanHide: () => spec.canHide ?? true,
        columnDef: {
          ...(spec.accessorKey !== undefined ? { accessorKey: spec.accessorKey } : {}),
          ...(spec.accessorFn !== undefined ? { accessorFn: spec.accessorFn } : {}),
          ...(spec.dataKeys !== undefined ? { meta: { dataKeys: spec.dataKeys } } : {}),
        },
      }));
      const specById = new Map(specs.map((spec) => [spec.id, spec]));
      return {
        getAllColumns: () => columns,
        getCoreRowModel: () => ({
          flatRows: data.map((original) => ({
            original,
            getValue: (columnId: string) => {
              const spec = specById.get(columnId);
              if (spec?.accessorFn) return spec.accessorFn(original);
              return spec?.accessorKey ? original[spec.accessorKey] : undefined;
            },
          })),
        }),
      } as unknown as Table<Record<string, unknown>>;
    };

    it("reports hideable accessor and dataKeys columns that are empty across all rows", () => {
      const table = buildTable(
        [
          { name: "Salt", cas: "", sdsUrl: undefined },
          { name: "Base", cas: null },
        ],
        [
          { id: "title", canHide: false, accessorKey: "name" },
          { id: "cas", accessorKey: "cas" },
          { id: "sds", dataKeys: ["sdsUrl"] },
        ],
      );
      expect(getEmptyHideableColumnIds(table)).toEqual(["cas", "sds"]);
    });

    it("keeps a column that has data in at least one row (incl. via dataKeys and accessorFn)", () => {
      const table = buildTable(
        [
          { cas: "", grade: undefined, purity: undefined, sdsUrl: undefined },
          { cas: "7647-14-5", grade: "ACS Grade", sdsUrl: "https://x/y.pdf" },
        ],
        [
          { id: "cas", accessorKey: "cas" },
          { id: "purity", accessorFn: (row) => row.grade ?? row.purity },
          { id: "sds", dataKeys: ["sdsUrl"] },
        ],
      );
      expect(getEmptyHideableColumnIds(table)).toEqual([]);
    });

    it("never reports non-hideable columns or accessor-less columns without dataKeys", () => {
      const table = buildTable(
        [{}],
        [{ id: "title", canHide: false, accessorKey: "name" }, { id: "expander" }],
      );
      expect(getEmptyHideableColumnIds(table)).toEqual([]);
    });

    it("treats blank strings and empty arrays as empty but 0 as data", () => {
      const table = buildTable(
        [
          { blank: "   ", empty: [], zero: 0 },
          { blank: "", empty: [] },
        ],
        [
          { id: "blank", accessorKey: "blank" },
          { id: "empty", accessorKey: "empty" },
          { id: "zero", accessorKey: "zero" },
        ],
      );
      expect(getEmptyHideableColumnIds(table)).toEqual(["blank", "empty"]);
    });
  });

  describe("setColumnVisibility", () => {
    it("should toggle visibility when column can be hidden", () => {
      const column = createMockColumn("test", "Test");
      setColumnVisibility(column, false);
      expect(column.toggleVisibility).toHaveBeenCalledWith(false);
    });

    it("should not toggle visibility when column cannot be hidden", () => {
      const column = {
        ...createMockColumn("test", "Test"),
        getCanHide: () => false,
      };
      setColumnVisibility(column, false);
      expect(column.toggleVisibility).not.toHaveBeenCalled();
    });

    it("should not toggle visibility if current state matches desired state", () => {
      const column = {
        ...createMockColumn("test", "Test"),
        getIsVisible: () => true,
      };
      setColumnVisibility(column, true);
      expect(column.toggleVisibility).not.toHaveBeenCalled();
    });

    it("should turn a hidden column visible when made visible", () => {
      const column = {
        ...createMockColumn("test", "Test"),
        getIsVisible: () => false,
      };
      setColumnVisibility(column, true);
      expect(column.toggleVisibility).toHaveBeenCalledWith(true);
    });
  });
});
