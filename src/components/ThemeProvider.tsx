import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import React, { useEffect, useState } from "react";
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
  const [mode, setMode] = useState<ThemeMode>("light");

  // Load theme preference from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as ThemeMode;
    if (savedTheme && (savedTheme === "light" || savedTheme === "dark")) {
      setMode(savedTheme);
    }
  }, []);

  // Save theme preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("theme", mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
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
