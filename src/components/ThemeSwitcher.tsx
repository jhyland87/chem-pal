import { DarkMode as DarkModeIcon, LightMode as LightModeIcon } from "@mui/icons-material";
import { Tooltip } from "@mui/material";
import { FC } from "react";
import { useTheme } from "../themes";
import { ThemeSwitcherButton } from "./StyledComponents";

/**
 * Props for {@link ThemeSwitcher}.
 * @example
 * ```tsx
 * const props: ThemeSwitcherProps = { size: "medium" };
 * ```
 * @source
 */
interface ThemeSwitcherProps {
  /** Icon button size. Defaults to `"small"`. */
  size?: "small" | "medium" | "large";
}

/**
 * A tooltip-wrapped icon button that toggles between light and dark theme
 * modes, showing the icon for the mode it will switch *to*.
 * @param props - The {@link ThemeSwitcherProps} (the button `size`).
 * @returns The theme-toggle button element.
 * @example
 * ```tsx
 * <ThemeSwitcher size="medium" />
 * // In light mode renders a dark-mode icon; clicking calls toggleTheme().
 * ```
 * @source
 */
export const ThemeSwitcher: FC<ThemeSwitcherProps> = ({ size = "small" }) => {
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
