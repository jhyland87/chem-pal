import { CACHE, DRAWER_INDEX, PANEL } from '@/constants/common';
import { i18n } from '@/helpers/i18n';
import { isTabView, openExtensionTab } from '@/utils/displayContext';
import { getSearchResults } from '@/utils/idbCache';
import { cstorage } from '@/utils/storage';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsIcon from '@mui/icons-material/Settings';
import Badge from '@mui/material/Badge';
import { FC, useEffect, useState } from 'react';
import { useAppContext } from '../context';
import { useTheme as useCustomTheme } from '../themes';
import { SearchForm } from './SearchForm';
import styles from './SearchPanelHome.module.scss';
import {
  SearchPanelHomeContainer,
  SearchPanelHomeForwardButton,
  SearchPanelHomeMaximizeButton,
  SearchPanelHomeSettingsButton,
  SearchPanelHomeTopBar,
} from './StyledComponents';

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
          console.warn('Failed to load search results from IndexedDB:', { error });
        }
      };
      loadStoredResults();
    }
  }, [appContext.searchResults]);

  const handleSearch = async (query: string) => {
    // Persist the submitted query (source of truth for the results header label
    // and reopen restore) and reset CACHE.SEARCH_INPUT (the unsubmitted draft) so
    // the next visit to any search field starts empty.
    //
    // Deliberately NOT setting CACHE.SEARCH_IS_NEW_SEARCH: that flag routes the
    // trigger through a shared-storage inbox that only App.tsx's onChanged bridge
    // (full-tab view only) consumes, so whichever context isn't the tab never runs
    // the search, and the consuming context can starve the submitting one (e.g. a
    // popup submit clears the tab but not the popup). Instead trigger locally via
    // pendingSearchQuery — the same path the drawer and history panels use — so the
    // submitting context reliably clears and runs its own search.
    await cstorage.session.set({
      [CACHE.QUERY]: query,
      [CACHE.SEARCH_INPUT]: '',
    });
    appContext.setPendingSearchQuery(query);
    // Show the results panel; SearchPanel (re)mounts and its useSearch effect picks
    // up the pending query set above.
    if (typeof appContext.setPanel === 'function') {
      appContext.setPanel(PANEL.RESULTS);
    } else if (typeof appContext.setUserSettings === 'function') {
      appContext.setUserSettings({
        ...appContext.userSettings,
      });
    }
  };

  // Use only Cp7 for light and Cp6 for dark
  const logoSrc =
    mode === 'dark'
      ? '/static/images/logo/ChemPal-logo-inverted.png'
      : '/static/images/logo/ChemPal-logo.png';

  return (
    <SearchPanelHomeContainer>
      {/* Header icons in the upper right, ordered left-to-right */}
      <SearchPanelHomeTopBar>
        {/* Settings */}
        <SearchPanelHomeSettingsButton
          onClick={() => appContext.toggleDrawer(DRAWER_INDEX.SETTINGS)}
          aria-label={i18n('search_open_settings')}
        >
          <SettingsIcon />
        </SearchPanelHomeSettingsButton>

        {/* Forward arrow, only if there are results */}
        {hasStoredResults && appContext.setPanel && (
          <SearchPanelHomeForwardButton
            onClick={() => appContext.setPanel!(PANEL.RESULTS)}
            aria-label={i18n('search_go_to_results')}
            isDarkTheme={mode === 'dark'}
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
            aria-label={i18n('common_open_in_tab')}
          >
            <OpenInNewIcon />
          </SearchPanelHomeMaximizeButton>
        )}
      </SearchPanelHomeTopBar>
      <div className={styles['search-panel-home-content']}>
        {/* Logo always visible at the top */}
        <div className={styles['search-panel-home-logo-container']}>
          <img
            className={styles['search-panel-home-logo']}
            src={logoSrc}
            alt={i18n('search_logo_alt')}
          />
        </div>
        <SearchForm
          onSearch={handleSearch}
          placeholder={i18n('search_placeholder')}
          showAdvancedButton={false}
        />
      </div>
    </SearchPanelHomeContainer>
  );
};

export default SearchPanelHome;
