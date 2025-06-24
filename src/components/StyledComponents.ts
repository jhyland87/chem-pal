import { styled } from '@mui/material/styles';
import { Box, Paper, Typography, TextField, IconButton, TableRow, TableCell, AccordionSummary, AccordionDetails, List, ListItem, ListItemText, Select, Button, InputBase, Divider } from '@mui/material';
import { designTokens, isDevelopment } from '../themes';

// === APP COMPONENTS ===

// Main app container with dynamic sizing and background
export const AppContainer = styled(Box)(({ theme }) => ({
  width: isDevelopment ? '100vw' : '100%',
  //height: isDevelopment ? '100vh' : '400px',
  //maxHeight: '600px',
  backgroundColor: theme.palette.background.default,
  position: 'relative',
  overflow: 'hidden',
  ...(isDevelopment && {
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
  }),
}));

// Main content area
export const MainContent = styled(Box)(() => ({
  height: '100%',
  ...(isDevelopment && {
    flex: 1,
  }),
}));

// === SEARCH PAGE COMPONENTS ===

// Main container with dynamic background gradient
export const SearchContainer = styled(Box)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`,
}));

// Search field with dynamic theming and colors
export const SearchField = styled(TextField)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  boxShadow: designTokens.shadows.medium,
  border: `1px solid ${theme.palette.grey[300]}`,

  '&:focus-within': {
    boxShadow: designTokens.shadows.high,
    border: `1px solid ${theme.palette.primary.main}40`,
  },

  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.palette.background.paper,
    '& fieldset': {
      border: 'none',
    },
    '&:hover fieldset': {
      border: 'none',
    },
    '&.Mui-focused fieldset': {
      border: 'none',
    },
  },

  '& .MuiInputBase-input': {
    color: theme.palette.text.primary,
  },
}));

// Search button with dynamic theming
export const SearchButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text.primary,
  backgroundColor: 'transparent',
  transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:disabled': {
    color: theme.palette.text.disabled,
  },
}));

// Development badge - small transparent badge in bottom left corner
export const DevBadge = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: '8px',
  left: '8px',
  backgroundColor: `${theme.palette.error.main}E6`, // 90% opacity
  color: theme.palette.error.contrastText,
  padding: '4px 8px',
  borderRadius: designTokens.borderRadius.small,
  fontSize: '0.65rem',
  fontWeight: 500,
  zIndex: 9999,
  backdropFilter: 'blur(4px)',
  border: `1px solid ${theme.palette.error.main}60`, // 38% opacity border
  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.2)',
  width: 'fit-content',
  height: 'fit-content',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  pointerEvents: 'none',
}));

// Menu button with theme colors and positioning
export const MenuButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: '16px',
  right: '16px',
  zIndex: 10,
  backgroundColor: theme.palette.background.paper,
  boxShadow: designTokens.shadows.low,
  color: theme.palette.text.primary,
  transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',

  '&:hover': {
    backgroundColor: theme.palette.grey[100],
    transform: 'translateY(-1px)',
  },
}));

// === RESULTS PAGE COMPONENTS ===

// Results page container
export const ResultsContainer = styled(Box)(({ theme }) => ({
  height: '100%',
  minHeight: isDevelopment ? '400px' : '400px',
  backgroundColor: theme.palette.background.default,
  padding: '12px',
  overflow: 'auto',
}));

// Results page header
export const ResultsHeader = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '12px',
  padding: '0 2px',
}));

// Header left section
export const HeaderLeft = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}));

// Search bar in header
export const HeaderSearchField = styled(TextField)(({ theme }) => ({
  minWidth: isDevelopment ? '400px' : '300px',
  backgroundColor: theme.palette.background.paper,
  borderRadius: designTokens.borderRadius.medium,
  boxShadow: designTokens.shadows.low,

  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.palette.background.paper,
    '& fieldset': {
      borderColor: theme.palette.grey[300],
    },
    '&:hover fieldset': {
      borderColor: theme.palette.primary.main,
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main,
    },
  },
}));

// Results container paper
export const ResultsPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: designTokens.borderRadius.medium,
  boxShadow: designTokens.shadows.medium,
  overflow: 'hidden',
}));

// Results title
export const ResultsTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  marginBottom: '16px',
  fontWeight: 500,
}));

// Table row with hover effects
export const StyledTableRow = styled(TableRow)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  transition: theme.transitions.create('background-color'),
  cursor: 'pointer',

  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

// Table cell with consistent styling
export const StyledTableCell = styled(TableCell)(({ theme }) => ({
  color: theme.palette.text.primary,
  padding: '4px 8px',
  fontSize: '0.85rem',
  lineHeight: 1.2,
}));

// Description text
export const DescriptionText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  maxWidth: '200px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

// Compact expand button for dense table
export const CompactExpandButton = styled(IconButton)(({ theme }) => ({
  padding: '2px',
  minWidth: '20px',
  width: '20px',
  height: '20px',
  color: theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
  },
}));

// === DRAWER COMPONENTS ===

// Main drawer container
export const DrawerContainer = styled(Box)(() => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}));

// Accordion summary with reduced font size
export const StyledAccordionSummary = styled(AccordionSummary)(() => ({
  '& .MuiAccordionSummary-content': {
    '& .MuiTypography-root': {
      fontSize: '0.85rem',
      fontWeight: 500,
    },
  },
}));

// Accordion details with reduced font size
export const StyledAccordionDetails = styled(AccordionDetails)(() => ({
  '& .MuiTypography-root': {
    fontSize: '0.8rem',
  },
  '& .MuiFormControlLabel-label': {
    fontSize: '0.8rem',
  },
}));

// Accordion details with no padding (for supplier list)
export const StyledAccordionDetailsNoPadding = styled(AccordionDetails)(() => ({
  padding: 0,
  '& .MuiTypography-root': {
    fontSize: '0.8rem',
  },
  '& .MuiFormControlLabel-label': {
    fontSize: '0.8rem',
  },
}));

// Chip container for availability options
export const ChipContainer = styled(Box)(() => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
}));

// Supplier list with scrolling
export const SupplierList = styled(List)(() => ({
  maxHeight: 200,
  overflow: 'auto',
  width: '100%',
}));

// Supplier list item with hover effects
export const SupplierListItem = styled(ListItem)(({ theme }) => ({
  paddingLeft: theme.spacing(1),
  paddingRight: theme.spacing(1),
  border: 'none',
  backgroundColor: 'transparent',
  width: '100%',
  textAlign: 'left',
  '&:hover': {
    backgroundColor: theme.palette.action.hover
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

// Theme switcher with fixed positioning
export const FixedThemeSwitcher = styled(Box)(() => ({
  position: 'fixed',
  bottom: 16,
  right: 16,
  zIndex: 1000,
}));

// Header right section with controls
export const HeaderRight = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}));

// Product cell container with indentation
export const ProductCellContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'depth',
})<{ depth: number }>(({ depth }) => ({
  paddingLeft: `${depth * 1}rem`,
  display: 'flex',
  alignItems: 'center',
}));

// Product typography with consistent styling
export const ProductTypography = styled(Typography)(() => ({
  fontWeight: 500,
  lineHeight: 1.2,
}));

// Supplier/shipping/country typography
export const CellTypography = styled(Typography)(() => ({
  lineHeight: 1.2,
}));

// Price typography with primary color
export const PriceTypography = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.primary.main,
  lineHeight: 1.2,
}));

// Availability typography with dynamic color
export const AvailabilityTypography = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'availabilityColor',
})<{ availabilityColor: string }>(({ availabilityColor }) => ({
  color: availabilityColor,
  lineHeight: 1.2,
}));

// Table header cell with sorting
export const SortableTableHeaderCell = styled(StyledTableCell, {
  shouldForwardProp: (prop) => prop !== 'canSort' && prop !== 'cellWidth',
})<{
  canSort: boolean;
  cellWidth: number;
}>(({ theme, canSort, cellWidth }) => ({
  fontWeight: 600,
  cursor: canSort ? 'pointer' : 'default',
  width: `${cellWidth}px`,
  minWidth: `${cellWidth}px`,
  maxWidth: `${cellWidth}px`,
  backgroundColor: theme.palette.background.paper,
}));

// Filter cell with fixed sizing
export const FilterTableCell = styled(StyledTableCell, {
  shouldForwardProp: (prop) => prop !== 'cellWidth',
})<{ cellWidth: number }>(({ theme, cellWidth }) => ({
  padding: '4px 8px',
  width: `${cellWidth}px`,
  minWidth: `${cellWidth}px`,
  maxWidth: `${cellWidth}px`,
  backgroundColor: theme.palette.background.paper,
}));

// Filter text field
export const FilterTextField = styled(TextField)(() => ({
  width: '100%',
  '& .MuiOutlinedInput-root': {
    height: '28px',
    fontSize: '0.65rem',
  },
  '& .MuiOutlinedInput-input': {
    padding: '4px 8px',
  },
}));

// Sub-row styling
export const SubRowTableRow = styled(StyledTableRow, {
  shouldForwardProp: (prop) => prop !== 'isSubRow',
})<{ isSubRow: boolean }>(({ theme, isSubRow }) => ({
  backgroundColor: isSubRow ? theme.palette.action.hover : 'transparent',
}));

// Empty state cell
export const EmptyStateCell = styled(StyledTableCell)(({ theme }) => ({
  textAlign: 'center',
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
  color: theme.palette.text.secondary,
  fontStyle: 'italic',
}));

// Pagination container
export const PaginationContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px',
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

// Page size selector container
export const PageSizeContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

// Page size select
export const PageSizeSelect = styled(Select)(({ theme }) => ({
  minWidth: 80,
  size: 'small',
  '& .MuiSelect-select': {
    padding: theme.spacing(0.5),
  },
}));

// Navigation buttons container
export const NavigationContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
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
  shouldForwardProp: (prop) => prop !== 'isActive' && prop !== 'activeColor' && prop !== 'textColor',
})<{
  isActive: boolean;
  activeColor: string;
  textColor: string;
}>(({ isActive, activeColor, textColor }) => ({
  color: isActive ? activeColor : textColor,
  backgroundColor: isActive ? `${activeColor}15` : 'transparent',
}));

// Settings icon with color
export const ColoredIconButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'iconColor',
})<{ iconColor: string }>(({ iconColor }) => ({
  '& .MuiSvgIcon-root': {
    color: iconColor,
  },
}));

// === ERROR BOUNDARY COMPONENTS ===

// Error boundary main container
export const ErrorBoundaryContainer = styled(Box)(({ theme }) => ({
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.background.default,
  padding: theme.spacing(3),
}));

// Error boundary paper container
export const ErrorBoundaryPaper = styled(Paper)(({ theme }) => ({
  maxWidth: 600,
  width: '100%',
  padding: theme.spacing(4),
  textAlign: 'center',
  backgroundColor: theme.palette.background.paper,
}));

// Error icon styling
export const ErrorBoundaryIcon = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  '& .MuiSvgIcon-root': {
    fontSize: 64,
    color: theme.palette.error.main,
  },
}));

// Error message typography
export const ErrorBoundaryMessage = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

// Error details container (dev only)
export const ErrorDetailsContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(3),
  backgroundColor: theme.palette.grey[50],
  textAlign: 'left',
  maxHeight: 200,
  overflow: 'auto',
}));

// Error details text
export const ErrorDetailsText = styled(Typography)(() => ({
  fontSize: '0.75rem',
  fontFamily: 'monospace',
  whiteSpace: 'pre-wrap',
}));

// Error details text with margin
export const ErrorDetailsTextWithMargin = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  marginTop: theme.spacing(1),
  fontFamily: 'monospace',
  whiteSpace: 'pre-wrap',
}));

// Error boundary actions container
export const ErrorBoundaryActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  justifyContent: 'center',
}));

// Error boundary action button
export const ErrorBoundaryButton = styled(Button)(() => ({
  minWidth: 120,
}));

// Error ID typography
export const ErrorIdText = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(3),
  display: 'block',
}));

// === SEARCH FORM COMPONENTS ===

// Search form container
export const SearchFormContainer = styled(Box)(() => ({
  position: 'relative',
  width: '100%',
  maxWidth: 600,
}));

// Search form paper
export const SearchFormPaper = styled('form')(({ theme }) => ({
  padding: '2px 4px',
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  boxShadow: theme.shadows[2],
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.spacing(1),
}));

// Search form input
export const SearchFormInput = styled(InputBase)(({ theme }) => ({
  marginLeft: theme.spacing(2),
  flex: 1,
}));

// Search form icon button
export const SearchFormIconButton = styled(IconButton)(() => ({
  padding: '10px',
}));

// Search form divider
export const SearchFormDivider = styled(Divider)(({ theme }) => ({
  height: 28,
  margin: theme.spacing(0.5),
}));

// === SEARCH PAGE COMPONENTS ===

// Search page settings button
export const SearchPageSettingsButton = styled(IconButton)(() => ({
  position: 'absolute',
  top: 8,
  right: 8,
  zIndex: 1000,
}));

// Search page theme switcher
export const SearchPageThemeSwitcher = styled(Box)(() => ({
  position: 'fixed',
  bottom: 16,
  right: 16,
  zIndex: 1000,
}));

// === THEME SWITCHER COMPONENTS ===

// Theme switcher icon button
export const ThemeSwitcherButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'currentPalette' && prop !== 'mode',
})<{ currentPalette: { text: string; notificationBg: string }; mode: string }>(({ currentPalette, mode }) => ({
  color: currentPalette.text,
  '&:hover': {
    backgroundColor: mode === 'light'
      ? `${currentPalette.notificationBg}15`
      : `${currentPalette.text}15`,
  },
}));

// === RESULTS PAGE COMPONENTS ===

// Back button with themed color
export const BackIconButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'iconColor',
})<{ iconColor: string }>(({ iconColor }) => ({
  '& .MuiSvgIcon-root': {
    color: iconColor,
  },
}));