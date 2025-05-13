//import * as React from 'react';
import { Divider, IconButton, InputBase, Paper } from "@mui/material";

import {
  Menu as MenuIcon,
  Science as ScienceIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { useState } from "react";

type SearchInputStates = {
  searchInput: string;
  setSearchInput: (value: string) => void;
};

export default function SearchInput({ searchInput, setSearchInput }: SearchInputStates) {
  const [searchInputValue, setSearchInputValue] = useState<string>(searchInput);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSearchInput(searchInputValue);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInputValue(e.target.value);
  };

  return (
    <>
      <div className="search-input-container fullwidth" style={{ padding: "none" }}>
        <Paper
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", alignItems: "center", width: "100%" }}
        >
          <IconButton aria-label="menu">
            <MenuIcon />
          </IconButton>
          <InputBase
            sx={{ ml: 1, flex: 1 }}
            value={searchInputValue}
            onChange={handleSearchInputChange}
            placeholder="Search..."
            inputProps={{ "aria-label": "Search for chemicals" }}
          />
          <IconButton type="button" aria-label="search">
            <ScienceIcon />
          </IconButton>
          <Divider orientation="vertical" />
          <IconButton color="primary" aria-label="directions">
            <SearchIcon />
          </IconButton>
        </Paper>
      </div>
    </>
  );
}
