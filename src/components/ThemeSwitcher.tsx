import { DarkMode as DarkModeIcon, LightMode as LightModeIcon } from "@mui/icons-material";
import { Tooltip } from "@mui/material";
import React from "react";
import { useTheme } from "../themes";
import { ThemeSwitcherButton } from "./StyledComponents";

interface ThemeSwitcherProps {
  size?: "small" | "medium" | "large";
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ size = "small" }) => {
  const { mode, toggleTheme, currentPalette } = useTheme();

  return (
    <Tooltip title={`Switch to ${mode === "light" ? "dark" : "light"} mode`}>
      <ThemeSwitcherButton
        onClick={toggleTheme}
        size={size}
        currentPalette={currentPalette}
        mode={mode}
      >
        {mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
      </ThemeSwitcherButton>
    </Tooltip>
  );
};
