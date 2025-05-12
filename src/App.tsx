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
import storageMock from './mocks/chrome_storage_mock'
import SpeedDialMenu from './components/SpeedDialMenu';
import ErrorBoundary from './components/ErrorBoundary';


if (!chrome.storage) {
  console.debug('!!! chrome.storage not found, using mock - may result in unexpected behavior !!!')
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
  const [speedDialVisibility, setSpeedDialVisibility] = useState(false);
  // 55 would be so right when their cursor gets to where the center of the speed dial menu
  // would be, it would open. But setting it to a lower value (eg: 30) makes it so it won't
  // show unless they go all the way to the bottom right corner of the screen, making it
  // less likely to pop up when you're just scrolling through results. This might have its
  // own annoyance of having to reposition the cursor once it's open, but I think it's
  // better this way.
  const cornerThreshold = 30;

  // The logic in the useEffect is to determine if the cursor is in the right position to
  // show the speed dial menu.
  //  1) If the cursor is within ${cornerThreshold} pixels of the bottom right corner of
  //     the screen, then the speed dial menu is shown.
  //  2) If the cursor is neither in the bottom right corner nor over the expanded element
  //     for the speed dial menu, then the speed dial menu is hidden.
  //  Note: This logic is used becuase we don't want the menu to go away once the user
  //        moves their cursor out of the bottom right corner to select one of the menu
  //        options.
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setSpeedDialVisibility(
        document.getElementById('speed-dial-menu')?.matches(':hover')
        || (event.x >= window.innerWidth - cornerThreshold
          && event.y >= window.innerHeight - cornerThreshold)
      )
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);


  // Default settings
  const [settings, setSettings] = useState<Settings>({
    showHelp: false,
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
    showColumnFilters: true,
    showAllColumns: false,
    hideColumns: ['description', 'uom'],
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
    <ErrorBoundary fallback={<p>Something went wrong</p>}>
      <SettingsContext.Provider value={{ settings, setSettings }}>
        <ThemeProvider theme={currentTheme}>
          <CssBaseline />
          <Box sx={{ bgcolor: 'background.default', width: '100%' }}>
            <AppBar position='static' sx={{ borderRadius: 1 }}>
              <TabHeader page={panel} setPage={setPanel} />
              <TabPanel value={panel} name='search-panel' index={0} dir={theme.direction}>
                <SearchPanel />
              </TabPanel>
              <TabPanel value={panel} name='suppliers-panel' index={1} dir={theme.direction}>
                <SuppliersPanel />
              </TabPanel>
              <TabPanel value={panel} name='settings-panel' index={2} dir={theme.direction}>
                <SettingsPanel />
              </TabPanel>
            </AppBar>
            <SpeedDialMenu speedDialVisibility={speedDialVisibility} />
          </Box>
        </ThemeProvider>
      </SettingsContext.Provider>
    </ErrorBoundary>
  )
}

export default App