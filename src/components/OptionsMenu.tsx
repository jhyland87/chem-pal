import { MouseEvent, } from 'react';
import { SpeedDial, SpeedDialIcon, SpeedDialAction } from '@mui/material';
import {
  Save as SaveIcon,
  Clear as ClearIcon,
  AutoDelete as AutoDeleteIcon,
  Contrast as ContrastIcon
} from '@mui/icons-material';
import { useSettings } from '../context';

export default function OptionsMenu(props: any) {
  const settingsContext = useSettings();

  const handleClearResults = (event: MouseEvent<HTMLAnchorElement>) => {
    console.debug('clearing results')
    event.preventDefault();
    props.setProducts([])
  };

  const handleClearCache = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    const CACHE_VERSION = 1;
    const CURRENT_CACHES = {
      query: `query-cache-v${CACHE_VERSION}`,
    };
    const expectedCacheNamesSet = new Set(Object.values(CURRENT_CACHES));
    //event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.debug('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      )
    })
    //);
  };

  const handleSaveResults = (event: MouseEvent<HTMLAnchorElement>) => {
    console.debug('saving results')
    event.preventDefault();
  };

  const handleToggleTheme = (event: MouseEvent<HTMLAnchorElement>) => {
    console.debug('toggling theme')
    event.preventDefault();

    settingsContext.setSettings({
      ...settingsContext.settings,
      theme: settingsContext.settings.theme === 'light' ? 'dark' : 'light'
    });

    console.debug('settingsContext.settings.theme', settingsContext.settings.theme)
  };

  const actions = [
    { icon: <ClearIcon />, name: 'Clear Resultsss', onClick: handleClearResults },
    { icon: <AutoDeleteIcon />, name: 'Clear Cache', onClick: handleClearCache },
    { icon: <SaveIcon />, name: 'Save Results', onClick: handleSaveResults },
    { icon: <ContrastIcon />, name: 'Toggle Theme', onClick: handleToggleTheme },
  ];

  return (
    <SpeedDial
      FabProps={{ size: 'small' }}
      ariaLabel='SpeedDial basic example'
      sx={{ position: 'absolute', bottom: 16, right: 16 }}
      icon={<SpeedDialIcon />}
    >
      {actions.map((action) => (
        <SpeedDialAction
          onClick={(e: MouseEvent<HTMLDivElement>) => {
            action.onClick(e as unknown as MouseEvent<HTMLAnchorElement>);
          }}
          key={action.name}
          icon={action.icon}
          tooltipTitle={action.name}
        />
      ))}
    </SpeedDial>
  );
}