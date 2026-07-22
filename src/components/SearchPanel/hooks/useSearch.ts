import { getColumnFilterConfig } from "@/components/SearchPanel/TableColumns";
import { AVAILABILITY_LABEL_MAP, CACHE } from "@/constants/common";
import { useAppContext } from "@/context";
import { SearchEvent, emitSearchEvent } from "@/events/searchEvents";
import { addExcludedProduct } from "@/helpers/excludedProducts";
import { i18n } from "@/helpers/i18n";
import { recordProductPrices } from "@/helpers/priceHistory";
import { dedupeProducts, getProductDedupeKey } from "@/helpers/productIdentity";
import { suggestAlternativeSearch } from "@/helpers/pubchem";
import { HotkeyEvent } from "@/hotkeys";
import { SupplierFactory } from "@/suppliers/SupplierFactory";
import {
  IDB_SEARCH_RESULTS_CLEARED,
  addSearchHistoryEntry,
  clearSearchResults,
  getSearchHistory,
  getSearchResultsRecord,
  setSearchResults as idbSetSearchResults,
  updateSearchHistoryResultCount as idbUpdateHistoryResultCount,
} from "@/utils/idbCache";
import { Logger } from "@/utils/Logger";
import { cstorage } from "@/utils/storage";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";

const logger = new Logger("useSearch");

interface SearchState {
  isLoading: boolean;
  // True between the user requesting an abort and the in-flight requests
  // finishing draining. The overlay stays up (showing "Aborting...") until
  // the search settles and isLoading flips to false.
  isAborting: boolean;
  status: string | boolean;
  error?: string;
  resultCount: number;
}

type ColumnFilterConfig = Record<string, { filterVariant: string; filterData: unknown[] }>;

/**
 * Mutates the column filter config based on a single product result.
 * For "range" variants, tracks min/max; for "select"/"text" variants, tracks
 * unique values seen. Intentionally mutates the config in-place so callers can
 * build it up incrementally as results stream in.
 *
 * NOTE: preserves existing (possibly buggy) range logic — see original code.
 */
export function updateColumnFilterFromResult(config: ColumnFilterConfig, result: Product): void {
  for (const [columnName, columnValue] of Object.entries(result)) {
    if (columnName in config === false) continue;
    const column = config[columnName];

    if (column.filterVariant === "range") {
      if (typeof columnValue !== "number") continue;
      if (typeof column.filterData[0] !== "number" || columnValue < column.filterData[0]) {
        column.filterData[0] = columnValue;
      } else if (typeof column.filterData[1] !== "number" || columnValue < column.filterData[1]) {
        column.filterData[1] = columnValue;
      }
    } else if (column.filterVariant === "select" || column.filterVariant === "text") {
      if (!column.filterData.includes(columnValue)) {
        column.filterData.push(columnValue);
      }
    }
  }
}

/**
 * Persists search results (and the query that produced them) to IndexedDB,
 * logging (but not throwing on) errors.
 * @param results - The products to persist.
 * @param query - The originating search query, stored alongside the results so the
 * header label survives a session-storage loss. Omit when re-persisting without a
 * query context.
 * @returns A promise that resolves once the write settles (or is swallowed on error).
 * @example
 * ```ts
 * await saveResultsToSession(finalResults, "acetone");
 * ```
 * @source
 */
export async function saveResultsToSession(results: Product[], query?: string): Promise<void> {
  try {
    await idbSetSearchResults(results, query);
  } catch (error) {
    logger.warn("Failed to save search results to IndexedDB:", { error });
  }
}

/**
 * Creates an initial search history entry in cstorage.local with a placeholder
 * result count of 0. The count will be updated later via `updateHistoryResultCount`
 * as results stream in. Keeps the most recent 100 entries.
 */
export async function createInitialHistoryEntry(
  query: string,
  timestamp: number,
  filters: SearchFilters,
  selectedSuppliers: SupplierClassName[],
): Promise<void> {
  try {
    await addSearchHistoryEntry({
      query,
      timestamp,
      resultCount: 0,
      type: "search",
      filters: { ...filters },
      selectedSuppliers: [...selectedSuppliers],
    });
  } catch (error) {
    logger.warn("Failed to save search history:", { error });
  }
}

