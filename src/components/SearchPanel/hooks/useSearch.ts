import { useAppContext } from "@/context";
import SupplierFactory from "@/suppliers/SupplierFactory";
import BadgeAnimator from "@/utils/BadgeAnimator";
import Cactus from "@/utils/Cactus";
import Pubchem from "@/utils/Pubchem";
import { type Table } from "@tanstack/react-table";
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
  const [tableText, setTableText] = useState<string>("");
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

          console.log("executing search FROM USEFFECT", {
            query: data.searchInput,
            supplierResultLimit: appContext.userSettings.supplierResultLimit,
            suppliers: appContext.userSettings.suppliers.slice(0, 2),
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

      console.log("executing search FROM EXECUTESEARCH", {
        query,
        supplierResultLimit: appContext.userSettings.supplierResultLimit,
        suppliers: appContext.selectedSuppliers.slice(0, 2),
      });
      // Use startTransition for better performance during search
      startTransition(() => {
        performSearch({
          query,
          supplierResultLimit: appContext.userSettings.supplierResultLimit,
          suppliers: appContext.selectedSuppliers.slice(0, 2),
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
      // Create the search factory object, which sets the query, supplier search limits,
      // and the abort controller for the search.
      const productQueryFactory = new SupplierFactory(
        query,
        searchLimit,
        fetchControllerRef.current,
        appContext.selectedSuppliers,
      );

      const startSearchTime = performance.now();

      const resultsTable = window.resultsTable as Table<Product>;

      // Execute the search for all suppliers.
      const productQueryResults = await productQueryFactory.executeAllStream(3);

      // Process results as they stream in.
      for await (const result of productQueryResults) {
        // Update the live counter immediately - this is what was missing!
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
          id: resultsTable.getRowCount() - 1, // Use resultCount for consistent ID
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
      (window.resultsTable as Table<Product>)?.updateBadgeCount?.();

      console.debug(`Found ${resultsTable.getRowCount()} products in ${searchTime} milliseconds`);

      // If no results were found, then try to suggest alternative search terms using cactus.nci.nih.gov API.
      if (resultsTable.getRowCount() === 0) {
        const queryCactus = new Cactus(query);
        const pubchem = new Pubchem(query);
        const queryIUPACName = await queryCactus.getIUPACName();
        const querySimpleNames = await queryCactus.getSimpleNames(3);
        const pubchemSimpleName = await pubchem.getSimpleName();

        console.log(`Cactus(${query}).getSimpleNames()`, querySimpleNames);
        console.log(`Cactus(${query}).getIUPACName()`, queryIUPACName);
        console.log(`Pubchem(${query}).getSimpleName()`, pubchemSimpleName);

        const tableTextLines = [`No results found for "${query}"`];

        if (!queryIUPACName && !querySimpleNames && !pubchemSimpleName) {
          tableTextLines.push("No alternative names or IUPAC name found either.");
        } else {
          // If a IUPAC name was found, then recommend that as a search term.
          if (queryIUPACName && query.toLowerCase() !== queryIUPACName.toLowerCase()) {
            tableTextLines.push(`Perhaps try the IUPAC name instead: ${queryIUPACName}`);
          }
          // If simple names were found, then recommend that as a search term.
          if (querySimpleNames && querySimpleNames.length > 0) {
            tableTextLines.push(
              (queryIUPACName ? `Or` : `Perhaps`) +
                ` try one of the following names: ${querySimpleNames.join(", ")}`,
            );
          }
          // If a pubchem simple name was found, then recommend that as a search term.
          if (pubchemSimpleName && query.toLowerCase() !== pubchemSimpleName.toLowerCase()) {
            tableTextLines.push(`Perhaps try the PubChem name instead: ${pubchemSimpleName}`);
          }
        }
        setTableText(tableTextLines.join("\n"));
      } else {
        // Clear any status text from a previous search.
        setTableText("");
      }

      // Final state - search complete
      startTransition(() => {
        setState({
          isLoading: false,
          status: false, // Hide status when complete
          error: undefined,
          resultCount: resultsTable.getRowCount(),
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
    tableText,
  };
}
