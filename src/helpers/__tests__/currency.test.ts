import { CurrencySymbol, ExchangeRateResponse } from "../../types";
import {
  getCurrencyCodeFromSymbol,
  getCurrencyRate,
  getCurrencySymbol,
  parsePrice,
  toUSD,
} from "../currency";

describe("getCurrencySymbol", () => {
  const testData = {
    $1000: "$",
    "1000€": "€",
    "£1000": "£",
    "1000¥": "¥",
    "₹1000": "₹",
    "1000": undefined,
  };

  for (const [input, expected] of Object.entries(testData)) {
    it(`should return ${expected} for price: ${input}`, () =>
      expect(getCurrencySymbol(input)).toBe(expected));
  }
});

describe("getCurrencyRate", () => {
  beforeEach(() => (global.fetch = jest.fn()));
  afterEach(() => jest.resetAllMocks());

  it("should return exchange rate for valid currency pair", async () => {
    const mockResponse: ExchangeRateResponse = {
      status_code: 200,
      data: {
        base: "USD",
        target: "EUR",
        mid: 0.889,
        unit: 1,
        timestamp: new Date().toISOString(),
      },
    };

    const mockFetch = global.fetch as jest.Mock;
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

  it("should throw error for failed API call", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

    await expect(getCurrencyRate("USD", "EUR")).rejects.toThrow(
      "Failed to get currency rate for USD to EUR",
    );
  });
});
describe("getCurrencyCodeFromSymbol", () => {
  const testData = {
    $: "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "₹": "INR",
  };

  for (const [symbol, code] of Object.entries(testData)) {
    it(`should return ${code} for symbol: ${symbol}`, () =>
      expect(getCurrencyCodeFromSymbol(symbol as CurrencySymbol)).toBe(code));
  }
});

describe("toUSD", () => {
  beforeEach(() => (global.fetch = jest.fn()));
  afterEach(() => jest.resetAllMocks());

  it("should convert amount to USD with correct formatting", async () => {
    const mockResponse = { data: { mid: 1.1765 } };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await toUSD(100, "EUR");
    expect(result).toBe("117.65");
  });
});

describe("parsePrice", () => {
  it("should parse price with symbol before amount", () => {
    expect(parsePrice("$1000")).toEqual({
      currencyCode: "USD",
      price: 1000,
      currencySymbol: "$",
    });
  });

  it("should parse price with symbol after amount", () => {
    expect(parsePrice("1000€")).toEqual({
      currencyCode: "EUR",
      price: 1000,
      currencySymbol: "€",
    });
  });

  it("should parse decimal prices", () => {
    expect(parsePrice("£10.50")).toEqual({
      currencyCode: "GBP",
      price: 10.5,
      currencySymbol: "£",
    });
  });

  it("should parse prices with thousands separators", () => {
    expect(parsePrice("¥1,000")).toEqual({
      currencyCode: "JPY",
      price: 1000,
      currencySymbol: "¥",
    });
  });

  it("should parse prices with European number format", () => {
    expect(parsePrice("₹1.234,56")).toEqual({
      currencySymbol: "₹",
      currencyCode: "INR",
      price: 1234.56,
    });
  });

  it("should handle prices with spaces between symbol and amount", () => {
    expect(parsePrice("$ 1000")).toEqual({
      currencyCode: "USD",
      price: 1000,
      currencySymbol: "$",
    });
  });

  it("should return undefined for invalid price strings", () => {
    expect(parsePrice("invalid")).toBeUndefined();
    expect(parsePrice("1000")).toBeUndefined();
  });
});
