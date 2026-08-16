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

  /** Supplier deny-list and limits config. */
  type SupplierSettings = {
    /** Supplier class names the user has disabled (deny-list). */
    disabled?: Array<SupplierClassName>;
    /** When `true` (the default), exclude suppliers that don't ship to the user's location. */
    excludeNonShipping?: boolean;
    /** Max results to request per supplier. */
    resultLimit?: number;
  };

  /** Search behavior config: variant grouping and restricted-product filtering. */
  type SearchSettings = {
    /** When `true` (the default), group a product's variants under one results row. */
    groupProductVariants?: boolean;
    /** When `true` (the default), hide products the user cannot buy (shipping or restricted). */
    hideRestrictedProducts?: boolean;
  };

  /** Results-table display config: empty-column auto-hiding and default-hidden columns. */
  type ResultsSettings = {
    /** When `true` (the default), auto-hide columns with no data in the current result set. */
    autoHideEmpty?: boolean;
    /** Column ids hidden from the results table by default. */
    hidden?: Array<string>;
  };

  /** UI presentation config: theme, font scale, and toolbar-icon behavior. */
  type DisplaySettings = {
    /** Selected UI theme. */
    theme?: 'light' | 'dark';
    /** UI font-size scale; drives the root `html` font-size. */
    fontSize?: 'small' | 'medium' | 'large';
    /** When `true`, the toolbar icon opens the full-tab view instead of the popup. */
    openInTab?: boolean;
  };

  /** The nested settings groups a `NESTED_*` reducer action can target. */
  type SettingGroup = 'search' | 'results' | 'display';

  type SettingAction =
    | { type: typeof ACTION_TYPE.SWITCH_CHANGE; name: string; checked: boolean }
    | {
        type: typeof ACTION_TYPE.NESTED_SWITCH_CHANGE;
        group: SettingGroup;
        name: string;
        checked: boolean;
      }
    | { type: typeof ACTION_TYPE.NESTED_BUTTON_CLICK; group: SettingGroup; name: string; value: string }
    | { type: typeof ACTION_TYPE.INPUT_CHANGE; name: string; value: string }
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
     * UI presentation, grouping the theme, font-size scale, and toolbar-icon
     * behavior. `theme` selects light/dark; `fontSize` controls the root `html`
     * font-size so every `rem`-based style scales proportionally; `openInTab` (default
     * `false`) makes the toolbar icon open the full-tab view instead of the popup —
     * the service worker enforces it by clearing the action popup
     * (`chrome.action.setPopup`) and handling `chrome.action.onClicked`.
     * @example
     * ```ts
     * const display = { theme: 'light', fontSize: 'medium', openInTab: false };
     * ```
     */
    display?: DisplaySettings;

    /**
     * Search behavior, grouping variant handling and restricted-product filtering.
     * `groupProductVariants` (default `true`) groups a product's variants under its
     * single results-table row (off gives each variant its own row so sorting and
     * filtering apply across all variants); `hideRestrictedProducts` (default `true`)
     * hides products the user cannot buy — not shipped to their `location`, or
     * restricted to business/government/professional buyers.
     * @example
     * ```ts
     * const search = { groupProductVariants: true, hideRestrictedProducts: true };
     * ```
     */
    search?: SearchSettings;

    /**
     * Results-table display config. `autoHideEmpty` (default `true`) auto-hides
     * hideable columns with no data in the current result set (across all rows and
     * variants) and restores them once a later search populates them; `hidden` lists
     * the column ids hidden by default.
     * @example
     * ```ts
     * const results = { autoHideEmpty: true, hidden: ['cas', 'formula'] };
     * ```
     */
    results?: ResultsSettings;

    /**
     * When true (the default), ChemPal sends anonymous usage and error statistics
     * (searches, result counts, render errors) to PostHog, an independent
     * analytics provider, to help guide improvements. Set to false to opt out;
     * nothing is then sent to analytics.
     * @example true
     */
    shareUsageData?: boolean;

    /**
     * Supplier deny-list and limits. `disabled` names are excluded from every
     * search and hidden from the filter menu; `excludeNonShipping` (default `true`)
     * drops suppliers that don't ship to the user's `location`; `resultLimit` caps
     * results requested per supplier. (The live "which suppliers to search"
     * selection is session-scoped, not stored here.)
     * @example
     * ```ts
     * const suppliers = { disabled: [], excludeNonShipping: true, resultLimit: 5 };
     * ```
     */
    suppliers?: SupplierSettings;

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
