import { UOM, UOM_ALIASES } from "@/constants/common";

/**
 * @categoryDescription Helpers
 * @group Quantity
 * Quantity parsing and unit conversion utilities for handling different units of measurement.
 * @showGroups
 * @showCategories
 */

/**
 * Pattern for matching quantities in strings.
 * @source
 */
const quantityPattern =
  "(?:(?<multiplier>[1-9][0-9]*)\\s?[xX\u00D7]\\s?(?=[1-9]))?" +
  "(?<quantity>[1-9][0-9]*(?:[.,]\\d+)*(?:\\s\\d{3})*)\\s?" +
  "(?<uom>(?:milli|kilo|centi)?(?:ml|ounce|g(?:allon|ram|al)" +
  "|each|ea?" +
  "|pound|quart|q(?:uar)?t|piece|pc|lb|(?:met|lit)[re]{2})s?" +
  "|fl\\.?\\s?oz|oz|k[mg]?|g|l|[cm]?[gl])s?(?!\\/mol)(?![A-Za-z])";

/**
 * @type QuantityObject
 * @group Quantity
 */
type QuantityObject = { quantity: number; uom: string };

/**
 * @type unitConversions
 * @group Quantity
 */
const unitConversions: { threshold: number; factor: number; from: string; to: string }[] = [
  { threshold: 1000, factor: 1000, from: "g", to: "kg" },
  { threshold: 1000, factor: 1000, from: "mg", to: "g" },
  { threshold: 1000, factor: 1000, from: "kg", to: "t" },
  { threshold: 1000, factor: 1000, from: "ml", to: "l" },
  { threshold: 100, factor: 100, from: "cm", to: "m" },
];

/**
 * Normalizes a quantity object to its base unit of measure.
 * @category Helpers
 * @group Quantity
 * @param input - The quantity object to normalize
 * @returns The normalized quantity object
 * @example
 * ```typescript
 * normalizeQuantity({ quantity: 1000, uom: "g" }) // Returns { quantity: 1, uom: "kg" }
 * normalizeQuantity({ quantity: 1000, uom: "mg" }) // Returns { quantity: 1, uom: "g" }
 * normalizeQuantity({ quantity: 1000, uom: "kg" }) // Returns { quantity: 1, uom: "t" }
 * normalizeQuantity({ quantity: 1000, uom: "ml" }) // Returns { quantity: 1, uom: "l" }
 * normalizeQuantity({ quantity: 1000, uom: "cm" }) // Returns { quantity: 1, uom: "m" }
 * ```
 * @source
 */
export function normalizeQuantity(input: QuantityObject): QuantityObject {
  const conversion = unitConversions.find((c) => c.from === input.uom.toLowerCase());

  if (!conversion || input.quantity < conversion.threshold) return input;

  return {
    quantity: Math.round((input.quantity / conversion.factor) * 100) / 100,
    uom: conversion.to,
  };
}

/**
 * Parses a quantity string into a structured object containing the numeric value and unit of measure.
 * Handles various formats including foreign number formats (e.g., 1.234,56).
 * Uses regex pattern matching to extract quantity and unit information.
 * @category Helpers
 * @group Quantity
 * @param  value - The quantity string to parse (e.g., '100g', '120 grams')
 * @returns Object containing quantity and UOM, or undefined if parsing fails
 * @throws  If the quantity string cannot be parsed
 *
 * @example
 * ```typescript
 * parseQuantity('100g') // Returns { quantity: 100, uom: 'g' }
 * parseQuantity('120 grams') // Returns { quantity: 120, uom: 'grams' }
 * parseQuantity('43.4 ounce') // Returns { quantity: 43.4, uom: 'ounce' }
 * parseQuantity('1200 milliliters') // Returns { quantity: 1200, uom: 'milliliters' }
 * parseQuantity('1.2 L') // Returns { quantity: 1.2, uom: 'L' }
 * parseQuantity('1.2 g/mol') // Returns nothing, as g/mol is not a quantity
 * ```
 *
 * @see https://regex101.com/r/Ruid54/7
 * @source
 */
