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
     * Enables or disables search autocomplete suggestions.
     * Defaults to true.
     */
    autocomplete?: boolean;

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
     * User's geographical location for shipping calculations
     * @example "US"
     */
    location?: string;

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
     * Auto-resize the popup window so more results are visible when the
     * search returns many products. Surfaced as a toggle in the "Display"
     * settings accordion.
     * @example true
     */
    autoResize?: boolean;

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
  }
}
