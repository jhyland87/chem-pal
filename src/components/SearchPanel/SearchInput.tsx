import MenuIcon from "@/icons/MenuIcon";
import ScienceIcon from "@/icons/ScienceIcon";
import SearchIcon from "@/icons/SearchIcon";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import { FormEvent, useCallback, useState } from "react";
import HighlightedSearchInput from "./HighlightedSearchInput";
import styles from "./SearchInput.module.scss";
import { useSearchInput } from "./useSearchInput.hook";

/**
 * SearchInput component that provides a search interface with a text input and action buttons.
 * It includes a menu button, search input field, and search action buttons.
 *
 * Refactored version that uses the useSearchInput hook for better code organization.
 *
 * @component
 *
 * @param props - Component props
 *
 * @example
 * ```tsx
 * <SearchInput
 *   onSearch={handleSearchChange}
 * />
 * ```
 * @source
 */
export default function SearchInput({ onSearch }: SearchInputStates) {
  const { searchInputValue, isLoading, handleSearchInputChange, handleSubmit } = useSearchInput();

  // Set when the typed query is an invalid advanced query (malformed, or no inclusive term);
  // holds the human-readable reason and blocks the search until fixed.
  const [searchError, setSearchError] = useState<string | undefined>(undefined);

  const handleValidityChange = useCallback((blocked: boolean, message?: string) => {
    setSearchError(blocked ? (message ?? "Invalid query.") : undefined);
  }, []);

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (searchError) {
      event.preventDefault();
      return;
    }
    handleSubmit(onSearch)(event);
  };

  return (
    <>
      <div className={`${styles['search-input-container']} ${styles.fullwidth}`}>
        <Paper
          className={`${styles.fullwidth} ${styles['search-query-input-form']}`}
          component="form"
          onSubmit={handleFormSubmit}
          sx={{
            opacity: isLoading ? 0.7 : 1,
            transition: "opacity 0.2s ease",
          }}
        >
          <IconButton disabled={isLoading} aria-label="menu">
            <MenuIcon />
          </IconButton>

          <HighlightedSearchInput
            value={searchInputValue}
            onChange={handleSearchInputChange}
            className={`${styles['search-query-input']} ${styles.fullwidth}`}
            placeholder={isLoading ? "Searching..." : "Search..."}
            disabled={isLoading}
            ariaLabel="Search for chemicals"
            onValidityChange={handleValidityChange}
          />

          <IconButton type="button" disabled={isLoading} aria-label="search">
            <ScienceIcon />
          </IconButton>

          <Divider orientation="vertical" />

          <IconButton
            color="primary"
            type="submit"
            disabled={isLoading || !searchInputValue.trim() || Boolean(searchError)}
            aria-label="execute search"
          >
            <SearchIcon />
          </IconButton>
        </Paper>

        {searchError && (
          <div role="alert" className={styles['search-error-hint']}>
            {searchError}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
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
          >
            Loading...
          </div>
        )}
      </div>
    </>
  );
}
