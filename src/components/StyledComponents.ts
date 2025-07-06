import {
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { darkPalette, designTokens, lightPalette } from "../themes";

// === APP COMPONENTS ===

// === SEARCH PAGE COMPONENTS ===

// Main container with dynamic background gradient
export const SearchContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(2),
  width: process.env.NODE_ENV !== "production" ? "100vw" : "100%",
  maxWidth: "100%",
  margin: "0 auto",
}));

// Search field with dynamic theming and colors
export const SearchField = styled(TextField)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  boxShadow: designTokens.shadows.medium,
  border: `1px solid ${theme.palette.grey[300]}`,

  "&:focus-within": {
    boxShadow: designTokens.shadows.high,
    border: `1px solid ${theme.palette.primary.main}40`,
  },

  "& .MuiOutlinedInput-root": {
    backgroundColor: theme.palette.background.paper,
    "& fieldset": {
      border: "none",
    },
    "&:hover fieldset": {
      border: "none",
    },
    "&.Mui-focused fieldset": {
      border: "none",
    },
  },

  "& .MuiInputBase-input": {
    color: theme.palette.text.primary,
  },
}));

// Search button with dynamic theming
export const SearchButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text.primary,
  backgroundColor: "transparent",
  transition: "0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
  "&:disabled": {
    color: theme.palette.text.disabled,
  },
}));

// Development badge - small transparent badge in bottom left corner
export const DevBadge = styled(Box)(({ theme }) => ({
  position: "fixed",
  bottom: "8px",
  left: "8px",
  backgroundColor: `${theme.palette.error.main}E6`, // 90% opacity
  color: theme.palette.error.contrastText,
  padding: "4px 8px",
  borderRadius: designTokens.borderRadius.small,
  fontSize: "0.65rem",
  fontWeight: 500,
  zIndex: 9999,
  backdropFilter: "blur(4px)",
  border: `1px solid ${theme.palette.error.main}60`, // 38% opacity border
  boxShadow: "0 1px 4px rgba(0, 0, 0, 0.2)",
  width: "fit-content",
  height: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  whiteSpace: "nowrap",
  userSelect: "none",
  pointerEvents: "none",
}));

// Menu button with theme colors and positioning
export const MenuButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  top: "16px",
  right: "16px",
  zIndex: 10,
  backgroundColor: theme.palette.background.paper,
  boxShadow: designTokens.shadows.low,
  color: theme.palette.text.primary,
  transition: "0.3s cubic-bezier(0.4, 0, 0.2, 1)",

  "&:hover": {
    backgroundColor: theme.palette.grey[100],
    transform: "translateY(-1px)",
  },
}));

// === RESULTS PAGE COMPONENTS ===

// === DRAWER COMPONENTS ===

// Main drawer container
export const DrawerContainer = styled(Box)(() => ({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
}));

// Accordion summary with reduced font size
export const StyledAccordionSummary = styled(AccordionSummary)(() => ({
  "& .MuiAccordionSummary-content": {
    "& .MuiTypography-root": {
      fontSize: "0.85rem",
      fontWeight: 500,
    },
  },
}));

// Accordion details with reduced font size
export const StyledAccordionDetails = styled(AccordionDetails)(() => ({
  "& .MuiTypography-root": {
    fontSize: "0.8rem",
  },
  "& .MuiFormControlLabel-label": {
    fontSize: "0.8rem",
  },
}));

// Accordion details with no padding (for supplier list)
export const StyledAccordionDetailsNoPadding = styled(AccordionDetails)(() => ({
  padding: 0,
  "& .MuiTypography-root": {
    fontSize: "0.8rem",
  },
  "& .MuiFormControlLabel-label": {
    fontSize: "0.8rem",
  },
}));

// Chip container for availability options
export const ChipContainer = styled(Box)(() => ({
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
}));

// Supplier list with scrolling
export const SupplierList = styled(List)(() => ({
  maxHeight: 200,
  overflow: "auto",
  width: "100%",
}));

