import { ChangeEvent, MouseEvent } from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import ListSubheader from '@mui/material/ListSubheader';
import TextField from '@mui/material/TextField';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import ButtonGroup from '@mui/material/ButtonGroup';
import { useSettings } from '../context';

const inputStyle = {
  width: 120,
}

const style = {
  py: 0,
  width: '100%',
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  backgroundColor: 'background.paper',
};

// Show the setting helper text only when that listitem is hovered over.
// Just trying to be fancy with the hover effect
const displayHelperOnHover = {
  '& > .MuiFormHelperText-root': {
    transition: 'visibility 0s, opacity 0.5s linear',
    visibility: 'hidden',
    opacity: 0
  },
  '&:hover > .MuiFormHelperText-root': {
    visibility: 'visible',
    opacity: 1
  },
  '&:focus > .MuiFormHelperText-root': {
    visibility: 'visible',
    opacity: 1
  }
};


export default function Settings() {
  const settingsContext = useSettings();

  const handleSwitchChange = (event: ChangeEvent<HTMLInputElement>) => {
    console.log({ settingsContext, event, name: event.target.name, checked: event.target.checked, value: event.target.value });
    settingsContext.setSettings({
      ...settingsContext.settings,
      [event.target.name]: event.target.checked
    });
  };

  const handleSelectChange = (event: SelectChangeEvent) => {
    console.log({ settingsContext, event, name: event.target.name, value: event.target.value });
    settingsContext.setSettings({
      ...settingsContext.settings,
      [event.target.name]: event.target.value
    });
  }

  const handleInputChange = (event: SelectChangeEvent | ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    console.log({ settingsContext, event, name: event.target.name, value: event.target.value });
    settingsContext.setSettings({
      ...settingsContext.settings,
      [event.target.name]: event.target.value
    });
  }

  const handleButtonClick = (event: MouseEvent<HTMLDivElement>) => {
    const button = event.target as HTMLButtonElement;
    const size = button.textContent?.toLowerCase();
    console.log({ settingsContext, event, name: button.name, size, target: button });
    if (size) {
      settingsContext.setSettings({
        ...settingsContext.settings,
        [button.name]: size
      });
    }
  }

  return (

    <FormGroup>
      <List sx={{ width: '100%', bgcolor: 'background.paper' }}
        component="nav"
        aria-labelledby="nested-list-subheader"
        subheader={
          <ListSubheader component="label" id="nested-list-subheader">
            Behavior
          </ListSubheader>
        }>
        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Cache Search Results" />
          <FormHelperText>Improves performance</FormHelperText>
          <FormControlLabel
            control={
              <Switch
                checked={settingsContext.settings.caching}
                onChange={handleSwitchChange}
                name="caching"
              />
            }
            labelPlacement="start"
            label=""
          />
        </ListItem>
        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="AutoComplete" />
          <FormHelperText>Autocomplete search input</FormHelperText>
          <FormControlLabel
            control={
              <Switch
                checked={settingsContext.settings.autocomplete}
                onChange={handleSwitchChange}
                name="autocomplete"
              />
            }
            labelPlacement="start"
            label=""
          />
        </ListItem>
        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Currency" />
          <FormHelperText>Convert all currency to this</FormHelperText>
          <FormControlLabel
            control={
              <Select
                value={settingsContext.settings.currency}
                onChange={handleInputChange}
                name="currency"
                label="currency"
                sx={{ ...inputStyle }}
              >
                <MenuItem value="usd">USD ($)</MenuItem>
                <MenuItem value="eur">EUR (€)</MenuItem>
                <MenuItem value="gbp">GBP (£)</MenuItem>
                <MenuItem value="aud">AUD ($)</MenuItem>
                <MenuItem value="rub">RUB (₽)</MenuItem>
                <MenuItem value="cad">CAD ($)</MenuItem>
                <MenuItem value="inr">INR (₹)</MenuItem>
                <MenuItem value="rub">RUB (₽)</MenuItem>
                <MenuItem value="cny">CNY (¥)</MenuItem>
                <MenuItem value="brl">BRL (R$)</MenuItem>
                <MenuItem value="mxn">MXN (MX$)</MenuItem>
                <MenuItem value="zar">ZAR (R)</MenuItem>
                <MenuItem value="jpy">JPY (¥)</MenuItem>
              </Select>
            }
            labelPlacement="start"
            label=""
          />
        </ListItem>
        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Location" />
          <FormHelperText>Your country</FormHelperText>
          <FormControlLabel
            control={
              <Select
                value={settingsContext.settings.location}
                onChange={handleInputChange}
                name="location"
                label="location"
                sx={{ ...inputStyle }}
              >
                <MenuItem value=""><i>None</i></MenuItem>
                <MenuItem value="usa">USA</MenuItem>
                <MenuItem value="canada">Canada</MenuItem>
                <MenuItem value="uk">UK</MenuItem>
                <MenuItem value="australia">Australia</MenuItem>
                <MenuItem value="newzealand">New Zealand</MenuItem>
                <MenuItem value="japan">Japan</MenuItem>
                <MenuItem value="china">China</MenuItem>
                <MenuItem value="india">India</MenuItem>
                <MenuItem value="russia">Russia</MenuItem>
                <MenuItem value="germany">Germany</MenuItem>
                <MenuItem value="europe">Europe</MenuItem>
              </Select>
            }
            labelPlacement="start"
            label=""
          />
        </ListItem>
        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Ships to Location" />
          <FormHelperText>Only show products that ship to your location</FormHelperText>
          <FormControlLabel
            control={
              <Switch
                checked={!!settingsContext.settings.location && settingsContext.settings.shipsToMyLocation}
                disabled={settingsContext.settings.location === ''}
                onChange={handleSwitchChange}
                name="shipsToMyLocation"
              />
            }
            labelPlacement="start"
            label=""
          />
        </ListItem>
        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Foo" />
          <FormHelperText>Just an input example</FormHelperText>
          <FormControlLabel
            control={
              <TextField
                value={settingsContext.settings.foo}
                name="foo"
                onChange={handleInputChange}
                //hiddenLabel
                variant="filled"
                size="small"
                sx={{ ...inputStyle }}
              />
            }
            labelPlacement="start"
            label=""
          />
        </ListItem>
        <Divider variant="middle" component="li" />
      </List>
      <List sx={{ width: '100%', bgcolor: 'background.paper' }}
        component="nav"
        aria-labelledby="nested-list-subheader"
        subheader={
          <ListSubheader component="label" id="nested-list-subheader">
            Display
          </ListSubheader>
        }>
        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Popup Size" />
          <FormHelperText>Popup size</FormHelperText>
          <FormControlLabel
            control={
              <ButtonGroup variant="contained" aria-label="Basic button group" onClick={handleButtonClick}>
                <Button name="popupSize" value="small" size="small" variant={settingsContext.settings.popupSize === 'small' ? 'contained' : 'text'}>Small</Button>
                <Button name="popupSize" value="medium" size="small" variant={settingsContext.settings.popupSize === 'medium' ? 'contained' : 'text'}>Medium</Button>
                <Button name="popupSize" value="large" size="small" variant={settingsContext.settings.popupSize === 'large' ? 'contained' : 'text'}>Large</Button>
              </ButtonGroup>

            }
            labelPlacement="start"
            label=""
          />
        </ListItem>
        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Auto-Resize" />
          <FormHelperText>More results = larger window</FormHelperText>
          <FormControlLabel
            control={
              <Switch
                checked={settingsContext.settings.autoResize}
                onChange={handleSwitchChange}
                name="autoResize"
              />
            }
            labelPlacement="start"
            label=""
          />
        </ListItem>
        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Some Setting" />
          <FormHelperText id="some-setting-helper-text">Disabled by default</FormHelperText>
          <FormControlLabel
            control={
              <Switch
                checked={settingsContext.settings.someSetting}
                onChange={handleSwitchChange}
                name="someSetting"
              />
            }
            labelPlacement="start"
            label=""
          />
        </ListItem>
        <Divider component="li" />
        <ListItem>
          <Stack spacing={2} direction="row" sx={{ display: 'block', marginLeft: 'auto', marginRight: 'auto' }}>
            <Button variant="outlined">Restore Defaults</Button>
          </Stack>
        </ListItem>
      </List>
    </FormGroup>
  );
}
