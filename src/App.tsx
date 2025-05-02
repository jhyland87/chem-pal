import './App.css'
// import Search from './components/Search'
// import ResultsTable from './components/ResultsTable'
import ProductTable from './components/ProductTable'
import TabHeader from './components/TabHeader'
import React, { ReactNode, useState, SyntheticEvent } from 'react';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';

const darkTheme = createTheme({
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
interface TabPanelProps {
  children?: ReactNode;
  dir?: string;
  index: number;
  value: number;
  style?: object
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`full-width-tabpanel-${index}`}
      aria-labelledby={`full-width-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 1 }}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

function App() {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ bgcolor: 'background.default', width: 500 }}>
        <AppBar position="static">
          <TabHeader page={page} setPage={setPage} />
          <TabPanel value={page} index={0} dir={theme.direction}>
            <ProductTable />
          </TabPanel>
          <TabPanel value={page} index={1} dir={theme.direction}>
            Item Two
          </TabPanel>
          <TabPanel value={page} index={2} dir={theme.direction}>
            Item Three
          </TabPanel>
        </AppBar>
      </Box>
    </ThemeProvider>
  )
}

export default App



