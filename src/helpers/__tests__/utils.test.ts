import { delayAction, deserialize, firstMap, md5sum, serialize, sleep } from "@/helpers/utils";

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
    const mockFn = jest.fn();
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
