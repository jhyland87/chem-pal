import { useAppContext } from "@/context";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import React from "react";
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
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { userSettings, setUserSettings } = useAppContext();

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
