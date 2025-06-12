declare module "price-parser" {
  interface Currency {
    code: string;
    symbols: string[];
    name: string;
    exponent: number;
  }

  interface ParsedPriceResult {
    value: number;
    floatValue: number;
    symbol: string;
    currencyCode: string;
    currency: Currency;
  }

  export const currencies: Currency[];
  export function parseAll(
    text: string,
    options?: { parseNegative?: boolean },
  ): ParsedPriceResult[];
  export function parseFirst(
    text: string,
    options?: { parseNegative?: boolean },
  ): ParsedPriceResult | null;
}
