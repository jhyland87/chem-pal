import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialAction from "@mui/material/SpeedDialAction";
import SpeedDialIcon from "@mui/material/SpeedDialIcon";
import { MouseEvent, useEffect, useState } from "react";
import { SpeedDialMenuProps } from "types";
import AutoDeleteIcon from "../assets/icons/AutoDeleteIcon";
import ClearIcon from "../assets/icons/ClearIcon";
import ContrastIcon from "../assets/icons/ContrastIcon";
import InfoOutlineIcon from "../assets/icons/InfoOutlineIcon";
import { useAppContext } from "../context";
import _ from "../lodash";
import AboutModal from "./AboutModal";
import HelpTooltip from "./HelpTooltip";

/**
 * SpeedDialMenu component that provides quick access to various application actions.
 * Displays a floating action button that expands to show multiple action buttons when clicked.
 * Includes actions for clearing results, clearing cache, toggling theme, and showing about information.
 *
 * @component
 * @category Component
 * @param {SpeedDialMenuProps} props - Component props
 * @param {boolean} props.speedDialVisibility - Controls whether the speed dial menu is visible
 *
 * @example
 * ```tsx
 * <SpeedDialMenu speedDialVisibility={true} />
 * ```
 */
export default function SpeedDialMenu({ speedDialVisibility }: SpeedDialMenuProps) {
  const appContext = useAppContext();

  const [, setShowHelp] = useState(false);

  /**
   * Effect hook to show and hide help tooltip based on settings.
   * Shows help tooltip after 500ms and hides it after 2000ms if showHelp is enabled.
   */
  useEffect(() => {
    if (appContext.settings.showHelp === false) return;

    _.delayAction(500, () => setShowHelp(true));
    _.delayAction(2000, () => setShowHelp(false));
  }, [appContext.settings.showHelp]);

  /**
   * Handles clearing all search results.
   * Updates the session storage and triggers a settings update.
   *
   * @param {MouseEvent<HTMLAnchorElement>} event - The click event
   */
  const handleClearResults = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    chrome.storage.session.set({ searchResults: [] });
    appContext.setSettings({
      ...appContext.settings,
      searchResultUpdateTs: new Date().toISOString(),
    });
  };

  /**
   * Handles clearing the browser cache.
   * Deletes all cache entries for the application.
   *
   * @param {MouseEvent<HTMLAnchorElement>} event - The click event
   */
  const handleClearCache = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    caches.keys().then((cacheNames) => {
      return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    });
  };

  /**
   * Handles toggling between light and dark themes.
   * Updates the application settings with the new theme.
   *
   * @param {MouseEvent<HTMLAnchorElement>} event - The click event
   */
  const handleToggleTheme = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    appContext.setSettings({
      ...appContext.settings,
      theme: appContext.settings.theme === "light" ? "dark" : "light",
    });
  };

  const [aboutOpen, setAboutOpen] = useState(false);

  /**
   * Handles opening the about modal.
   */
  const handleAboutOpen = () => setAboutOpen(true);

  /**
   * Array of action configurations for the speed dial menu.
   * Each action includes an icon, name, and click handler.
   */
  const actions = [
    { icon: <ClearIcon />, name: "Clear Results", onClick: handleClearResults },
    { icon: <AutoDeleteIcon />, name: "Clear Cache", onClick: handleClearCache },
    { icon: <ContrastIcon />, name: "Toggle Theme", onClick: handleToggleTheme },
    { icon: <InfoOutlineIcon />, name: "About", onClick: handleAboutOpen },
  ];

  return (
    <>
      <AboutModal aboutOpen={aboutOpen} setAboutOpen={setAboutOpen} />
      <SpeedDial
        id="speed-dial-menu"
        className={speedDialVisibility ? "speed-dial-menu open" : "speed-dial-menu"}
        FabProps={{ size: "small" }}
        ariaLabel="SpeedDial Menu"
        sx={{ position: "fixed", bottom: 6, right: 0 }}
        icon={
          <HelpTooltip text="Bring your cursor to the bottom right corner of the screen to open the menu">
            <SpeedDialIcon />
          </HelpTooltip>
        }
      >
        {actions.map((action) => (
          <SpeedDialAction
            id={action.name}
            onClick={(e: MouseEvent<HTMLDivElement>) => {
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
