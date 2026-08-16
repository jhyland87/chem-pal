import { onSearchEvent, SearchEvent } from '@/events/searchEvents';
import { trackEvent } from '@/helpers/analytics';
import { useEffect } from 'react';

/**
 * Subscribes to the search-lifecycle event bus and forwards it to PostHog, keeping
 * analytics out of the search hook itself (the producers stay decoupled from
 * consumers). Mirrors the `useBadgeController` hook.
 *
 * - `SearchEvent.STARTED` → `search_query` (with the search term)
 * - `SearchEvent.COMPLETED` → `search_results` (with the final result count)
 *
 * Aborted/failed searches are intentionally not reported. Mount once, near the
 * app root.
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
    // Remember the most recent started query so COMPLETED (which carries only the
    // count) can attach the term to its event.
    let lastQuery = '';
    const unsubscribers = [
      onSearchEvent(SearchEvent.STARTED, ({ query }) => {
        lastQuery = query.trim();
        void trackEvent('search_query', { search_term: lastQuery });
      }),
      onSearchEvent(SearchEvent.COMPLETED, ({ count }) => {
        void trackEvent('search_results', { search_term: lastQuery, result_count: count });
      }),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, []);
}
