//import type { ExchangeRateResponse, ParsedPrice } from "types";
import { LRUCache } from "lru-cache";
import type { CurrencyCode, CurrencySymbol, ParsedPrice } from "types/currency";
import { CurrencyCodeMap } from "../data/currency";

const lruCurrencyRate = new LRUCache({
  max: 5,
  fetchMethod: async (key: string) => {
    const [from, to] = key.split(":");
    const response = await fetch(
      `https://hexarate.paikama.co/api/rates/latest/${from}?target=${to}`,
    );
    const result = await response.json();
    return result.data.mid;
  },
});

/**
 * Extracts the currency symbol from a price string.
 * Uses Unicode property escapes to match currency symbols.
 *
 * @param {string} price - The price string to extract the currency symbol from
 * @returns {string | undefined} The currency symbol if found, undefined otherwise
 * @category Helper
 * @example
 * ```typescript
 * getCurrencySymbol('$1000') // Returns '$'
 * getCurrencySymbol('1000€') // Returns '€'
 * getCurrencySymbol('1000£') // Returns '£'
 * getCurrencySymbol('1000¥') // Returns '¥'
 * getCurrencySymbol('1000₹') // Returns '₹'
 * ```
 */
export function getCurrencySymbol(price: string): CurrencySymbol | undefined {
  const match = price.match(/\p{Sc}/u);
  if (!match) return undefined;
  return match[0] as CurrencySymbol;
}

/**
 * Parses a price string into a structured object containing currency information.
 * Handles various price formats including foreign number formats (e.g., 1.234,56).
 *
 * @param {string} price - The price string to parse
 * @returns {ParsedPrice | void} Object containing currency code, symbol, and numeric price, or undefined if invalid
 * @category Helper
 * @example
 * ```typescript
 * parsePrice('$1000') // Returns { currencyCode: 'USD', price: 1000, currencySymbol: '$' }
 * parsePrice('1000€') // Returns { currencyCode: 'EUR', price: 1000, currencySymbol: '€' }
 * parsePrice('1000£') // Returns { currencyCode: 'GBP', price: 1000, currencySymbol: '£' }
 * parsePrice('1000¥') // Returns { currencyCode: 'JPY', price: 1000, currencySymbol: '¥' }
 * parsePrice('1000') // Returns undefined
 * ```
 */
export function parsePrice(price: string): ParsedPrice | void {
  if (typeof price !== "string") return;
  const currencySymbol = getCurrencySymbol(price) as CurrencySymbol;
  if (!currencySymbol) return;

  const currencyCode = getCurrencyCodeFromSymbol(currencySymbol);
  let bareAmount = price.replace(currencySymbol as string, "").trim();

  // Handle foreign number formats where commas and decimals are swapped
  if (bareAmount.match(/^(\d+\.\d+,\d{1,2}|\d{1,3},\d{1,2}|\d{1,3},\d{1,2})$/))
    bareAmount = bareAmount.replaceAll(".", "xx").replaceAll(",", ".").replaceAll("xx", ",");

  // Remove all commas from the amount to make it castable to a number
  bareAmount = bareAmount.replace(/,/g, "");

  return {
    currencyCode,
    currencySymbol,
    price: parseFloat(bareAmount),
  } as ParsedPrice;
}

/**
 * Fetches the current exchange rate between two currencies.
 * Uses the Hexarate API to get real-time exchange rates.
 * The responses are cached using lru-cache npm module.
 *
 * @param {CurrencyCode} from - The source currency code
 * @param {CurrencyCode} to - The target currency code
 * @returns {Promise<number>} The exchange rate between the currencies
 * @throws {Error} If the API request fails
 * @category Helper
 * @example
 * ```typescript
 * await getCurrencyRate('USD', 'EUR') // Returns 0.85
 * await getCurrencyRate('EUR', 'USD') // Returns 1.1764705882352942
 * ```
 */
export async function getCurrencyRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
  try {
    return await lruCurrencyRate.fetch(`${from as string}:${to as string}`);
  } catch (error) {
    throw new Error(
      `Failed to get currency rate for ${from as string} to ${to as string} - ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Maps a currency symbol to its corresponding currency code.
 * Uses a predefined mapping of symbols to ISO currency codes.
 *
 * @param {CurrencySymbol} symbol - The currency symbol to look up
 * @returns {CurrencyCode} The corresponding ISO currency code
 * @category Helper
 * @example
 * ```typescript
 * getCurrencyCodeFromSymbol('$') // Returns 'USD'
 * getCurrencyCodeFromSymbol('€') // Returns 'EUR'
 * getCurrencyCodeFromSymbol('£') // Returns 'GBP'
 * getCurrencyCodeFromSymbol('¥') // Returns 'JPY'
 * getCurrencyCodeFromSymbol('₹') // Returns 'INR'
 * ```
 */
export function getCurrencyCodeFromSymbol(symbol: CurrencySymbol): CurrencyCode {
  return CurrencyCodeMap[symbol as string];
}

/**
 * Converts a given amount from any supported currency to USD.
 * Uses real-time exchange rates from the Hexarate API.
 *
 * @param {number} amount - The amount to convert
 * @param {CurrencyCode} from - The source currency code
 * @returns {Promise<number>} The converted amount in USD, formatted to 2 decimal places
 * @category Helper
 * @example
 * ```typescript
 * await toUSD(100, 'EUR') // Returns 117.65
 * await toUSD(100, 'GBP') // Returns 130.43
 * await toUSD(100, 'JPY') // Returns 11000
 * await toUSD(100, 'INR') // Returns 8500
 * ```
 */
export async function toUSD(amount: number, from: CurrencyCode): Promise<number> {
  const rate = await getCurrencyRate(from, "USD");
  return parseFloat(Number(amount * rate).toFixed(2));
}
