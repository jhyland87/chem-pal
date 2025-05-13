import { QuantityObject, UOM } from "../types";

/**
 * Since a single UOM can be represented in multiple ways, we need to keep track of all the
 * possible aliases for each UOM.
 */
export const uomAliases: Record<UOM, string[]> = {
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
 * Parses a quantity string into a QuantityObject object.
 * @see https://regex101.com/r/lDLuVX/10
 * @param value - The quantity string to parse.
 * @returns A QuantityObject object.
 */
export function parseQuantity(value: string): QuantityObject | void {
  const quantityMatch = value.match(
    /(?<quantity>\d[\d.,]*)\s?(?<uom>(?:milli|kilo|centi)?(?:ounce|g(?:allon|ram|al)|pound|quart|qt|lb|(?:met|lit)[re]{2})s?|oz|k[mg]?|g|l|[cm]?[glm])/i,
  );

  if (
    !quantityMatch ||
    !quantityMatch.groups ||
    !quantityMatch.groups.quantity ||
    !quantityMatch.groups.uom
  ) {
    throw new Error("Failed to parse quantity");
  }

  let parsedQuantity: string | number = quantityMatch.groups.quantity;

  // https://regex101.com/r/Q5w26N/2
  // If the quantity is the weird foreign style where the commas and decimals are swapped,
  // (eg: 1.234,56 instead of 1,234.56), then we need to swap the commas and decimals for
  // easier parsing and handling.
  if (parsedQuantity.match(/^(\d+\.\d+,\d{1,2}|\d{1,3},\d{1,2}|\d{1,3},\d{1,2})$/))
    parsedQuantity = parsedQuantity
      .replaceAll(".", "xx")
      .replaceAll(",", ".")
      .replaceAll("xx", ",");

  const uom = standardizeUom(quantityMatch.groups.uom);
  const quantity = parseFloat(parsedQuantity.replace(/,/g, ""));

  if (uom && quantity) return { quantity, uom };
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
 *  standardizeUom('Grams') // 'gram'
 */
export function standardizeUom(uomx: string): string | void {
  const uomMap = Object.entries(uomAliases).reduce(
    (acc, [uomx, aliases]) => {
      aliases.forEach((alias) => {
        acc[alias] = uomx;
      });
      return acc;
    },
    { [uomx]: uomx } as Record<string, string>,
  );

  if (uomx.toLowerCase() in uomMap) return uomMap[uomx.toLowerCase()];
}

export function convertToBaseUom(quantity: number, uom: UOM): number {
  switch (uom) {
    // Convert km/kg to m/g
    case UOM.KM:
    case UOM.KG:
      return quantity * 1000;
      break;

    // Convert pounds to grams
    case UOM.LB:
      return quantity * 453.592;
      break;
  }
  return quantity;
}
