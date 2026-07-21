/**
 * @group Constants
 * @groupDescription Application-wide constants and enumerations used throughout the codebase.
 * @source
 */

/**
 * Action types for settings panel form state management.
 * Used by the SettingsPanel component.
 * @source
 */
export const ACTION_TYPE = {
  /** A toggle Switch changed; writes `checked` to the named setting */
  SWITCH_CHANGE: "SWITCH_CHANGE",
  /** A text field or Select changed; writes `value` to the named setting */
  INPUT_CHANGE: "INPUT_CHANGE",
  /** A button-group option was clicked (e.g. font size); writes `value` to the named setting */
  BUTTON_CLICK: "BUTTON_CLICK",
  /** A supplier was enabled/disabled; replaces the disabled-suppliers list */
  SUPPLIER_TOGGLE: "SUPPLIER_TOGGLE",
  /** Resets the settings to their defaults */
  RESTORE_DEFAULTS: "RESTORE_DEFAULTS",
} as const;

export type ActionType = (typeof ACTION_TYPE)[keyof typeof ACTION_TYPE];

/**
 * Discriminators for `chrome.runtime` messages exchanged between extension
 * contexts (pages) and the background service worker.
 * @source
 */
export const MESSAGE_TYPE = {
  /** Proxied fetch request handled by the background worker; see helpers/backgroundFetch.ts. */
  BACKGROUND_FETCH: "BACKGROUND_FETCH",
} as const;

export type MessageType = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];

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
export const APP_ACTION = {
  /** Applies new user settings and persists them to chrome.storage.local */
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
  /** Stores the fetched USD→currency conversion rate for the selected currency */
  SET_CURRENCY_RATE: "SET_CURRENCY_RATE",
  /** Switches the active panel (0 = SearchHome, 1 = Results, 2 = Stats) */
  SET_PANEL: "SET_PANEL",
  /** Toggles the SpeedDial FAB visibility based on mouse proximity */
  SET_SPEED_DIAL_VISIBILITY: "SET_SPEED_DIAL_VISIBILITY",
  /** Hydrates app state from chrome.storage on initial mount */
  LOAD_FROM_STORAGE: "LOAD_FROM_STORAGE",
  /** Re-hydrates user settings from an external storage change (no write-back) */
  HYDRATE_SETTINGS: "HYDRATE_SETTINGS",
  /** Opens a specific drawer tab or closes the drawer (tab = -1) */
  SET_DRAWER_TAB: "SET_DRAWER_TAB",
  /** Updates the selected suppliers list for search filtering */
  SET_SELECTED_SUPPLIERS: "SET_SELECTED_SUPPLIERS",
  /** Stores the ID of the ChemPal Favorites bookmarks folder */
  SET_BOOKMARKS_FOLDER_ID: "SET_BOOKMARKS_FOLDER_ID",
} as const;

export type AppActionType = (typeof APP_ACTION)[keyof typeof APP_ACTION];

/**
 * Keys used for storing and retrieving data in chrome.storage.session.
 * @source
 */
export const CACHE = {
  /** Application settings */
  USER_SETTINGS: "user_settings",
  /** The current query */
  QUERY: "query",
  /** The current search input text */
  SEARCH_INPUT: "search_input",
  /** Flag indicating a new search was submitted from the search home panel */
  SEARCH_IS_NEW_SEARCH: "is_new_search",
  /** Selected suppliers list for search filtering */
  SELECTED_SUPPLIERS: "selected_suppliers",
  /** HTTP LRU cache */
  HTTP_LRU: "httplru",
  /** The current panel (0 = SearchHome, 1 = Results, 2 = Stats) */
  PANEL: "panel",
  /** Persisted TanStack table state (sorting, pagination, expanded rows, column visibility) */
  TABLE_STATE: "table_state",
  /** ID of the ChemPal Favorites bookmarks folder */
  BOOKMARKS_FOLDER_ID: "bookmarks_folder_id",
  /** Rehydrated Chemsavers Typesense API key (overrides the hardcoded default when present) */
  CHEMSAVERS_API_KEY: "chemsavers_api_key",
  /** LabChem full product catalog snapshot, cached for 24h (empty-query search) */
  LABCHEM_CATALOG: "labchem_catalog",
  /** UI-owned update bookkeeping: GitHub poll throttle and per-version dismissal */
  UPDATE_CHECK: "update_check",
  /** Service-worker-owned: a Web Store update staged and awaiting a reload */
  UPDATE_PENDING: "update_pending",
  /** Last app version this profile has opened; drives the post-update what's-new prompt */
  LAST_SEEN_VERSION: "last_seen_version",
} as const;

