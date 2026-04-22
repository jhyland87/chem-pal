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
  paddingBlock: theme.spacing(0.35),
}));

/**
 * Inline flex wrapper that right-aligns a sequence of per-key {@link HotkeyCombo}
 * chips. Used in the help modal so each modifier / key renders as its own
 * block (e.g. `⌘` `⇧` `R`) — matching the style Onshape uses for its
 * keyboard-shortcuts panel.
 * @source
 */
export const HotkeyComboGroup = styled(Box)(({ theme }) => ({
  display: "inline-flex",
  gap: theme.spacing(0.4),
  justifyContent: "flex-end",
  flexWrap: "wrap",
}));

/**
 * Pill that displays a single key or modifier in a hotkey combo. Colors,
 * border, and inner padding are theme-derived so the pill reads correctly
 * in both light and dark palettes. Multiple chips are grouped inline via
 * {@link HotkeyComboGroup}.
 * @source
 */
export const HotkeyCombo = styled(Box)(({ theme }) => ({
  paddingInline: theme.spacing(0.6),
  paddingBlock: theme.spacing(0.05),
  borderRadius: Number(theme.shape.borderRadius),
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.action.hover,
  minWidth: "1.4rem",
  textAlign: "center",
}));
