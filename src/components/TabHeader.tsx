import { SyntheticEvent } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

function tabProps(index: number, name:string) {
  return {
    id: `full-width-tab-${index}`,
    panel: name,
    'aria-controls': `full-width-tabpanel-${index}`,
  };
}

export default function TabHeader({ page, setPage }: { page: number; setPage: (page: number) => void }) {
  const handleChange = (event: SyntheticEvent, newValue: number) => {
    setPage(newValue);
  };

  return (
    <Tabs
      value={page}
      onChange={handleChange}
      indicatorColor='secondary'
      textColor='inherit'
      variant='fullWidth'
      aria-label='full width tabs example'
    >
      <Tab label='Search Results' {...tabProps(0, 'search-panel')} />
      <Tab label='Suppliers' {...tabProps(1, 'suppliers-panel')} />
      <Tab label='Settings' {...tabProps(2, 'settings-panel')} />
    </Tabs>
  );
}