export type Cache = (typeof CACHE)[keyof typeof CACHE];

/**
 * IndexedDB object-store names for the ChemPal database. Centralized here so the
 * store names aren't hardcoded across `idbCache.ts`. Values are snake_case to
 * match the {@link CACHE} storage-key convention.
 */
export const IDB_STORE = {
  /** Current search results (single row keyed `"current"`). */
  SEARCH_RESULTS: "search_results",
  /** Persisted search history entries. */
  SEARCH_HISTORY: "search_history",
  /** Supplier query-result cache. */
  SUPPLIER_QUERY_CACHE: "supplier_query_cache",
  /** Supplier product-detail cache. */
  SUPPLIER_PRODUCT_DATA_CACHE: "supplier_product_data_cache",
  /** Daily supplier HTTP stats. */
  SUPPLIER_STATS: "supplier_stats",
  /** User's excluded/ignored products (single row keyed `"current"`). */
  EXCLUDED_PRODUCTS: "excluded_products",
  /** Per-product/variant USD price history. */
  PRICE_HISTORY: "price_history",
  /** App metadata — single row keyed `"current"` recording the app version that last wrote/migrated the cache. */
  APP_META: "app_meta",
  /** Cached `.xlsx` result exports, keyed by a unique id, for the export-history list. */
  EXPORTS: "exports",
} as const;

export type IdbStore = (typeof IDB_STORE)[keyof typeof IDB_STORE];

/**
 * Represents the availability of a product
 * Keep values as lower case strings.
 * @source
 */
export const AVAILABILITY = {
  /** In stock and ready to ship */
  IN_STOCK: "in_stock",
  /** Available but in limited quantity (schema.org LimitedAvailability) */
  LIMITED_STOCK: "limited_stock",
  /** Currently out of stock */
  OUT_OF_STOCK: "out_of_stock",
  /** Not yet released; orderable ahead of availability */
  PRE_ORDER: "preorder",
  /** Offered for sale ahead of general availability (schema.org PreSale) */
  PRE_SALE: "pre_sale",
  /** Out of stock but orderable, shipping when restocked */
  BACKORDER: "backorder",
  /** Produced only once ordered (schema.org MadeToOrder) */
  MADE_TO_ORDER: "made_to_order",
  /** Sold out (schema.org SoldOut) */
  SOLD_OUT: "sold_out",
  /** Held/reserved and not currently purchasable (schema.org Reserved) */
  RESERVED: "reserved",
  /** Purchasable online only (schema.org OnlineOnly) */
  ONLINE_ONLY: "online_only",
  /** Purchasable in physical stores only (schema.org InStoreOnly) */
  IN_STORE_ONLY: "in_store_only",
  /** No longer sold */
  DISCONTINUED: "discontinued",
  /** Cannot be purchased (e.g. restricted or delisted) */
  UNAVAILABLE: "unavailable",
  /** Availability could not be determined */
  UNKNOWN: "unknown",
} as const;

