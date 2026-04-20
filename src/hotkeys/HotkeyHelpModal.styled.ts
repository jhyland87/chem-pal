import Box from "@mui/material/Box";
import { styled } from "@mui/material/styles";

/**
 * Theme-aware wrapper for the HotkeyHelpModal body. Static positioning,
 * sizing, and outline are applied via the sibling SCSS module.
 * @source
 */
export const HotkeyHelpBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  borderRadius: Number(theme.shape.borderRadius) * 2,
  boxShadow: theme.shadows[24],
  paddingInline: theme.spacing(2),
  paddingBlock: theme.spacing(1.5),
}));

/**
 * Styled row wrapping a combo badge + description in the help modal.
 * Gap and vertical padding use theme.spacing so they scale with the
 * active theme's density; flex layout is static and lives in SCSS.
 * @source
 */
export const HotkeyRow = styled(Box)(({ theme }) => ({
  gap: theme.spacing(1.25),
  paddingBlock: theme.spacing(0.25),
}));

/**
 * Pill that displays the key combo for a hotkey. Colors, border, and inner
 * padding are all theme-derived so the pill reads correctly in both light
 * and dark palettes.
 * @source
 */
export const HotkeyCombo = styled(Box)(({ theme }) => ({
  paddingInline: theme.spacing(0.75),
  paddingBlock: theme.spacing(0.125),
  borderRadius: Number(theme.shape.borderRadius),
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.action.hover,
}));
