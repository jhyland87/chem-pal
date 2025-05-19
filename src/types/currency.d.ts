import HttpStatusCode from "./HttpStatusCode";
import { CurrencyCodeMap, CurrencySymbolMap } from "./currency";

/**
 * Represents a currency exchange rate as a number
 */
export type CurrencyRate = number;

/**
 * Response structure for currency exchange rate data
 */
declare type ExchangeRateResponse = {
  /** HTTP status code of the response */
  status_code: HttpStatusCode;
  /** Exchange rate data */
  data: {
    /** Base currency code */
    base: CurrencyCode;
    /** Target currency code */
    target: CurrencyCode;
    /** Mid-point exchange rate */
    mid: number;
    /** Unit of the exchange rate */
    unit: number;
    /** Timestamp of the exchange rate in ISO format */
    timestamp: string; // ISOString
  };
};

/**
 * Structure for parsed price information
 */
declare type ParsedPrice = {
  /** Currency code (e.g., USD, EUR) */
  currencyCode: CurrencyCode;
  /** Currency symbol (e.g., $, €) */
  currencySymbol: CurrencySymbol;
  /** Numeric price value */
  price: number;
};

/**
 * Type representing valid currency codes
 * Derived from the keys of CurrencySymbolMap
 */
declare type CurrencyCode = keyof typeof CurrencySymbolMap;

/**
 * Type representing valid currency symbols
 * Derived from the keys of CurrencyCodeMap
 */
declare type CurrencySymbol = keyof typeof CurrencyCodeMap;

/**
 * Mapping of currency symbols to their corresponding ISO currency codes
 * @example
 * ```typescript
 * CurrencyCodeMap['$'] // returns 'USD'
 * CurrencyCodeMap['€'] // returns 'EUR'
 * ```
 */
