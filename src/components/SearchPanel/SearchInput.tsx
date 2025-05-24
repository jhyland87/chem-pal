import MenuIcon from "@/icons/MenuIcon";
import ScienceIcon from "@/icons/ScienceIcon";
import SearchIcon from "@/icons/SearchIcon";
import { type SearchInputStates } from "@/types/props";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Paper from "@mui/material/Paper";
import { useState } from "react";
import "./SearchInput.scss";

/**
 * SearchInput component that provides a search interface with a text input and action buttons.
 * It includes a menu button, search input field, and search action buttons.
 *
 * @component
 *
 * @param props - Component props
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
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSearchInput(searchInputValue);
  };

  /**
   * Handles changes to the search input field.
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
            // eslint-disable-next-line @typescript-eslint/naming-convention
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
