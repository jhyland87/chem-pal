// ProductBuilder must be imported before SupplierBase to satisfy the suppliers'
// module-init order (mirrors SupplierBase.setup.test.ts).
import { ProductBuilder } from "@/utils/ProductBuilder";
import { parseSearchQuery } from "@/utils/search-query/parseSearchQuery";
import { describe, expect, it } from "vitest";
import { SupplierBase } from "../SupplierBase";

void ProductBuilder;

interface TitleItem {
  title: string;
}

/**
 * Minimal concrete supplier exposing the protected advanced-search helpers for
 * testing. No network/cache is touched by `fuzzyFilterAst`/`deriveFallbackTerms`.
 */
class TestSupplier extends SupplierBase<TitleItem, Product> {
  public readonly supplierName = "Test";
  public readonly baseURL = "https://example.com";
  public readonly shipping: ShippingRange = "worldwide";
  public readonly country: CountryCode = "US";
  public readonly paymentMethods: PaymentMethod[] = ["mastercard"];

  protected titleSelector(data: unknown): Maybe<string> {
    return (data as TitleItem).title;
  }

  protected getUniqueProductKey(data: unknown): string {
    return (data as TitleItem).title;
  }

  protected async queryProducts(): Promise<ProductBuilder<Product>[] | void> {
    return;
  }

  protected initProductBuilders(): ProductBuilder<Product>[] {
    return [];
  }

  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return product;
  }

  public runFuzzyFilterAst(data: TitleItem[]): TitleItem[] {
    return this.fuzzyFilterAst<TitleItem>(data);
  }

  public runDeriveFallbackTerms(): string[] {
    return this.deriveFallbackTerms();
  }
}

const make = (query: string, fuzzingDisabled = false, rankOnly = true): TestSupplier => {
  const supplier = new TestSupplier(query, 10, new AbortController());
  supplier.setParsedQuery(parseSearchQuery(query));
  supplier.setFuzzyFilteringDisabled(fuzzingDisabled);
  // fuzzyFilterRankOnly is protected readonly; override it on the instance for the
  // opt-out case so we can still exercise the hard-cutoff path.
  if (!rankOnly) Reflect.set(supplier, "fuzzyFilterRankOnly", false);
  return supplier;
};

const data: TitleItem[] = [
  { title: "Sodium Chloride" },
  { title: "Potassium Permanganate" },
  { title: "Sodium Borohydride" },
  { title: "Acetone" },
];

describe("fuzzyFilterAst", () => {
  it("ranks a plain query by score without dropping weak matches", () => {
    // Rank-only (the default): the best match leads, the worst trails, but nothing is
    // cut — the base search pipeline caps the list to `limit`.
    const titles = make("sodium chloride")
      .runFuzzyFilterAst(data)
      .map((d) => d.title);
    expect(titles[0]).toBe("Sodium Chloride");
    expect(titles).not.toContain("Acetone");
    expect(titles.indexOf("Sodium Chloride")).toBeLessThan(titles.indexOf("Sodium Borohydride"));
  });

  it("applies a hard cutoff when a supplier opts out of rank-only", () => {
    const titles = make("sodium chloride", false, false)
      .runFuzzyFilterAst(data)
      .map((d) => d.title);
    expect(titles[0]).toBe("Sodium Chloride");
    expect(titles).not.toContain("Acetone");
  });

  it("filters an OR query to either branch", () => {
    const titles = make("Chloride OR Borohydride")
      .runFuzzyFilterAst(data)
      .map((d) => d.title)
      .sort();
    expect(titles).toEqual(["Sodium Borohydride", "Sodium Chloride"]);
  });

  it("excludes NOT branches", () => {
    const titles = make("Sodium AND NOT Borohydride")
      .runFuzzyFilterAst(data)
      .map((d) => d.title);
    expect(titles).toContain("Sodium Chloride");
    expect(titles).not.toContain("Sodium Borohydride");
  });

  it("returns raw data unchanged for a plain query when fuzzing is disabled", () => {
    const result = make("zzz-nonexistent", true).runFuzzyFilterAst(data);
    expect(result).toEqual(data);
  });

  it("applies boolean substring matching for an advanced query when fuzzing is disabled", () => {
    const titles = make("Sodium AND NOT Borohydride", true)
      .runFuzzyFilterAst(data)
      .map((d) => d.title);
    expect(titles).toEqual(["Sodium Chloride"]);
  });
});

describe("deriveFallbackTerms", () => {
  it("returns one longest term per OR-group, deduped", () => {
    expect(make("(Sodium OR Potassium) AND Hydroxide").runDeriveFallbackTerms()).toEqual([
      "Hydroxide",
    ]);
  });

  it("returns each OR alternative", () => {
    expect(make("Chloride OR Borohydride").runDeriveFallbackTerms().sort()).toEqual([
      "Borohydride",
      "Chloride",
    ]);
  });

  it("returns empty for a purely negative query", () => {
    expect(make("NOT bar").runDeriveFallbackTerms()).toEqual([]);
  });
});
