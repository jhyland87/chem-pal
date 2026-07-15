import { AppContext } from "@/context";
import { i18n, useLocale } from "@/helpers/i18n";
import { useUserSettings } from "@/hooks/useUserSettings";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import ErrorBoundary from "./components/ErrorBoundary";
import SettingsPanel from "./components/SettingsPanel";
import { ThemeProvider } from "./components/ThemeProvider";

// SettingsPanel and ThemeProvider are the only consumers on this page; both read
// solely userSettings/setUserSettings from context. The remaining AppContextProps
// fields exist for the search/drawer UI (not rendered here), so they get inert
// defaults — enough to satisfy the type without assertions.
const NOOP = () => {};

/**
 * Standalone root for the extension's options page. It reuses the exact
 * `SettingsPanel` from the side drawer, wrapped in the minimal providers that
 * component needs (`AppContext` for settings + `ThemeProvider` for MUI theme and
 * font-size). Settings are owned by {@link useUserSettings}, which shares the
 * `chrome.storage.local` `user_settings` key with the popup/side-panel — so edits
 * here appear there live and vice-versa. The panel fills the page width instead
 * of the drawer's fixed 280px.
 * @returns The options page React tree.
 * @example
 * ```tsx
 * createRoot(document.getElementById("root")!).render(<OptionsApp />);
 * // Renders the full-width Settings panel; changing Currency here also updates
 * // an open popup because both read the shared user_settings storage key.
 * ```
 * @source
 */
export function OptionsApp() {
  // Re-render the whole page when the UI locale changes (language switch).
  useLocale();

  const { userSettings, setUserSettings } = useUserSettings();

  const contextValue: AppContextProps = {
    userSettings,
    setUserSettings,
    searchResults: [],
    setSearchResults: NOOP,
    setDrawerTab: NOOP,
    toggleDrawer: NOOP,
    setSelectedSuppliers: NOOP,
    pendingSearchQuery: null,
    setPendingSearchQuery: NOOP,
    searchFilters: { titleQuery: "", availability: [], country: [], shippingType: [] },
    setSearchFilters: NOOP,
    setBookmarksFolderId: NOOP,
  };

  return (
    <ErrorBoundary fallback={<p>{i18n("app_error_generic")}</p>}>
      <AppContext.Provider value={contextValue}>
        <ThemeProvider>
          <CssBaseline />
          <Box sx={{ width: "100%", maxWidth: 720, mx: "auto", p: 2, boxSizing: "border-box" }}>
            <SettingsPanel />
          </Box>
        </ThemeProvider>
      </AppContext.Provider>
    </ErrorBoundary>
  );
}
