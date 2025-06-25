import { createTheme, type Theme } from "@mui/material/styles";
import { createContext, useContext } from "react";

// Design tokens
export const designTokens = {
  spacing: {
    drawerWidth: 280,
    drawerWidthDev: 320,
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 16,
  },
  shadows: {
    low: "0 1px 3px rgba(0, 0, 0, 0.12)",
    medium: "0 4px 6px rgba(0, 0, 0, 0.1)",
    high: "0 10px 20px rgba(0, 0, 0, 0.15)",
    dark: "0 4px 20px rgba(0, 0, 0, 0.3)",
  },
  transitions: {
    fast: "150ms",
    standard: "300ms",
    slow: "500ms",
  },
};

// Color palettes
export const lightPalette = {
  text: "#1a1a1a",
  primaryInterface: "#ffffff",
  paperBackground: "#f8f9fa",
  notificationBg: "#007bff",
  lightGray: "#f0f0f0",
  borderLight: "#e0e0e0",
  drawerBackground: "#ffffff",
  expandedBackground: "#f3f7fa",
  activeBackground: "#f5f5f5",
  borders: "#e0e0e0",
  hoverBackground: "#f5f5f5",
} as typeof darkPalette;

export const darkPalette = {
  text: "#e0e0e0",
  primaryInterface: "#2d3748",
  paperBackground: "#1a202c",
  notificationBg: "#4299e1",
  lightGray: "#4a5568",
  borderLight: "#4a5568",
  drawerBackground: "#272e3d",
  expandedBackground: "#19222b",
  activeBackground: "#2d3748",
  borders: "#4a5568",
  hoverBackground: "#374151",
};

// Global component overrides that both themes will use
const globalComponentOverrides = {
  MuiDrawer: {
    styleOverrides: {
      paper: {
        width: "280px",
        // Color will be set via theme-specific overrides below
      },
    },
  },
  MuiAccordion: {
    styleOverrides: {
      root: {
        backgroundColor: "transparent",
        boxShadow: "none",
        border: "none",
        borderRadius: 0,
        margin: 0,
        "&:before": {
          display: "none",
        },
        "&.Mui-expanded": {
          margin: 0,
        },
      },
    },
  },
  MuiAccordionSummary: {
    styleOverrides: {
      root: {
        backgroundColor: "transparent",
        height: "36px",
        minHeight: "36px",
        maxHeight: "36px",
        padding: "0 16px",
        fontSize: "0.875rem",
        "& .MuiAccordionSummary-content": {
          margin: "8px 0",
        },
        "& .MuiAccordionSummary-expandIconWrapper": {
          fontSize: "1.2rem",
        },
        "&.Mui-expanded": {
          minHeight: "36px",
          height: "36px",
        },
      },
    },
  },
  MuiAccordionDetails: {
    styleOverrides: {
      root: {
        padding: "8px 16px 12px",
      },
    },
  },
  MuiTabs: {
    styleOverrides: {
      root: {
        minHeight: "36px",
        "& .MuiTab-root": {
          minWidth: "60px",
          padding: "6px 8px",
          minHeight: "36px",
          fontSize: "0.65rem",
          textTransform: "uppercase",
        },
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        "& .MuiInputBase-input": {
          padding: "6px 8px",
        },
        "& .MuiInputLabel-root": {
          fontSize: "0.8rem",
        },
        "& .MuiOutlinedInput-root": {
          fontSize: "0.8rem",
        },
        // Drawer-specific spacing
        ".MuiDrawer-paper &": {
          marginBottom: "10px",
        },
      },
    },
  },
  MuiFormControlLabel: {
    styleOverrides: {
      root: {
        fontSize: "0.875rem",
        marginBottom: "8px",
      },
    },
  },
  MuiSlider: {
    styleOverrides: {
      root: {
        marginBottom: "12px",
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        fontSize: "0.7rem",
        height: "24px",
        "& .MuiChip-label": {
          padding: "0 6px",
        },
      },
    },
  },
};

// Light theme
export const lightTheme: Theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: lightPalette.notificationBg,
      contrastText: lightPalette.text,
    },
    background: {
      default: lightPalette.paperBackground,
      paper: lightPalette.primaryInterface,
    },
    text: {
      primary: lightPalette.text,
      secondary: `${lightPalette.text}CC`,
    },
    grey: {
      100: lightPalette.lightGray,
      200: lightPalette.borderLight,
      300: lightPalette.borders,
    },
    divider: lightPalette.borderLight,
  },
  shape: {
    borderRadius: designTokens.borderRadius.medium,
  },
  spacing: 8,
  components: {
    ...globalComponentOverrides,
    MuiDrawer: {
      styleOverrides: {
        paper: {
          ...globalComponentOverrides.MuiDrawer.styleOverrides.paper,
          backgroundColor: lightPalette.drawerBackground,
          color: lightPalette.text,
          borderLeft: `1px solid ${lightPalette.borderLight}`,
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiAccordion.styleOverrides.root,
          backgroundColor: lightPalette.expandedBackground,
          color: lightPalette.text,
          borderBottom: `1px solid ${lightPalette.borderLight}`,
          "&:hover": {
            backgroundColor: lightPalette.hoverBackground,
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiAccordionSummary.styleOverrides.root,
          backgroundColor: lightPalette.expandedBackground,
          color: lightPalette.text,
          "&:hover": {
            backgroundColor: lightPalette.hoverBackground,
          },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiAccordionDetails.styleOverrides.root,
          backgroundColor: lightPalette.expandedBackground,
          color: lightPalette.text,
        },
      },
    },
    MuiList: {
      defaultProps: {
        dense: true,
      },
      styleOverrides: {
        root: {
          backgroundColor: lightPalette.expandedBackground,
          color: lightPalette.text,
          borderRadius: designTokens.borderRadius.small,
        },
      },
    },
    MuiTableCell: {
      defaultProps: {
        size: "small",
      },
      styleOverrides: {
        root: {
          padding: [6, 16],
          borderBottom: `1px solid ${lightPalette.borderLight}`,
        },
      },
    },
    MuiTable: {
      defaultProps: {
        size: "small",
      },
      styleOverrides: {
        root: {
          "& tbody tr:hover": {
            backgroundColor: lightPalette.hoverBackground,
            cursor: "context-menu",
            transition: "background-color 0.15s ease-in-out",
          },
        },
      },
    },
    MuiSpeedDial: {
      styleOverrides: {
        root: {
          position: "fixed",
          bottom: 6,
          right: 0,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          color: "white",
          fontSize: 12,
          padding: [4, 8],
          borderRadius: 4,
          maxWidth: 200,
          textAlign: "center",
          fontFamily: "Arial, sans-serif",
          fontWeight: "bold",
          textShadow: "0 0 1px rgba(0, 0, 0, 0.5)",
          opacity: 0.8,
          transition: "opacity 0.3s ease-in-out",
          "&:hover": {
            opacity: 1,
          },
        },
      },
    },
  },
});

