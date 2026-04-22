import { describe, expect, it } from "vitest";
import { diff, omit } from "../collectionUtils";

describe("collectionUtils", () => {
  describe("omit", () => {
    it("should omit a single property", () => {
      const data = { name: "John", age: 30, city: "New York" };
      expect(omit(data, "age")).toEqual({ name: "John", city: "New York" });
    });

    it("should omit multiple properties", () => {
      const data = { name: "John", age: 30, city: "New York" };
      expect(omit(data, ["age", "city"])).toEqual({ name: "John" });
    });

    it("should return the same object if no properties are specified", () => {
      const data = { name: "John", age: 30 };
      expect(omit(data, [] as never[])).toEqual({ name: "John", age: 30 });
    });
  });

  describe("diff", () => {
    it("returns an empty array for two equal shallow objects", () => {
      expect(diff({ a: 1, b: 2 }, { a: 1, b: 2 })).toEqual([]);
    });

    it("returns an empty array for two equal deep objects", () => {
      const left = { user: { name: "Ann", tags: ["admin", "editor"] } };
      const right = { user: { name: "Ann", tags: ["admin", "editor"] } };
      expect(diff(left, right)).toEqual([]);
    });

    it("reports a single modified primitive leaf", () => {
      expect(diff({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual([
        { type: "modified", path: ["b"], oldValue: 2, newValue: 3 },
      ]);
    });

    it("reports keys added as created and removed as deleted", () => {
      const left = { a: 1, b: 2, c: 3 };
      const right = { a: 1, b: 2, d: 4 };
      const changes = diff(left, right);

      expect(changes).toHaveLength(2);
      expect(changes).toContainEqual({ type: "deleted", path: ["c"], value: 3 });
      expect(changes).toContainEqual({ type: "created", path: ["d"], value: 4 });
    });

    it("recurses into nested objects and carries the key path", () => {
      const left = { user: { name: "Ann", age: 30 } };
      const right = { user: { name: "Bea", age: 30 } };
      expect(diff(left, right)).toEqual([
        { type: "modified", path: ["user", "name"], oldValue: "Ann", newValue: "Bea" },
      ]);
    });

    it("diffs arrays element-wise using numeric indexes in the path", () => {
      expect(diff([1, 2, 3], [1, 2, 3, 4])).toEqual([
        { type: "created", path: [3], value: 4 },
      ]);
    });

    it("reports array length shrinkage as deletions", () => {
      expect(diff(["a", "b", "c"], ["a", "b"])).toEqual([
        { type: "deleted", path: [2], value: "c" },
      ]);
    });

    it("treats array↔object swaps as a wholesale modification", () => {
      const changes = diff({ a: [1, 2] }, { a: { 0: 1, 1: 2 } });
      expect(changes).toEqual([
        {
          type: "modified",
          path: ["a"],
          oldValue: [1, 2],
          newValue: { 0: 1, 1: 2 },
        },
      ]);
    });

    it("handles nullish-on-either-side as created/deleted at the root", () => {
      expect(diff(null, { a: 1 })).toEqual([{ type: "created", path: [], value: { a: 1 } }]);
      expect(diff({ a: 1 }, null)).toEqual([{ type: "deleted", path: [], value: { a: 1 } }]);
      expect(diff(null, null)).toEqual([]);
      expect(diff(undefined, undefined)).toEqual([]);
    });

    it("uses Object.is semantics for primitive comparisons (NaN is equal to NaN)", () => {
      expect(diff({ a: NaN }, { a: NaN })).toEqual([]);
      expect(diff({ a: 0 }, { a: -0 })).toEqual([
        { type: "modified", path: ["a"], oldValue: 0, newValue: -0 },
      ]);
    });

    it("treats a Date instance as a non-plain container (replace, don't recurse)", () => {
      const d1 = new Date("2024-01-01");
      const d2 = new Date("2024-01-02");
      expect(diff({ when: d1 }, { when: d2 })).toEqual([
        { type: "modified", path: ["when"], oldValue: d1, newValue: d2 },
      ]);
    });
  });
});
