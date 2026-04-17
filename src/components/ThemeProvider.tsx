import { useAppContext } from "@/context";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { FC, ReactNode, useEffect } from "react";
import {
  darkPalette,
  darkTheme,
  lightPalette,
  lightTheme,
  ThemeContext,
  ThemeContextType,
  ThemeMode,
} from "../themes";

interface ThemeProviderProps {
  children: ReactNode;
}

const FONT_SIZE_PX: Record<UserSettings["fontSize"], string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
};

/**
 * Wraps the app in MUI's `ThemeProvider` plus a local `ThemeContext`, and
 * keeps the root `<html>` font-size in sync with `userSettings.fontSize`
 * (small = 14px, medium = 16px, large = 18px). Because every styled
 * component in the project uses `rem`, changing the root size rescales the
 * whole UI proportionally.
 * @param props - Component props.
 * @param props.children - App tree to render under the theme.
 * @returns The children wrapped in `ThemeContext.Provider` and MUI's theme.
 * @example
 * ```tsx
 * <AppContext.Provider value={appValue}>
 *   <ThemeProvider>
 *     <App />
 *   </ThemeProvider>
 * </AppContext.Provider>
 * // Mounting with userSettings.fontSize === "large" sets
 * // <html style="font-size: 18px"> and picks the light/dark theme based on
 * // userSettings.theme.
 * ```
 * @source
 */
export const ThemeProvider: FC<ThemeProviderProps> = ({ children }) => {
  const { userSettings, setUserSettings } = useAppContext();

  useEffect(() => {
    document.documentElement.style.fontSize =
      FONT_SIZE_PX[userSettings.fontSize] ?? FONT_SIZE_PX.medium;
  }, [userSettings.fontSize]);

  const mode: ThemeMode = userSettings.theme === "dark" ? "dark" : "light";

  const toggleTheme = () => {
    setUserSettings({ ...userSettings, theme: mode === "light" ? "dark" : "light" });
  };

  const currentTheme = mode === "light" ? lightTheme : darkTheme;
  const currentPalette = mode === "light" ? lightPalette : darkPalette;

  const themeContextValue: ThemeContextType = {
    mode,
    toggleTheme,
    currentTheme,
    currentPalette,
  };

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <MuiThemeProvider theme={currentTheme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
