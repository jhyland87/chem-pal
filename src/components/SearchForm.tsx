import { Science as ScienceIcon, Search as SearchIcon } from "@mui/icons-material";
import React, { useState } from "react";
import {
  SearchFormContainer,
  SearchFormDivider,
  SearchFormIconButton,
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
  showAdvancedButton = true,
}) => {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleSubmit(event);
    }
  };

  return (
    <SearchFormContainer>
      <SearchFormPaper onSubmit={handleSubmit}>
        <SearchFormInput
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          inputProps={{
            "aria-label": "search for products",
            autoComplete: "off",
            autoCorrect: "off",
            autoCapitalize: "off",
            spellCheck: "false",
          }}
        />

        <SearchFormIconButton type="submit" aria-label="search" disabled={!query.trim()}>
          <SearchIcon />
        </SearchFormIconButton>

        {showAdvancedButton && (
          <>
            <SearchFormDivider orientation="vertical" />
            <SearchFormIconButton
              type="button"
              color="primary"
              aria-label="advanced options"
              onClick={onDrawerToggle}
            >
              <ScienceIcon />
            </SearchFormIconButton>
          </>
        )}
      </SearchFormPaper>
    </SearchFormContainer>
  );
};
