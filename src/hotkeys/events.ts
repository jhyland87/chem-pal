/**
 * Custom DOM event names used to bridge global hotkey handlers in `App.tsx`
 * to components that own the relevant local state (e.g. `ResultsTable`).
 *
 * We use `window`-dispatched `CustomEvent`s rather than lifting state into
 * context so the hotkey layer stays decoupled from the component tree —
 * the listener only has to exist while the target component is mounted.
 * @source
 */

/** Focus the "Filter results..." text input in the results table. */
export const FOCUS_GLOBAL_FILTER_EVENT = "chempal:focus-global-filter";

/** Toggle the per-column filter row in the results table. */
export const TOGGLE_COLUMN_FILTERS_EVENT = "chempal:toggle-column-filters";

/** Abort the currently-running search (same effect as the stop button). */
export const ABORT_SEARCH_EVENT = "chempal:abort-search";
