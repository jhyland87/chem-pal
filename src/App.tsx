import { useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import SearchPage from './components/SearchPage';
import ResultsPage from './components/ResultsPage';
import DrawerSystem from './components/DrawerSystem';
import ErrorBoundary from './components/ErrorBoundary';
import { AppContainer, MainContent } from './components/StyledComponents';
import { generateRandomProductData, type ProductResult } from './utils/mockData';
import './styles/main.scss';
import './App.scss';

function App() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);

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
                    onDrawerToggle={() => setIsDrawerOpen(!isDrawerOpen)}
                  />
                }
              />
              <Route
                path="/results"
                element={
                  <ResultsPage
                    results={searchResults}
                    searchQuery={searchQuery}
                    onNewSearch={handleSearch}
                    onDrawerToggle={() => setIsDrawerOpen(!isDrawerOpen)}
                  />
                }
              />
            </Routes>
          </MainContent>
          <DrawerSystem
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
          />
        </AppContainer>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
