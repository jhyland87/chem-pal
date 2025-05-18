import { QuantityObject, UOM } from "../types";

/**
 * Maps each unit of measure (UOM) to its possible string representations.
 * This mapping helps standardize various ways of expressing the same unit.
 * @category Helper
 * @type {Record<UOM, string[]>}
 */
export const uomAliases: Record<UOM, string[]> = {
  [UOM.PCS]: ["piece", "pieces", "pc", "pcs"],
  [UOM.KG]: ["kilogram", "kilograms", "kg", "kgs"],
  [UOM.LB]: ["pound", "pounds", "lb", "lbs"],
  [UOM.ML]: ["ml", "mls", "millilitre", "milliliter", "milliliters", "millilitres"],
  [UOM.G]: ["grams", "g"],
  [UOM.L]: ["liters", "litres", "l"],
  [UOM.QT]: ["quarts", "qts", "qt"],
  [UOM.GAL]: ["gallon", "gallons", "gal"],
  [UOM.MM]: ["millimeter", "millimeters", "millimetre", "millimetres", "mm"],
  [UOM.CM]: ["centimeter", "centimeters", "centimetre", "centimetres", "cm"],
  [UOM.M]: ["meters", "metre", "metres", "m", "meter"],
  [UOM.OZ]: ["ounce", "ounces", "oz"],
  [UOM.MG]: ["milligram", "milligrams", "mg", "mgs"],
  [UOM.KM]: ["kilometer", "kilometre", "kilometers", "kilometres", "km"],
};

/**
 * Parses a quantity string into a structured object containing the numeric value and unit of measure.
 * Handles various formats including foreign number formats (e.g., 1.234,56).
 * Uses regex pattern matching to extract quantity and unit information.
 * @category Helper
 * @param {string} value - The quantity string to parse (e.g., '100g', '120 grams')
 * @returns {QuantityObject | void} Object containing quantity and UOM, or undefined if parsing fails
 * @throws {Error} If the quantity string cannot be parsed
 *
 * @example
 * ```ts
 * parseQuantity('100g') // Returns { quantity: 100, uom: 'g' }
 * parseQuantity('120 grams') // Returns { quantity: 120, uom: 'grams' }
 * parseQuantity('43.4 ounce') // Returns { quantity: 43.4, uom: 'ounce' }
 * parseQuantity('1200 milliliters') // Returns { quantity: 1200, uom: 'milliliters' }
 * parseQuantity('1.2 L') // Returns { quantity: 1.2, uom: 'L' }
 * ```
 *
 * @see https://regex101.com/r/Ruid54/3
 */
export function parseQuantity(value: string): QuantityObject | void {
  const quantityPattern = new RegExp(
    "(?<quantity>\\d[\\d.,]*)\\s?(?<uom>(?:milli|kilo|centi)?" +
      "(?:ounce|g(?:allon|ram|al)|pound|quart|qt|piece|pc|" +
      "lb|(?:met|lit)[re]{2})s?|oz|k[mg]?|g|l|[cm]?[glm])",
    "i",
  );
  const quantityMatch = value.match(quantityPattern);

  if (
    !quantityMatch ||
    !quantityMatch.groups ||
    !quantityMatch.groups.quantity ||
    !quantityMatch.groups.uom
  ) {
    throw new Error("Failed to parse quantity");
  }

  let parsedQuantity: string | number = quantityMatch.groups.quantity;

  // Handle foreign number formats where commas and decimals are swapped
  if (parsedQuantity.match(/^(\d+\.\d+,\d{1,2}|\d{1,3},\d{1,2}|\d{1,3},\d{1,2})$/))
    parsedQuantity = parsedQuantity
      .replaceAll(".", "xx")
      .replaceAll(",", ".")
      .replaceAll("xx", ",");

  const uom = standardizeUom(quantityMatch.groups.uom);
  const quantity = parseFloat(parsedQuantity.replace(/,/g, ""));

  if (uom && quantity) return { quantity, uom } as QuantityObject;
}

/**
 * Standardizes a unit of measure (UOM) to its canonical form.
 * Uses the uomAliases mapping to convert various representations to standard forms.
 * @category Helper
 * @param {string} uom - The unit of measure to standardize
 * @returns {UOM | void} The standardized UOM, or undefined if not recognized
 *
 * @example
 * ```ts
 * standardizeUom('qt') // Returns 'quart'
 * standardizeUom('kg') // Returns 'kilogram'
 * standardizeUom('kilograms') // Returns 'kilogram'
 * standardizeUom('lb') // Returns 'pound'
 * standardizeUom('Grams') // Returns 'gram'
 * ```
 */
export function standardizeUom(uom: string): UOM | void {
  const uomMap = Object.entries(uomAliases).reduce(
    (acc, [uom, aliases]) => {
      aliases.forEach((alias) => {
        acc[alias] = uom;
      });
      return acc;
    },
    { [uom]: uom } as Record<string, string>,
  );

  if (uom.toLowerCase() in uomMap) return uomMap[uom.toLowerCase()] as UOM;
}

/**
 * Converts a quantity from its current unit to its base unit.
 * Currently supports conversion of kilometers to meters and pounds to grams.
 * @category Helper
 * @param {number} quantity - The quantity to convert
 * @param {UOM} uom - The unit of measure of the quantity
 * @returns {number} The converted quantity in its base unit
 *
 * @example
 * ```ts
 * convertToBaseUom(1, UOM.KM) // Returns 1000 (meters)
 * convertToBaseUom(1, UOM.LB) // Returns 453.592 (grams)
 * convertToBaseUom(1, UOM.G) // Returns 1 (no conversion needed)
 * ```
 */
export function convertToBaseUom(quantity: number, uom: UOM): number {
  switch (uom) {
    // Convert km/kg to m/g
    case UOM.KM:
    case UOM.KG:
      return quantity * 1000;

    // Convert pounds to grams
    case UOM.LB:
      return quantity * 453.592;
  }
  return quantity;
}