// Dark theme
export const darkTheme: Theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: darkPalette.notificationBg,
      contrastText: darkPalette.text,
    },
    background: {
      default: darkPalette.paperBackground,
      paper: darkPalette.primaryInterface,
    },
    text: {
      primary: darkPalette.text,
      secondary: `${darkPalette.text}CC`,
    },
    grey: {
      100: darkPalette.lightGray,
      200: darkPalette.borderLight,
      300: darkPalette.borders,
    },
    divider: darkPalette.borderLight,
  },
  shape: {
    borderRadius: designTokens.borderRadius.medium,
  },
  spacing: 8,
  components: {
    ...globalComponentOverrides,
    MuiDrawer: {
      styleOverrides: {
        paper: {
          ...globalComponentOverrides.MuiDrawer.styleOverrides.paper,
          backgroundColor: darkPalette.drawerBackground,
          color: darkPalette.text,
          borderLeft: `1px solid ${darkPalette.borderLight}`,
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiAccordion.styleOverrides.root,
          backgroundColor: darkPalette.expandedBackground,
          color: darkPalette.text,
          borderBottom: `1px solid ${darkPalette.borderLight}`,
          "&:hover": {
            backgroundColor: darkPalette.hoverBackground,
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiAccordionSummary.styleOverrides.root,
          backgroundColor: darkPalette.expandedBackground,
          color: darkPalette.text,
          "&:hover": {
            backgroundColor: darkPalette.hoverBackground,
          },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiAccordionDetails.styleOverrides.root,
          backgroundColor: darkPalette.expandedBackground,
          color: darkPalette.text,
        },
      },
    },
    MuiList: {
      defaultProps: {
        dense: true,
      },
      styleOverrides: {
        root: {
          backgroundColor: darkPalette.expandedBackground,
          color: darkPalette.text,
          borderRadius: designTokens.borderRadius.small,
        },
      },
    },
    MuiTableCell: {
      defaultProps: {
        size: "small",
      },
      styleOverrides: {
        root: {
          padding: [6, 16],
          borderBottom: `1px solid ${darkPalette.borderLight}`,
        },
      },
    },
    MuiTable: {
      defaultProps: {
        size: "small",
      },
      styleOverrides: {
        root: {
          "& tbody tr:hover": {
            backgroundColor: darkPalette.hoverBackground,
            cursor: "context-menu",
            transition: "background-color 0.15s ease-in-out",
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          color: "white",
          fontSize: 12,
          padding: [4, 8],
          borderRadius: 4,
          maxWidth: 200,
          textAlign: "center",
          fontFamily: "Arial, sans-serif",
          fontWeight: "bold",
          textShadow: "1px 1px 2px rgba(0, 0, 0, 0.5)",
          opacity: 0.8,
          transition: "opacity 0.3s ease-in-out",
          "&:hover": {
            opacity: 1,
          },
        },
      },
    },
  },
});

// Theme context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export type ThemeMode = "light" | "dark";

export interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  currentTheme: Theme;
  currentPalette: typeof lightPalette | typeof darkPalette;
}

// Custom hook to use theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

// Utility functions
export const getBoxShadow = (elevation: "low" | "medium" | "high" | "dark" = "medium") => {
  const shadows = {
    low: designTokens.shadows.low,
    medium: designTokens.shadows.medium,
    high: designTokens.shadows.high,
    dark: designTokens.shadows.dark,
  };
  return shadows[elevation];
};

export const getTransition = (
  property = "all",
  duration: "fast" | "standard" | "slow" = "standard",
) => {
  const durations = {
    fast: designTokens.transitions.fast,
    standard: designTokens.transitions.standard,
    slow: designTokens.transitions.slow,
  };
  return `${property} ${durations[duration]} cubic-bezier(0.4, 0, 0.2, 1)`;
};

export const getBorderRadius = (size: "small" | "medium" | "large" = "medium") => {
  const radii = {
    small: designTokens.borderRadius.small,
    medium: designTokens.borderRadius.medium,
    large: designTokens.borderRadius.large,
  };
  return `${radii[size]}px`;
};

export const getDrawerWidth = () => {
  const isDevelopment = process.env.NODE_ENV !== "production";
  return isDevelopment ? designTokens.spacing.drawerWidthDev : designTokens.spacing.drawerWidth;
};

// Export the context for use in providers
export { ThemeContext };
