import { createTheme } from "@mui/material/styles";

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

export const isDevelopment = process.env.NODE_ENV !== "production";

export const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#386181",
      light: "#6495b6",
      dark: "#284b63",
    },
    secondary: {
      main: "#6f8ea0",
      light: "#9fb8c5",
      dark: "#4f636e",
    },
    background: {
      default: "#f3f7fa",
      paper: "#ffffff",
    },
  },
  shape: {
    borderRadius: 4,
  },
  spacing: 8,
  components: {
    /* eslint-disable */
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid #404854",
          color: "#f3f7fa",
          backgroundColor: "#272e3d",
          "&:hover": {
            backgroundColor: "#515864",
            transition: "none",
          },
        },
      },
    },

    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          backgroundColor: "#272e3d",
          color: "#f3f7fa",
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid #404854",
          color: "#f3f7fa",
          backgroundColor: "#272e3d",
          "&:hover": {
            backgroundColor: "#272e3d",
          },
        },
      },
    },
    // MuiFormControl: {
    //   styleOverrides: {
    //     root: {
    //       backgroundColor: "#19222b",
    //       color: "#f3f7fa",
    //     },
    //   },
    // },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 4,
          backgroundColor: "#29303b",
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: "primary.dark",
          underline: "none",
          textDecoration: "none",
          ":hover": {
            textDecoration: "none",
            color: "#6495b6",
          },
        },
      },
    },
    MuiList: {
      defaultProps: {
        dense: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 2,
          backgroundColor: "#19212a",
          color: "#f3f7fa",
        },
      },
    },
    MuiTableCell: {
      defaultProps: {
        //padding: "checkbox",
        size: "small",
      },
      styleOverrides: {
        root: {
          padding: [6, 16],
        },
      },
    },
    MuiTable: {
      defaultProps: {
        size: "small",
        // padding: "checkbox"
      },
      styleOverrides: {
        root: {
          //borderRadius: 0,
          //padding: "1px"

          // Add hover effects for table rows
          "& tbody tr:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.08)",
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
          textShadow: "0 0 1pxrgba(0, 0, 0, 0.5)",
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

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#386181",
    },
    secondary: {
      main: "#6f8ea0",
    },
  },
  shape: {
    borderRadius: 4,
  },
  spacing: 8,
  components: {
    /* eslint-disable */
    MuiList: {
      defaultProps: {
        dense: true,
      },
    },
    MuiTableCell: {
      defaultProps: {
        //padding: "checkbox",
        size: "small",
      },
      styleOverrides: {
        root: {
          padding: [6, 16],
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
    MuiTable: {
      defaultProps: {
        size: "small",
        // padding: "checkbox"
      },
      styleOverrides: {
        root: {
          //padding: "1px"

          // Add hover effects for table rows in dark theme
          "& tbody tr:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            cursor: "context-menu",
            transition: "background-color 0.15s ease-in-out",
          },
        },
      },
    },
  },
  /* eslint-enable */
});

export const lightThemeOld = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#b7b7b7",
    },
    secondary: {
      main: "#6f8ea0",
    },
    background: {
      default: "#f3f3f3",
      paper: "#f3f7fa",
    },
  },
});

export const blueTheme = createTheme({
  palette: {
    primary: {
      main: "#42a5f5",
      // light: will be calculated from palette.primary.main,
      // dark: will be calculated from palette.primary.main,
      // contrastText: will be calculated to contrast with palette.primary.main
    },
    secondary: {
      main: "#E0C2FF",
      light: "#F5EBFF",
      // dark: will be calculated from palette.secondary.main,
      contrastText: "#47008F",
    },
  },
  components: {
    /* eslint-disable */
    // Name of the component ⚛️
    MuiTableCell: {
      defaultProps: {
        // The default props to change
        size: "small",
      },
    },
    MuiTable: {
      defaultProps: {
        // The default props to change
        size: "small",
      },
    },
  },
  /* eslint-enable */
});

// Custom useTheme hook for compatibility with chem-pal components
export function useTheme() {
  // This is a placeholder. You may want to connect this to your actual theme context or logic.
  // For now, it returns 'light' mode and a no-op toggleTheme.
  return {
    mode: "light",
    toggleTheme: () => {},
    currentPalette: {
      text: "#000",
      notificationBg: "#fff",
    },
  };
}
