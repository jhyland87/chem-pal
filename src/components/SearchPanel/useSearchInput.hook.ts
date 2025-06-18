import { useCallback, useEffect, useState } from "react";

/**
 * Return type for the useSearchInput hook.
 * Contains search input state and handler functions.
 */
interface UseSearchInputReturn {
  /** Current value of the search input field */
  searchInputValue: string;
  /** Whether a search operation is currently in progress */
  isLoading: boolean;
  /** Function to handle changes to the search input value */
  handleSearchInputChange: (value: string) => void;
  /** Function that returns a form submit handler */
  handleSubmit: (
    onSearch?: (query: string) => void,
  ) => (e: React.FormEvent<HTMLFormElement>) => void;
  /** Function to manually set the loading state */
  setIsLoading: (loading: boolean) => void;
}

/**
 * Hook to manage search input state with Chrome storage persistence.
 * Handles input value, loading state, and automatic Chrome storage sync.
 *
 * This hook automatically saves search input to Chrome session storage
 * and restores it when the component mounts. It also provides loading
 * state management for search operations.
 *
 * @returns Search input state and handlers
 *
 * @example
 * ```tsx
 * const {
 *   searchInputValue,
 *   isLoading,
 *   handleSearchInputChange,
 *   handleSubmit
 * } = useSearchInput();
 *
 * <form onSubmit={handleSubmit(onSearch)}>
 *   <input
 *     value={searchInputValue}
 *     onChange={(e) => handleSearchInputChange(e.target.value)}
 *     disabled={isLoading}
 *   />
 * </form>
 * ```
 */
export function useSearchInput(): UseSearchInputReturn {
  const [searchInputValue, setSearchInputValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load the search input from Chrome storage on component mount
  useEffect(() => {
    chrome.storage.session
      .get(["searchInput"])
      .then((data) => {
        if (data.searchInput) {
          setSearchInputValue(data.searchInput);
        }
      })
      .catch((error) => {
        console.warn("Failed to load search input from Chrome storage:", error);
      });
  }, []);

  /**
   * Handles changes to the search input field and saves to Chrome storage.
   * Updates both local state and Chrome session storage.
   *
   * @param value - The new search input value
   */
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchInputValue(value);

    // Save to Chrome storage
    chrome.storage.session
      .set({ searchInput: value })
      .then(() => {
        console.log("searchInput saved as:", value);
      })
      .catch((error) => {
        console.error("Failed to save search input:", error);
      });
  }, []);

  /**
   * Creates a form submission handler that triggers search operations.
   * Returns a function that prevents default form submission and calls
   * the provided search function with the current input value.
   *
   * @param onSearch - Optional callback function to execute the search
   * @returns Form event handler function
   */
  const handleSubmit = useCallback(
    (onSearch?: (query: string) => void) => {
      return (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (searchInputValue.trim()) {
          setIsLoading(true);
          onSearch?.(searchInputValue.trim());
          // Reset loading state after a short delay
          setTimeout(() => setIsLoading(false), 500);
        }
      };
    },
    [searchInputValue],
  );

  return {
    searchInputValue,
    isLoading,
    handleSearchInputChange,
    handleSubmit,
    setIsLoading,
  };
}
