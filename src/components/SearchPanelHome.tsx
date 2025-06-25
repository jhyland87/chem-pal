import React from "react";
import { useAppContext } from "../context";
import { SearchForm } from "./SearchForm";
import { SearchContainer } from "./StyledComponents";

const RESULTS_TAB_INDEX = 1;

const SearchPanelHome: React.FC = () => {
  const appContext = useAppContext();

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
    <SearchContainer
      style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
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
