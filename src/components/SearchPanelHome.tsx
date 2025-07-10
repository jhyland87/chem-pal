import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SettingsIcon from "@mui/icons-material/Settings";
import Badge from "@mui/material/Badge";
import React, { useEffect, useState } from "react";
import { useAppContext } from "../context";
import { useTheme as useCustomTheme } from "../themes";
import { SearchForm } from "./SearchForm";
import {
  SearchPanelHomeContainer,
  SearchPanelHomeContent,
  SearchPanelHomeForwardButton,
  SearchPanelHomeLogo,
  SearchPanelHomeLogoContainer,
  SearchPanelHomeSettingsButton,
} from "./StyledComponents";

const RESULTS_TAB_INDEX = 1;

const SearchPanelHome: React.FC = () => {
  const appContext = useAppContext();
  const { mode } = useCustomTheme();
  const [hasStoredResults, setHasStoredResults] = useState(false);
  const [resultCount, setResultCount] = useState(0);

  useEffect(() => {
    if (appContext.searchResults && appContext.searchResults.length > 0) {
      setHasStoredResults(true);
      setResultCount(appContext.searchResults.length);
    } else {
      chrome.storage.session.get(["searchResults"]).then((data) => {
        if (data.searchResults && data.searchResults.length > 0) {
          setHasStoredResults(true);
          setResultCount(data.searchResults.length);
        }
      });
    }
  }, [appContext.searchResults]);

  const handleSearch = async (query: string) => {
    // Save the query to Chrome session storage (same as SearchInput)
    await chrome.storage.session.set({
      searchInput: query,
      isNewSearch: true, // Flag to indicate this is a new search submission
    });
    // Switch to the results panel
    if (typeof appContext.setPanel === "function") {
      appContext.setPanel(RESULTS_TAB_INDEX);
    } else if (typeof appContext.setUserSettings === "function") {
      appContext.setUserSettings({
        ...appContext.userSettings,
      });
    }
  };

  // Use only Cp7 for light and Cp6 for dark
  const logoSrc =
    mode === "dark"
      ? "/static/images/logo/ChemPal-logo-v2-inverted.png"
      : "/static/images/logo/ChemPal-logo-v2.png";

  return (
    <SearchPanelHomeContainer>
      {/* Settings button in upper right */}
      <SearchPanelHomeSettingsButton
        onClick={() => appContext.toggleDrawer()}
        aria-label="Open settings"
      >
        <SettingsIcon />
      </SearchPanelHomeSettingsButton>

      {/* Forward arrow in upper right, only if there are results */}
      {hasStoredResults && appContext.setPanel && (
        <SearchPanelHomeForwardButton
          onClick={() => appContext.setPanel!(RESULTS_TAB_INDEX)}
          aria-label="Go to results"
          isDarkTheme={mode === "dark"}
        >
          <Badge badgeContent={resultCount} color="primary">
            <ArrowForwardIcon />
          </Badge>
        </SearchPanelHomeForwardButton>
      )}
      <SearchPanelHomeContent>
        {/* Logo always visible at the top */}
        <SearchPanelHomeLogoContainer>
          <SearchPanelHomeLogo src={logoSrc} alt="Supplier Search Logo" />
        </SearchPanelHomeLogoContainer>
        <SearchForm
          onSearch={handleSearch}
          placeholder="Search for products..."
          showAdvancedButton={false}
        />
      </SearchPanelHomeContent>
    </SearchPanelHomeContainer>
  );
};

export default SearchPanelHome;
