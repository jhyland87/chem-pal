import { HTTP_STATUS_CODES } from "constants/app";
import { CURRENCY_CODE_MAP, CURRENCY_SYMBOL_MAP } from "constants/currency";

declare module "price-parser" {
  interface Price {
    value: number;
    currencyCode: string;
    floatValue: number;
    symbol: string;
    currency: {
      code: string;
      exponent: number;
      symbols: string[];
    };
  }
}

declare global {
  /**
   * Represents a currency exchange rate as a number
   */
  type CurrencyRate = number;

  /**
   * Response structure for currency exchange rate data
   */
  interface ExchangeRateResponse {
    /** HTTP status code of the response */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    status_code: HTTP_STATUS_CODES;
    /** Exchange rate data */
    data: {
      /** Base currency code */
      base: keyof typeof CURRENCY_CODE_MAP;
      /** Target currency code */
      target: keyof typeof CURRENCY_CODE_MAP;
      /** Mid-point exchange rate */
      mid: number;
      /** Unit of the exchange rate */
      unit: number;
      /** Timestamp of the exchange rate in ISO format */
      timestamp: string; // ISOString
    };
  }

  /**
   * Structure for parsed price information
   */
  interface ParsedPrice {
    /** Currency code (e.g., USD, EUR) */
    currencyCode: CurrencyCode;
    /** Currency symbol (e.g., $, €) */
    currencySymbol: CurrencySymbol;
    /** Numeric price value */
    price: number;
  }

  /**
   * Type representing valid currency codes
   * Derived from the keys of CurrencySymbolMap
   */
  type CurrencyCode = valueof<typeof CURRENCY_CODE_MAP>;

  /**
   * Type representing valid currency symbols
   * Derived from the keys of CurrencyCodeMap
   */
  type CurrencySymbol = valueof<typeof CURRENCY_SYMBOL_MAP>;

  /**
   * Mapping of currency symbols to their corresponding ISO currency codes
   * @example
   * ```typescript
   * CurrencyCodeMap['$'] // returns 'USD'
   * CurrencyCodeMap['€'] // returns 'EUR'
   * ```
   */
  type CurrencyCodeMap = typeof CURRENCY_CODE_MAP;

  /**
   * Mapping of ISO currency codes to their corresponding symbols
   * @example
   * ```typescript
   * CurrencySymbolMap['USD'] // returns '$'
   * CurrencySymbolMap['EUR'] // returns '€'
   * ```
   */
  type CurrencySymbolMap = typeof CURRENCY_SYMBOL_MAP;
}

// This export is needed to make the file a module
export {};
