import { CACHE, PANEL } from '@/constants/common';

/**
 * Decides which panel the app should land on when the popup/tab opens, given the
 * restored session data and the number of cached search results. A queued
 * context-menu search always wins (land on Results so it can execute); otherwise
 * cached results open the Results table, and an empty cache falls back to the
 * search home. A previously-saved Stats selection is deliberately never honored
 * — that panel only renders in the session-only advanced mode, which is always
 * off at mount, so restoring it would strand the user on a blank panel.
 * @param sessionData - The restored `cstorage.session` values (`CACHE.QUERY`, `CACHE.SEARCH_IS_NEW_SEARCH`).
 * @param resultCount - The number of cached search results (from IndexedDB).
 * @returns The panel to activate on open.
 * @category Utils
 * @group State
 * @example
 * ```ts
 * resolveInitialPanel({ is_new_search: true, query: 'acetone' }, 0); // PANEL.RESULTS
 * resolveInitialPanel({}, 5);                                        // PANEL.RESULTS
 * resolveInitialPanel({}, 0);                                        // PANEL.SEARCH_HOME
 * ```
 * @source
 */
export function resolveInitialPanel(
  sessionData: Record<string, unknown>,
  resultCount: number,
): PANEL {
  const query = sessionData[CACHE.QUERY];
  const hasPendingSearch = Boolean(
    sessionData[CACHE.SEARCH_IS_NEW_SEARCH] && typeof query === 'string' && query.trim(),
  );

  if (hasPendingSearch) return PANEL.RESULTS;
  return resultCount > 0 ? PANEL.RESULTS : PANEL.SEARCH_HOME;
}
