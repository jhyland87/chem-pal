import MenuIcon from "@/icons/MenuIcon";
import ScienceIcon from "@/icons/ScienceIcon";
import SearchIcon from "@/icons/SearchIcon";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Paper from "@mui/material/Paper";
import "./SearchInput.scss";
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
 */
export default function SearchInput({ onSearch }: SearchInputStates) {
  const { searchInputValue, isLoading, handleSearchInputChange, handleSubmit } = useSearchInput();

  return (
    <>
      <div className="search-input-container fullwidth">
        <Paper
          className="fullwidth search-query-input-form"
          component="form"
          onSubmit={handleSubmit(onSearch)}
          sx={{
            opacity: isLoading ? 0.7 : 1,
            transition: "opacity 0.2s ease",
          }}
        >
          <IconButton disabled={isLoading} aria-label="menu">
            <MenuIcon />
          </IconButton>

          <InputBase
            value={searchInputValue}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            className="search-query-input fullwidth"
            placeholder={isLoading ? "Searching..." : "Search..."}
            disabled={isLoading}
            inputProps={{ "aria-label": "Search for chemicals" }}
          />

          <IconButton type="button" disabled={isLoading} aria-label="search">
            <ScienceIcon />
          </IconButton>

          <Divider orientation="vertical" />

          <IconButton
            color="primary"
            type="submit"
            disabled={isLoading || !searchInputValue.trim()}
            aria-label="execute search"
          >
            <SearchIcon />
          </IconButton>
        </Paper>

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
