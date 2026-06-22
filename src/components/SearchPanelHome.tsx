import { CACHE, PANEL } from "@/constants/common";
import { getSearchResults } from "@/utils/idbCache";
import { cstorage } from "@/utils/storage";
import { isTabView, openExtensionTab } from "@/utils/displayContext";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SettingsIcon from "@mui/icons-material/Settings";
import Badge from "@mui/material/Badge";
import { useEffect, useState, FC } from "react";
import { useAppContext } from "../context";
import { useTheme as useCustomTheme } from "../themes";
import { SearchForm } from "./SearchForm";
import styles from "./SearchPanelHome.module.scss";
import {
  SearchPanelHomeContainer,
  SearchPanelHomeForwardButton,
  SearchPanelHomeMaximizeButton,
  SearchPanelHomeSettingsButton,
  SearchPanelHomeTopBar,
} from "./StyledComponents";

/**
 * The popup's home panel. Shows the search entry point and, when a previous
 * search's results are cached, a summary with the result count plus a button to
 * jump back into them. Reads and persists state via app context.
 * @returns The home panel element.
 * @example
 * ```tsx
 * // Rendered as the default popup view.
 * <SearchPanelHome />
 * ```
 * @source
 */
const SearchPanelHome: FC = () => {
  const appContext = useAppContext();
  const { mode } = useCustomTheme();
  const [hasStoredResults, setHasStoredResults] = useState(false);
  const [resultCount, setResultCount] = useState(0);

  useEffect(() => {
    if (appContext.searchResults && appContext.searchResults.length > 0) {
      setHasStoredResults(true);
      setResultCount(appContext.searchResults.length);
    } else {
      const loadStoredResults = async () => {
        try {
          const results = await getSearchResults();
          if (results.length > 0) {
            setHasStoredResults(true);
            setResultCount(results.length);
          } else {
            setHasStoredResults(false);
            setResultCount(0);
          }
        } catch (error) {
          console.warn("Failed to load search results from IndexedDB:", { error });
        }
      };
      loadStoredResults();
    }
  }, [appContext.searchResults]);

  const handleSearch = async (query: string) => {
    // Commit the submitted query to session storage and clear the live
    // in-progress value — once a search is submitted, CACHE.QUERY becomes the
    // source of truth and CACHE.SEARCH_INPUT (the unsubmitted draft) should
    // reset so the next visit to any search field starts empty.
    await cstorage.session.set({
      [CACHE.QUERY]: query,
      [CACHE.SEARCH_INPUT]: "",
      [CACHE.SEARCH_IS_NEW_SEARCH]: true, // Flag to indicate this is a new search submission
    });
    // Switch to the results panel
    if (typeof appContext.setPanel === "function") {
      appContext.setPanel(PANEL.RESULTS);
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
      {/* Header icons in the upper right, ordered left-to-right */}
      <SearchPanelHomeTopBar>
        {/* Settings */}
        <SearchPanelHomeSettingsButton
          onClick={() => appContext.toggleDrawer()}
          aria-label="Open settings"
        >
          <SettingsIcon />
        </SearchPanelHomeSettingsButton>

        {/* Forward arrow, only if there are results */}
        {hasStoredResults && appContext.setPanel && (
          <SearchPanelHomeForwardButton
            onClick={() => appContext.setPanel!(PANEL.RESULTS)}
            aria-label="Go to results"
            isDarkTheme={mode === "dark"}
          >
            <Badge badgeContent={resultCount} color="primary">
              <ArrowForwardIcon />
            </Badge>
          </SearchPanelHomeForwardButton>
        )}

        {/* Maximize: open in a full tab. Last icon, popup/side-panel only. */}
        {!isTabView() && (
          <SearchPanelHomeMaximizeButton
            onClick={() => void openExtensionTab()}
            aria-label="Open in tab"
          >
            <OpenInNewIcon />
          </SearchPanelHomeMaximizeButton>
        )}
      </SearchPanelHomeTopBar>
      <div className={styles["search-panel-home-content"]}>
        {/* Logo always visible at the top */}
        <div className={styles["search-panel-home-logo-container"]}>
          <img
            className={styles["search-panel-home-logo"]}
            src={logoSrc}
            alt="Supplier Search Logo"
          />
        </div>
        <SearchForm
          onSearch={handleSearch}
          placeholder="Search for products..."
          showAdvancedButton={false}
        />
      </div>
    </SearchPanelHomeContainer>
  );
};

export default SearchPanelHome;
