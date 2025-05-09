

import { QuantityObject, UOM } from '../types'

/**
 * Since a single UOM can be represented in multiple ways, we need to keep track of all the
 * possible aliases for each UOM.
 */
export const uomAliases: Record<UOM, string[]> = {
  [UOM.kg]: ['kilogram', 'kilograms', 'kg', 'kgs'],
  [UOM.lb]: ['pound', 'pounds', 'lb', 'lbs'],
  [UOM.ml]: ['ml', 'mls', 'millilitre', 'milliliter', 'milliliters', 'millilitres'],
  [UOM.g]: ['grams', 'g'],
  [UOM.L]: ['liters', 'litres', 'l'],
  [UOM.qt]: ['quarts', 'qts', 'qt'],
  [UOM.gal]: ['gallon', 'gallons', 'gal'],
  [UOM.mm]: ['millimeter', 'millimeters', 'millimetre', 'millimetres', 'mm'],
  [UOM.cm]: ['centimeter', 'centimeters', 'centimetre', 'centimetres', 'cm'],
  [UOM.m]: ['meters', 'metre', 'metres', 'm', 'meter'],
  [UOM.oz]: ['ounce', 'ounces', 'oz'],
  [UOM.mg]: ['milligram', 'milligrams', 'mg', 'mgs'],
  [UOM.km]: ['kilometer', 'kilometre', 'kilometers', 'kilometres', 'km'],
}

/**
 * Parses a quantity string into a QuantityObject object.
 * @see https://regex101.com/r/lDLuVX/7
 * @param value - The quantity string to parse.
 * @returns A QuantityObject object.
 */
export function parseQuantity(value: string): QuantityObject | void {
  const quantityMatch = value.match(/(?<quantity>[0-9][0-9\.\,]*)\s?(?<uom>(?:milli|kilo|centi)?(?:gram|meter|liter|litre|metre)s?|oz|ounces?|grams?|gallons?|quarts?|gal|cm|k[mg]?|g|lbs?|pounds?|l|qts?|m?[glm])/i)
  if (!quantityMatch || !quantityMatch.groups || !quantityMatch.groups.quantity || !quantityMatch.groups.uom)
    throw new Error('Failed to parse quantity')

  let parsedQuantity: string | number = quantityMatch.groups.quantity

  // https://regex101.com/r/Q5w26N/1
  // If the quantity is the weird foreign style where the commas and decimals are swapped,
  // (eg: 1.234,56 instead of 1,234.56), then we need to swap the commas and decimals for
  // easier parsing and handling.
  if (parsedQuantity.match(/^([0-9]+\.[0-9]+,[0-9]{1,2}|[0-9]{1,3},[0-9]{1,2}|[0-9]{1,3},[0-9]{1,2})$/))
    parsedQuantity = parsedQuantity.replaceAll('.', 'xx').replaceAll(',', '.').replaceAll('xx', ',')

  const uom = standardizeUom(quantityMatch.groups.uom)
  const quantity = parseFloat(parsedQuantity.replace(/,/g, ''))

  if (uom && quantity)
    return { quantity, uom }
}


/**
 * Standardizes a UOM to its canonical form.
 * @param {string} uom - The UOM to standardize.
 * @returns The standardized UOM. The displayable UOM values are in the UOM enum
 * @example
 *  standardizeUom('qt') // 'quart'
 *  standardizeUom('kg') // 'kilogram'
 *  standardizeUom('kilograms') // 'kilogram'
 *  standardizeUom('lb') // 'pound'
 */
export function standardizeUom(uomx: string): string | void {
  const uomMap = Object.entries(uomAliases).reduce((acc, [uomx, aliases]) => {
    aliases.forEach(alias => {
      acc[alias] = uomx
    })
    return acc
  }, { [uomx]: uomx } as Record<string, string>)

  if (uomx.toLowerCase() in uomMap)
    return uomMap[uomx.toLowerCase()]
}

