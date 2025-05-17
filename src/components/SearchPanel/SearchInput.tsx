import MenuIcon from "@mui/icons-material/Menu";
import ScienceIcon from "@mui/icons-material/Science";
import SearchIcon from "@mui/icons-material/Search";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Paper from "@mui/material/Paper";
import { useState } from "react";
import "./SearchInput.scss";

/**
 * Props for the SearchInput component
 * @param {string} searchInput - Current search input value
 * @param {Function} setSearchInput - Function to update the search input value
 */
type SearchInputStates = {
  searchInput: string;
  setSearchInput: (value: string) => void;
};

/**
 * SearchInput component that provides a search interface with a text input and action buttons.
 * It includes a menu button, search input field, and search action buttons.
 *
 * @component
 *
 * @param {SearchInputStates} props - Component props
 * @param {string} props.searchInput - Current search input value
 * @param {Function} props.setSearchInput - Function to update the search input value
 *
 * @example
 * ```tsx
 * <SearchInput
 *   searchInput={currentSearch}
 *   setSearchInput={handleSearchChange}
 * />
 * ```
 */
export default function SearchInput({ searchInput, setSearchInput }: SearchInputStates) {
  const [searchInputValue, setSearchInputValue] = useState<string>(searchInput);

  /**
   * Handles form submission and updates the search input.
   * @param {React.FormEvent<HTMLFormElement>} e - Form submission event
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSearchInput(searchInputValue);
  };

  /**
   * Handles changes to the search input field.
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInputValue(e.target.value);
  };

  return (
    <>
      <div className="search-input-container fullwidth">
        <Paper
          className="fullwidth search-query-input-form"
          component="form"
          onSubmit={handleSubmit}
          //sx={{ display: "flex", alignItems: "center", width: "100%" }}
        >
          <IconButton aria-label="menu">
            <MenuIcon />
          </IconButton>
          <InputBase
            //sx={{ ml: 1, flex: 1 }}
            value={searchInputValue}
            onChange={handleSearchInputChange}
            className="search-query-input fullwidth"
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
