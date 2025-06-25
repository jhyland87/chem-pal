import React from "react";
import { useAppContext } from "../context";
import { useTheme } from "../themes";
import { SearchForm } from "./SearchForm";
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
    <SearchContainer
      style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ marginBottom: 40, textAlign: "center" }}>
          <img
            src={logoSrc}
            alt="Supplier Search Logo"
            style={{
              maxWidth: 75,
              width: "100%",
              height: "auto",
              objectFit: "contain",
              filter:
                "drop-shadow(0 2px 4px rgba(0,0,0,0.15)) " +
                "drop-shadow(0 -1px 2px rgba(0,0,0,0.05)) " +
                "drop-shadow(-1px 0 2px rgba(0,0,0,0.05)) " +
                "drop-shadow(1px 0 2px rgba(0,0,0,0.05))",
            }}
          />
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
