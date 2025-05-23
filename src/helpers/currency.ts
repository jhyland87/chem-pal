//import type { ExchangeRateResponse, ParsedPrice } from "types";
import { CURRENCY_CODE_MAP } from "constants/currency";
import { LRUCache } from "lru-cache";
import type { CurrencyCode, CurrencySymbol, ParsedPrice } from "types/currency";

/**
 * LRU (Least Recently Used) cache for storing currency exchange rates.
 * Implements caching to minimize API calls to the exchange rate service.
 *
 * Configuration:
 * - Maximum size: 5 entries
 * - Automatic fetching of missing rates
 * - Fetches from Hexarate API (https://hexarate.paikama.co)
 *
 * Cache key format: "FROM:TO" (e.g., "USD:EUR")
 * Cache value: Exchange rate as a number
 *
 * @example
 * ```typescript
 * // Cache usage is automatic through getCurrencyRate():
 * const rate1 = await getCurrencyRate('USD', 'EUR'); // Fetches from API
 * const rate2 = await getCurrencyRate('USD', 'EUR'); // Uses cached value
 *
 * // After 5 different currency pairs, least recently used pair is evicted
 * ```
 */
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
 * Supports a wide range of international currency symbols.
 *
 * @category Helper
 * @param price - The price string to extract the currency symbol from
 * @returns The currency symbol if found, undefined otherwise
 *
 * @example
 * ```typescript
 * getCurrencySymbol('$1000') // Returns '$'
 * getCurrencySymbol('1000€') // Returns '€'
 * getCurrencySymbol('£99.99') // Returns '£'
 * getCurrencySymbol('¥10000') // Returns '¥'
 * getCurrencySymbol('₹1500') // Returns '₹'
 * getCurrencySymbol('1000') // Returns undefined (no symbol)
 * ```
 */
export function getCurrencySymbol(price: string): CurrencySymbol | void {
  const match = price.match(/\p{Sc}/u);
  if (!match) return;
  return match[0] satisfies CurrencySymbol;
}

/**
 * Parses a price string into a structured object containing currency information.
 * Handles various price formats and number representations:
 * - Different currency symbol positions (prefix/suffix)
 * - International number formats (e.g., 1.234,56 or 1,234.56)
 * - Various currency symbols (€, $, £, ¥, etc.)
 *
 * @category Helper
 * @param price - The price string to parse (e.g., "$1,234.56" or "1.234,56€")
 * @returns Object with currency code, symbol, and numeric price, or undefined if invalid
 *
 * @example
 * ```typescript
 * parsePrice('$1,234.56')
 * // Returns { currencyCode: 'USD', price: 1234.56, currencySymbol: '$' }
 *
 * parsePrice('1.234,56€')
 * // Returns { currencyCode: 'EUR', price: 1234.56, currencySymbol: '€' }
 *
 * parsePrice('£99.99')
 * // Returns { currencyCode: 'GBP', price: 99.99, currencySymbol: '£' }
 *
 * parsePrice('invalid') // Returns undefined
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
  } satisfies ParsedPrice;
}

/**
 * Fetches the current exchange rate between two currencies.
 * Uses the Hexarate API to get real-time exchange rates.
 * Implements caching using LRU cache to minimize API calls.
 *
 * @category Helper
 * @param from - The source currency code (e.g., 'USD', 'EUR')
 * @param to - The target currency code
 * @returns The exchange rate as a number
 * @throws Error if the API request fails or rate cannot be fetched
 *
 * @example
 * ```typescript
 * // Get EUR to USD rate
 * const rate = await getCurrencyRate('EUR', 'USD')
 * // Returns something like 1.18 (meaning 1 EUR = 1.18 USD)
 *
 * // Convert amount using rate
 * const amount = 100;
 * const converted = amount * rate; // 118 USD
 *
 * // Rates are cached for subsequent calls
 * await getCurrencyRate('EUR', 'USD') // Uses cached value
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
 * Maps a currency symbol to its corresponding ISO currency code.
 * Uses a predefined mapping from the CURRENCY_CODE_MAP constant.
 * Supports major international currency symbols.
 *
 * @category Helper
 * @param symbol - The currency symbol to look up (e.g., '$', '€', '£')
 * @returns The corresponding ISO currency code (e.g., 'USD', 'EUR', 'GBP')
 *
 * @example
 * ```typescript
 * getCurrencyCodeFromSymbol('$') // Returns 'USD'
 * getCurrencyCodeFromSymbol('€') // Returns 'EUR'
 * getCurrencyCodeFromSymbol('£') // Returns 'GBP'
 * getCurrencyCodeFromSymbol('¥') // Returns 'JPY'
 * getCurrencyCodeFromSymbol('₹') // Returns 'INR'
 *
 * // Useful in combination with getCurrencySymbol
 * const symbol = getCurrencySymbol('$100');
 * const code = getCurrencyCodeFromSymbol(symbol); // 'USD'
 * ```
 */
export function getCurrencyCodeFromSymbol(symbol: CurrencySymbol): CurrencyCode {
  return CURRENCY_CODE_MAP[symbol as string];
}

/**
 * Converts a given amount from any supported currency to USD.
 * Uses real-time exchange rates from the Hexarate API.
 * Results are rounded to 2 decimal places for standard currency format.
 *
 * @category Helper
 * @param amount - The amount to convert
 * @param from - The source currency code (e.g., 'EUR', 'GBP')
 * @returns The converted amount in USD, formatted to 2 decimal places
 *
 * @example
 * ```typescript
 * // Convert 100 EUR to USD
 * await toUSD(100, 'EUR')
 * // Returns 118.45 (if rate is 1.1845)
 *
 * // Convert 1000 JPY to USD
 * await toUSD(1000, 'JPY')
 * // Returns 9.12 (if rate is 0.00912)
 *
 * // Chain conversions
 * const price = parsePrice('€50.00');
 * if (price) {
 *   const usdAmount = await toUSD(price.price, price.currencyCode);
 * }
 * ```
 */
export async function toUSD(amount: number, from: CurrencyCode): Promise<number> {
  const rate = await getCurrencyRate(from, "USD");
  return parseFloat(Number(amount * rate).toFixed(2));
}
