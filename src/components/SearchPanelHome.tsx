import React from "react";
import { useAppContext } from "../context";
import { useTheme } from "../themes";
import { SearchForm } from "./SearchForm";
import "./SearchPanelHome.scss";
import { SearchContainer } from "./StyledComponents";

const RESULTS_TAB_INDEX = 1;

const SearchPanelHome: React.FC = () => {
  const appContext = useAppContext();
  const { mode } = useTheme();

  const logoSrc = mode === "light" ? "/static/images/logo/Cp7.png" : "/static/images/logo/Cp6.png";

  const handleSearch = async (query: string) => {
    // Save the query to Chrome session storage (same as SearchInput)
    await chrome.storage.session.set({ searchInput: query });
    // Switch to the results panel
    if (typeof appContext.setPanel === "function") {
      appContext.setPanel(RESULTS_TAB_INDEX);
    } else if (typeof appContext.setUserSettings === "function") {
      appContext.setUserSettings({
        ...appContext.userSettings,
      });
    }
  };

  return (
    <SearchContainer className="search-panel-home__container">
      <div className="search-panel-home__inner">
        <div className="search-panel-home__logo-container">
          <img src={logoSrc} alt="Supplier Search Logo" className="search-panel-home__logo" />
        </div>
        <SearchForm
          onSearch={handleSearch}
          placeholder="Search for products..."
          showAdvancedButton={true}
        />
      </div>
    </SearchContainer>
  );
};

export default SearchPanelHome;
