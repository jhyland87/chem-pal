/**
 * @group Constants
 * @groupDescription The column-drawer vocabulary — the widget kinds a column can
 * render as in the drawer accordion, where each one reads and writes in app state,
 * and the adornment sentinel. Split out of `constants/common.ts` because these are
 * consumed together, by the drawer and by the column definitions that configure it.
 * @source
 */

/**
 * Widget kinds a column's `meta.drawer` config can request. The value discriminates
 * the {@link ColumnDrawerConfig} union, so each one implies the runtime type of that
 * branch's `options` (e.g. {@link DRAWER_WIDGET.AUTOCOMPLETE_OBJECTS} needs
 * `{ code, label }[]`).
 * @category Constants
 * @source
 */
export const DRAWER_WIDGET = {
  /** Multi-select autocomplete over a list of plain strings. */
  AUTOCOMPLETE_STRINGS: 'autocompleteStrings',
  /** Multi-select autocomplete over `{ code, label }` options, e.g. countries. */
  AUTOCOMPLETE_OBJECTS: 'autocompleteObjects',
  /** A row of toggleable chips, one per option. */
  CHIPS: 'chips',
  /** Paired min/max numeric inputs. */
  NUMBER_RANGE: 'numberRange',
} as const;

/**
 * A {@link DRAWER_WIDGET} value.
 * @category Constants
 * @source
 */
export type DrawerWidget = (typeof DRAWER_WIDGET)[keyof typeof DRAWER_WIDGET];

/**
 * Where a drawer section's value reads and writes in app state. Discriminates the
 * {@link ColumnDrawerBinding} union, so `ColumnDrawerSection` can dispatch on it
 * without columns knowing how the context is structured.
 * @category Constants
 * @source
 */
export const DRAWER_BINDING = {
  /** A keyed slice of `searchFilters` (availability, country, shippingType). */
  SEARCH_FILTERS: 'searchFilters',
  /** The selected-suppliers list on the app context. */
  SELECTED_SUPPLIERS: 'selectedSuppliers',
  /** A min/max pair of `userSettings` keys, e.g. `priceMin`/`priceMax`. */
  USER_SETTINGS_RANGE: 'userSettingsRange',
} as const;

/**
 * A {@link DRAWER_BINDING} value.
 * @category Constants
 * @source
 */
export type DrawerBindingKind = (typeof DRAWER_BINDING)[keyof typeof DRAWER_BINDING];

/**
 * Sentinel values for a `numberRange` widget's `adornment`. Anything else is used
 * verbatim as the start-adornment text.
 * @category Constants
 * @source
 */
export const DRAWER_ADORNMENT = {
  /** Resolve the symbol at render time from `userSettings.currency` (USD → "$"). */
  CURRENCY: 'currency',
} as const;
