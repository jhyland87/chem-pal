

import { QuantityMatch } from '../types'

/**
 * Parses a quantity string into a QuantityMatch object.
 * @see https://regex101.com/r/lDLuVX/6
 * @param quantity - The quantity string to parse.
 * @returns A QuantityMatch object.
 */
export function parseQuantity(quantity: string): QuantityMatch {
  const quantityMatch = quantity.match(/(?<quantity>[0-9][0-9\.\,]*)\s?(?<uom>(?:milli|kilo|centi)?(?:gram|meter|liter|metre)s?|oz|ounces?|grams?|gallons?|quarts?|gal|cm|k[mg]?|g|lbs?|pounds?|l|qts?|m?[glm])/i)
  if (!quantityMatch)
    throw new Error('Failed to parse quantity')

  const groups = quantityMatch.groups

  if (!groups)
    throw new Error('Failed to parse quantity: no groups found')

  let parsedQuantity: string | number = groups.quantity

  // https://regex101.com/r/Q5w26N/1
  // If the quantity is the weird foreign style where the commas and decimals are swapped,
  // (eg: 1.234,56 instead of 1,234.56), then we need to swap the commas and decimals for
  // easier parsing and handling.
  if (parsedQuantity.match(/^([0-9]+\.[0-9]+,[0-9]{1,2}|[0-9]{1,3},[0-9]{1,2}|[0-9]{1,3},[0-9]{1,2})$/)) {
    parsedQuantity = parsedQuantity.replaceAll('.', 'xx').replaceAll(',', '.').replaceAll('xx', ',')
  }

  parsedQuantity = parseFloat(parsedQuantity.replace(/,/g, ''))

  if (isNaN(parsedQuantity))
    throw new Error('Failed to parse quantity: invalid number')

  return {
    quantity: parsedQuantity,
    uom: groups.uom
  }
}

