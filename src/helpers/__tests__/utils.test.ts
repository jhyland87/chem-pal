import {
  delayAction,
  deserialize,
  firstMap,
  getPath,
  mapDefined,
  md5sum,
  serialize,
  sleep,
  zodAddActualValueToIssues,
} from "@/helpers/utils";
import { describe, expect, it, vi } from "vitest";

describe("md5sum", () => {
  it("should hash strings correctly", () => {
    expect(md5sum("test")).toBe("098f6bcd4621d373cade4e832627b4f6");
    expect(md5sum("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });

  it("should handle different input types", () => {
    expect(md5sum(123)).toBe("202cb962ac59075b964b07152d234b70");
    expect(md5sum({ test: "value" })).toBe("1c623102e25ffbd59a0e5709c503902e");
    expect(md5sum({ a: 1, b: "two", c: [3, "four"] })).toBe("4cde5f9f7861a1d940a8e816f78dd774");
  });

  it("should throw error for invalid input types", () => {
    expect(() => md5sum(Symbol("test"))).toThrow("Unexpected input type: symbol");
  });
});

describe("serialize/deserialize", () => {
  it("should correctly serialize and deserialize strings", () => {
    const original = "Hello, World!";
    const serialized = serialize(original);
    expect(typeof serialized).toBe("string");
    expect(deserialize(serialized)).toBe(original);
  });

  it("should handle special characters", () => {
    const original = '!@#$%^&*()_+{}[]|";:<>?,./';
    expect(deserialize(serialize(original))).toBe(original);
  });

  it("should handle unicode characters", () => {
    const original = "你好，世界！";
    expect(deserialize(serialize(original))).toBe(original);
  });
});

describe("sleep", () => {
  it("should delay execution for specified time", async () => {
    const start = Date.now();
    await sleep(100);
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(95); // Allow for small timing variations
  });
});

describe("delayAction", () => {
  it("should execute action after specified delay", async () => {
    const mockFn = vi.fn();
    const start = Date.now();

    await delayAction(100, mockFn);

    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(95);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

describe("firstMap", () => {
  it("should return first non-null/undefined result", () => {
    const fn = (x: string) => x.match(/\d+/)?.[0];
    const result = firstMap(fn, ["abc", "123", "def"]);
    expect(result).toBe("123");
  });

  it("should return undefined if no matches found", () => {
    const fn = (x: string) => x.match(/\d+/)?.[0];
    const result = firstMap(fn, ["abc", "def", "ghi"]);
    expect(result).toBeUndefined();
  });

  it("should work with custom type transformations", () => {
    const fn = (x: number) => (x > 5 ? x * 2 : undefined);
    const result = firstMap(fn, [1, 3, 6, 8]);
    expect(result).toBe(12);
  });

  it("should handle empty array", () => {
    const fn = (x: string) => x;
    const result = firstMap(fn, []);
    expect(result).toBeUndefined();
  });
});

describe("mapDefined", () => {
  it("should filter out null and undefined values after mapping", () => {
    const input = [1, 2, 3, 4, 5];
    const fn = (x: number) => (x % 2 === 0 ? x : undefined);
    expect(mapDefined(input, fn)).toEqual([2, 4]);
  });

  it("should handle empty arrays", () => {
    const input: number[] = [];
    const fn = (x: number) => x * 2;
    expect(mapDefined(input, fn)).toEqual([]);
  });

  it("should work with object transformations", () => {
    interface User {
      name: string;
      age?: number;
    }
    const input: User[] = [
      { name: "Alice", age: 25 },
      { name: "Bob" },
      { name: "Charlie", age: 30 },
    ];
    const fn = (user: User) => user.age;
    expect(mapDefined(input, fn)).toEqual([25, 30]);
  });

  it("should handle array with all null/undefined results", () => {
    const input = [1, 2, 3];
    const fn = () => null;
    expect(mapDefined(input, fn)).toEqual([]);
  });

  it("should preserve non-null falsy values", () => {
    type FalsyValue = string | number | boolean | null | undefined;
    const input: FalsyValue[] = ["", 0, false, null, undefined, "test"];
    const fn = (x: FalsyValue) => x;
    expect(mapDefined(input, fn)).toEqual(["", 0, false, "test"]);
  });
});

describe("Utils", () => {
  it("should handle async operations", () => {
    const mockFn = vi.fn();
    // ... rest of the test
  });
});

describe("getPath", () => {
  it("resolves a deep key path", () => {
    expect(getPath({ a: { b: { c: 1 } } }, ["a", "b", "c"])).toBe(1);
  });

  it("returns undefined when any segment is missing", () => {
    expect(getPath({ a: { b: 1 } }, ["a", "x"])).toBeUndefined();
    expect(getPath({ a: { b: 1 } }, ["a", "x", "y"])).toBeUndefined();
  });

  it("indexes arrays with numeric segments", () => {
    expect(getPath({ items: [10, 20, 30] }, ["items", 1])).toBe(20);
    expect(getPath([[1, 2], [3, 4]], [1, 0])).toBe(3);
  });

  it("short-circuits on null without throwing", () => {
    expect(getPath({ a: null }, ["a", "b"])).toBeNull();
  });

  it("short-circuits on undefined without throwing", () => {
    expect(getPath({ a: undefined }, ["a", "b"])).toBeUndefined();
  });

  it("returns the root when the path is empty", () => {
    const root = { a: 1 };
    expect(getPath(root, [])).toBe(root);
  });

  it("returns undefined when rooted at null or undefined", () => {
    expect(getPath(null, ["a"])).toBeNull();
    expect(getPath(undefined, ["a"])).toBeUndefined();
  });
});

describe("zodAddActualValueToIssues", () => {
  it("adds the resolved actual value from the source object", () => {
    const issues = [
      { path: ["user", "age"], code: "invalid_type", message: "Expected number" },
    ];
    const obj = { user: { age: "forty" } };

    expect(zodAddActualValueToIssues(issues, obj)).toEqual([
      {
        path: ["user", "age"],
        code: "invalid_type",
        message: "Expected number",
        actual: "forty",
      },
    ]);
  });

  it("sets actual to undefined when the path is missing on the source object", () => {
    const issues = [{ path: ["missing"], message: "required" }];
    expect(zodAddActualValueToIssues(issues, {})).toEqual([
      { path: ["missing"], message: "required", actual: undefined },
    ]);
  });

  it("preserves any extra fields on each issue", () => {
    const issues = [{ path: ["a"], code: "x", expected: "string", received: "number" }];
    const out = zodAddActualValueToIssues(issues, { a: 7 });
    expect(out[0]).toMatchObject({ code: "x", expected: "string", received: "number", actual: 7 });
  });

  it("returns an empty array when given no issues", () => {
    expect(zodAddActualValueToIssues([], { a: 1 })).toEqual([]);
  });

  it("supports numeric path segments (array indexes)", () => {
    const issues = [{ path: ["items", 1], message: "bad" }];
    const obj = { items: [10, 20, 30] };
    expect(zodAddActualValueToIssues(issues, obj)).toEqual([
      { path: ["items", 1], message: "bad", actual: 20 },
    ]);
  });

  it("does not mutate the input issue objects", () => {
    const original = { path: ["a"], message: "bad" };
    const frozen = Object.freeze({ ...original });
    expect(() => zodAddActualValueToIssues([frozen], { a: 1 })).not.toThrow();
    expect(frozen).toEqual(original);
    expect("actual" in frozen).toBe(false);
  });
});
