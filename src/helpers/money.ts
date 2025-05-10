
import currency from 'currency.js'
import fx from 'money'
import { CurrencyCode, ExchangeRateResponse, CurrencySymbolMap, CurrencyCodeMap } from '../types'



/**
 * Get the currency symbol from a price string.
 * @param price - The price string to get the currency symbol from.
 * @returns The currency symbol or undefined if no symbol is found.
 */
export function getCurrencySymbol(price: string): string | undefined {
  const match = price.match(/\p{Sc}/u);

  if (!match) return undefined

  return match[0]
}

/**
 * Get the currency rate for a given currency pair.
 * @param from - The currency to convert from.
 * @param to - The currency to convert to.
 * @returns The currency rate.
 */
export async function getCurrencyRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
  try {
    const response = await fetch(`https://hexarate.paikama.co/api/rates/latest/${from}?target=${to}`)
    const result = await response.json() as ExchangeRateResponse
    return result.data.mid
  }
  catch (error) {
    console.error(error)
    throw new Error(`Failed to get currency rate for ${from} to ${to}`)
  }
}

export function getCurrencyCodeFromSymbol(symbol: CurrencySymbolMap): CurrencyCodeMap {
  return CurrencyCodeMap[symbol as keyof typeof CurrencyCodeMap]
}

//getCurrencyRate('USD', 'EUR').then(console.log)


//console.log(getCurrencySymbol('$1000'))

//console.log(fx.convert(1000, { from: 'USD', to: 'EUR' }))

// https://hexarate.paikama.co/api/rates/latest/EUR?target=USD