/* eslint-disable @typescript-eslint/naming-convention */
/**
 * @group Constants
 * @groupDescription Application-wide constants and enumerations used throughout the codebase.
 * @source
 */

import { locations } from "@/../config.json";

/**
 * Indexes for the different panels in the application.
 * @source
 */
export enum PANEL {
  /** Search home panel index */
  SEARCH_HOME = 0,
  /** Results panel index */
  RESULTS = 1,
  /** Stats panel index */
  STATS = 2,
}

/**
 * Indexes for the different drawer tabs in the application.
 * @source
 */
export enum DRAWER_INDEX {
  /** Closed tab index */
  CLOSED = -1,
  /** Search tab index */
  SEARCH = 0,
  /** History tab index (not implemented yet) */
  HISTORY = 1,
  /** Settings tab index (not implemented yet) */
  SETTINGS = 2,
}

/**
 * Action types dispatched to the App component's useActionState reducer.
 * Each action corresponds to a specific state transition in the application.
 * @source
 */
export enum APP_ACTION {
  /** Applies new user settings and persists them to chrome.storage.local */
  UPDATE_SETTINGS = "UPDATE_SETTINGS",
  /** Switches the active panel (0 = SearchHome, 1 = Results, 2 = Stats) */
  SET_PANEL = "SET_PANEL",
  /** Toggles the SpeedDial FAB visibility based on mouse proximity */
  SET_SPEED_DIAL_VISIBILITY = "SET_SPEED_DIAL_VISIBILITY",
  /** Hydrates app state from chrome.storage on initial mount */
  LOAD_FROM_STORAGE = "LOAD_FROM_STORAGE",
  /** Opens a specific drawer tab or closes the drawer (tab = -1) */
  SET_DRAWER_TAB = "SET_DRAWER_TAB",
  /** Updates the selected suppliers list for search filtering */
  SET_SELECTED_SUPPLIERS = "SET_SELECTED_SUPPLIERS",
}

/**
 * Keys used for storing and retrieving data in chrome.storage.session.
 * @source
 */
export enum CACHE {
  /** Application settings */
  USER_SETTINGS = "user_settings",
  /** The current query */
  QUERY = "query",
  /** The current search input text */
  SEARCH_INPUT = "search_input",
  /** Array of product results from the most recent search */
  SEARCH_RESULTS = "search_results",
  /** Flag indicating a new search was submitted from the search home panel */
  SEARCH_IS_NEW_SEARCH = "is_new_search",
  /** Persisted search history entries stored in chrome.storage.local */
  SEARCH_HISTORY = "search_history",
  /** Selected suppliers list for search filtering */
  SELECTED_SUPPLIERS = "selected_suppliers",
  /** HTTP LRU cache */
  HTTP_LRU = "httplru",
  /** The current panel (0 = SearchHome, 1 = Results, 2 = Stats) */
  PANEL = "panel",
  /** Query results cache */
  QUERY_RESULTS_CACHE = "query_results_cache",
  /** Product data cache */
  PRODUCT_DATA_CACHE = "product_data_cache",
  /** Supplier query results cache */
  SUPPLIER_QUERY_CACHE = "supplier_query_cache",
  /** Supplier product data cache */
  SUPPLIER_PRODUCT_DATA_CACHE = "supplier_product_data_cache",
  /** User-excluded products, keyed by product data cache key (see getProductExclusionKey) */
  EXCLUDED_PRODUCTS = "excluded_products",
  /** Persisted TanStack table state (sorting, pagination, expanded rows, column visibility) */
  TABLE_STATE = "table_state",
}

/**
 * Represents the availability of a product
 * Keep values as lower case strings.
 * @source
 */
export enum AVAILABILITY {
  IN_STOCK = "in stock",
  LIMITED_STOCK = "limited stock",
  OUT_OF_STOCK = "out of stock",
  PRE_ORDER = "preorder",
  BACKORDER = "backorder",
  DISCONTINUED = "discontinued",
  UNAVAILABLE = "unavailable",
  UNKNOWN = "unknown",
}

/**
 * Represents different rotation speeds for animations
 * @source
 */
export enum SPIN_SPEED {
  /** Slow rotation speed - 6 units */
  SLOW = 6,
  /** Medium rotation speed - 4 units */
  MEDIUM = 4,
  /** Fast rotation speed - 2 units */
  FAST = 2,
  /** Very fast rotation speed - 1 unit */
  VERY_FAST = 1,
}

/**
 * Contains full names of units of measurement
 * @source
 */
export enum UOM_LONG {
  /** Full name for kilogram unit */
  KG = "kilogram",
  /** Full name for pound unit */
  LB = "pound",
  /** Full name for milliliter unit */
  ML = "milliliter",
  /** Full name for gram unit */
  G = "gram",
  /** Full name for liter unit */
  L = "liter",
  /** Full name for quart unit */
  QT = "quart",
  /** Full name for gallon unit */
  GAL = "gallon",
  /** Full name for ounce unit */
  OZ = "ounce",
  /** Full name for milligram unit */
  MG = "milligram",
  /** Full name for piece unit */
  PCS = "piece",
}

/**
 * Contains abbreviated forms of units of measurement
 * @source
 */