// Supplier list item with hover effects
export const SupplierListItem = styled(ListItem)(({ theme }) => ({
  paddingLeft: theme.spacing(1),
  paddingRight: theme.spacing(1),
  border: "none",
  backgroundColor: "transparent",
  width: "100%",
  textAlign: "left",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

// List item text with margin
export const StyledListItemText = styled(ListItemText)(({ theme }) => ({
  marginLeft: theme.spacing(1),
}));

// Typography with margin bottom for settings
export const SettingsTypography = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

// === PAGINATION COMPONENTS ===

// Pagination container
export const PaginationContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px",
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

// Page size selector container
export const PageSizeContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

// Page size select
export const PageSizeSelect = styled(Select)(({ theme }) => ({
  minWidth: 80,
  size: "small",
  "& .MuiSelect-select": {
    padding: theme.spacing(0.5),
  },
}));

// Navigation buttons container
export const NavigationContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

// Column menu item container
export const ColumnMenuItemContainer = styled(Box)(({ theme }) => ({
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
}));

// Filter icon button with conditional styling
export const FilterIconButton = styled(IconButton, {
  shouldForwardProp: (prop) =>
    prop !== "isActive" && prop !== "activeColor" && prop !== "textColor",
})<{
  isActive: boolean;
  activeColor: string;
  textColor: string;
}>(({ isActive, activeColor, textColor }) => ({
  color: isActive ? activeColor : textColor,
  backgroundColor: isActive ? `${activeColor}15` : "transparent",
}));

// Settings icon with color
export const ColoredIconButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== "iconColor",
})<{ iconColor: string }>(({ iconColor }) => ({
  "& .MuiSvgIcon-root": {
    color: iconColor,
  },
}));

// Back button with themed color
export const BackIconButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== "iconColor",
})<{ iconColor: string }>(({ iconColor }) => ({
  "& .MuiSvgIcon-root": {
    color: iconColor,
  },
}));

// === TABLE CELL COMPONENTS ===
export const StyledTableCell = styled(TableCell)(() => ({
  padding: "2px 0 0 0",
}));

// Empty state cell
export const EmptyStateCell = styled(StyledTableCell)(({ theme }) => ({
  textAlign: "center",
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
  color: theme.palette.text.secondary,
  fontStyle: "italic",
}));

// Header right section with controls
export const HeaderRight = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
}));

// Table header cell with sorting
export const SortableTableHeaderCell = styled(StyledTableCell, {
  shouldForwardProp: (prop) => prop !== "canSort" && prop !== "cellWidth",
})<{
  canSort: boolean;
  cellWidth: number;
}>(({ theme, canSort, cellWidth }) => ({
  fontWeight: 600,
  cursor: canSort ? "pointer" : "default",
  width: `${cellWidth}px`,
  minWidth: `${cellWidth}px`,
  maxWidth: `${cellWidth}px`,
  backgroundColor: theme.palette.background.paper,
}));

// Filter cell with fixed sizing
export const FilterTableCell = styled(StyledTableCell, {
  shouldForwardProp: (prop) => prop !== "cellWidth",
})<{ cellWidth: number }>(({ theme, cellWidth }) => ({
  padding: "4px 8px",
  width: `${cellWidth}px`,
  minWidth: `${cellWidth}px`,
  maxWidth: `${cellWidth}px`,
  backgroundColor: theme.palette.background.paper,
}));

// Filter text field
export const FilterTextField = styled(TextField)(() => ({
  width: "100%",
  "& .MuiOutlinedInput-root": {
    height: "28px",
    fontSize: "0.65rem",
  },
  "& .MuiOutlinedInput-input": {
    padding: "4px 8px",
  },
}));

// === SEARCH FORM COMPONENTS ===

export const SearchFormContainer = styled(Box)(() => ({
  position: "relative",
  width: "100%",
  maxWidth: 600,
}));

export const SearchFormPaper = styled("form")(({ theme }) => ({
  padding: "2px 4px",
  display: "flex",
  alignItems: "center",
  width: "100%",
  boxShadow: theme.shadows[2],
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.spacing(1),
}));

export const SearchFormInput = styled(TextField)(({ theme }) => ({
  marginLeft: theme.spacing(2),
  flex: 1,
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      border: "none",
    },
    "&:hover fieldset": {
      border: "none",
    },
    "&.Mui-focused fieldset": {
      border: "none",
    },
  },
  "& .MuiInputBase-input": {
    fontSize: "1.15rem",
  },
}));

export const SearchFormIconButton = styled(IconButton)(() => ({
  padding: "10px",
}));

export const SearchFormDivider = styled(Box)(({ theme }) => ({
  height: 28,
  margin: theme.spacing(0.5),
  borderLeft: `1px solid ${theme.palette.divider}`,
}));

// === SEARCH PAGE COMPONENTS ===

export const SearchPageSettingsButton = styled(IconButton)(() => ({
  position: "absolute",
  top: 8,
  right: 8,
  zIndex: 1000,
}));

export const SearchPageThemeSwitcher = styled(Box)(() => ({
  position: "fixed",
  bottom: 16,
  right: 16,
  zIndex: 1000,
}));

// === THEME SWITCHER COMPONENTS ===

