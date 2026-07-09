import { formatDisplayPrice } from "@/helpers/price";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("formatDisplayPrice", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats a USD price with the default USD settings", () => {
    const result = formatDisplayPrice(
      { price: 19.99, usdPrice: 19.99, currencyCode: "USD" },
      { currency: "USD", currencyRate: 1 },
    );
    expect(result).toBe("$19.99");
  });

  it("falls back to USD at rate 1 when userSettings is undefined", () => {
    expect(formatDisplayPrice({ price: 5, usdPrice: 5, currencyCode: "USD" }, undefined)).toBe(
      "$5.00",
    );
  });

  it("converts a USD-anchored price into the user's currency at the given rate", () => {
    const result = formatDisplayPrice(
      { price: 17, usdPrice: 20, currencyCode: "USD" },
      { currency: "EUR", currencyRate: 0.9 },
    );
    // 20 * 0.9 = 18, formatted in EUR.
    expect(result).toBe("€18.00");
  });

  it("renders a non-USD product without a usdPrice anchor in its native currency", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = formatDisplayPrice(
      { price: 42, currencyCode: "GBP" },
      { currency: "EUR", currencyRate: 0.9 },
    );
    expect(result).toBe("£42.00");
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("uses the currency symbol, not the code, for currencies Intl renders as a code", () => {
    // ANG's Intl currency symbol is "ANG"; the symbol map has the proper glyph "ƒ".
    const result = formatDisplayPrice(
      { price: 43.5, usdPrice: 43.5, currencyCode: "USD" },
      { currency: "ANG", currencyRate: 1 },
    );
    expect(result).toBe("ƒ43.50");
  });

  it("returns an empty string when neither price nor usdPrice is present", () => {
    expect(formatDisplayPrice({ currencyCode: "USD" }, { currency: "USD", currencyRate: 1 })).toBe(
      "",
    );
  });
});
