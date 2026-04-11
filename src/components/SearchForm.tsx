import { CACHE } from "@/constants/common";
import { cstorage } from "@/utils/storage";
import { Science as ScienceIcon, Search as SearchIcon } from "@mui/icons-material";
import { Box, IconButton } from "@mui/material";
import React, { useEffect } from "react";
import { useAppContext } from "../context";
import styles from "./SearchForm.module.scss";
import {
  SearchFormDivider,
  SearchFormInput,
  SearchFormPaper,
} from "./StyledComponents";

interface SearchFormProps {
  onSearch: (query: string) => void;
  onDrawerToggle?: () => void;
  placeholder?: string;
  showAdvancedButton?: boolean;
}

export const SearchForm: React.FC<SearchFormProps> = ({
  onSearch,
  onDrawerToggle,
  placeholder = "Search for products...",
}) => {
  const appContext = useAppContext();
  const { searchFilters, setSearchFilters } = appContext;
  const query = searchFilters.titleQuery;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = async (value: string) => {
    setSearchFilters({ ...searchFilters, titleQuery: value });
    try {
      await cstorage.session.set({ [CACHE.SEARCH_INPUT]: value });
    } catch (error) {
      console.warn("Failed to persist search input to session storage:", { error });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    <Box className={styles['search-form-container']}>
      <SearchFormPaper onSubmit={handleSubmit}>
        <SearchFormInput
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          slotProps={{
            input: {
              "aria-label": "search for products",
              autoComplete: "off",
              autoCorrect: "off",
              autoCapitalize: "off",
              spellCheck: "false",
            },
          }}
        />

        <IconButton className={styles['search-form-icon-button']} type="submit" aria-label="search" disabled={!query.trim()}>
          <SearchIcon />
        </IconButton>

        <SearchFormDivider />
        <IconButton
          className={styles['search-form-icon-button']}
          type="button"
          //color="primary"
          aria-label="advanced options"
          onClick={handleDrawerToggle}
        >
          <ScienceIcon />
        </IconButton>
      </SearchFormPaper>
    </Box>
  );
};
