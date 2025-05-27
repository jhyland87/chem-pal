import { createTheme } from "@mui/material/styles";

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
      default: "#f3f3f3",
      paper: "#ffffff",
    },
  },
  shape: {
    borderRadius: 4,
  },
  spacing: 8,
  components: {
    /* eslint-disable */
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
          borderRadius: 4,
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
      paper: "#ffffff",
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
