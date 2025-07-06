import { Science as ScienceIcon, Search as SearchIcon } from "@mui/icons-material";
import React, { useState } from "react";
import { useAppContext } from "../context";
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
}) => {
  const [query, setQuery] = useState("");
  const appContext = useAppContext();

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

  const handleDrawerToggle = () => {
    if (onDrawerToggle) {
      onDrawerToggle();
    } else {
      appContext.toggleDrawer();
    }
  };

  return (
    <SearchFormContainer>
      <SearchFormPaper onSubmit={handleSubmit}>
        <SearchFormInput
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyPress}
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

        <SearchFormIconButton type="submit" aria-label="search" disabled={!query.trim()}>
          <SearchIcon />
        </SearchFormIconButton>

        <SearchFormDivider />
        <SearchFormIconButton
          type="button"
          //color="primary"
          aria-label="advanced options"
          onClick={handleDrawerToggle}
        >
          <ScienceIcon />
        </SearchFormIconButton>
      </SearchFormPaper>
    </SearchFormContainer>
  );
};
