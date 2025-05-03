import { SyntheticEvent } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

function a11yProps(index: number) {
  return {
    id: `full-width-tab-${index}`,
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
      indicatorColor="secondary"
      textColor="inherit"
      variant="fullWidth"
      aria-label="full width tabs example"
    >
      <Tab label="Search Results" {...a11yProps(0)} />
      <Tab label="Suppliers" {...a11yProps(1)} />
      <Tab label="Settings" {...a11yProps(2)} />
    </Tabs>
  );
}
