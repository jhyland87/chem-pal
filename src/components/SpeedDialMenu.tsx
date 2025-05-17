import AutoDeleteIcon from "@mui/icons-material/AutoDelete";
import ClearIcon from "@mui/icons-material/Clear";
import ContrastIcon from "@mui/icons-material/Contrast";
import InfoOutlineIcon from "@mui/icons-material/InfoOutline";
import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialAction from "@mui/material/SpeedDialAction";
import SpeedDialIcon from "@mui/material/SpeedDialIcon";
import { MouseEvent, useEffect, useState } from "react";
import { useAppContext } from "../context";
import _ from "../lodash";
import AboutModal from "./AboutModal";
import HelpTooltip from "./HelpTooltip";

type SpeedDialMenuProps = { speedDialVisibility: boolean };

export default function SpeedDialMenu({ speedDialVisibility }: SpeedDialMenuProps) {
  const appContext = useAppContext();

  const [, setShowHelp] = useState(false);

  useEffect(() => {
    if (appContext.settings.showHelp === false) return;

    _.delayAction(500, () => setShowHelp(true));
    _.delayAction(2000, () => setShowHelp(false));
  }, [appContext.settings.showHelp]);

  const handleClearResults = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    chrome.storage.local.set({ searchResults: [] });
    appContext.setSettings({
      ...appContext.settings,
      searchResultUpdateTs: new Date().toISOString(),
    });
  };

  const handleClearCache = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    //event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    });
    //);
  };

  const handleToggleTheme = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    appContext.setSettings({
      ...appContext.settings,
      theme: appContext.settings.theme === "light" ? "dark" : "light",
    });
  };

  const [aboutOpen, setAboutOpen] = useState(false);
  const handleAboutOpen = () => setAboutOpen(true);

  const actions = [
    { icon: <ClearIcon />, name: "Clear Results", onClick: handleClearResults },
    { icon: <AutoDeleteIcon />, name: "Clear Cache", onClick: handleClearCache },
    //{ icon: <SaveIcon />, name: "Save Results", onClick: handleSaveResults },
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
