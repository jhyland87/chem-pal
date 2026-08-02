/**
 * Action types for the settings reducer used by SettingsPanel.
 */

import { ACTION_TYPE } from '@/constants/common';

export {};

declare global {
  /** Price-history tracking config: whether it's on and how many points to keep. */
  type PriceTracking = {
    /** Master switch; tracking is on unless explicitly `false`. */
    enabled?: boolean;
    /** Max points retained per series; `0` means unlimited. */
    maxDataPoints?: number;
  };

  /** Query-cache config: whether caching is on, empty-result handling, and TTL. */
  type CacheSettings = {
    /** Master switch; caching is on unless explicitly `false`. */
    enabled?: boolean;
    /** When `true`, zero-result queries are not cached. */
    doNotCacheEmptyResults?: boolean;
    /** Max age of a cache entry in minutes; `0` disables TTL expiration. */
    ttlMinutes?: number;
  };

  /** Supplier selection and limits config. */
  type SupplierSettings = {
    /** Enabled supplier class names; empty means all suppliers. */
    enabled?: Array<SupplierClassName>;
    /** Supplier class names the user has disabled (deny-list). */
    disabled?: Array<SupplierClassName>;
    /** When `true` (the default), exclude suppliers that don't ship to the user's location. */
    excludeNonShipping?: boolean;
    /** Max results to request per supplier. */
    resultLimit?: number;
  };

  type SettingAction =
    | { type: typeof ACTION_TYPE.SWITCH_CHANGE; name: string; checked: boolean }
    | { type: typeof ACTION_TYPE.INPUT_CHANGE; name: string; value: string }
    | { type: typeof ACTION_TYPE.BUTTON_CLICK; name: string; value: string }
    | { type: typeof ACTION_TYPE.SUPPLIER_TOGGLE; value: Array<SupplierClassName> }
    | { type: typeof ACTION_TYPE.PRICE_TRACKING_CHANGE; value: PriceTracking }
    | { type: typeof ACTION_TYPE.CACHE_CHANGE; value: CacheSettings }
    | { type: typeof ACTION_TYPE.RESTORE_DEFAULTS };

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
     * Query-cache configuration, grouping the master switch, empty-result
     * handling, and TTL. When `enabled` (the default), supplier query results are
     * cached; `doNotCacheEmptyResults` skips caching zero-result queries so a
     * previously-out-of-stock supplier can surface fresh results next time;
     * `ttlMinutes` evicts entries older than the given age on read (`0` disables
     * TTL expiration, leaving entries to LRU/version eviction). Defaults to
     * `{ enabled: true, doNotCacheEmptyResults: true, ttlMinutes: 7200 }`.
     * @example
     * ```ts
     * const caching = { enabled: true, doNotCacheEmptyResults: true, ttlMinutes: 7200 };
     * ```
     */
    caching?: CacheSettings;

    /**
     * Price-history tracking, grouping the master switch and the retention cap.
     * When `enabled` (the default), each search records every product's and
     * variant's standardized USD price into the `priceHistory` IndexedDB store,
     * appending a point only when the price changes — letting users see whether a
     * product got cheaper or more expensive since they last checked. `maxDataPoints`
     * bounds each series (oldest points dropped past the cap); `0` means unlimited.
     * Defaults to `{ enabled: true, maxDataPoints: 5 }`. Independent of `caching`.
     * @example
     * ```ts
     * const priceTracking = { enabled: true, maxDataPoints: 5 };
     * ```
     */
    priceTracking?: PriceTracking;

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
     * Overrides each supplier's per-class search-time budget (in seconds). Once a supplier's
     * search exceeds this, its outstanding detail requests are aborted and only the products
     * collected so far are shown. Leave unset to use the config default
     * (`search.supplierSearchTimeBudgetSec`); set to `0` to disable the limit entirely. Exposed in
     * the Advanced settings section.
     * @example 60
     */
    supplierSearchTimeBudgetSec?: number;

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
     * UI font size scale. Controls the root `html` font-size so every `rem`-based
     * style (MUI defaults and styled components) scales proportionally.
     * @example "medium"
     */
    fontSize?: 'small' | 'medium' | 'large';

    /**
     * When true, clicking the toolbar icon opens ChemPal in a full browser tab
     * (`index.html?view=tab`) instead of the popup. The service worker enforces
     * this by clearing the action popup (`chrome.action.setPopup`) and handling
     * `chrome.action.onClicked` to open/focus the tab. Defaults to false (popup).
     * @example true
     */
    openInTab?: boolean;

    /**
     * When true (the default), the results table auto-hides hideable columns that
     * have no data in the current result set (across all rows and variants), and
     * restores them once a later search populates them. Set to false to keep every
     * column visible regardless of whether it has data.
     * @example true
     */
    autoHideEmptyColumns?: boolean;

    /**
     * When true (the default), a product's variants are grouped under its single
     * results-table row and surfaced in the expanded detail panel. Set to false to
     * give each variant its own top-level row, so the table's column sorting and
     * filtering (price, quantity, unit price) apply across every variant rather
     * than only the primary one.
     * @example true
     */
    groupProductVariants?: boolean;

    /**
     * When true (the default), ChemPal sends anonymous usage and error statistics
     * (searches, result counts, render errors) to Google Analytics to help guide
     * improvements. Set to false to opt out; nothing is then sent to analytics.
     * @example true
     */
    shareUsageData?: boolean;

    /**
     * Supplier selection and limits, grouping the enabled list, the disabled
     * deny-list, the ship-to filter, and the per-supplier result cap. `enabled`
     * empty means all suppliers; `disabled` names are excluded from every search
     * and hidden from the filter menu; `excludeNonShipping` (default `true`) drops
     * suppliers that don't ship to the user's `location`; `resultLimit` caps
     * results requested per supplier.
     * @example
     * ```ts
     * const suppliers = { enabled: [], disabled: [], excludeNonShipping: true, resultLimit: 5 };
     * ```
     */
    suppliers?: SupplierSettings;

    /**
     * When true (the default), searches hide products the user cannot buy — either
     * because the product is not shipped to the user's `location`, or because it is
     * restricted to business/government/professional buyers. Toggled via the checkbox
     * under Suppliers in the search drawer. Restrictions are parsed per-product from
     * the supplier's product text.
     * @example true
     */
    hideRestrictedProducts?: boolean;

    /**
     * Selected UI theme identifier
     * @example "light"
     */
    theme?: 'light' | 'dark';

    /**
     * List of column identifiers that should be hidden from view
     * @example ["price", "quantity"]
     */
    hideColumns?: Array<string>;

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
