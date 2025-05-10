import {
  CurrencyCode,
  ExchangeRateResponse,
  CurrencyCodeMap,
  CurrencySymbol,
  ParsedPrice
} from '../types'

/**
 * Get the currency symbol from a price string.
 *
 * @param {string} price - The price string to get the currency symbol from.
 * @returns {string | undefined} - The currency symbol or undefined if no symbol is found.
 * @example
 * getCurrencySymbol('$1000') // '$'
 * getCurrencySymbol('1000€') // '€'
 * getCurrencySymbol('1000£') // '£'
 * getCurrencySymbol('1000¥') // '¥'
 * getCurrencySymbol('1000₹') // '₹'
 */
export function getCurrencySymbol(price: string): string | undefined {
  const match = price.match(/\p{Sc}/u);
  if (!match) return undefined
  return match[0]
}

/**
 * Parse a price string into a ParsedPrice object.
 *
 * @param {string} price - The price string to parse.
 * @returns {ParsedPrice | void} - The parsed price or undefined if the price is invalid.
 * @example
 * parsePrice('$1000') // { currency: 'USD', amount: 1000, symbol: '$' }
 * parsePrice('1000€') // { currency: 'EUR', amount: 1000, symbol: '€' }
 * parsePrice('1000£') // { currency: 'GBP', amount: 1000, symbol: '£' }
 * parsePrice('1000¥') // { currency: 'JPY', amount: 1000, symbol: '¥' }
 * parsePrice('1000') // undefined
 */
export function parsePrice(price: string): ParsedPrice | void {
  const symbol = getCurrencySymbol(price) as CurrencySymbol
  if (!symbol) return;

  const currencyCode = getCurrencyCodeFromSymbol(symbol)
  let bareAmount = price.replace(symbol, '').trim()

  // https://regex101.com/r/Q5w26N/2
  // If the prices (like quantities) could be the weird foreign style where the commas and
  // decimals are swapped, (eg: 1.234,56 instead of 1,234.56), then we need to swap the
  // commas and decimals for easier parsing and handling.
  if (bareAmount.match(/^(\d+\.\d+,\d{1,2}|\d{1,3},\d{1,2}|\d{1,3},\d{1,2})$/))
    bareAmount = bareAmount.replaceAll('.', 'xx').replaceAll(',', '.').replaceAll('xx', ',')

  // Remove all commas from the amount to make it castable to a number
  bareAmount = bareAmount.replace(/,/g, '')

  return {
    currency: currencyCode,
    amount: parseFloat(bareAmount),
    symbol
  } as ParsedPrice
}

/**
 * Get the currency rate for a given currency pair.
 *
 * @param {CurrencyCode} from - The currency to convert from.
 * @param {CurrencyCode} to - The currency to convert to.
 * @returns {Promise<number>} - The currency rate.
 * @example
 * getCurrencyRate('USD', 'EUR') // 0.85
 * getCurrencyRate('EUR', 'USD') // 1.1764705882352942
 */
export async function getCurrencyRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
  try {
    const response = await fetch(`https://hexarate.paikama.co/api/rates/latest/${from}?target=${to}`)
    const result = await response.json() as ExchangeRateResponse
    return result.data.mid
  }
  catch (error) {
    throw new Error(`Failed to get currency rate for ${from} to ${to}`)
  }
}

/**
 * Get the currency code from a currency symbol.
 *
 * @param {CurrencySymbolMap} symbol - The currency symbol to get the currency code from.
 * @returns {CurrencyCodeMap} - The currency code.
 * @example
 * getCurrencyCodeFromSymbol('$') // 'USD'
 * getCurrencyCodeFromSymbol('€') // 'EUR'
 * getCurrencyCodeFromSymbol('£') // 'GBP'
 * getCurrencyCodeFromSymbol('¥') // 'JPY'
 * getCurrencyCodeFromSymbol('₹') // 'INR'
 */
export function getCurrencyCodeFromSymbol(symbol: CurrencySymbol): CurrencyCode {
  return CurrencyCodeMap[symbol] as CurrencyCode
}

/**
 * Convert a given amount from a specified currency to USD.
 *
 * @param {number} amount - The amount to convert.
 * @param {CurrencyCode} from - The currency to convert from.
 * @returns {Promise<string>} - The amount in USD.
 * @example
 * toUSD(100, 'EUR') // '117.65'
 * toUSD(100, 'GBP') // '130.43'
 * toUSD(100, 'JPY') // '11000.00'
 * toUSD(100, 'INR') // '8500.00'
 */
export async function toUSD(amount: number, from: CurrencyCode): Promise<string> {
  const rate = await getCurrencyRate(from, 'USD')
  return (amount * rate).toFixed(2)
}

//toUSD(100, 'EUR').then(console.log)
//getCurrencyRate('USD', 'EUR').then(console.log)


//console.log(getCurrencySymbol('$1000'))

//console.log(fx.convert(1000, { from: 'USD', to: 'EUR' }))

// https://hexarate.paikama.co/api/rates/latest/EUR?target=USD