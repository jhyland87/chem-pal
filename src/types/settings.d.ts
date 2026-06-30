/**
 * Action types for the settings reducer used by SettingsPanel and SettingsPanelFull.
 */

import { ACTION_TYPE } from "@/constants/common";

export {};

declare global {
  type SettingAction =
    | { type: ACTION_TYPE.SWITCH_CHANGE; name: string; checked: boolean }
    | { type: ACTION_TYPE.INPUT_CHANGE; name: string; value: string }
    | { type: ACTION_TYPE.BUTTON_CLICK; name: string; value: string }
    | { type: ACTION_TYPE.RESTORE_DEFAULTS };

  /**
   * Application configuration settings that control various features and behaviors.
   * Used to store user preferences and feature flags.
   *
   * @example
   * ```typescript
   * const userSettings: UserSettings = {
   *   showHelp: true,
   *   caching: true,
   *   currency: "USD",
   *   location: "US",
   *   suppliers: ["supplier1", "supplier2"],
   *   theme: "light"
   * };
   * ```
   */
  interface UserSettings {
    /**
     * Controls visibility of help tooltips throughout the application.
     * Defaults to false.
     */
    showHelp?: boolean;

    /**
     * Enables or disables data caching functionality.
     * Defaults to true.
     */
    caching?: boolean;

    /**
     * When true, suppliers that return zero results for a query will not write
     * a cache entry for that query. Lets a previously-out-of-stock supplier
     * surface fresh results on the next search instead of returning the cached
     * empty list. Defaults to false.
     */
    doNotCacheEmptyResults?: boolean;

    /**
     * Maximum age of a query cache entry, in minutes. On read, entries older
     * than this are evicted and treated as a cache miss, forcing a fresh
     * fetch. Set to `0` (the default) to disable TTL expiration entirely —
     * entries then live until LRU eviction or version-mismatch eviction.
     * @example 60
     */
    cacheTtlMinutes?: number;

    /**
     * HTTP status codes that, when hit while fetching a product's detail/enrichment data,
     * prevent that product's data from being cached — so a later search retries it instead of
     * serving the incomplete cached entry. The product is still listed either way. Defaults to
     * `[429]` (Too Many Requests); set to an empty array to cache regardless of status. Not
     * exposed in the settings UI — configured via stored settings only.
     * @example [429, 503]
     */
    noCacheStatusCodes?: number[];

    /**
     * Overrides each supplier's per-class search-time budget (in milliseconds). Once a supplier's
     * search exceeds this, its outstanding detail requests are aborted and only the products
     * collected so far are shown. Leave unset to keep per-supplier defaults; set to `0` to disable
     * the limit entirely. Exposed in the Advanced settings section.
     * @example 60000
     */
    maxAllowableSearchTime?: number;

    /**
     * Currency rate for the user's currency
     * @example 1.0
     */
    currencyRate?: number;

    /**
     * Selected currency code for price display
     * @example "USD"
     */
    currency?: string;

    /**
     * User's geographical location (two-letter country code) for shipping
     * calculations. Kept in sync with `country` whenever it changes.
     * @example "US"
     */
    location?: string;

    /**
     * Full country name derived from `location` via `country-list-js`. Updated
     * automatically whenever `location` is set; suppliers that need a country
     * name (e.g. Ambeed's country cookie) read this rather than the code.
     * @example "United States"
     */
    country?: string;

    /**
     * Preferred language locale. Defaults to `chrome.i18n.getUILanguage()` on
     * first run. Used to pick the right-language document (e.g. Ambeed SDS
     * sheets).
     * @example "en-US"
     */
    language?: string;

    /**
     * Currency rate for the user's currency
     * @example 1.0
     */
    currencyRate?: number;

    /**
     * UI font size scale. Controls the root `html` font-size so every `rem`-based
     * style (MUI defaults and styled components) scales proportionally.
     * @example "medium"
     */
    fontSize?: "small" | "medium" | "large";

    /**
     * List of supplier IDs that are enabled for searching
     * @example ["supplier1", "supplier2"]
     */
    suppliers?: Array<string>;

    /**
     * Selected UI theme identifier
     * @example "light"
     */
    theme?: "light" | "dark";

    /**
     * Controls visibility of all available table columns.
     * Defaults to true.
     */
    showAllColumns?: boolean;

    /**
     * List of column identifiers that should be hidden from view
     * @example ["price", "quantity"]
     */
    hideColumns?: Array<string>;

    /**
     * Controls visibility of column filter UI elements.
     * Defaults to false.
     */
    showColumnFilters?: boolean;

    /**
     * Configuration object for individual column filter settings.
     * @example
     * ```typescript
     * {
     *   price: {
     *     filterVariant: "range",
     *     rangeValues: [0, 1000]
     *   }
     * }
     * ```
     */
    columnFilterConfig?: Record<string, ColumnMeta>;

    /**
     * Number of results to display per supplier
     * @example 20
     */
    supplierResultLimit?: number | undefined;

    /**
     * Minimum price (in the user's selected currency) to include in results.
     * Applied by `useSearch.passesSearchFilters` after suppliers return.
     * Undefined disables the lower bound.
     * @example 0
     */
    priceMin?: number;

    /**
     * Maximum price (in the user's selected currency) to include in results.
     * Applied by `useSearch.passesSearchFilters` after suppliers return.
     * Undefined disables the upper bound.
     * @example 100
     */
    priceMax?: number;

    /**
     * Optional global override for the fuzz-match scorer used by each supplier.
     * When set, `fuzzyFilter` uses this scorer instead of each supplier class's
     * default `fuzzScorer`. Value is the exported function name from `fuzzball`
     * (e.g. `"ratio"`, `"token_set_ratio"`, `"WRatio"`).
     *
     * Surfaced via the "Advanced" drawer accordion — hidden unless
     * `showAdvancedSettings` is true in `config.json`.
     * @example "token_set_ratio"
     */
    fuzzScorerOverride?: string;

    /**
     * When true, suppliers skip fuzzball fuzzy-match scoring. A plain query then
     * shows the raw results the supplier returned; an advanced (AND/OR/NOT) query
     * is filtered only by the boolean predicate using case-insensitive substring
     * matching. Leave unset/false to keep fuzzy filtering on (the default).
     *
     * Surfaced via the "Advanced" drawer accordion, beside the fuzz-scorer override.
     * @example true
     */
    fuzzyFilteringDisabled?: boolean;
  }
}
