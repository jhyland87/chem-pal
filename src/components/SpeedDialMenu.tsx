import { PANEL } from '@/constants/common';
import { useAppContext } from '@/context';
import { i18n } from '@/helpers/i18n';
import AutoDeleteIcon from '@/icons/AutoDeleteIcon';
import ClearIcon from '@/icons/ClearIcon';
import ContrastIcon from '@/icons/ContrastIcon';
import InfoOutlineIcon from '@/icons/InfoOutlineIcon';
import { SupplierCache } from '@/utils/SupplierCache';
import { clearSearchResults } from '@/utils/idbCache';
import BarChartIcon from '@mui/icons-material/BarChart';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import { MouseEvent, useState } from 'react';
import { useTheme } from '../themes';
import AboutModal from './AboutModal';
import HelpTooltip from './HelpTooltip';

/**
 * SpeedDialMenu component that provides quick access to various application actions.
 * Displays a floating action button that expands to show multiple action buttons when clicked.
 * Includes actions for clearing results, clearing cache, toggling theme, stats, and about.
 *
 * @component
 * @category Components
 * @param props - Component props
 *
 * @example
 * ```tsx
 * <SpeedDialMenu speedDialVisibility={true} />
 * ```
 * @source
 */
export default function SpeedDialMenu({ speedDialVisibility }: SpeedDialMenuProps) {
  const appContext = useAppContext();
  const { toggleTheme } = useTheme();
  const [aboutOpen, setAboutOpen] = useState(false);

  /**
   * Handles clearing all search results. Clears the persisted results, empties
   * the in-memory results, and also resets the search query text so the search
   * box the user returns to isn't left showing the previous query. Clearing the
   * results bounces the app back to the home search panel, whose input is
   * controlled by `searchFilters.titleQuery`, so resetting that empties the box.
   * @param event - The click event
   * @source
   */
  const handleClearResults = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    try {
      await clearSearchResults();
    } catch (error) {
      console.warn('Failed to clear search results from IndexedDB:', error);
    }

    console.debug('[handleClearResults] Setting userSettings to:', { ...appContext.userSettings });
    appContext.setUserSettings({ ...appContext.userSettings });

    appContext.setSearchResults([]);
    // Reset the query text so the home search box doesn't keep the old query.
    appContext.setSearchFilters({ ...appContext.searchFilters, titleQuery: '' });
  };

  /**
   * Handles clearing the browser cache.
   * Deletes all cache entries for the application.
   *
   * @param event - The click event
   * @source
   */
  const handleClearCache = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    try {
      await SupplierCache.clearAll();
      console.debug('Supplier cache cleared');
    } catch (error) {
      console.error('Failed to clear supplier cache:', { error });
    }
  };

  /**
   * Handles toggling between light and dark themes using the new theme system.
   *
   * @param event - The click event
   * @source
   */
  const handleToggleTheme = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    toggleTheme();
  };

  /**
   * Handles opening the about modal.
   * @source
   */
  const handleAboutOpen = () => setAboutOpen(true);

  // Stats are recorded in every build; the graphs appear only once the Konami
  // hotkey unlocks advanced mode — in dev builds too, so the toggle is honest.
  const statsVisible = appContext.advancedMode;

  /**
   * Handles navigating to the stats panel. No-op while the stats UI is hidden,
   * so the panel can't be reached outside advanced mode.
   * @source
   */
  const handleStatsOpen = () => {
    if (!statsVisible) return;
    appContext.setPanel?.(PANEL.STATS);
  };

  /**
   * Array of action configurations for the speed dial menu.
   * Each action includes an icon, name, and click handler.
   * The Stats action appears only in advanced mode.
   * @source
   */
  const actions = [
    { icon: <ClearIcon />, name: i18n('speed_dial_clear_results'), onClick: handleClearResults },
    { icon: <AutoDeleteIcon />, name: i18n('speed_dial_clear_cache'), onClick: handleClearCache },
    { icon: <ContrastIcon />, name: i18n('speed_dial_toggle_theme'), onClick: handleToggleTheme },
    ...(statsVisible
      ? [{ icon: <BarChartIcon />, name: i18n('speed_dial_stats'), onClick: handleStatsOpen }]
      : []),
    { icon: <InfoOutlineIcon />, name: i18n('speed_dial_about'), onClick: handleAboutOpen },
  ];

  return (
    <>
      <AboutModal aboutOpen={aboutOpen} setAboutOpen={setAboutOpen} />
      <SpeedDial
        id="speed-dial-menu"
        className={speedDialVisibility ? 'speed-dial-menu open' : 'speed-dial-menu'}
        FabProps={{ size: 'small' }}
        ariaLabel={i18n('speed_dial_aria')}
        sx={{ position: 'fixed', bottom: 6, right: 0 }}
        icon={
          <HelpTooltip text={i18n('speed_dial_hint')}>
            <SpeedDialIcon />
          </HelpTooltip>
        }
      >
        {actions.map((action) => (
          <SpeedDialAction
            id={action.name}
            onClick={(e: MouseEvent<HTMLDivElement>) => {
              // MUI's SpeedDialAction fires a div MouseEvent; handlers only use
              // preventDefault(), which is identical across element types.
              action.onClick(e as unknown as MouseEvent<HTMLAnchorElement>);
            }}
            key={action.name}
            icon={action.icon}
            title={action.name}
          />
        ))}
      </SpeedDial>
    </>
  );
}