export const ThemeSwitcherButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== "currentPalette" && prop !== "mode",
})<{ currentPalette: typeof lightPalette | typeof darkPalette; mode: string }>(
  ({ currentPalette, mode }) => ({
    color: currentPalette.text,
    "&:hover": {
      backgroundColor:
        mode === "light" ? `${currentPalette.notificationBg}15` : `${currentPalette.text}15`,
    },
  }),
);

export const AppMainBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  width: "100%",
}));

export const LoadingIndicatorBox = styled(Box)(() => ({
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  height: 2,
  backgroundColor: "#1976d2", // fallback color if theme is not used
  zIndex: 9999,
  animation: "pulse 1s infinite",
}));

export const StyledTableRow = styled(TableRow)(() => ({
  // You can add default styles for all table rows here if needed
}));

// Sub-row styling
export const SubRowTableRow = styled(StyledTableRow, {
  shouldForwardProp: (prop) => prop !== "isSubRow",
})<{ isSubRow: boolean }>(({ theme, isSubRow }) => ({
  backgroundColor: isSubRow ? theme.palette.action.hover : "transparent",
}));

// === SEARCH PANEL HOME COMPONENTS ===

export const SearchPanelHomeContainer = styled(SearchContainer)(() => ({
  minHeight: "75vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  paddingTop: "4vh",
}));

export const SearchPanelHomeContent = styled(Box)(() => ({
  width: "100%",
  maxWidth: 480,
  position: "relative",
  marginTop: "6vh",
}));

export const SearchPanelHomeLogoContainer = styled(Box)(() => ({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  marginBottom: 32,
}));

export const SearchPanelHomeLogo = styled("img")(() => ({
  maxWidth: 100,
  maxHeight: 100,
  display: "block",
  margin: "0 auto",
  filter: "drop-shadow(rgba(0, 0, 0, 0.3) 0px 2px 5px)",
}));

export const SearchPanelHomeForwardButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== "isDarkTheme",
})<{ isDarkTheme?: boolean }>(({ theme, isDarkTheme }) => ({
  position: "absolute",
  top: 16,
  right: 16,
  color: theme.palette.text.primary,
  background: theme.palette.background.paper,
  boxShadow: theme.shadows[1],
  zIndex: 2,
  "& .MuiBadge-badge": {
    backgroundColor: isDarkTheme ? "#ffffff" : "#1976d2", // Light for dark theme, dark blue for light theme
    color: isDarkTheme ? "#000000" : "#ffffff", // Dark text for light badge, white text for dark badge
    fontSize: "0.65rem",
    minWidth: "16px",
    height: "16px",
    padding: "0 4px",
  },
}));

export const SearchPanelHomeSettingsButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  top: 16,
  right: 56, // Position to the left of the forward button
  color: theme.palette.text.primary,
  background: theme.palette.background.paper,
  boxShadow: theme.shadows[1],
  zIndex: 2,
}));

export const StyledTable = styled(Table)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: `0 0 8px 8px`, // Only bottom corners rounded
  "& .MuiTableBody-root": {
    backgroundColor: theme.palette.background.paper,
  },
  "& .MuiTableRow-root": {
    backgroundColor: theme.palette.background.paper,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

export const StyledTableHead = styled(TableHead)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: 0,
}));

export const StyledTableBody = styled(TableBody)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: 0,
}));

// === ERROR BOUNDARY COMPONENTS ===

export const ErrorBoundaryContainer = styled(Box)(({ theme }) => ({
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: theme.palette.background.default,
  padding: theme.spacing(3),
}));

export const ErrorBoundaryPaper = styled(Paper)(({ theme }) => ({
  maxWidth: 600,
  width: "100%",
  padding: theme.spacing(4),
  textAlign: "center",
  backgroundColor: theme.palette.background.paper,
}));

export const ErrorBoundaryIcon = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  "& .MuiSvgIcon-root": {
    fontSize: 64,
    color: theme.palette.error.main,
  },
}));

export const ErrorBoundaryMessage = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

export const ErrorDetailsContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(3),
  backgroundColor: theme.palette.grey[50],
  textAlign: "left",
  maxHeight: 200,
  overflow: "auto",
}));

export const ErrorDetailsText = styled(Typography)(() => ({
  fontSize: "0.75rem",
  fontFamily: "monospace",
  whiteSpace: "pre-wrap",
}));

export const ErrorDetailsTextWithMargin = styled(Typography)(({ theme }) => ({
  fontSize: "0.75rem",
  marginTop: theme.spacing(1),
  fontFamily: "monospace",
  whiteSpace: "pre-wrap",
}));

export const ErrorBoundaryActions = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(2),
  justifyContent: "center",
}));

export const ErrorBoundaryButton = styled(Button)(() => ({
  minWidth: 120,
}));

export const ErrorIdText = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(3),
  display: "block",
}));
