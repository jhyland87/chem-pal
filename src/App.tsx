import './App.css'
import ProductTable from './components/ProductTable'
import TabHeader from './components/TabHeader'
import { useState, useEffect } from 'react';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import SettingsForm from './components/SettingsForm'
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { TabPanelProps, Settings } from './types';
import SupplierSelector from './components/SupplierSelector';
import SupplierFactory from './supplier_factory';

import { SettingsContext } from './context';


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
          <Typography component={'span'} variant={'body2'}>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

function App() {
  const theme = useTheme();
  const [page, setPage] = useState(0);

  // Default settings
  const [settings, setSettings] = useState<Settings>({
    caching: true,
    autocomplete: true,
    currency: 'usd',
    location: '',
    shipsToMyLocation: false,
    foo: 'bar',
    jason: false,
    antoine: true,
    popupSize: 'small',
    autoResize: true,
    someSetting: false,
    suppliers: SupplierFactory.supplierList()
  });

  // Load the settings from storage.local on the initial component load
  useEffect(() => {
    chrome.storage.local.get(['settings'])
      .then(data => {
        console.log('Retrieved storage.local.settings:', data)
        if (!data.settings) return;
        setSettings({ ...data.settings });
      })
  }, [])

  // Save the settings to storage.local when the settings change
  useEffect(() => {
    console.log('Updating storage.local.settings to:', settings)
    chrome.storage.local.set({ settings })
  }, [settings])

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box sx={{ bgcolor: 'background.default', width: 500 }}>
          <AppBar position="static">
            <TabHeader page={page} setPage={setPage} />
            <TabPanel value={page} index={0} dir={theme.direction}>
              <ProductTable />
            </TabPanel>
            <TabPanel value={page} index={1} dir={theme.direction}>
              <SupplierSelector />
            </TabPanel>
            <TabPanel value={page} index={2} dir={theme.direction}>
              <SettingsForm />
            </TabPanel>
          </AppBar>
        </Box>
      </ThemeProvider>
    </SettingsContext.Provider>
  )
}

export default App



