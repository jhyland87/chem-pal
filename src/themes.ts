import { createTheme } from "@mui/material/styles";

export const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#386181",
    },
    secondary: {
      main: "#6f8ea0",
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
          padding: "6px 16px",
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
          padding: "6px 16px",
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
});
