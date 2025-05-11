import './App.css'
import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme, createTheme } from '@mui/material/styles';
import SearchPanel from './components/SearchPanel'
import SettingsPanel from './components/SettingsPanel'
import SuppliersPanel from './components/SuppliersPanel';
import TabHeader from './components/TabHeader'
import AppBar from '@mui/material/AppBar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import SupplierFactory from './suppliers/supplier_factory';
import { TabPanelProps, Settings } from './types';
import { SettingsContext } from './context';
import { lightTheme, darkTheme } from './themes';
import ExpandableVirtTable from './components/ExpandableVirtTable';
import storageMock from './mocks/chrome_storage_mock'

if (!chrome.storage) {
  console.debug('!!! chrome.storage not found, using mock !!!')
  window.chrome = {
    storage: storageMock as any,
  } as any;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role='tabpanel'
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
  const [panel, setPanel] = useState(0);
  const [currentTheme, setCurrentTheme] = useState(lightTheme);
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
    suppliers: SupplierFactory.supplierList(),
    theme: 'light',
    showAllColumns: false,
    showColumns: []
  });

  // Load the settings from storage.local on the initial component load
  useEffect(() => {
    chrome.storage.local.get(['settings', 'panel'])
      .then(data => {
        //console.debug('Retrieved storage.local.settings:', data)
        if (data.settings) setSettings({ ...data.settings });;
        if (data.panel) setPanel(data.panel);
      })
  }, [])

  // Save the settings to storage.local when the settings change
  useEffect(() => {
    //console.debug('Updating storage.local.settings to:', settings)
    chrome.storage.local.set({ settings, panel })
    console.debug('settings updated:', settings)
    setCurrentTheme(settings.theme === 'light' ? lightTheme : darkTheme)
  }, [settings, panel])

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        <Box sx={{ bgcolor: 'background.default', width: '100%' }}>
          <AppBar position='static' sx={{ borderRadius: 1 }}>
            <TabHeader page={panel} setPage={setPanel} />
            <TabPanel value={panel} name='search-panel' index={0} dir={theme.direction}>
              <ExpandableVirtTable />
            </TabPanel>
            <TabPanel value={panel} name='suppliers-panel' index={1} dir={theme.direction}>
              <SuppliersPanel />
            </TabPanel>
            <TabPanel value={panel} name='settings-panel' index={2} dir={theme.direction}>
              <SettingsPanel />
            </TabPanel>
          </AppBar>
        </Box>
      </ThemeProvider>
    </SettingsContext.Provider>
  )
}

export default App