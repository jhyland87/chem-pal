
import currency from 'currency.js'
import fx from 'money'



export function getCurrencySymbol(price: string): string | undefined {
  const match = price.match(/\p{Sc}/u);

  if (!match) return undefined

  return match[0]
}

console.log(getCurrencySymbol('$1000'))

console.log(fx.convert(1000, { from: 'USD', to: 'EUR' }))

// https://hexarate.paikama.co/api/rates/latest/EUR?target=USD