/**
 * Updates the result count on an existing history entry identified by its timestamp.
 * Called as results stream in (live count) and again when the search completes (final count).
 */
export async function updateHistoryResultCount(timestamp: number, count: number): Promise<void> {
  try {
    await idbUpdateHistoryResultCount(timestamp, count);
  } catch (error) {
    logger.warn("Failed to update search history result count:", { error });
  }
}

/**
 * Collects the set of past queries that returned zero results, lowercased. Used to avoid
 * suggesting an alternative name the user has already tried unsuccessfully (which would
 * otherwise create A→B→A suggestion loops between synonyms of the same compound).
 */
async function getZeroResultQueries(): Promise<Set<string>> {
  const failed = new Set<string>();
  try {
    const history = await getSearchHistory();
    for (const entry of history) {
      if (entry.type === "search" && entry.resultCount === 0 && entry.query) {
        failed.add(entry.query.toLowerCase());
      }
    }
  } catch (error) {
    logger.warn("Failed to load search history for suggestions:", { error });
  }
  return failed;
}

/**
 * Builds the "no results found" message for the results table, optionally suggesting
 * broader filters or a simpler PubChem alternative name (falling back to a CAS number).
 * Only simple common names are suggested, and never one that previously returned no results.
 */
export async function buildNoResultsMessage(
  query: string,
  filtersActive: boolean,
): Promise<string> {
  const lines = [i18n("search_no_results_for", [query])];

  if (filtersActive) {
    lines.push(i18n("search_try_broaden"));
  }

  try {
    const excluded = await getZeroResultQueries();
    const { name, cas } = await suggestAlternativeSearch(query, excluded);
    if (name) {
      lines.push(i18n("search_suggest_name", [name]));
    } else if (cas) {
      lines.push(i18n("search_suggest_cas", [cas]));
    }
  } catch (error) {
    logger.warn("Failed to build alternative search suggestion:", { error });
  }

  return lines.join("\n");
}

/**
 * Checks whether a product passes the pre-search filters set via the drawer.
 * Returns true if the product should be included in the results.
 */
function passesSearchFilters(
  product: Product,
  filters: SearchFilters,
  userSettings: UserSettings,
): boolean {
  // Availability filter
  if (filters.availability.length > 0) {
    const allowedStatuses = filters.availability.flatMap(
      (label) => AVAILABILITY_LABEL_MAP[label] ?? [],
    );
    const productAvailability = (
      product.variants?.[0]?.availability ??
      product.variants?.[0]?.status ??
      product.variants?.[0]?.statusTxt ??
      ""
    ).toLowerCase();

    if (productAvailability && !allowedStatuses.includes(productAvailability)) {
      return false;
    }
  }

  // Country filter
  if (filters.country.length > 0 && product.supplierCountry) {
    if (!filters.country.includes(product.supplierCountry)) {
      return false;
    }
  }

  // Shipping type filter
  if (filters.shippingType.length > 0 && product.supplierShipping) {
    if (!filters.shippingType.includes(product.supplierShipping)) {
      return false;
    }
  }

  // Price range filter
  if (userSettings.priceMin != null && product.price < userSettings.priceMin) {
    return false;
  }
  if (userSettings.priceMax != null && product.price > userSettings.priceMax) {
    return false;
  }

  return true;
}

/**
 * Applies the per-supplier result limit after filtering.
 * Groups products by supplier and takes the first N from each.
 */
function applyPerSupplierLimit(products: Product[], limit: number): Product[] {
  const supplierCounts: Partial<Record<SupplierClassName, number>> = {};
  return products.filter((product) => {
    if (!SupplierFactory.isSupplierClassName(product.supplier)) return false;
    const supplier = product.supplier as SupplierClassName;
    supplierCounts[supplier] = (supplierCounts[supplier] ?? 0) + 1;
    return supplierCounts[supplier] <= limit;
  });
}

/**
 * Determines whether any pre-search filters are active.
 */
