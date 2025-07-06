import { useAppContext } from "@/context";
import SupplierFactory from "@/suppliers/SupplierFactory";
import BadgeAnimator from "@/utils/BadgeAnimator";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { getColumnFilterConfig } from "../TableColumns";

interface SearchState {
  isLoading: boolean;
  status: string | boolean;
  error?: string;
  resultCount: number;
}

/**
 * React v19 enhanced search hook that maintains streaming behavior.
 *
 * This version preserves the original streaming approach where results appear
 * in the table as they're found, with live counter updates, AND restores
 * session persistence so results are maintained across page reloads.
 *
 * Key improvements over original:
 * - Uses startTransition for better performance
 * - Better error handling
 * - Streaming results with immediate UI updates
 * - Live result counter that updates as results arrive
 * - Session persistence restored (loads previous results on mount)
 */
export function useSearch() {
  const appContext = useAppContext();
  const fetchControllerRef = useRef<AbortController>(new AbortController());

  const initialState: SearchState = {
    isLoading: false,
    status: false,
    error: undefined,
    resultCount: 0,
  };

  const [state, setState] = useState<SearchState>(initialState);
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  // Load search results from Chrome storage on mount - this restores session persistence!
  useEffect(() => {
    chrome.storage.session
      .get(["searchResults", "searchInput", "isNewSearch"])
      .then((data) => {
        if (
          data.searchResults &&
          Array.isArray(data.searchResults) &&
          data.searchResults.length > 0
        ) {
          console.debug(
            "Loading previous search results from session storage:",
            data.searchResults.length,
            "results",
          );
          setSearchResults(data.searchResults);
          setState((prev) => ({
            ...prev,
            resultCount: data.searchResults.length,
            status: false, // Don't show status when loading from storage
          }));
        }

        // Only execute search if this is a new search submission
        if (data.isNewSearch && data.searchInput && data.searchInput.trim()) {
          console.debug("Found new search submission, executing search:", data.searchInput);
          // Clear the new search flag first
          chrome.storage.session.remove(["isNewSearch"]).catch((error) => {
            console.warn("Failed to clear isNewSearch flag:", error);
          });

          // Execute the search
          performSearch({
            query: data.searchInput,
            supplierResultLimit: appContext.userSettings.supplierResultLimit,
            suppliers: appContext.userSettings.suppliers.slice(0, 2),
          });
        }
      })
      .catch((error) => {
        console.warn("Failed to load search data from session storage:", error);
      });
  }, [appContext.userSettings.supplierResultLimit, appContext.userSettings.suppliers]);

  const executeSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        return;
      }

      // Use startTransition for better performance during search
      startTransition(() => {
        performSearch({
          query,
          supplierResultLimit: appContext.userSettings.supplierResultLimit,
          suppliers: appContext.userSettings.suppliers.slice(0, 2),
        });
      });
    },
    [appContext.userSettings.supplierResultLimit, appContext.userSettings.suppliers],
  );

  const performSearch = async ({
    query,
    supplierResultLimit = appContext.userSettings.supplierResultLimit ?? 3,
    suppliers = appContext.userSettings.suppliers ?? [],
  }: {
    query: string;
    supplierResultLimit?: number;
    suppliers?: string[];
  }) => {
    console.log("performSearch", {
      query,
      supplierResultLimit,
      suppliers,
      userSettings: appContext.userSettings,
    });
    // Reset state for new search
    setState({
      isLoading: true,
      status: "Searching...",
      error: undefined,
      resultCount: 0,
    });
    setSearchResults([]);

    // Start the loading animation
    BadgeAnimator.animate("ellipsis", 300);

    const columnFilterConfig = getColumnFilterConfig();
    const searchLimit = appContext.userSettings.supplierResultLimit ?? 5;

    // Create new abort controller for this search
    fetchControllerRef.current = new AbortController();

    try {
      const productQueryFactory = new SupplierFactory(
        query,
        searchLimit,
        fetchControllerRef.current,
        appContext.userSettings.suppliers,
      );

      const startSearchTime = performance.now();
      let resultCount = 0;
      const productQueryResults = await productQueryFactory.executeAllStream(3);

      // Process results as they stream in - this maintains the original behavior
      for await (const result of productQueryResults) {
        resultCount++;

        // Update the live counter immediately - this is what was missing!
        BadgeAnimator.setText(resultCount.toString());

        // Update state with current count using startTransition for better performance
        startTransition(() => {
          setState((prev) => ({
            ...prev,
            resultCount,
            status: `Found ${resultCount} result${resultCount !== 1 ? "s" : ""}...`,
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
          id: resultCount - 1, // Use resultCount for consistent ID
        };

        // Update results immediately using startTransition for better performance
        startTransition(() => {
          setSearchResults((prevResults) => {
            const newResults = [...prevResults, productWithId];

            // Save to Chrome storage for session persistence - this maintains the original behavior
            chrome.storage.session
              .set({
                searchResults: newResults.map((r, idx) => ({ ...r, id: idx })),
              })
              .catch((error) => {
                console.warn("Failed to save search results to session storage:", error);
              });

            return newResults;
          });
        });
      }

      const endSearchTime = performance.now();
      const searchTime = endSearchTime - startSearchTime;

      console.debug(`Found ${resultCount} products in ${searchTime} milliseconds`);

      // Final state - search complete
      startTransition(() => {
        setState({
          isLoading: false,
          status: false, // Hide status when complete
          error: undefined,
          resultCount,
        });
      });
    } catch (error) {
      startTransition(() => {
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
      });
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
  };
}
