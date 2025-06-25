import { useState } from "react";
import { Route, HashRouter as Router, Routes } from "react-router-dom";
import DrawerSystem from "./components/DrawerSystem";
import ErrorBoundary from "./components/ErrorBoundary";
import ResultsPage from "./components/ResultsPage";
import SearchPage from "./components/SearchPage";
import { AppContainer, MainContent } from "./components/StyledComponents";
import { createPropertySetter, useSmartStorage } from "./useSmartStorage";
import { generateRandomProductData, type ProductResult } from "./utils/mockData";

import "./App.scss";
import "./styles/main.scss";

const defaultAppState = {
  theme: "light" as "light" | "dark",
  drawerState: false,
  query: "",
};

function App() {
  //const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);

  const [appState, setAppState] = useSmartStorage("appState", defaultAppState, { area: "local" });

  // Create setters for individual properties
  const setDrawerState = createPropertySetter(setAppState, "drawerState");
  const setSearchQuery = createPropertySetter(setAppState, "query");

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Generate random product data using Faker.js
    const generatedResults = generateRandomProductData();
    setSearchResults(generatedResults);
  };

  return (
    <ErrorBoundary>
      <Router>
        <AppContainer>
          <MainContent>
            <Routes>
              <Route
                path="/"
                element={
                  <SearchPage
                    onSearch={handleSearch}
                    onDrawerToggle={() => setDrawerState(!appState.drawerState)}
                  />
                }
              />
              <Route
                path="/results"
                element={
                  <ResultsPage
                    results={searchResults}
                    searchQuery={appState.query}
                    onNewSearch={handleSearch}
                    onDrawerToggle={() => setDrawerState(!appState.drawerState)}
                  />
                }
              />
            </Routes>
          </MainContent>
          <DrawerSystem isOpen={appState.drawerState} onClose={() => setDrawerState(false)} />
        </AppContainer>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
