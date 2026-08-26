import { onSearchEvent, SearchEvent, type SearchOutcomeDetail } from '@/events/searchEvents';
import { trackEvent } from '@/helpers/analytics';
import { useEffect } from 'react';

/**
 * PostHog properties describing how a search run turned out, derived from a
 * terminal search event's {@link SearchOutcomeDetail}.
 * @param outcome - The terminal event's outcome detail.
 * @param searchTerm - The term the search was started with.
 * @returns Non-PII event properties, ready for {@link trackEvent}.
 * @example
 * ```ts
 * outcomeParams({ count: 3, durationMs: 1240, suppliersQueried: 8, suppliersCompleted: 2 }, "acetone");
 * // => { search_term: "acetone", result_count: 3, duration_ms: 1240,
 * //      suppliers_queried: 8, suppliers_completed: 2 }
 * ```
 * @source
 */
function outcomeParams(
  outcome: SearchOutcomeDetail,
  searchTerm: string,
): Record<string, string | number> {
  return {
    search_term: searchTerm,
    result_count: outcome.count,
    duration_ms: outcome.durationMs,
    suppliers_queried: outcome.suppliersQueried,
    suppliers_completed: outcome.suppliersCompleted,
  };
}

/**
 * Subscribes to the search-lifecycle event bus and forwards it to PostHog, keeping
 * analytics out of the search hook itself (the producers stay decoupled from
 * consumers). Mirrors the `useBadgeController` hook.
 *
 * - `SearchEvent.STARTED` → `search_query` (with the search term)
 * - `SearchEvent.COMPLETED` → `search_results`, or `search_terminated` when the
 *   stream only drained because the search was aborted
 * - `SearchEvent.ABORTED` / `SearchEvent.FAILED` → `search_terminated`
 *
 * A search that ended early reports `search_terminated` *instead of*
 * `search_results`, so the duration and result-count distributions on
 * `search_results` describe complete runs only. Mount once, near the app root.
 * @returns Nothing.
 * @example
 * ```tsx
 * function App() {
 *   useSearchAnalytics();
 *   // ...
 * }
 * ```
 * @source
 */
export function useSearchAnalytics(): void {
  useEffect(() => {
    // Remember the most recent started query so the terminal events (which carry
    // only the outcome) can attach the term to their event.
    let lastQuery = '';
    const unsubscribers = [
      onSearchEvent(SearchEvent.STARTED, ({ query }) => {
        lastQuery = query.trim();
        void trackEvent('search_query', { search_term: lastQuery });
      }),
      onSearchEvent(SearchEvent.COMPLETED, ({ abortReason, ...outcome }) => {
        const params = outcomeParams(outcome, lastQuery);
        if (abortReason === undefined) {
          void trackEvent('search_results', params);
          return;
        }
        void trackEvent('search_terminated', { ...params, reason: abortReason });
      }),
      onSearchEvent(SearchEvent.ABORTED, ({ reason, ...outcome }) => {
        void trackEvent('search_terminated', {
          ...outcomeParams(outcome, lastQuery),
          reason: reason ?? 'unknown',
        });
      }),
      onSearchEvent(SearchEvent.FAILED, ({ error, ...outcome }) => {
        void trackEvent('search_terminated', {
          ...outcomeParams(outcome, lastQuery),
          reason: 'error',
          ...(error ? { error_message: error } : {}),
        });
      }),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, []);
}
