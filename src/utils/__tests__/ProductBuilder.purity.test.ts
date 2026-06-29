import { ProductBuilder } from "@/utils/ProductBuilder";
import { describe, expect, it } from "vitest";

// USD pricing keeps build() from making a currency-conversion network call.
const buildWithPurity = (purity: unknown) =>
  new ProductBuilder<Product>("https://example.com")
    .setBasicInfo("Sodium chloride", "/products/sodium-chloride", "TestSupplier")
    .setPricing(10, "USD", "$")
    .setQuantity(500, "g")
    .setPurity(purity)
    .build();

describe("ProductBuilder setPurity", () => {
  it("normalizes a whole-number purity to a percentage string", async () => {
    expect(await buildWithPurity(98)).toMatchObject({ purity: "98%" });
  });

  it("normalizes a decimal numeric purity", async () => {
    expect(await buildWithPurity(99.5)).toMatchObject({ purity: "99.5%" });
  });

  it("accepts 100", async () => {
    expect(await buildWithPurity(100)).toMatchObject({ purity: "100%" });
  });

  it("keeps a plain percentage string", async () => {
    expect(await buildWithPurity("98%")).toMatchObject({ purity: "98%" });
  });

  it("keeps a comparator with decimals", async () => {
    expect(await buildWithPurity("≥99.995%")).toMatchObject({ purity: "≥99.995%" });
  });

  it("extracts the percentage and drops trailing qualifier text", async () => {
    expect(await buildWithPurity("≥99.995% metals basis")).toMatchObject({ purity: "≥99.995%" });
  });

  it("extracts a percentage with a parenthetical method suffix", async () => {
    expect(await buildWithPurity("≥98%(HPLC)")).toMatchObject({ purity: "≥98%" });
  });

  it("extracts a percentage from a solvent description", async () => {
    expect(await buildWithPurity("60% in Water")).toMatchObject({ purity: "60%" });
  });

  it("strips internal whitespace around the percentage", async () => {
    expect(await buildWithPurity("≥ 99.9 % trace")).toMatchObject({ purity: "≥99.9%" });
  });

  it("ignores a string with no percentage", async () => {
    expect(await buildWithPurity("ACS reagent")).not.toHaveProperty("purity");
  });

  it("ignores an out-of-range percentage", async () => {
    expect(await buildWithPurity("150%")).not.toHaveProperty("purity");
  });

  it("ignores 0%", async () => {
    expect(await buildWithPurity("0%")).not.toHaveProperty("purity");
  });

  it("ignores undefined", async () => {
    expect(await buildWithPurity(undefined)).not.toHaveProperty("purity");
  });
});