export enum UOM {
  /** Abbreviated form of kilogram */
  KG = "kg",
  /** Abbreviated form of pound */
  LB = "lb",
  /** Abbreviated form of milliliter */
  ML = "ml",
  /** Abbreviated form of gram */
  G = "g",
  /** Abbreviated form of liter */
  L = "l",
  /** Abbreviated form of quart */
  QT = "qt",
  /** Abbreviated form of gallon */
  GAL = "gal",
  /** Abbreviated form of ounce */
  OZ = "oz",
  /** Abbreviated form of fluid ounce */
  FLOZ = "floz",
  /** Abbreviated form of milligram */
  MG = "mg",
  /** Abbreviated form of piece */
  PCS = "pcs",
  /** Abbreviated form of each */
  EA = "ea",
}

/**
 * A constant mapping of units of measurement to their various string representations.
 * This object implements the UOMAliases interface and provides standardized
 * ways to recognize different text forms of the same unit of measurement.
 *
 * Used for parsing and normalizing unit strings in the application, this constant
 * handles variations in spelling, pluralization, and common abbreviations.
 *
 * Type: UOMAliases
 * Category: Helper
 *
 * Usage examples:
 * // Get all possible representations of kilograms
 * const kgAliases = UOM_ALIASES[UOM.KG]; // ["kilogram", "kilograms", "kg", "kgs"]
 *
 * // Check if a string represents a specific unit
 * const isKilogram = UOM_ALIASES[UOM.KG].includes("kg"); // true
 * @source
 */
export const UOM_ALIASES: UOMAliases = {
  /** Piece aliases */
  [UOM.PCS]: ["piece", "pieces", "pc", "pcs"],
  /** Kilogram aliases */
  [UOM.KG]: ["kilogram", "kilograms", "kg", "kgs"],
  /** Pound aliases */
  [UOM.LB]: ["pound", "pounds", "lb", "lbs"],
  /** Milliliter aliases */
  [UOM.ML]: ["ml", "mls", "millilitre", "milliliter", "milliliters", "millilitres"],
  /** Gram aliases */
  [UOM.G]: ["grams", "g"],
  /** Liter aliases */
  [UOM.L]: ["liters", "litres", "l"],
  /** Quart aliases */
  [UOM.QT]: ["quarts", "qts", "qt"],
  /** Gallon aliases */
  [UOM.GAL]: ["gallon", "gallons", "gal"],
  /** Ounce aliases */
  [UOM.OZ]: ["ounce", "ounces", "oz"],
  /** Milligram aliases */
  [UOM.MG]: ["milligram", "milligrams", "mg", "mgs"],
  /** Each aliases */
  [UOM.EA]: ["each", "ea"],
  /** Fluid ounce aliases */
  [UOM.FLOZ]: ["fl oz", "floz", "fl.oz", "fl. oz"],
} as const;

/**
 * Regular expression for validating CAS (Chemical Abstracts Service) numbers.
 * Matches the standard format of three segments: 2-7 digits, 2 digits, and 1 checksum digit.
 *

 * @category Helpers
 * @example
 * ```typescript
 * CAS_REGEX.test('1234-56-6') // true
 * CAS_REGEX.test('50-00-0') // true
 * CAS_REGEX.test('1234-56-999') // false
 * ```
 *
 * @see https://regex101.com/r/xPF1Yp/2
 * @see https://www.cas.org/training/documentation/chemical-substances/checkdig
 * @source
 */
export const CAS_REGEX: RegExp = /(?<seg_a>\d{2,7})-(?<seg_b>\d{2})-(?<seg_checksum>\d)/;

/**
 * Supported countries for location-based features such as currency and shipping filters.
 * Derived from the locations defined in config.json, excluding the "OTHER" fallback entry.
 * Sorted alphabetically by country name.
 * @source
 */
export const COUNTRIES = Object.entries(locations)
  .filter(([code]) => code !== "OTHER")
  .map(([code, { name }]) => ({ name, code }))
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Maps user-facing availability labels to product availability values
 * used in the {@link AVAILABILITY} enum.
 * @source
 */
export const AVAILABILITY_LABEL_MAP: Record<string, string[]> = {
  "In Stock": [AVAILABILITY.IN_STOCK],
  "Limited Stock": [AVAILABILITY.LIMITED_STOCK],
  "Out of Stock": [AVAILABILITY.OUT_OF_STOCK, AVAILABILITY.BACKORDER],
  "Pre-order": [AVAILABILITY.PRE_ORDER],
  Unavailable: [AVAILABILITY.UNAVAILABLE, AVAILABILITY.DISCONTINUED],
};

/**
 * User-facing availability filter options for the drawer search panel.
 * Derived from the keys of {@link AVAILABILITY_LABEL_MAP}.
 * @source
 */
export const AVAILABILITY_OPTIONS = Object.keys(AVAILABILITY_LABEL_MAP);

/**
 * Supplier country options available for filtering in the drawer search panel.
 * Derived from the locations defined in config.json, excluding the "OTHER" fallback entry.
 * Sorted alphabetically by country label.
 * @source
 */
export const SUPPLIER_COUNTRY_OPTIONS = Object.entries(locations)
  .filter(([code]) => code !== "OTHER")
  .map(([code, { name }]) => ({ code, label: name }))
  .sort((a, b) => a.label.localeCompare(b.label));

/**
 * Shipping range options available for filtering in the drawer search panel.
 * Values correspond to the {@link ShippingRange} type.
 * @source
 */
export const SHIPPING_OPTIONS: ShippingRange[] = [
  "worldwide",
  "international",
  "domestic",
  "local",
];