export function parseQuantity(value: string): QuantityObject | void {
  if (!value) return;

  // (?<quantity>[1-9][0-9]*(?:[.,]\d+)*)\s?(?<uom>(?:milli|kilo|centi)?(?:ounce|g(?:allon|ram|al)|pound|quart|qt|piece|pc|lb|(?:met|lit)[re]{2})|oz|k[mg]?|g|l|[cm]?[glm])s?(?!\/mol)(?![A-Za-z])
  const quantityPatternRegex = new RegExp(quantityPattern, "i");
  const quantityMatch = value.match(quantityPatternRegex);

  if (!quantityMatch?.groups?.quantity || !quantityMatch?.groups?.uom) return;

  let parsedQuantity: string | number = quantityMatch.groups.quantity;

  // Handle foreign number formats where commas and decimals are swapped
  if (parsedQuantity.match(/^(\d+\.\d+,\d{1,2}|\d{1,3},\d{1,2}|\d{1,3},\d{1,2})$/))
    parsedQuantity = parsedQuantity
      .replaceAll(".", "xx")
      .replaceAll(",", ".")
      .replaceAll("xx", ",");

  const uom = standardizeUom(quantityMatch.groups.uom);
  const quantity = parseFloat(parsedQuantity.replaceAll(/[,\s]/g, ""));
  const multiplier = parseInt(quantityMatch.groups?.multiplier ?? "1");

  if (uom && quantity) return normalizeQuantity({ quantity: quantity * multiplier, uom });
}

/**
 * Strips the quantity from a string. This is useful for when some suppliers don't have products
 * listed as variants, but instead have multiple products with a quantity in the name. Using this
 * function, we can get the name of the product without the quantity, which may be identical to
 * the other variations. Making it easy to group the products into a single listing with multiple
 * variants.
 * @category Helpers
 * @group Quantity
 * @param value - The string to strip the quantity from
 * @returns The string with the quantity removed
 * @example
 * ```typescript
 * stripQuantityFromString("Some reagent - 100g") // Returns "Some reagent -"
 * stripQuantityFromString("120 grams, of some reagent") // Returns "of some reagent"
 * stripQuantityFromString("43.4 ounce of some reagent") // Returns "ounce of some reagent"
 * stripQuantityFromString("1200 milliliters of some reagent") // Returns "milliliters of some reagent"
 * stripQuantityFromString("1.2 L of some reagent") // Returns "L of some reagent"
 * ```
 * @see https://regex101.com/r/1lzkMN/1
 * @source
 */
export function stripQuantityFromString(value: string): string {
  if (!value || typeof value !== "string") return value;

  const quantityPatternRegex = new RegExp(quantityPattern, "ig");

  return value.replace(quantityPatternRegex, "").trim();
}

/**
 * Standardizes a unit of measure (UOM) to its canonical form.
 * Uses the uomAliases mapping to convert various representations to standard forms.
 * @category Helpers
 * @group Quantity
 * @param uom - The unit of measure to standardize
 * @returns The standardized UOM, or undefined if not recognized
 *
 * @example
 * ```typescript
 * standardizeUom('qt') // Returns 'quart'
 * standardizeUom('kg') // Returns 'kilogram'
 * standardizeUom('kilograms') // Returns 'kilogram'
 * standardizeUom('lb') // Returns 'pound'
 * standardizeUom('Grams') // Returns 'gram'
 * ```
 * @source
 */
export function standardizeUom(uom: string): UOM | void {
  const uomMap: Record<string, string> = { [uom]: uom };
  for (const [canonical, aliases] of Object.entries(UOM_ALIASES)) {
    for (const alias of aliases) {
      uomMap[alias] = canonical;
    }
  }

  const normalized = uom.toLowerCase();
  if (normalized in uomMap) return uomMap[normalized] satisfies string as UOM;
}

/**
 * Converts a quantity from its current unit to a common unit of mass or volume.
 * This is to make it easier to compare quantities of different units.
 * @category Helpers
 * @group Quantity
 * @param quantity - The quantity to convert
 * @param unit - The unit of measure of the quantity
 * @returns The converted quantity in its base unit
 *
 * @example
 * ```typescript
 * toBaseQuantity(1, UOM.KG) // Returns 1000 (kilograms)
 * toBaseQuantity(1, UOM.LB) // Returns 453.592 (grams)
 * toBaseQuantity(1, UOM.G) // Returns 1 (no conversion needed)
 * ```
 * @source
 */
export function toBaseQuantity(quantity: number, unit: UOM): number {
  if (typeof quantity !== "number") return quantity;

  switch (unit) {
    // Solids, convert all to milligrams
    case UOM.MG:
      return quantity;
    case UOM.G:
      return quantity * 1000;
    case UOM.KG:
      return quantity * 1000000;
    case UOM.LB:
      return quantity * 453592;
    case UOM.OZ:
      return quantity * 28349.5; // Weight ounce, not fluid

    // Liquids, convert all to milliliters
    case UOM.ML:
      return quantity;
    case UOM.L:
      return quantity * 1000;
    case UOM.QT:
      return quantity * 946.353;
    case UOM.GAL:
      return quantity * 3785.41;
    case UOM.FLOZ:
      return quantity * 29.5735;

    // Countable units, no conversion
    case UOM.PCS:
    case UOM.EA:
      return quantity;

    default:
      console.debug(`${quantity} ${unit} -> ${quantity} ${unit} (no conversion found)`);
      return quantity;
  }
}
