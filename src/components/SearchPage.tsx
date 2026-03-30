import { Settings as SettingsIcon } from "@mui/icons-material";
import { Box, IconButton } from "@mui/material";
import React from "react";
import { useNavigate } from "react-router-dom";
import "../main.scss";
import { useTheme } from "../themes";
import { SearchForm } from "./SearchForm";
import styles from "./SearchPage.module.scss";
import {
  DevBadge,
  SearchContainer,
} from "./StyledComponents";
import { ThemeSwitcher } from "./ThemeSwitcher";

// TODO: Replace with local logo assets if available
import { default as darkLogo, default as lightLogo } from "../assets/react.svg";

interface SearchPageProps {
  onSearch: (query: string) => void;
  onDrawerToggle: () => void;
}

const isDevelopment = process.env.NODE_ENV === "development";

const SearchPage: React.FC<SearchPageProps> = ({ onSearch, onDrawerToggle }) => {
  const navigate = useNavigate();
  const { mode } = useTheme();

  const logo = mode === "light" ? lightLogo : darkLogo;

  const handleSearch = (query: string) => {
    onSearch(query);
    navigate("/results");
  };

  const containerClass = `search-page__container ${isDevelopment ? "search-page__container--dev" : "search-page__container--production"}`;
  const logoClass = `search-page__logo ${isDevelopment ? "search-page__logo--dev" : "search-page__logo--production"}`;
  const wrapperClass = `search-page__search-wrapper ${isDevelopment ? "search-page__search-wrapper--dev" : "search-page__search-wrapper--production"}`;

  return (
    <SearchContainer className={containerClass}>
      {/* Settings Gear - Top Right */}
      <IconButton className={styles['search-page-settings-button']} onClick={onDrawerToggle} size="medium">
        <SettingsIcon />
      </IconButton>

      {/* Theme Switcher - Bottom Right */}
      <Box className={styles['search-page-theme-switcher']}>
        <ThemeSwitcher />
      </Box>

      {isDevelopment && <DevBadge className="search-page__dev-badge">DEV MODE</DevBadge>}

      <div className="search-page__logo-container">
        <img src={logo} alt="Supplier Search" className={logoClass} />
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
