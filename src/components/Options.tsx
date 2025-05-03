import * as React from 'react';
//import Box from '@mui/material/Box';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import SaveIcon from '@mui/icons-material/Save';
import ClearIcon from '@mui/icons-material/Clear';
import AutoDeleteIcon from '@mui/icons-material/AutoDelete';
import ContrastIcon from '@mui/icons-material/Contrast';

const actions = [
  { icon: <ClearIcon />, name: 'Clear Results' },
  { icon: <AutoDeleteIcon />, name: 'Clear Cache' },
  { icon: <SaveIcon />, name: 'Save Results' },
  { icon: <ContrastIcon />, name: 'Toggle Theme' },
];

export default function BasicSpeedDial() {
  return (
    <SpeedDial
      ariaLabel="SpeedDial basic example"
      sx={{ position: 'absolute', bottom: 16, right: 16 }}
      icon={<SpeedDialIcon />}
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.name}
          icon={action.icon}
          tooltipTitle={action.name}
        />
      ))}
    </SpeedDial>
  );
}