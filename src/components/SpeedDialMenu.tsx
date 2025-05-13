import AutoDeleteIcon from "@mui/icons-material/AutoDelete";
import ClearIcon from "@mui/icons-material/Clear";
import ContrastIcon from "@mui/icons-material/Contrast";
import SaveIcon from "@mui/icons-material/Save";
import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialAction from "@mui/material/SpeedDialAction";
import SpeedDialIcon from "@mui/material/SpeedDialIcon";
import { MouseEvent, useEffect, useState } from "react";
import { useSettings } from "../context";
import _ from "../lodash";
import HelpTooltip from "./HelpTooltip";

type SpeedDialMenuProps = { speedDialVisibility: boolean };

export default function SpeedDialMenu({ speedDialVisibility }: SpeedDialMenuProps) {
  const settingsContext = useSettings();

  const [, setShowHelp] = useState(false);

  useEffect(() => {
    console.log("settingsContext.settings.showHelp", settingsContext.settings.showHelp);
    if (settingsContext.settings.showHelp === false) return;

    _.delayAction(500, () => setShowHelp(true));
    _.delayAction(2000, () => setShowHelp(false));
  }, [settingsContext.settings.showHelp]);

  const handleClearResults = (event: MouseEvent<HTMLAnchorElement>) => {
    console.debug("clearing results");
    event.preventDefault();
    chrome.storage.local.set({ searchResults: [] });
    settingsContext.setSettings({
      ...settingsContext.settings,
      searchResultUpdateTs: new Date().toISOString(),
    });
  };

  const handleClearCache = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    const CACHE_VERSION = 1;
    const CURRENT_CACHES = {
      query: `query-cache-v${CACHE_VERSION}`,
    };
    const expectedCacheNamesSet = new Set(Object.values(CURRENT_CACHES));
    //event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.debug("Deleting cache:", cacheName);
          return caches.delete(cacheName);
        }),
      );
    });
    //);
  };

  const handleSaveResults = (event: MouseEvent<HTMLAnchorElement>) => {
    console.debug("saving results");
    event.preventDefault();
  };

  const handleToggleTheme = (event: MouseEvent<HTMLAnchorElement>) => {
    console.debug("toggling theme");
    event.preventDefault();

    settingsContext.setSettings({
      ...settingsContext.settings,
      theme: settingsContext.settings.theme === "light" ? "dark" : "light",
    });

    console.debug("settingsContext.settings.theme", settingsContext.settings.theme);
  };

  const actions = [
    { icon: <ClearIcon />, name: "Clear Results", onClick: handleClearResults },
    { icon: <AutoDeleteIcon />, name: "Clear Cache", onClick: handleClearCache },
    { icon: <SaveIcon />, name: "Save Results", onClick: handleSaveResults },
    { icon: <ContrastIcon />, name: "Toggle Theme", onClick: handleToggleTheme },
  ];

  return (
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
  );
}
