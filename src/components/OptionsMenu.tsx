import * as React from 'react';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import SaveIcon from '@mui/icons-material/Save';
import ClearIcon from '@mui/icons-material/Clear';
import AutoDeleteIcon from '@mui/icons-material/AutoDelete';
import ContrastIcon from '@mui/icons-material/Contrast';


export default function OptionsMenu(props: any) {
  const handleClearResults = (event: React.MouseEvent<HTMLAnchorElement>) => {
    console.debug('clearing results')
    // Stop the form from propagating
    event.preventDefault();
    props.setProducts([])
  };

  const handleClearCache = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Stop the form from propagating
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
          console.debug("Deleting cache:", cacheName);
          return caches.delete(cacheName);
        })
      )
    })
    //);
  };

  const handleSaveResults = (event: React.MouseEvent<HTMLAnchorElement>) => {
    console.debug('saving results')
    // Stop the form from propagating
    event.preventDefault();
  };

  const handleToggleTheme = (event: React.MouseEvent<HTMLAnchorElement>) => {
    console.debug('toggling theme')
    // Stop the form from propagating
    event.preventDefault();
  };

  const actions = [
    { icon: <ClearIcon />, name: 'Clear Resultsss', onClick: handleClearResults },
    { icon: <AutoDeleteIcon />, name: 'Clear Cache', onClick: handleClearCache },
    { icon: <SaveIcon />, name: 'Save Results', onClick: handleSaveResults },
    { icon: <ContrastIcon />, name: 'Toggle Theme', onClick: handleToggleTheme },
  ];

  return (
    <SpeedDial
      FabProps={{ size: "small" }}
      ariaLabel="SpeedDial basic example"
      sx={{ position: 'absolute', bottom: 16, right: 16 }}
      icon={<SpeedDialIcon />}
    >
      {actions.map((action) => (
        <SpeedDialAction
          onClick={(e: React.MouseEvent<HTMLDivElement>) => {
            action.onClick(e as unknown as React.MouseEvent<HTMLAnchorElement>);
          }}
          key={action.name}
          icon={action.icon}
          tooltipTitle={action.name}
        />
      ))}
    </SpeedDial>
  );
}