function hasActiveFilters(filters: SearchFilters, userSettings: UserSettings): boolean {
  return (
    filters.availability.length > 0 ||
    filters.country.length > 0 ||
    filters.shippingType.length > 0 ||
    userSettings.priceMin != null ||
    userSettings.priceMax != null
  );
}

/**
 * React v19 enhanced search hook that maintains streaming behavior.
 *
 * This version preserves the original streaming approach where results appear
 * in the table as they're found, with live counter updates, AND restores
 * session persistence so results are maintained across page reloads.
 *
 * When pre-search filters are active (set via the drawer), the hook:
 * 1. Fetches results with a higher limit to account for filtering
 * 2. Applies drawer filters (availability, country, shipping, price)
 * 3. Applies the per-supplier limit on the filtered set
 * @source
 */
export function useSearch() {
  const appContext = useAppContext();
  const fetchControllerRef = useRef<AbortController>(new AbortController());
  // Guard to prevent the mount useEffect from triggering duplicate searches
  // when dependencies change (e.g. suppliers array getting a new reference
  // after LOAD_FROM_STORAGE dispatches in App.tsx).
  const isSearchInitiatedRef = useRef<boolean>(false);
  // Normalized query currently executing. Prevents a single submission from
  // running twice when both trigger paths fire (the useSearch mount effect and
  // App.tsx's session-storage listener → executeSearch) — and StrictMode double
  // invokes. Cleared when the search settles so a later re-search of the same
  // term still runs.
  const inFlightQueryRef = useRef<string | null>(null);

  const initialState: SearchState = {
    isLoading: false,
    isAborting: false,
    status: false,
    error: undefined,
    resultCount: 0,
  };

  const [state, setState] = useState<SearchState>(initialState);
  const [tableText, setTableText] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  // The query string of the most recently executed search. Displayed in the
  // results panel header so the user can see what they searched for.
  const [executedQuery, setExecutedQuery] = useState<string>("");

  // Guard to ensure session storage is only loaded once, even under StrictMode's
  // double-invoke of effects in development.
  const hasLoadedFromStorageRef = useRef<boolean>(false);

  // Load search results from Chrome storage on mount - this restores session persistence!
  useEffect(() => {
    if (hasLoadedFromStorageRef.current) return;
    hasLoadedFromStorageRef.current = true;

    const loadSearchData = async () => {
      try {
        // Check for a pending new-search submission *before* rehydrating from
        // IndexedDB. If one is queued, loading stale results first would flash
        // the previous search's rows into the table for a frame before the new
        // search's setSearchResults([]) clears them. Read both in parallel so
        // we don't add a serial round-trip to the hot path.
        const [cachedRecord, sessionData] = await Promise.all([
          getSearchResultsRecord(),
          cstorage.session.get([CACHE.QUERY, CACHE.SEARCH_IS_NEW_SEARCH]),
        ]);
        const cachedResults = cachedRecord.data;

        const hasPendingSearch = Boolean(
          sessionData[CACHE.SEARCH_IS_NEW_SEARCH] &&
            sessionData[CACHE.QUERY] &&
            sessionData[CACHE.QUERY].trim(),
        );

        // In the full-tab view, App.tsx's storage.onChanged bridge consumes (and
        // removes) the SEARCH_IS_NEW_SEARCH flag and sets pendingSearchQuery *before*
        // this freshly-mounted effect runs. So the inbox flag alone can already be gone
        // while a search is still imminent — a live pendingSearchQuery also means "search
        // pending". Gate the cached-results rehydrate on both, otherwise a home-box search
        // that remounts this panel repaints the previous search's rows over the new one.
        const searchPending = hasPendingSearch || Boolean(appContext.pendingSearchQuery?.trim());

        if (!searchPending && cachedResults.length > 0) {
          logger.debug("Loading previous search results from IndexedDB", {
            length: cachedResults.length,
            results: cachedResults,
          });
          setSearchResults(cachedResults);
          setState((prev) => ({
            ...prev,
            resultCount: cachedResults.length,
            status: false, // Don't show status when loading from storage
          }));
          // Restore the query label shown in the results header so it survives a
          // popup reopen. Prefer the query persisted alongside the results (always
          // in sync with them); fall back to the session copy for legacy rows
          // written before the query was stored in IndexedDB.
          const restoredQuery =
            cachedRecord.query ??
            (typeof sessionData[CACHE.QUERY] === "string" ? sessionData[CACHE.QUERY] : "");
          if (restoredQuery) {
            setExecutedQuery(restoredQuery);
          }
        }

        // Only execute search if this is a new search submission
        if (hasPendingSearch) {
          isSearchInitiatedRef.current = true;

          logger.debug("Found new search submission, executing search", {
            query: sessionData[CACHE.QUERY],
          });
          // Await the flag removal to prevent race conditions with re-runs
          try {
            await cstorage.session.remove([String(CACHE.SEARCH_IS_NEW_SEARCH)]);
          } catch (error) {
            logger.warn(`Failed to clear ${CACHE.SEARCH_IS_NEW_SEARCH} flag`, { error });
          }

          logger.debug("executing search FROM USEFFECT", {
            query: sessionData[CACHE.QUERY],
          });
          // Execute the search - performSearch reads supplierResultLimit/suppliers
          // from appContext via its default parameters, so we don't need to pass them.
          performSearch({ query: sessionData[CACHE.QUERY] });
        }
      } catch (error) {
        logger.warn("Failed to load search data from session storage:", { error });
      }
    };
    loadSearchData();
  }, []);

  // Listen for external clears of search results (e.g. SpeedDial "Clear Results")
  useEffect(() => {
    const handler = () => {
      setSearchResults([]);
      setState((prev) => ({ ...prev, resultCount: 0, status: false }));
    };
    window.addEventListener(IDB_SEARCH_RESULTS_CLEARED, handler);
    return () => window.removeEventListener(IDB_SEARCH_RESULTS_CLEARED, handler);
  }, []);

  const performSearch = useCallback(
    async ({
      query,
      supplierResultLimit = appContext.userSettings.supplierResultLimit ?? 15,
      suppliers = appContext.selectedSuppliers ?? [],
    }: {
      query: string;
      supplierResultLimit?: number;
      suppliers?: string[];
    }) => {
      // Drop a duplicate trigger for the same query already in flight. Set
      // synchronously (before any await) so two near-simultaneous callers can't
      // both pass the check. Cleared in the finally below once the search settles.
      const normalizedQuery = query.trim();
      if (inFlightQueryRef.current === normalizedQuery) {
        logger.debug("performSearch: duplicate in-flight query ignored", { query });
        return;
      }
      inFlightQueryRef.current = normalizedQuery;

      const { searchFilters } = appContext;
      const filtersActive = hasActiveFilters(searchFilters, appContext.userSettings);

      logger.debug("performSearch", {
        query,
        supplierResultLimit,
        suppliers,
        userSettings: appContext.userSettings,
        filtersActive,
        searchFilters,
      });
      // Reset state for new search. Clearing `tableText` here prevents a stale
      // empty-state message (e.g. "No results found for X" from the previous
      // search, or "Search aborted") from bleeding into the new search's
      // empty-state cell. While `isLoading === true` the cell renders
      // "Searching..." regardless, so clearing now doesn't cause a flash.
      setState({
        isLoading: true,
        isAborting: false,
        status: i18n("results_status_searching"),
        error: undefined,
        resultCount: 0,
      });
      setSearchResults([]);
      setTableText("");
      setExecutedQuery(query);

      // Drop stale persisted results so a 0-result/aborted search doesn't
      // rehydrate them on next open. Silent so it doesn't bounce off the panel.
      await clearSearchResults({ notify: false });

      // Create a history entry immediately so it's recorded even if the search is cancelled or hangs.
      // The resultCount will be updated live as results stream in.
      const historyTimestamp = Date.now();
      logger.log("Searching for", { query, suppliers, appContext });
      void createInitialHistoryEntry(
        query,
        historyTimestamp,
        searchFilters,
        appContext.selectedSuppliers ?? [],
      );

      // Signal search start — the badge controller owns the loading animation.
      emitSearchEvent(SearchEvent.STARTED, { query });

      const columnFilterConfig = getColumnFilterConfig();
      const userLimit = appContext.userSettings.supplierResultLimit ?? 15;

      // When filters are active, fetch more results so there's enough after filtering.
      // The per-supplier limit is applied post-filter, so we ask each supplier for more.
      const fetchLimit = filtersActive ? userLimit * 5 : userLimit;
      logger.debug("fetchLimit", {
        fetchLimit,
        userLimit,
        filtersActive,
        supplierResultLimit: appContext.userSettings.supplierResultLimit,
      });

      // Create new abort controller for this search
      fetchControllerRef.current = new AbortController();

      try {
        // Create the search factory object, which sets the query, supplier search limits,
        // and the abort controller for the search.
        const productQueryFactory = new SupplierFactory(query, {
          limit: fetchLimit,
          controller: fetchControllerRef.current,
          suppliers: appContext.selectedSuppliers,
          caching: appContext.userSettings.caching,
          // The scorer selector lives behind advanced mode, so only honor the
          // override there; otherwise a stale value can't strand a normal user
          // on a non-default scorer — they fall through to the WRatio default.
          fuzzScorerOverride: appContext.advancedMode
            ? appContext.userSettings.fuzzScorerOverride
            : undefined,
          doNotCacheEmptyResults: appContext.userSettings.doNotCacheEmptyResults,
          cacheTtlMinutes: appContext.userSettings.cacheTtlMinutes,
          noCacheStatusCodes: appContext.userSettings.noCacheStatusCodes,
          maxAllowableSearchTimeSec: appContext.userSettings.maxAllowableSearchTimeSec,
          fuzzyFilteringDisabled: appContext.userSettings.fuzzyFilteringDisabled,
          location: appContext.userSettings.location,
          excludeNonShippingSuppliers: appContext.userSettings.excludeNonShippingSuppliers ?? true,
          hideRestrictedProducts: appContext.userSettings.hideRestrictedProducts ?? true,
          disabledSuppliers: appContext.userSettings.disabledSuppliers,
        });

        const startSearchTime = performance.now();

        // Execute the search for all suppliers.
        const productQueryResults = await productQueryFactory.executeAllStream(3);

        // Authoritative result count, tracked from the data we actually produce.
        // `resultsTable.getRowCount()` only reflects the last committed render,
        // which lags the `setSearchResults` calls below (the streaming branch
        // defers them with startTransition), so reading it right after the
        // stream drains can spuriously report 0 — see the no-results check below.
        let totalResults = 0;

        // Tracks supplier-scoped identities already emitted this search so the
        // streaming branch can skip a product that arrives more than once,
        // keeping duplicates out of both the live table and storage.
        const seenKeys = new Set<string>();

        // When filters are active, collect all results first, then filter and limit.
        // When no filters are active, stream results directly for immediate UI feedback.
        if (filtersActive) {
          const allResults: Product[] = [];

          // Collect all streamed results
          for await (const result of productQueryResults) {
            allResults.push(result);

            // Show progress while collecting
            startTransition(() => {
              setState((prev) => ({
                ...prev,
                status: i18n("search_status_fetching", [String(allResults.length)]),
              }));
            });
          }

          // Drop products that streamed in more than once (same supplier-scoped
          // identity) before filtering, so duplicates never reach state/storage
          // and the per-supplier limit counts unique products.
          const uniqueResults = dedupeProducts(allResults);

          // Apply pre-search filters
          const filtered = uniqueResults.filter((product) =>
            passesSearchFilters(product, searchFilters, appContext.userSettings),
          );

          // Apply per-supplier limit on the filtered set
          const limited = applyPerSupplierLimit(filtered, userLimit);

          // Build column filter config for final results
          for (const result of limited) {
            updateColumnFilterFromResult(columnFilterConfig, result);
          }

          // Set all filtered+limited results at once. The badge count is driven
          // by ResultsTable emitting SearchEvent.RESULTS_COUNT off its filtered row count
          // count — committing this state update re-renders the table, which
          // re-emits the count, so no direct badge update is needed here.
          // Stamp the positional row index onto `_id`, leaving the real product
          // `id` intact so persisted results keep their true identity.
          const finalResults = limited.map((r, idx) => ({ ...r, _id: idx }));
          setSearchResults(finalResults);
          totalResults = finalResults.length;

          // Record USD price history for the final result set (fire-and-forget;
          // dedup means unchanged prices add nothing).
          void recordProductPrices(finalResults, appContext.userSettings);

          // Save to Chrome storage and update history with final count
          await saveResultsToSession(finalResults, query);
          await updateHistoryResultCount(historyTimestamp, finalResults.length);

          logger.debug("Fetched results", {
            allResults,
            filtered,
            finalResults,
          });
        } else {
          // No filters active — stream results directly; ResultsTable re-emits
          // the count per appended row, so no direct badge update is needed here.
          for await (const result of productQueryResults) {
            // Skip a product whose identity already streamed in this search, so
            // the same product is never appended (and persisted) twice.
            const dedupeKey = getProductDedupeKey(result);
            if (dedupeKey !== undefined) {
              if (seenKeys.has(dedupeKey)) continue;
              seenKeys.add(dedupeKey);
            }

            totalResults += 1;

            // Update state with current count using startTransition for better performance
            startTransition(() => {
              setState((prev) => ({
                ...prev,
                resultCount: totalResults,
                status: i18n(
                  totalResults === 1 ? "search_status_found_one" : "search_status_found_other",
                  [String(totalResults)],
                ),
              }));
            });

            // Build column filter config for this result
            updateColumnFilterFromResult(columnFilterConfig, result);

            // Add result immediately to the table - streaming behavior restored!
            // `_id` carries the positional index; the real product `id` is left untouched.
            const productWithId = {
              ...result,
              _id: totalResults - 1,
            };

            // Record USD price history for this streamed product (fire-and-forget;
            // done outside the state updater so it runs once per product, not per
            // whole-array remap).
            void recordProductPrices([productWithId], appContext.userSettings);

            // Update results immediately using startTransition for better performance
            startTransition(() => {
              setSearchResults((prevSearchResults) => {
                const newResults = [...prevSearchResults, productWithId];
                // Re-index positions on `_id` only; preserve each product's real `id`.
                const indexedResults = newResults.map((r, idx) => ({ ...r, _id: idx }));

                // Persist and update history live (fire and forget)
                void (async () => {
                  await saveResultsToSession(indexedResults, query);
                  await updateHistoryResultCount(historyTimestamp, newResults.length);
                })();

                return newResults;
              });
            });
          }
        }

        const endSearchTime = performance.now();
        const searchTime = endSearchTime - startSearchTime;

        logger.debug(`Found ${totalResults} products in ${searchTime} milliseconds`, {
          query,
          fetchLimit,
          productQueryResults,
          startSearchTime,
          endSearchTime,
          searchTime,
        });

        // If no results were found, then try to suggest alternative search terms using cactus.nci.nih.gov API.
        if (totalResults === 0) {
          // When the shipping filter alone emptied the supplier set, explain that
          // directly instead of the generic "no products" suggestion flow.
          const message = productQueryFactory.shippingExcludedAll
            ? i18n("search_no_shipping_suppliers")
            : await buildNoResultsMessage(query, filtersActive);
          setTableText(message);
          logger.debug("setting table text", { tableText: message });
        } else {
          // Clear any status text from a previous search.
          setTableText("");
        }

        // Signal completion; the badge controller reconciles the final count.
        emitSearchEvent(SearchEvent.COMPLETED, { count: totalResults });

        // Final state - search complete
        // NOTE: Do NOT wrap in startTransition — the isLoading:false update must be
        // high priority so the LoadingBackdrop closes immediately. startTransition
        // would let React defer it behind the queued streaming updates indefinitely.
        setState({
          isLoading: false,
          isAborting: false,
          status: false, // Hide status when complete
          error: undefined,
          resultCount: totalResults,
        });
      } catch (error) {
        // Signal the terminal outcome; the badge controller clears the badge.
        // Either branch lands here once the stream has fully drained — including
        // after an abort, when in-flight requests have finished settling — so
        // this is where isLoading/isAborting reset and the overlay closes.
        if (error instanceof Error && error.name === "AbortError") {
          emitSearchEvent(SearchEvent.ABORTED, { reason: error.message });
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isAborting: false,
            status: i18n("search_status_aborted"),
            error: undefined,
          }));
          setTableText(i18n("search_status_aborted"));
        } else {
          emitSearchEvent(SearchEvent.FAILED, {
            error: error instanceof Error ? error.message : i18n("search_error_failed"),
          });
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isAborting: false,
            status: false,
            error: error instanceof Error ? error.message : i18n("search_error_failed"),
          }));
        }
      } finally {
        // Release the guard so a later deliberate re-search of the same term runs.
        inFlightQueryRef.current = null;
      }
    },
    [appContext.userSettings, appContext.selectedSuppliers, appContext.searchFilters],
  );

  const executeSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        return;
      }

      // Keep the drawer's search term in sync with whatever query is being executed
      if (appContext.searchFilters.titleQuery !== query.trim()) {
        appContext.setSearchFilters({ ...appContext.searchFilters, titleQuery: query.trim() });
      }

      logger.debug(`executing search FROM EXECUTESEARCH`, { query });
      // Use startTransition for better performance during search
      startTransition(() => {
        performSearch({ query });
      });
    },
    [appContext, performSearch],
  );

  /**
   * Remove a product from the current results and persist it to the
   * excluded-products list so future searches skip it as well. Drives the
   * "Ignore Product" context-menu action: it immediately drops the row from
   * the visible table, updates the session-storage snapshot so a reload
   * doesn't resurrect it, and writes the exclusion entry to local storage.
   *
   * Matching is done by `(url, supplier)` pair — identical to the shape of
   * the exclusion key used in `SupplierBase.getProductData`.
   *
   * @param product - The product to exclude and drop from results.
   * @example
   * ```ts
   * const { excludeProduct } = useSearch();
   * await excludeProduct(row.original);
   * ```
   * @source
   */
  const excludeProduct = useCallback(
    async (product: Product) => {
      if (!product?.url || !product?.supplier) return;
      let nextResults: Product[] = [];
      setSearchResults((prev) => {
        nextResults = prev.filter(
          (p) => !(p.url === product.url && p.supplier === product.supplier),
        );
        return nextResults;
      });
      // setSearchResults re-renders the table, which re-emits the count; no
      // direct badge update needed here.
      try {
        // Key the exclusion by the product's stable identity (same key the
        // product-detail cache uses); fall back to the URL when unstamped.
        await addExcludedProduct(product.cacheKey ?? product.url, product.supplier, {
          title: product.title,
          url: product.url,
        });
      } catch (error) {
        logger.warn("Failed to persist excluded product:", { error });
      }
      // Persist the updated results so a reload doesn't resurrect the row. Keep the
      // current query so removing a row doesn't drop the header label.
      await saveResultsToSession(nextResults, executedQuery);
    },
    [executedQuery],
  );

  const handleStopSearch = useCallback(() => {
    logger.debug("triggering abort..");
    // Signal the abort but keep the overlay up: requests already in flight will
    // keep streaming back until the supplier streams settle. Flip into the
    // "Aborting..." state now; performSearch resets isLoading/isAborting once the
    // stream finishes draining, which is what actually closes the overlay.
    fetchControllerRef.current.abort("Request was aborted by user");
    startTransition(() => {
      setState((prev) => ({
        ...prev,
        isAborting: true,
        status: i18n("loading_aborting"),
      }));
    });
  }, []);

  // Listen for the global abort-search hotkey (mod+.) dispatched from App.tsx.
  // Kept here rather than in App.tsx so we have direct access to the local
  // AbortController ref without threading it through context.
  useEffect(() => {
    const handler = () => handleStopSearch();
    window.addEventListener(HotkeyEvent.ABORT_SEARCH, handler);
    return () => window.removeEventListener(HotkeyEvent.ABORT_SEARCH, handler);
  }, [handleStopSearch]);

  return {
    searchResults,
    isLoading: state.isLoading,
    isAborting: state.isAborting,
    statusLabel: state.status,
    error: state.error,
    resultCount: state.resultCount,
    executeSearch,
    handleStopSearch,
    excludeProduct,
    tableText,
    executedQuery,
  };
}
