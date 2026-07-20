import { CACHE } from "@/constants/common";
import { i18n } from "@/helpers/i18n";
import { cstorage } from "@/utils/storage";
import { Science as ScienceIcon, Search as SearchIcon } from "@mui/icons-material";
import { Box, IconButton } from "@mui/material";
import { FC, FormEvent, useEffect, useState } from "react";
import { useAppContext } from "../context";
import styles from "./SearchForm.module.scss";
import HighlightedSearchInput from "./SearchPanel/HighlightedSearchInput";
import { useDelayedError } from "./SearchPanel/useDelayedError.hook";
import { SearchFormDivider, SearchFormPaper } from "./StyledComponents";

/**
 * Props for {@link SearchForm}. Controls submit handling, the advanced-options
 * button behavior, and the input's placeholder text.
 * @example
 * ```tsx
 * const props: SearchFormProps = {
 *   onSearch: (q) => runSearch(q),
 *   placeholder: "Search chemicals...",
 * };
 * ```
 * @source
 */
interface SearchFormProps {
  /** Called with the trimmed query when the form is submitted. */
  onSearch: (query: string) => void;
  /** Overrides the advanced-options button action; defaults to toggling the app drawer. */
  onDrawerToggle?: () => void;
  /** Placeholder text for the input. Defaults to `"Search for products..."`. */
  placeholder?: string;
  /** Whether to show the advanced-options button. */
  showAdvancedButton?: boolean;
}

/**
 * Renders the primary search bar: a text input bound to the shared
 * `searchFilters.titleQuery`, a submit button, and an advanced-options button
 * that opens the settings drawer. The input hydrates from and persists to
 * session storage so the query survives popup re-opens.
 * @param props - The {@link SearchFormProps} controlling submit handling,
 *   placeholder text, and the drawer-toggle override.
 * @returns The search form element.
 * @example
 * ```tsx
 * <SearchForm onSearch={(q) => runSearch(q)} placeholder="Search chemicals..." />
 * // Renders a search box; submitting "acetone" calls onSearch("acetone").
 * ```
 * @source
 */
export const SearchForm: FC<SearchFormProps> = ({
  onSearch,
  onDrawerToggle,
  placeholder = i18n("search_placeholder"),
}) => {
  const appContext = useAppContext();
  const { searchFilters, setSearchFilters } = appContext;
  const query = searchFilters.titleQuery;

  // Set when the typed query is an invalid advanced query; blocks submit until fixed.
  const [searchError, setSearchError] = useState<string | undefined>(undefined);
  // Debounced copy for display only — the message appears after the user pauses typing.
  const hintMessage = useDelayedError(searchError, query, 200);

  // Hydrate the shared title query from the persisted draft in session storage
  // so this field reflects whatever was last typed in any search input — even
  // across popup re-opens. Both this component and DrawerSearchPanel bind to
  // searchFilters.titleQuery, so once context is populated they stay in sync
  // automatically without re-reading the cache.
  useEffect(() => {
    const loadSearchInput = async () => {
      try {
        const data = await cstorage.session.get([CACHE.SEARCH_INPUT]);
        const stored = data[CACHE.SEARCH_INPUT];
        if (typeof stored === "string" && stored && stored !== searchFilters.titleQuery) {
          setSearchFilters({ ...searchFilters, titleQuery: stored });
        }
      } catch (error) {
        console.warn("Failed to load search input from session storage:", { error });
      }
    };
    loadSearchInput();
    // Run once on mount; intentionally don't depend on searchFilters to avoid loops.
  }, []);

  const handleChange = async (value: string) => {
    setSearchFilters({ ...searchFilters, titleQuery: value });
    try {
      await cstorage.session.set({ [CACHE.SEARCH_INPUT]: value });
    } catch (error) {
      console.warn("Failed to persist search input to session storage:", { error });
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searchError) {
      return;
    }
    const trimmed = query.trim();
    if (trimmed) {
      // Clear the live draft so re-opening the drawer doesn't show stale text
      // from the just-submitted query. The parent's onSearch handler is also
      // responsible for clearing CACHE.SEARCH_INPUT in session storage.
      setSearchFilters({ ...searchFilters, titleQuery: "" });
      onSearch(trimmed);
    }
  };

  const handleDrawerToggle = () => {
    if (onDrawerToggle) {
      onDrawerToggle();
    } else {
      appContext.toggleDrawer();
    }
  };

  return (
    <Box className={styles["search-form-container"]} data-testid="search-form-container">
      <SearchFormPaper onSubmit={handleSubmit}>
        <HighlightedSearchInput
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          ariaLabel={i18n("search_form_aria")}
          onValidityChange={(blocked, message) =>
            setSearchError(blocked ? (message ?? i18n("search_invalid_query")) : undefined)
          }
          style={{ marginLeft: 16, flex: 1, fontSize: "1.15rem" }}
        />

        <IconButton
          className={styles["search-form-icon-button"]}
          type="submit"
          aria-label={i18n("search_submit")}
          disabled={!query.trim() || Boolean(searchError)}
        >
          <SearchIcon />
        </IconButton>

        <SearchFormDivider />
        <IconButton
          className={styles["search-form-icon-button"]}
          type="button"
          //color="primary"
          aria-label={i18n("search_advanced_options")}
          onClick={handleDrawerToggle}
        >
          <ScienceIcon />
        </IconButton>
      </SearchFormPaper>

      {hintMessage && (
        <div role="alert" className={styles["search-error-hint"]}>
          {hintMessage}
        </div>
      )}
    </Box>
  );
};