export type Availability = (typeof AVAILABILITY)[keyof typeof AVAILABILITY];

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
export const UOM_LONG = {
  /** Full name for kilogram unit */
  KG: "kilogram",
  /** Full name for pound unit */
  LB: "pound",
  /** Full name for milliliter unit */
  ML: "milliliter",
  /** Full name for gram unit */
  G: "gram",
  /** Full name for liter unit */
  L: "liter",
  /** Full name for quart unit */
  QT: "quart",
  /** Full name for gallon unit */
  GAL: "gallon",
  /** Full name for ounce unit */
  OZ: "ounce",
  /** Full name for milligram unit */
  MG: "milligram",
  /** Full name for piece unit */
  PCS: "piece",
} as const;

export type UomLong = (typeof UOM_LONG)[keyof typeof UOM_LONG];

/**
 * Contains abbreviated forms of units of measurement
 * @source
 */
export const UOM = {
  /** Abbreviated form of kilogram */
  KG: "kg",
  /** Abbreviated form of pound */
  LB: "lb",
  /** Abbreviated form of milliliter */
  ML: "ml",
  /** Abbreviated form of gram */
  G: "g",
  /** Abbreviated form of liter */
  L: "l",
  /** Abbreviated form of quart */
  QT: "qt",
  /** Abbreviated form of gallon */
  GAL: "gal",
  /** Abbreviated form of ounce */
  OZ: "oz",
  /** Abbreviated form of fluid ounce */
  FLOZ: "floz",
  /** Abbreviated form of milligram */
  MG: "mg",
  /** Abbreviated form of piece */
  PCS: "pcs",
  /** Abbreviated form of each */
  EA: "ea",
} as const;

export type Uom = (typeof UOM)[keyof typeof UOM];

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
  [UOM.G]: ["grams", "g", "gm", "gram"],
  /** Liter aliases */
  [UOM.L]: ["liter", "liters", "litre", "litres", "l"],
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
 * Maps availability group codes (used as filter chip values and i18n keys) to the
 * {@link AVAILABILITY} enum values each group represents. A group may collapse
 * several enum values (e.g. `out_of_stock` covers OUT_OF_STOCK and BACKORDER).
 * @source
 */
export const AVAILABILITY_LABEL_MAP: Record<string, string[]> = {
  /** In-stock group; also covers online-only listings */
  in_stock: [AVAILABILITY.IN_STOCK, AVAILABILITY.ONLINE_ONLY],
  /** Limited-stock group */
  limited_stock: [AVAILABILITY.LIMITED_STOCK],
  /** Out-of-stock group; also covers backordered and sold-out items */
  out_of_stock: [AVAILABILITY.OUT_OF_STOCK, AVAILABILITY.BACKORDER, AVAILABILITY.SOLD_OUT],
  /** Pre-order group; also covers pre-sale and made-to-order items */
  preorder: [AVAILABILITY.PRE_ORDER, AVAILABILITY.PRE_SALE, AVAILABILITY.MADE_TO_ORDER],
  /** Unavailable group; also covers discontinued, reserved, and in-store-only items */
  unavailable: [
    AVAILABILITY.UNAVAILABLE,
    AVAILABILITY.DISCONTINUED,
    AVAILABILITY.RESERVED,
    AVAILABILITY.IN_STORE_ONLY,
  ],
};

/**
 * User-facing availability filter options for the drawer search panel.
 * Derived from the keys of {@link AVAILABILITY_LABEL_MAP}.
 * @source
 */
export const AVAILABILITY_OPTIONS = Object.keys(AVAILABILITY_LABEL_MAP);

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

/**
 * Type guard for whether a string is a valid {@link ShippingRange}.
 * @param value - The value to test.
 * @returns True when `value` is one of {@link SHIPPING_OPTIONS}.
 * @example
 * ```ts
 * isShippingRange("worldwide"); // => true
 * isShippingRange("mars"); // => false
 * ```
 * @source
 */
export function isShippingRange(value: string): value is ShippingRange {
  return SHIPPING_OPTIONS.some((option) => option === value);
}
