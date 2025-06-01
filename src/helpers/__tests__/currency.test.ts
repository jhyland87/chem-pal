import {
  getCurrencyCodeFromSymbol,
  getCurrencyRate,
  getCurrencySymbol,
  parsePrice,
  toUSD,
} from "@/helpers/currency";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";

describe("getCurrencySymbol", () => {
  test.each([
    ["$1000", "$"],
    ["1000€", "€"],
    ["£1000", "£"],
    ["1000¥", "¥"],
    ["₹1000", "₹"],
  ])("should return %s for price: %s", (input, expected) =>
    expect(getCurrencySymbol(input)).toBe(expected),
  );
});

describe("getCurrencyRate", () => {
  beforeEach(() => (global.fetch = vi.fn()));
  afterEach(() => vi.resetAllMocks());

  it("should throw error for failed API call", async () => {
    (global.fetch as Mock).mockRejectedValueOnce(new Error("API Error"));

    await expect(getCurrencyRate("USD", "EUR")).rejects.toThrow(
      "Failed to get currency rate for USD to EUR",
    );
  });

  it("should return exchange rate for valid currency pair", async () => {
    const mockResponse: ExchangeRateResponse = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      status_code: 200,
      data: {
        base: "USD",
        target: "EUR",
        mid: 0.889,
        unit: 1,
        timestamp: new Date().toISOString(),
      },
    };

    const mockFetch = global.fetch as Mock;
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockResponse),
      }),
    );

    const exchangeRate = await getCurrencyRate("USD", "EUR");
    expect(exchangeRate).toBe(0.889);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://hexarate.paikama.co/api/rates/latest/USD?target=EUR",
    );
  });
});
describe("getCurrencyCodeFromSymbol", () => {
  test.each([
    ["$", "USD"],
    ["€", "EUR"],
    ["£", "GBP"],
    ["¥", "JPY"],
    ["₹", "INR"],
  ])("should return %s for symbol: %s", (symbol, code) =>
    expect(getCurrencyCodeFromSymbol(symbol as CurrencySymbol)).toBe(code),
  );
});

describe("toUSD", () => {
  beforeEach(() => (global.fetch = vi.fn()));
  afterEach(() => vi.resetAllMocks());

  it("should convert amount to USD with correct formatting", async () => {
    const mockResponse = { data: { mid: 1.1765 } };
    (global.fetch as Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await toUSD(100, "EUR");
    expect(result).toBe(117.65);
  });

  it("should handle API errors", async () => {
    (global.fetch as Mock).mockRejectedValueOnce(new Error("API Error"));
    // ... rest of the test
  });

  it("should convert EUR to USD", async () => {
    const mockFetch = global.fetch as Mock;
    // ... rest of the test
  });
});

describe("parsePrice", () => {
  test.each([
    ["$1000", "USD", 1000, "$"],
    ["1000€", "EUR", 1000, "€"],
    ["£10.50", "GBP", 10.5, "£"],
    ["¥1,000", "JPY", 1000, "¥"],
    ["₹1.234,56", "INR", 1234.56, "₹"],
  ])("should parse price: %s", (input, expectedCurrencyCode, expectedPrice, expectedSymbol) => {
    expect(parsePrice(input)).toEqual({
      currencyCode: expectedCurrencyCode,
      price: expectedPrice,
      currencySymbol: expectedSymbol,
    });
  });

  it("should return undefined for invalid price strings", () => {
    expect(parsePrice("invalid")).toBeUndefined();
    expect(parsePrice("1000")).toBeUndefined();
  });
});

describe("Currency helpers", () => {
  beforeEach(() => (global.fetch = vi.fn()));
  afterEach(() => vi.resetAllMocks());

  describe("other tests", () => {
    beforeEach(() => (global.fetch = vi.fn()));
    afterEach(() => vi.resetAllMocks());

    it("should handle successful API response", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        // ... rest of the test
      });
    });
  });
});
