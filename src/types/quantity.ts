export type QuantityObject = { quantity: number; uom: string };

export enum UOM_LONG {
  KG = "kilogram",
  LB = "pound",
  ML = "milliliter",
  G = "gram",
  L = "liter",
  QT = "quart",
  GAL = "gallon",
  MM = "millimeter",
  CM = "centimeter",
  M = "meter",
  OZ = "ounce",
  MG = "milligram",
  KM = "kilometer",
}

// These are the UOM values that will be displayed to the user.
// Changing the values here will change the UOM values in the
// search results.
// export enum UOM {
//   kg = 'kg',
//   lb = 'lb',
//   ml = 'ml',
//   g = 'g',
//   L = 'L',
//   qt = 'qt',
//   gal = 'gal',
//   mm = 'mm',
//   cm = 'cm',
//   m = 'm',
//   oz = 'oz',
//   mg = 'mg',
//   km = 'km',
// }

export enum UOM {
  KG = "kg",
  LB = "lb",
  ML = "ml",
  G = "g",
  L = "L",
  QT = "qt",
  GAL = "gal",
  MM = "mm",
  CM = "cm",
  M = "m",
  OZ = "oz",
  MG = "mg",
  KM = "km",
}
