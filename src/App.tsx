import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, useTheme } from "@mui/material/styles";
import "./App.scss";
//import { extensionId } from "../config.json";
import { useEffect, useState } from "react";
import "./__mocks__/chromeStorageMock";
import ErrorBoundary from "./components/ErrorBoundary";
import FavoritesPanel from "./components/FavoritesPanel";
import HistoryPanel from "./components/HistoryPanel";
import SearchPanel from "./components/SearchPanel/SearchPanel";
import SettingsPanel from "./components/SettingsPanel";
import SpeedDialMenu from "./components/SpeedDialMenu";
import SuppliersPanel from "./components/SuppliersPanel";
import TabHeader from "./components/TabHeader";
import TabPanel from "./components/TabPanel";
import { AppContext } from "./context";
import SupplierFactory from "./suppliers/SupplierFactory";
import { darkTheme, lightTheme } from "./themes";
import { Settings } from "./types";

/**
 * Main application component that manages the overall layout and state.
 * The App component serves as the root component of the application, providing:
 * - Theme management (light/dark mode)
 * - Tab-based navigation
 * - Global settings management
 * - Speed dial menu for quick actions
 * - Error boundary for graceful error handling
 *
 * @component
 *
 * @example
 * ```tsx
 * // The App component is typically rendered at the root level
 * ReactDOM.render(
 *   <App />,
 *   document.getElementById('root')
 * );
 * ```
 */
function App() {
  const theme = useTheme();
  const [panel, setPanel] = useState(0);
  const [currentTheme, setCurrentTheme] = useState(lightTheme);
  const [speedDialVisibility, setSpeedDialVisibility] = useState(false);
  // 55 would be so right when their cursor gets to where the center of the speed dial menu
  // would be, it would open. But setting it to a lower value (eg: 30) makes it so it won't
  // show unless they go all the way to the bottom right corner of the screen, making it
  // less likely to pop up when you're just scrolling through results. This might have its
  // own annoyance of having to reposition the cursor once it's open, but I think it's
  // better this way.
  const cornerThreshold = 30;

  // The logic in the useEffect is to determine if the cursor is in the right position to
  // show the speed dial menu.
  //  1) If the cursor is within ${cornerThreshold} pixels of the bottom right corner of
  //     the screen, then the speed dial menu is shown.
  //  2) If the cursor is neither in the bottom right corner nor over the expanded element
  //     for the speed dial menu, then the speed dial menu is hidden.
  //  Note: This logic is used becuase we don't want the menu to go away once the user
  //        moves their cursor out of the bottom right corner to select one of the menu
  //        options.
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setSpeedDialVisibility(
        document.getElementById("speed-dial-menu")?.matches(":hover") ||
          (event.x >= window.innerWidth - cornerThreshold &&
            event.y >= window.innerHeight - cornerThreshold),
      );
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Default settings
  const [settings, setSettings] = useState<Settings>({
    showHelp: false,
    caching: true,
    autocomplete: true,
    currency: "usd",
    location: "",
    shipsToMyLocation: false,
    foo: "bar",
    jason: false,
    antoine: true,
    popupSize: "small",
    autoResize: true,
    someSetting: false,
    suppliers: SupplierFactory.supplierList(),
    theme: "light",
    showColumnFilters: true,
    showAllColumns: false,
    hideColumns: ["description", "uom"],
    columnFilterConfig: {},
  });

  // Load the settings from storage.local on the initial component load
  useEffect(() => {
    chrome.storage.session.get(["settings", "panel"]).then((data) => {
      if (data.settings) setSettings({ ...data.settings });
      if (data.panel) setPanel(data.panel);
    });
  }, []);

  // Save the settings to storage.local when the settings change
  useEffect(() => {
    chrome.storage.session.set({ settings, panel });
    setCurrentTheme(settings.theme === "light" ? lightTheme : darkTheme);
  }, [settings, panel]);

  return (
    <ErrorBoundary fallback={<p>Something went wrong</p>}>
      <AppContext.Provider value={{ settings, setSettings }}>
        <ThemeProvider theme={currentTheme}>
          <CssBaseline />
          <Box sx={{ bgcolor: "background.default", width: "100%" }}>
            <AppBar position="static" sx={{ borderRadius: 1 }}>
              <TabHeader page={panel} setPage={setPanel} />
              <TabPanel value={panel} name="search-panel" index={0} dir={theme.direction}>
                <SearchPanel />
              </TabPanel>
              <TabPanel value={panel} name="suppliers-panel" index={1} dir={theme.direction}>
                <SuppliersPanel />
              </TabPanel>
              <TabPanel value={panel} name="favorites-panel" index={2} dir={theme.direction}>
                <FavoritesPanel />
              </TabPanel>
              <TabPanel value={panel} name="history-panel" index={3} dir={theme.direction}>
                <HistoryPanel />
              </TabPanel>
              <TabPanel value={panel} name="settings-panel" index={4} dir={theme.direction}>
                <SettingsPanel />
              </TabPanel>
            </AppBar>
            <SpeedDialMenu speedDialVisibility={speedDialVisibility} />
          </Box>
        </ThemeProvider>
      </AppContext.Provider>
    </ErrorBoundary>
  );
}

export default App;
