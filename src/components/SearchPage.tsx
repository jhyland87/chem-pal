import { Settings as SettingsIcon } from "@mui/icons-material";
import { Box, IconButton } from "@mui/material";
import { FC } from "react";
import { useNavigate } from "react-router-dom";
import "../main.scss";
import { useTheme } from "../themes";
import { SearchForm } from "./SearchForm";
import styles from "./SearchPage.module.scss";
import { SearchContainer } from "./StyledComponents";
import { ThemeSwitcher } from "./ThemeSwitcher";

/** Landing-page logo served from the extension's static assets (see `public/static/images/logo`). */
const LIGHT_MODE_LOGO = "/static/images/logo/ChemPal-logo.svg";
/** Inverted variant used on the dark theme so the badge stays legible. */
const DARK_MODE_LOGO = "/static/images/logo/ChemPal-logo-inverted.svg";

/**
 * Props for {@link SearchPage}.
 * @example
 * ```tsx
 * const props: SearchPageProps = {
 *   onSearch: (q) => runSearch(q),
 *   onDrawerToggle: () => openDrawer(),
 * };
 * ```
 * @source
 */
interface SearchPageProps {
  /** Called with the submitted query; the page then navigates to `/results`. */
  onSearch: (query: string) => void;
  /** Opens the settings/advanced drawer (settings gear + advanced button). */
  onDrawerToggle: () => void;
}

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * The landing/home view: centered logo, the {@link SearchForm}, a settings
 * gear, and a {@link ThemeSwitcher}. Submitting a search runs `onSearch` and
 * navigates to the results route; shows a "DEV MODE" badge in development.
 * @param props - The {@link SearchPageProps} with the search and drawer-toggle callbacks.
 * @returns The search landing page element.
 * @example
 * ```tsx
 * <SearchPage onSearch={(q) => runSearch(q)} onDrawerToggle={() => openDrawer()} />
 * // Submitting "acetone" calls onSearch("acetone") and navigates to /results.
 * ```
 * @source
 */
const SearchPage: FC<SearchPageProps> = ({ onSearch, onDrawerToggle }) => {
  const navigate = useNavigate();
  const { mode } = useTheme();
  const logo = mode === "light" ? LIGHT_MODE_LOGO : DARK_MODE_LOGO;

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
      <IconButton
        className={styles["search-page-settings-button"]}
        onClick={onDrawerToggle}
        size="medium"
      >
        <SettingsIcon />
      </IconButton>

      {/* Theme Switcher - Bottom Right */}
      <Box className={styles["search-page-theme-switcher"]}>
        <ThemeSwitcher />
      </Box>

      {/* Corner status badges live in <StatusBadges /> at the app level, so they
          render once across every panel and lay out side by side. */}

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
