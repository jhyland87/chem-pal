import { getColumnFilterConfig } from "@/components/SearchPanel/TableColumns";
import { AVAILABILITY_LABEL_MAP, CACHE_KEYS } from "@/constants/common";
import { useAppContext } from "@/context";
import { getCompoundNameFromAlias } from "@/helpers/pubchem";
import SupplierFactory from "@/suppliers/SupplierFactory";
import BadgeAnimator from "@/utils/BadgeAnimator";
import { type Table } from "@tanstack/react-table";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
interface SearchState {
  isLoading: boolean;
  status: string | boolean;
  error?: string;
  resultCount: number;
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
  const supplierCounts: Record<string, number> = {};
  return products.filter((product) => {
    const supplier = product.supplier;
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

  const initialState: SearchState = {
    isLoading: false,
    status: false,
    error: undefined,
    resultCount: 0,
  };

  const [state, setState] = useState<SearchState>(initialState);
  const [tableText, setTableText] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  // Load search results from Chrome storage on mount - this restores session persistence!
  useEffect(() => {
    const loadSearchData = async () => {
      try {
        const data = await chrome.storage.session.get([
          CACHE_KEYS.SEARCH_INPUT,
          CACHE_KEYS.SEARCH_RESULTS,
          CACHE_KEYS.SEARCH_IS_NEW_SEARCH,
        ]);

        if (
          data[CACHE_KEYS.SEARCH_RESULTS] &&
          Array.isArray(data[CACHE_KEYS.SEARCH_RESULTS]) &&
          data[CACHE_KEYS.SEARCH_RESULTS].length > 0
        ) {
          console.debug(
            "Loading previous search results from session storage:",
            data[CACHE_KEYS.SEARCH_RESULTS]?.length,
            "results",
          );
          setSearchResults(data[CACHE_KEYS.SEARCH_RESULTS]);
          setState((prev) => ({
            ...prev,
            resultCount: data[CACHE_KEYS.SEARCH_RESULTS].length,
            status: false, // Don't show status when loading from storage
          }));
        }

        // Only execute search if this is a new search submission
        // and we haven't already initiated a search from a previous effect run
        if (
          data[CACHE_KEYS.SEARCH_IS_NEW_SEARCH] &&
          data[CACHE_KEYS.SEARCH_INPUT] &&
          data[CACHE_KEYS.SEARCH_INPUT].trim()
        ) {
          if (isSearchInitiatedRef.current) {
            console.debug("Search already initiated, skipping duplicate execution");
            return;
          }
          isSearchInitiatedRef.current = true;

          console.debug("Found new search submission, executing search:", {
            query: data[CACHE_KEYS.SEARCH_INPUT],
          });
          // Await the flag removal to prevent race conditions with re-runs
          try {
            await chrome.storage.session.remove([String(CACHE_KEYS.SEARCH_IS_NEW_SEARCH)]);
          } catch (error) {
            console.warn(`Failed to clear ${CACHE_KEYS.SEARCH_IS_NEW_SEARCH} flag:`, { error });
          }

          console.log("executing search FROM USEFFECT", {
            query: data[CACHE_KEYS.SEARCH_INPUT],
            supplierResultLimit: appContext.userSettings.supplierResultLimit,
            suppliers: appContext.userSettings.suppliers,
          });
          // Execute the search
          performSearch({
            query: data[CACHE_KEYS.SEARCH_INPUT],
            supplierResultLimit: appContext.userSettings.supplierResultLimit,
            suppliers: appContext.userSettings.suppliers,
          });
        }
      } catch (error) {
        console.warn("Failed to load search data from session storage:", { error });
      }
    };
    loadSearchData();
  }, [appContext.userSettings.supplierResultLimit, appContext.userSettings.suppliers]);

  // Listen for external clears of search results (e.g. SpeedDial "Clear Results")
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== "session") return;
      const change = changes[CACHE_KEYS.SEARCH_RESULTS];
      if (change && Array.isArray(change.newValue) && change.newValue.length === 0) {
        setSearchResults([]);
        setState((prev) => ({ ...prev, resultCount: 0, status: false }));
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const executeSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        return;
      }

      // Keep the drawer's search term in sync with whatever query is being executed
      if (appContext.searchFilters.titleQuery !== query.trim()) {
        appContext.setSearchFilters({ ...appContext.searchFilters, titleQuery: query.trim() });
      }

      console.debug(`executing search FROM EXECUTESEARCH`, { query });
      // Use startTransition for better performance during search
      startTransition(() => {
        performSearch({
          query,
          supplierResultLimit: appContext.userSettings.supplierResultLimit,
          suppliers: appContext.selectedSuppliers,
        });
      });
    },
    [appContext.userSettings.supplierResultLimit, appContext.selectedSuppliers],
  );

  const performSearch = async ({
    query,
    supplierResultLimit = appContext.userSettings.supplierResultLimit ?? 3,
    suppliers = appContext.selectedSuppliers ?? [],
  }: {
    query: string;
    supplierResultLimit?: number;
    suppliers?: string[];
  }) => {
    const { searchFilters } = appContext;
    const filtersActive = hasActiveFilters(searchFilters, appContext.userSettings);

    console.log("performSearch", {
      query,
      supplierResultLimit,
      suppliers,
      userSettings: appContext.userSettings,
      filtersActive,
      searchFilters,
    });
    // Reset state for new search
    setState({
      isLoading: true,
      status: "Searching...",
      error: undefined,
      resultCount: 0,
    });
    setSearchResults([]);

    // Create a history entry immediately so it's recorded even if the search is cancelled or hangs.
    // The resultCount will be updated live as results stream in.
    const historyTimestamp = Date.now();
    (async () => {
      try {
        const data = await chrome.storage.local.get([CACHE_KEYS.SEARCH_HISTORY]);
        const history: SearchHistoryEntry[] = Array.isArray(data[CACHE_KEYS.SEARCH_HISTORY])
          ? data[CACHE_KEYS.SEARCH_HISTORY]
          : [];
        history.unshift({
          query,
          timestamp: historyTimestamp,
          resultCount: 0,
          type: "search",
          filters: { ...searchFilters },
          selectedSuppliers: [...appContext.selectedSuppliers],
        });
        // Keep last 100 entries
        await chrome.storage.local.set({ [CACHE_KEYS.SEARCH_HISTORY]: history.slice(0, 100) });
      } catch (error) {
        console.warn("Failed to save search history:", { error });
      }
    })();

    // Start the loading animation
    BadgeAnimator.animate("ellipsis", 300);

    const columnFilterConfig = getColumnFilterConfig();
    const userLimit = appContext.userSettings.supplierResultLimit ?? 5;

    // When filters are active, fetch more results so there's enough after filtering.
    // The per-supplier limit is applied post-filter, so we ask each supplier for more.
    const fetchLimit = filtersActive ? userLimit * 5 : userLimit;

    // Create new abort controller for this search
    fetchControllerRef.current = new AbortController();

    try {
      // Create the search factory object, which sets the query, supplier search limits,
      // and the abort controller for the search.
      const productQueryFactory = new SupplierFactory(
        query,
        fetchLimit,
        fetchControllerRef.current,
        appContext.selectedSuppliers,
      );

      const startSearchTime = performance.now();

      const resultsTable = window.resultsTable as Table<Product>;

      // Execute the search for all suppliers.
      const productQueryResults = await productQueryFactory.executeAllStream(3);

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
              status: `Fetching results... (${allResults.length} found)`,
            }));
          });
        }

        // Apply pre-search filters
        const filtered = allResults.filter((product) =>
          passesSearchFilters(product, searchFilters, appContext.userSettings),
        );

        // Apply per-supplier limit on the filtered set
        const limited = applyPerSupplierLimit(filtered, userLimit);

        // Build column filter config for final results
        for (const result of limited) {
          for (const [columnName, columnValue] of Object.entries(result)) {
            if (columnName in columnFilterConfig === false) continue;

            if (columnFilterConfig[columnName].filterVariant === "range") {
              if (typeof columnValue !== "number") continue;
              if (
                typeof columnFilterConfig[columnName].filterData[0] !== "number" ||
                columnValue < columnFilterConfig[columnName].filterData[0]
              ) {
                columnFilterConfig[columnName].filterData[0] = columnValue;
              } else if (
                typeof columnFilterConfig[columnName].filterData[1] !== "number" ||
                columnValue < columnFilterConfig[columnName].filterData[1]
              ) {
                columnFilterConfig[columnName].filterData[1] = columnValue;
              }
            } else if (columnFilterConfig[columnName].filterVariant === "select") {
              if (!columnFilterConfig[columnName].filterData.includes(columnValue)) {
                columnFilterConfig[columnName].filterData.push(columnValue);
              }
            } else if (columnFilterConfig[columnName].filterVariant === "text") {
              if (!columnFilterConfig[columnName].filterData.includes(columnValue)) {
                columnFilterConfig[columnName].filterData.push(columnValue);
              }
            }
          }
        }

        // Set all filtered+limited results at once
        const finalResults = limited.map((r, idx) => ({ ...r, id: idx }));
        setSearchResults(finalResults);
        resultsTable?.updateBadgeCount?.();

        // Save to Chrome storage
        try {
          await chrome.storage.session.set({ [CACHE_KEYS.SEARCH_RESULTS]: finalResults });
        } catch (error) {
          console.warn("Failed to save search results to session storage:", { error });
        }

        // Update history with final count
        try {
          const data = await chrome.storage.local.get([CACHE_KEYS.SEARCH_HISTORY]);
          const history: SearchHistoryEntry[] = Array.isArray(data[CACHE_KEYS.SEARCH_HISTORY])
            ? data[CACHE_KEYS.SEARCH_HISTORY]
            : [];
          const entry = history.find((h) => h.timestamp === historyTimestamp);
          if (entry) {
            entry.resultCount = finalResults.length;
            await chrome.storage.local.set({ [CACHE_KEYS.SEARCH_HISTORY]: history });
          }
        } catch (error) {
          console.warn("Failed to update search history result count:", { error });
        }

        console.debug(
          `Fetched ${allResults.length}, filtered to ${filtered.length}, limited to ${finalResults.length}`,
        );
      } else {
        // No filters active — stream results directly (original behavior)
        for await (const result of productQueryResults) {
          // Update the live counter immediately
          resultsTable?.updateBadgeCount?.();

          // Update state with current count using startTransition for better performance
          startTransition(() => {
            setState((prev) => ({
              ...prev,
              resultCount: resultsTable.getRowCount(),
              status: `Found ${resultsTable.getRowCount()} result${resultsTable.getRowCount() !== 1 ? "s" : ""}...`,
            }));
          });

          // Build column filter config for this result
          for (const [columnName, columnValue] of Object.entries(result)) {
            if (columnName in columnFilterConfig === false) continue;

            if (columnFilterConfig[columnName].filterVariant === "range") {
              if (typeof columnValue !== "number") continue;

              if (
                typeof columnFilterConfig[columnName].filterData[0] !== "number" ||
                columnValue < columnFilterConfig[columnName].filterData[0]
              ) {
                columnFilterConfig[columnName].filterData[0] = columnValue;
              } else if (
                typeof columnFilterConfig[columnName].filterData[1] !== "number" ||
                columnValue < columnFilterConfig[columnName].filterData[1]
              ) {
                columnFilterConfig[columnName].filterData[1] = columnValue;
              }
            } else if (columnFilterConfig[columnName].filterVariant === "select") {
              if (!columnFilterConfig[columnName].filterData.includes(columnValue)) {
                columnFilterConfig[columnName].filterData.push(columnValue);
              }
            } else if (columnFilterConfig[columnName].filterVariant === "text") {
              if (!columnFilterConfig[columnName].filterData.includes(columnValue)) {
                columnFilterConfig[columnName].filterData.push(columnValue);
              }
            }
          }

          // Add result immediately to the table - streaming behavior restored!
          const productWithId = {
            ...result,
            id: resultsTable.getRowCount() - 1,
          };

          // Update results immediately using startTransition for better performance
          startTransition(() => {
            setSearchResults((prevSearchResults) => {
              const newResults = [...prevSearchResults, productWithId];

              // Save to Chrome storage for session persistence
              (async () => {
                try {
                  await chrome.storage.session.set({
                    [CACHE_KEYS.SEARCH_RESULTS]: newResults.map((r, idx) => ({
                      ...r,
                      id: idx,
                    })),
                  });
                } catch (error) {
                  console.warn("Failed to save search results to session storage:", { error });
                }

                // Update the search history entry's resultCount live
                try {
                  const data = await chrome.storage.local.get([CACHE_KEYS.SEARCH_HISTORY]);
                  const history: SearchHistoryEntry[] = Array.isArray(
                    data[CACHE_KEYS.SEARCH_HISTORY],
                  )
                    ? data[CACHE_KEYS.SEARCH_HISTORY]
                    : [];
                  const entry = history.find((h) => h.timestamp === historyTimestamp);
                  if (entry) {
                    entry.resultCount = newResults.length;
                    await chrome.storage.local.set({ [CACHE_KEYS.SEARCH_HISTORY]: history });
                  }
                } catch (error) {
                  console.warn("Failed to update search history result count:", { error });
                }
              })();

              return newResults;
            });
          });
        }
      }

      const endSearchTime = performance.now();
      const searchTime = endSearchTime - startSearchTime;
      (window.resultsTable as Table<Product>)?.updateBadgeCount?.();

      console.debug(`Found ${resultsTable.getRowCount()} products in ${searchTime} milliseconds`);

      // If no results were found, then try to suggest alternative search terms using cactus.nci.nih.gov API.
      if (resultsTable.getRowCount() === 0) {
        const tableTextLines = [`No results found for "${query}"`];

        if (filtersActive) {
          tableTextLines.push("Try broadening your search filters in the drawer.");
        }

        const pubchemSimpleName = await getCompoundNameFromAlias(query);
        if (pubchemSimpleName && pubchemSimpleName.toLowerCase() !== query.toLowerCase()) {
          tableTextLines.push(`Perhaps try the PubChem name instead: ${pubchemSimpleName}`);
        }

        setTableText(tableTextLines.join("\n"));
        console.debug("setting table text", { tableText: tableTextLines.join("\n") });
      } else {
        // Clear any status text from a previous search.
        setTableText("");
      }

      // Final state - search complete
      // NOTE: Do NOT wrap in startTransition — the isLoading:false update must be
      // high priority so the LoadingBackdrop closes immediately. startTransition
      // would let React defer it behind the queued streaming updates indefinitely.
      setState({
        isLoading: false,
        status: false, // Hide status when complete
        error: undefined,
        resultCount: resultsTable.getRowCount(),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setState({
          isLoading: false,
          status: "Search aborted",
          error: undefined,
          resultCount: state.resultCount,
        });
      } else {
        setState({
          isLoading: false,
          status: false,
          error: error instanceof Error ? error.message : "Search failed",
          resultCount: state.resultCount,
        });
      }
    }
  };

  const handleStopSearch = useCallback(() => {
    console.debug("triggering abort..");
    fetchControllerRef.current.abort();
    startTransition(() => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        status: "Search aborted",
      }));
    });
  }, []);

  return {
    searchResults,
    isLoading: state.isLoading,
    statusLabel: state.status,
    error: state.error,
    resultCount: state.resultCount,
    executeSearch,
    handleStopSearch,
    tableText,
  };
}
