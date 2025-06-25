import React, { useState } from "react";
import { useAppContext } from "../context";
import SupplierFactory from "../suppliers/SupplierFactory";
import { SearchForm } from "./SearchForm";
import { SearchContainer } from "./StyledComponents";

const RESULTS_TAB_INDEX = 1;

const SearchPanelHome: React.FC = () => {
  const appContext = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const controller = new AbortController();
      const suppliers = appContext.userSettings.suppliers;
      const limit = appContext.userSettings.supplierResultLimit || 10;
      const factory = new SupplierFactory(query, limit, controller, suppliers);
      const results = await factory.executeAll();
      if (typeof appContext.setSearchResults === "function") {
        appContext.setSearchResults(results);
      }
      // Switch to the results tab
      if (typeof appContext.setPanel === "function") {
        appContext.setPanel(RESULTS_TAB_INDEX);
      } else if (typeof appContext.setUserSettings === "function") {
        appContext.setUserSettings({
          ...appContext.userSettings,
        });
      }
    } catch (err) {
      setError("Search failed. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
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
          showAdvancedButton={false}
        />
        {loading && <div style={{ marginTop: 16 }}>Searching suppliers...</div>}
        {error && <div style={{ color: "red", marginTop: 16 }}>{error}</div>}
      </div>
    </SearchContainer>
  );
};

export default SearchPanelHome;
