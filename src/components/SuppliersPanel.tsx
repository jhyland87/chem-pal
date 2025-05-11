import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Checkbox from '@mui/material/Checkbox';
import Avatar from '@mui/material/Avatar';
import SupplierFactory from '../suppliers/supplier_factory';
import { useSettings } from '../context';

export default function SuppliersPanel() {
  const settingsContext = useSettings();

  const handleToggle = (supplierName: string) => () => {
    const selectedSuppliers = settingsContext.settings.suppliers
    const currentIndex = selectedSuppliers.indexOf(supplierName);
    const newChecked = [...selectedSuppliers];

    if (currentIndex === -1) {
      newChecked.push(supplierName);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    settingsContext.setSettings({
      ...settingsContext.settings,
      suppliers: newChecked
    });
  };

  return (
    <List dense sx={{ width: '100%', bgcolor: 'background.paper', color: 'text.primary' }}>
      {SupplierFactory.supplierList().map((supplierName) => {
        const labelId = `checkbox-list-secondary-label-${supplierName}`;
        return (
          <ListItem
            key={supplierName}
            secondaryAction={
              <Checkbox
                value={supplierName}
                edge='end'
                onChange={handleToggle(supplierName)}
                checked={settingsContext.settings.suppliers.includes(supplierName)}
                inputProps={{ 'aria-labelledby': labelId }}
              />
            }
            disablePadding
          >
            <ListItemButton>
              <ListItemAvatar>
                <Avatar
                  alt={`Avatar n°${supplierName}`}
                  src={`/static/images/avatar/${supplierName}.png`}
                />
              </ListItemAvatar>
              <ListItemText id={labelId} primary={supplierName.replace(/^Supplier/, '')} />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}