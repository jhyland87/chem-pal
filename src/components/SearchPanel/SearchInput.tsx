import MenuIcon from "@/icons/MenuIcon";
import ScienceIcon from "@/icons/ScienceIcon";
import SearchIcon from "@/icons/SearchIcon";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Paper from "@mui/material/Paper";
import { startTransition, use, useActionState } from "react";
import "./SearchInput.scss";

/**
 * Enhanced SearchInput component using React v19 features for improved performance
 * and simpler state management.
 *
 * Key improvements over original SearchInput.tsx:
 * - use() hook for Chrome storage (eliminates useState + useEffect pattern)
 * - useActionState for form submission handling
 * - Better error handling and loading states
 * - Automatic Chrome storage persistence
 * - Cleaner separation of concerns
 *
 * COMPARISON WITH ORIGINAL:
 *
 * Original (useState + useEffect for Chrome storage):
 * ```typescript
 * const [searchInputValue, setSearchInputValue] = useState<string>("");
 *
 * useEffect(() => {
 *   chrome.storage.session.get(["searchInput"]).then((data) => {
 *     if (data.searchInput) {
 *       setSearchInputValue(data.searchInput);
 *     }
 *   });
 * }, []);
 *
 * const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 *   const newValue = e.target.value;
 *   setSearchInputValue(newValue);
 *   chrome.storage.session.set({ searchInput: newValue });
 * };
 * ```
 *
 * React v19 Version:
 * ```typescript
 * const searchInputValue = use(chromeStoragePromise("searchInput"));
 * const [formState, submitSearch, isPending] = useActionState(searchAction, { value: searchInputValue });
 * // Automatic Chrome storage sync and form submission handling
 * ```
 *
 * BENEFITS:
 * 1. Eliminates useState + useEffect boilerplate for Chrome storage
 * 2. Built-in form submission handling with loading states
 * 3. Automatic persistence to Chrome storage
 * 4. Better error handling for storage operations
 * 5. Cleaner component logic with less code
 */

interface SearchFormState {
  value: string;
  error?: string;
}

type SearchAction =
  | { type: "UPDATE_INPUT"; value: string }
  | { type: "SUBMIT_SEARCH"; query: string };

// Helper function to create Chrome storage promise that React v19's use() can handle
function createChromeStoragePromise(key: string): Promise<string> {
  return chrome.storage.session.get([key]).then((data) => {
    return data[key] || "";
  });
}

// Cache the storage promise to avoid recreating it on every render
let storagePromise: Promise<string> | null = null;

function getChromeStoragePromise(key: string): Promise<string> {
  if (!storagePromise) {
    storagePromise = createChromeStoragePromise(key);
  }
  return storagePromise;
}

export default function SearchInput({ onSearch }: SearchInputStates) {
  // React v19's use() hook eliminates useEffect for Chrome storage loading
  let initialValue = "";
  try {
    // use() hook suspends the component until the promise resolves
    initialValue = use(getChromeStoragePromise("searchInput"));
  } catch (error) {
    console.warn("Failed to load search input from Chrome storage:", error);
  }

  // React v19's useActionState for form management
  const [formState, dispatch, isPending] = useActionState(
    (currentState: SearchFormState, action: SearchAction): SearchFormState => {
      switch (action.type) {
        case "UPDATE_INPUT": {
          const newValue = action.value;

          // Handle async Chrome storage with startTransition
          startTransition(() => {
            chrome.storage.session
              .set({ searchInput: newValue })
              .then(() => {
                console.log("searchInput saved as:", newValue);
              })
              .catch((error) => {
                console.error("Failed to save search input:", error);
              });
          });

          return {
            ...currentState,
            value: newValue,
            error: undefined,
          };
        }

        case "SUBMIT_SEARCH": {
          const query = action.query.trim();

          if (!query) {
            return {
              ...currentState,
              error: "Search query cannot be empty",
            };
          }

          // Handle async search with startTransition
          startTransition(() => {
            try {
              // Trigger the search
              onSearch?.(query);
            } catch (error) {
              console.error("Search failed:", error);
            }
          });

          return {
            ...currentState,
            error: undefined,
          };
        }

        default:
          return currentState;
      }
    },
    { value: initialValue },
  );

  /**
   * Handles form submission and triggers search
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    dispatch({
      type: "SUBMIT_SEARCH",
      query: formState.value,
    });
  };

  /**
   * Handles changes to the search input field with automatic Chrome storage persistence
   */
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: "UPDATE_INPUT",
      value: e.target.value,
    });
  };

  return (
    <>
      <div className="search-input-container fullwidth">
        <Paper
          className="fullwidth search-query-input-form"
          component="form"
          onSubmit={handleSubmit}
          sx={{
            opacity: isPending ? 0.7 : 1,
            transition: "opacity 0.2s ease",
          }}
        >
          <IconButton disabled={isPending}>
            <MenuIcon />
          </IconButton>

          <InputBase
            value={formState.value}
            onChange={handleSearchInputChange}
            className="search-query-input fullwidth"
            placeholder={isPending ? "Searching..." : "Search..."}
            disabled={isPending}
            error={!!formState.error}
          />

          <IconButton type="button" disabled={isPending}>
            <ScienceIcon />
          </IconButton>

          <Divider orientation="vertical" />

          <IconButton color="primary" type="submit" disabled={isPending || !formState.value.trim()}>
            <SearchIcon />
          </IconButton>
        </Paper>

        {/* Error display */}
        {formState.error && (
          <div
            style={{
              color: "red",
              fontSize: "0.8rem",
              marginTop: "4px",
              padding: "0 16px",
            }}
          >
            {formState.error}
          </div>
        )}

        {/* Loading indicator */}
        {isPending && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: "#1976d2",
              animation: "pulse 1s infinite",
              zIndex: 1000,
            }}
          />
        )}
      </div>
    </>
  );
}

/**
 * MIGRATION GUIDE:
 *
 * To migrate from SearchInput.tsx to this React v19 version:
 *
 * 1. Replace useState + useEffect with use() hook for Chrome storage
 * 2. Replace manual form handling with useActionState
 * 3. Add loading states and error handling
 * 4. Use action dispatcher pattern for all input changes and form submission
 * 5. Add visual feedback for pending operations
 * 6. Implement automatic Chrome storage persistence
 *
 * PERFORMANCE BENEFITS:
 * - Eliminates useEffect for initial data loading
 * - Automatic Chrome storage synchronization
 * - Built-in loading and error states
 * - Better form submission handling
 * - Reduced component complexity and re-renders
 *
 * NOTE: The use() hook requires React v19 and will suspend the component
 * until the Chrome storage promise resolves. Consider wrapping in Suspense
 * boundary for better loading UX.
 */
