import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the excludedProducts IndexedDB store.
let store: Record<string, unknown> = {};
vi.mock("@/utils/idbCache", () => ({
  getExcludedProducts: async () => store,
  putExcludedProducts: async (map: Record<string, unknown>) => {
    store = map;
  },
}));

const { addExcludedProduct, loadExcludedProductKeys } = await import(
  "@/helpers/excludedProducts"
);
const { getProductIdentityKey } = await import("@/helpers/productIdentity");

describe("addExcludedProduct (identity-keyed)", () => {
  beforeEach(() => {
    store = {};
  });
  afterEach(() => vi.restoreAllMocks());

  it("keys the entry by the product identity, not the URL", async () => {
    const key = await addExcludedProduct("FAM_889460", "Carolina", {
      title: "Sodium Hydroxide",
      url: "https://carolina.com/p/889425",
    });

    expect(key).toBe(getProductIdentityKey("FAM_889460", "Carolina"));
    const keys = await loadExcludedProductKeys();
    expect(keys.has(key)).toBe(true);
    expect(store[key]).toMatchObject({
      identity: "FAM_889460",
      url: "https://carolina.com/p/889425",
      supplier: "Carolina",
      title: "Sodium Hydroxide",
    });
  });

  it("is idempotent for the same identity + supplier", async () => {
    await addExcludedProduct("ID1", "Loudwolf", { url: "https://a" });
    await addExcludedProduct("ID1", "Loudwolf", { url: "https://a" });
    expect(Object.keys(store)).toHaveLength(1);
  });

  it("keys distinct products under distinct keys", async () => {
    const k1 = await addExcludedProduct("ID1", "Loudwolf", { url: "https://loudwolf.com/p/1" });
    const k2 = await addExcludedProduct("ID2", "Loudwolf", { url: "https://loudwolf.com/p/2" });
    expect(k1).not.toBe(k2);
    expect(Object.keys(store)).toHaveLength(2);
  });
});
