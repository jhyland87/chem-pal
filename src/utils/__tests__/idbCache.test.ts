import {
  clearSearchResults,
  clearSupplierProductDataCache,
  deleteSupplierProductDataCacheEntry,
  findDuplicateProductIds,
  getSearchResults,
  getSupplierProductDataCacheEntry,
  putSupplierProductDataCacheEntry,
  setSearchResults,
} from "@/utils/idbCache";
import { Logger } from "@/utils/Logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const product = (fields: Partial<Product>): Product => fields as unknown as Product;

describe("findDuplicateProductIds", () => {
  it("returns an empty list when every product is unique", () => {
    expect(findDuplicateProductIds([product({ id: "P1" }), product({ id: "P2" })])).toEqual([]);
  });

  it("reports duplicates keyed off the real product id, not the positional _id", () => {
    const duplicates = findDuplicateProductIds([
      product({ id: "P1", _id: 0 }),
      product({ id: "P1", _id: 1 }),
      product({ id: "P2", _id: 2 }),
    ]);

    expect(duplicates).toEqual(["id:P1"]);
  });

  it("keys off cacheKey when present, ignoring _id", () => {
    expect(
      findDuplicateProductIds([product({ cacheKey: "ck1", _id: 0 }), product({ cacheKey: "ck1", _id: 1 })]),
    ).toEqual(["ck:ck1"]);
  });

  it("falls back to supplier+url when a product has no id or cacheKey", () => {
    const duplicates = findDuplicateProductIds([
      product({ supplier: "Ambeed", url: "/x" }),
      product({ supplier: "Ambeed", url: "/x" }),
      product({ supplier: "Ambeed", url: "/y" }),
    ]);

    expect(duplicates).toEqual(["su:Ambeed:/x"]);
  });
});

describe("setSearchResults duplicate detection", () => {
  beforeEach(async () => {
    await clearSearchResults({ notify: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stored results from a correct (single) search have unique ids", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    await setSearchResults([product({ id: "P1", _id: 0 }), product({ id: "P2", _id: 1 })]);

    const ids = (await getSearchResults()).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns — and does NOT silently drop — when duplicates reach storage", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const one = [product({ id: "P1", _id: 0 }), product({ id: "P2", _id: 1 })];

    // A doubled search would persist the same products twice.
    await setSearchResults([...one, ...one]);

    // The duplicates are surfaced, not hidden: storage still reflects the bug so
    // the regression is visible rather than masked by a silent dedupe.
    expect(warn).toHaveBeenCalled();
    expect((await getSearchResults()).map((p) => p.id)).toEqual(["P1", "P2", "P1", "P2"]);
  });
});

describe("deleteSupplierProductDataCacheEntry", () => {
  afterEach(async () => {
    await clearSupplierProductDataCache();
  });

  it("removes a single product-detail cache entry, leaving others intact", async () => {
    await putSupplierProductDataCacheEntry("key-a", { data: { price: 1 }, timestamp: 1 });
    await putSupplierProductDataCacheEntry("key-b", { data: { price: 2 }, timestamp: 2 });

    await deleteSupplierProductDataCacheEntry("key-a");

    expect(await getSupplierProductDataCacheEntry("key-a")).toBeUndefined();
    expect(await getSupplierProductDataCacheEntry("key-b")).toBeDefined();
  });

  it("is a no-op for a key that isn't cached", async () => {
    await expect(deleteSupplierProductDataCacheEntry("missing")).resolves.toBeUndefined();
  });
});
