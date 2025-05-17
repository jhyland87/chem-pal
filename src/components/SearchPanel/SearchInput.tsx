import MenuIcon from "@mui/icons-material/Menu";
import ScienceIcon from "@mui/icons-material/Science";
import SearchIcon from "@mui/icons-material/Search";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Paper from "@mui/material/Paper";
import { useState } from "react";
import "./SearchInput.scss";

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
