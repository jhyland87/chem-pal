import { Science as ScienceIcon, Search as SearchIcon } from "@mui/icons-material";
import { Box, IconButton } from "@mui/material";
import React, { useState } from "react";
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
  const [query, setQuery] = useState("");
  const appContext = useAppContext();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
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
          onChange={(e) => setQuery(e.target.value)}
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
