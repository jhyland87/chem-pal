/**
 * Typed search-lifecycle events, dispatched on `window` as `CustomEvent`s.
 *
 * Mirrors the pattern in {@link "../hotkeys/events"} — we use `window`-dispatched
 * events rather than lifting state into context so producers (the search hook,
 * the results table, the popup load path) stay decoupled from consumers. The
 * sole consumer today is the badge controller ({@link "../utils/badgeController"}),
 * but these are general-purpose: history, analytics, or telemetry could subscribe
 * later without touching the producers.
 *
 * {@link emitSearchEvent} / {@link onSearchEvent} are thin typed wrappers over
 * `dispatchEvent`/`addEventListener` so payloads are checked at the call site
 * (no new dependency, unlike a dedicated emitter library).
 *
 * @category Events
 * @source
 */

/**
 * Search-lifecycle event names. The string values are the actual `CustomEvent`
 * types dispatched on `window` (kept in the `chempal:` namespace, matching the
 * hotkey events). Use the enum member everywhere — never the raw string.
 * @source
 */
export enum SearchEvent {
  /** A search has started; the loading animation should begin. */
  STARTED = "chempal:search-started",
  /** The current visible/filtered result count changed (streaming, filtering, exclusion). */
  RESULTS_COUNT = "chempal:search-results-count",
  /** A search finished (successfully or with zero results). */
  COMPLETED = "chempal:search-completed",
  /** A search was aborted by the user. */
  ABORTED = "chempal:search-aborted",
  /** A search failed with an error. */
  FAILED = "chempal:search-failed",
}

/**
 * Maps each {@link SearchEvent} to the shape of its `CustomEvent.detail`.
 * `undefined` means the event carries no payload.
 */
export interface SearchEventDetailMap {
  [SearchEvent.STARTED]: { query: string };
  [SearchEvent.RESULTS_COUNT]: { count: number };
  [SearchEvent.COMPLETED]: { count: number };
  [SearchEvent.ABORTED]: Maybe<{ reason?: string }>;
  [SearchEvent.FAILED]: { error?: string };
}

/** Union of all search-event names (equivalent to {@link SearchEvent}). */
export type SearchEventType = keyof SearchEventDetailMap;

/**
 * Dispatch a search-lifecycle event on `window` with a typed payload.
 * @param type - The event ({@link SearchEvent} member).
 * @param detail - The payload matching {@link SearchEventDetailMap} for `type`.
 * @example
 * ```ts
 * emitSearchEvent(SearchEvent.STARTED, { query: "acetone" });
 * emitSearchEvent(SearchEvent.RESULTS_COUNT, { count: 12 });
 * emitSearchEvent(SearchEvent.ABORTED, { reason: "Request was aborted" });
 * emitSearchEvent(SearchEvent.ABORTED); // No reason provided
 * ```
 * @source
 */
export function emitSearchEvent<K extends SearchEventType>(
  type: K,
  ...[detail]: SearchEventDetailMap[K] extends undefined ? [] : [SearchEventDetailMap[K]]
): void {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

/**
 * Subscribe to a search-lifecycle event. Returns an unsubscribe function, so it
 * drops straight into a `useEffect` cleanup.
 * @param type - The event ({@link SearchEvent} member).
 * @param handler - Receives the typed `detail` for `type`.
 * @returns A function that removes the listener.
 * @example
 * ```ts
 * useEffect(() => onSearchEvent(SearchEvent.COMPLETED, ({ count }) => {
 *   console.log("done", count);
 * }), []);
 * ```
 * @source
 */
export function onSearchEvent<K extends SearchEventType>(
  type: K,
  handler: (detail: SearchEventDetailMap[K]) => void,
): () => void {
  const listener = (event: Event) => {
    // DOM `addEventListener` types the callback arg as `Event`; this event is
    // only ever dispatched via `emitSearchEvent` as a `CustomEvent` with the
    // matching `detail`, so narrowing to `CustomEvent` is safe.
    handler((event as CustomEvent<SearchEventDetailMap[K]>).detail);
  };
  window.addEventListener(type, listener);
  return () => window.removeEventListener(type, listener);
}
