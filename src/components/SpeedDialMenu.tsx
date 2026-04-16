import { PANEL } from "@/constants/common";
import { useAppContext } from "@/context";
import AutoDeleteIcon from "@/icons/AutoDeleteIcon";
import ClearIcon from "@/icons/ClearIcon";
import ContrastIcon from "@/icons/ContrastIcon";
import InfoOutlineIcon from "@/icons/InfoOutlineIcon";
import SupplierCache from "@/utils/SupplierCache";
import { clearSearchResults } from "@/utils/idbCache";
import BarChartIcon from "@mui/icons-material/BarChart";
import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialAction from "@mui/material/SpeedDialAction";
import SpeedDialIcon from "@mui/material/SpeedDialIcon";
import { MouseEvent, useState } from "react";
import { useTheme } from "../themes";
import AboutModal from "./AboutModal";
import HelpTooltip from "./HelpTooltip";

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
   * Handles clearing all search results.
   * Updates the session storage and triggers a settings update.
   *
   * @param event - The click event
   * @source
   */
  const handleClearResults = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    try {
      await clearSearchResults();
    } catch (error) {
      console.warn("Failed to clear search results from IndexedDB:", error);
    }

    console.debug("[handleClearResults] Setting userSettings to:", { ...appContext.userSettings });
    appContext.setUserSettings({ ...appContext.userSettings });

    const badgeText = await chrome.action.getBadgeText({});
    if (badgeText !== "" && badgeText !== null) {
      await chrome.action.setBadgeText({ text: "0" });
      setTimeout(async () => {
        console.debug("[handleClearResults] Cleared results from session storage");
        await chrome.action.setBadgeText({ text: "" });
      }, 1000);
      console.debug("[handleClearResults] Cleared results from session storage");
    }

    appContext.setSearchResults([]);
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
      console.debug("Supplier cache cleared");
    } catch (error) {
      console.error("Failed to clear supplier cache:", { error });
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

  /**
   * Handles navigating to the stats panel.
   * @source
   */
  const handleStatsOpen = () => {
    appContext.setPanel?.(PANEL.STATS);
  };

  /**
   * Array of action configurations for the speed dial menu.
   * Each action includes an icon, name, and click handler.
   * @source
   */
  const actions = [
    { icon: <ClearIcon />, name: "Clear Results", onClick: handleClearResults },
    { icon: <AutoDeleteIcon />, name: "Clear Cache", onClick: handleClearCache },
    { icon: <ContrastIcon />, name: "Toggle Theme", onClick: handleToggleTheme },
    { icon: <BarChartIcon />, name: "Stats", onClick: handleStatsOpen },
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
