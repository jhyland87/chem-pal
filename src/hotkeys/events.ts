/**
 * Custom DOM event names used to bridge global hotkey handlers in `App.tsx`
 * to components that own the relevant local state (e.g. `ResultsTable`).
 *
 * We use `window`-dispatched `CustomEvent`s rather than lifting state into
 * context so the hotkey layer stays decoupled from the component tree —
 * the listener only has to exist while the target component is mounted.
 * @source
 */
export enum HotkeyEvent {
  /** Focus the "Filter results..." text input in the results table. */
  FOCUS_GLOBAL_FILTER = 'chempal:focus-global-filter',
  /** Toggle the per-column filter row in the results table. */
  TOGGLE_COLUMN_FILTERS = 'chempal:toggle-column-filters',
  /** Abort the currently-running search (same effect as the stop button). */
  ABORT_SEARCH = 'chempal:abort-search',
  /** Expand every expandable row in the results table. */
  EXPAND_ALL_ROWS = 'chempal:expand-all-rows',
  /** Collapse every expanded row in the results table. */
  COLLAPSE_ALL_ROWS = 'chempal:collapse-all-rows',
  /** Scroll the results table back to the top. */
  SCROLL_RESULTS_TO_TOP = 'chempal:scroll-results-to-top',
  /** Show every result row on one page (disable pagination). */
  SHOW_ALL_ROWS = 'chempal:show-all-rows',
  /** Clear all per-column filters in the results table. */
  CLEAR_COLUMN_FILTERS = 'chempal:clear-column-filters',
}
