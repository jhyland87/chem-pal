import { describe, expect, it } from "vitest";
import { createMockColumn, createMockTable, mockData } from "../__mocks__/tanstack";
import {
  getAllUniqueValues,
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
