import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon
} from '@mui/icons-material';
import { isDevelopment, useTheme } from '../themes';
import { ThemeSwitcher } from './ThemeSwitcher';
import { SearchForm } from './SearchForm';
import lightLogo from '../../logos/Cp7.png';
import darkLogo from '../../logos/Cp6.png';
import {
  SearchContainer,
  DevBadge,
  SearchPageSettingsButton,
  SearchPageThemeSwitcher,
} from './StyledComponents';
import '../styles/main.scss';

interface SearchPageProps {
  onSearch: (query: string) => void;
  onDrawerToggle: () => void;
}

const SearchPage: React.FC<SearchPageProps> = ({ onSearch, onDrawerToggle }) => {
  const navigate = useNavigate();
  const { mode } = useTheme();

  const logo = mode === 'light' ? lightLogo : darkLogo;

  const handleSearch = (query: string) => {
    onSearch(query);
    navigate('/results');
  };

  const containerClass = `search-page__container ${isDevelopment ? 'search-page__container--dev' : 'search-page__container--production'}`;
  const logoClass = `search-page__logo ${isDevelopment ? 'search-page__logo--dev' : 'search-page__logo--production'}`;
  const wrapperClass = `search-page__search-wrapper ${isDevelopment ? 'search-page__search-wrapper--dev' : 'search-page__search-wrapper--production'}`;

  return (
    <SearchContainer className={containerClass}>
      {/* Settings Gear - Top Right */}
      <SearchPageSettingsButton
        onClick={onDrawerToggle}
        size="medium"
      >
        <SettingsIcon />
      </SearchPageSettingsButton>

      {/* Theme Switcher - Bottom Right */}
      <SearchPageThemeSwitcher>
        <ThemeSwitcher />
      </SearchPageThemeSwitcher>

      {isDevelopment && (
        <DevBadge className="search-page__dev-badge">
          DEV MODE
        </DevBadge>
      )}

      <div className="search-page__logo-container">
        <img
          src={logo}
          alt="Supplier Search"
          className={logoClass}
        />
      </div>

      <div className={wrapperClass}>
        <SearchForm 
          onSearch={handleSearch}
          onDrawerToggle={onDrawerToggle}
          placeholder="Search for products..."
          showAdvancedButton={true}
        />
      </div>
    </SearchContainer>
  );
};

export default SearchPage;