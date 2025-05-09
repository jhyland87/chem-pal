import { createTheme } from '@mui/material/styles';


export const darkTheme = createTheme({
  palette: {
    primary: {
      main: '#42a5f5',
      // light: will be calculated from palette.primary.main,
      // dark: will be calculated from palette.primary.main,
      // contrastText: will be calculated to contrast with palette.primary.main
    },
    secondary: {
      main: '#E0C2FF',
      light: '#F5EBFF',
      // dark: will be calculated from palette.secondary.main,
      contrastText: '#47008F',
    },
  },
  colorSchemes: {
    dark: false,
  },
});