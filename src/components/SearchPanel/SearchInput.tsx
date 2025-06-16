import MenuIcon from "@/icons/MenuIcon";
import ScienceIcon from "@/icons/ScienceIcon";
import SearchIcon from "@/icons/SearchIcon";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Paper from "@mui/material/Paper";
import { useEffect, useState } from "react";
import "./SearchInput.scss";

/**
 * SearchInput component that provides a search interface with a text input and action buttons.
 * It includes a menu button, search input field, and search action buttons.
 *
 * Fixed version that properly handles Chrome storage without using use() hook incorrectly.
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
  const [searchInputValue, setSearchInputValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Handles form submission and triggers search
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchInputValue.trim()) {
      setIsLoading(true);
      onSearch?.(searchInputValue.trim());
      // Reset loading state after a short delay
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  // Load the search input from Chrome storage on component mount
  useEffect(() => {
    chrome.storage.session
      .get(["searchInput"])
      .then((data) => {
        if (data.searchInput) {
          setSearchInputValue(data.searchInput);
        }
      })
      .catch((error) => {
        console.warn("Failed to load search input from Chrome storage:", error);
      });
  }, []);

  /**
   * Handles changes to the search input field and saves to Chrome storage
   */
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchInputValue(newValue);

    // Save to Chrome storage
    chrome.storage.session
      .set({ searchInput: newValue })
      .then(() => {
        console.log("searchInput saved as:", newValue);
      })
      .catch((error) => {
        console.error("Failed to save search input:", error);
      });
  };

  return (
    <>
      <div className="search-input-container fullwidth">
        <Paper
          className="fullwidth search-query-input-form"
          component="form"
          onSubmit={handleSubmit}
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
            onChange={handleSearchInputChange}
            className="search-query-input fullwidth"
            placeholder={isLoading ? "Searching..." : "Search..."}
            disabled={isLoading}
            // eslint-disable-next-line @typescript-eslint/naming-convention
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
          />
        )}
      </div>
    </>
  );
}
