import { useState } from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Checkbox from '@mui/material/Checkbox';
import Avatar from '@mui/material/Avatar';
import SupplierFactory from '../supplier_factory';

export default function SupplierSelection() {
  const [checked, setChecked] = useState<string[]>(SupplierFactory.supplierList());

  const handleToggle = (supplierName: string) => () => {
    const currentIndex = checked.indexOf(supplierName);
    const newChecked = [...checked];

    if (currentIndex === -1) {
      newChecked.push(supplierName);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setChecked(newChecked);
  };

  return (
    <List dense sx={{ width: '100%', bgcolor: 'background.paper' }}>
      {SupplierFactory.supplierList().map((supplierName) => {
        const labelId = `checkbox-list-secondary-label-${supplierName}`;
        return (
          <ListItem
            key={supplierName}
            secondaryAction={
              <Checkbox
                edge="end"
                onChange={handleToggle(supplierName)}
                checked={checked.includes(supplierName)}
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
              <ListItemText id={labelId} primary={supplierName} />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}