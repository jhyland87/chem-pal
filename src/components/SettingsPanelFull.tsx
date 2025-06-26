import { useAppContext } from "@/components/SearchPanel/hooks/useContext";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import React, { ChangeEvent, MouseEvent, startTransition, useActionState, useState } from "react";
import { currencies, locations } from "../../config.json";
import "./SettingsPanelFull.scss";

type SettingAction =
  | { type: "SWITCH_CHANGE"; name: string; checked: boolean }
  | { type: "INPUT_CHANGE"; name: string; value: string }
  | { type: "BUTTON_CLICK"; name: string; value: string }
  | { type: "RESTORE_DEFAULTS" };

export default function SettingsPanelFull() {
  const appContext = useAppContext();
  const [expanded, setExpanded] = useState<string | false>("behavior");

  if (!appContext) {
    return <div>Loading settings...</div>;
  }

  const [formState, updateSetting, isPending] = useActionState(
    (currentSettings: UserSettings, action: SettingAction): UserSettings => {
      let newSettings: UserSettings;
      switch (action.type) {
        case "SWITCH_CHANGE":
          newSettings = { ...currentSettings, [action.name]: action.checked };
          break;
        case "INPUT_CHANGE":
          newSettings = { ...currentSettings, [action.name]: action.value };
          break;
        case "BUTTON_CLICK":
          newSettings = { ...currentSettings, [action.name]: action.value };
          break;
        case "RESTORE_DEFAULTS":
          newSettings = {
            ...currentSettings,
            showHelp: false,
            caching: true,
            autocomplete: true,
            autoResize: true,
            someSetting: false,
            showColumnFilters: true,
            showAllColumns: false,
            popupSize: "small",
            hideColumns: ["description", "uom"],
          };
          break;
        default:
          return currentSettings;
      }
      startTransition(() => {
        try {
          appContext.setUserSettings(newSettings);
        } catch (error) {
          console.error("Failed to update settings:", error);
        }
      });
      return newSettings;
    },
    appContext.userSettings,
  );

  const handleSwitchChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateSetting({
      type: "SWITCH_CHANGE",
      name: event.target.name,
      checked: event.target.checked,
    });
  };

  const handleInputChange = (
    event: SelectChangeEvent | ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    updateSetting({
      type: "INPUT_CHANGE",
      name: event.target.name,
      value: event.target.value,
    });
  };

  const handleButtonClick = (event: MouseEvent<HTMLDivElement>) => {
    const button = event.target as HTMLButtonElement;
    const value = button.textContent?.toLowerCase();
    if (value && button.name) {
      updateSetting({
        type: "BUTTON_CLICK",
        name: button.name,
        value,
      });
    }
  };

  const handleRestoreDefaults = () => {
    updateSetting({ type: "RESTORE_DEFAULTS" });
  };

  const currentSettings = formState || appContext.userSettings;

  const handleAccordionChange =
    (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false);
    };

  return (
    <Box>
      <Accordion expanded={expanded === "behavior"} onChange={handleAccordionChange("behavior")}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Behavior</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List component="nav" aria-labelledby="behavior-list-subheader">
            {/* Caching */}
            <ListItem className="settings-panel__helper-on-hover">
              <ListItemText primary="Cache Search Results" />
              <FormHelperText>Improves performance</FormHelperText>
              <FormControlLabel
                control={
                  <Switch
                    checked={currentSettings.caching}
                    onChange={handleSwitchChange}
                    name="caching"
                    disabled={isPending}
                  />
                }
                labelPlacement="start"
                label=""
              />
            </ListItem>
            {/* Autocomplete */}
            <ListItem className="settings-panel__helper-on-hover">
              <ListItemText primary="AutoComplete" />
              <FormHelperText>Autocomplete search input</FormHelperText>
              <FormControlLabel
                control={
                  <Switch
                    checked={currentSettings.autocomplete}
                    onChange={handleSwitchChange}
                    name="autocomplete"
                    disabled={isPending}
                  />
                }
                labelPlacement="start"
                label=""
              />
            </ListItem>
            {/* Currency */}
            <ListItem className="settings-panel__helper-on-hover">
              <ListItemText primary="Currency" />
              <FormHelperText>Convert all currency to this</FormHelperText>
              <FormControl>
                <InputLabel id="currency-select-label">Currency</InputLabel>
                <Select
                  labelId="currency-select-label"
                  value={currentSettings.currency}
                  onChange={handleInputChange}
                  name="currency"
                  label="currency"
                  size="small"
                  className="settings-panel__input"
                  disabled={isPending}
                >
                  {Object.entries(currencies).map(([currencyId, { symbol }]) => (
                    <MenuItem key={currencyId} value={currencyId}>
                      {currencyId.toUpperCase()} ({symbol})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </ListItem>
            {/* Location */}
            <ListItem className="settings-panel__helper-on-hover">
              <ListItemText primary="Location" />
              <FormHelperText>Your country</FormHelperText>
              <FormControl>
                <InputLabel id="location-select-label">Location</InputLabel>
                <Select
                  labelId="location-select-label"
                  value={currentSettings.location}
                  onChange={handleInputChange}
                  name="location"
                  label="location"
                  size="small"
                  className="settings-panel__input"
                  disabled={isPending}
                >
                  <MenuItem value="">
                    <i>None</i>
                  </MenuItem>
                  {Object.entries(locations).map(([locationId, { name }]) => (
                    <MenuItem key={locationId} value={locationId}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </ListItem>
            {/* Ships to Location */}
            <ListItem className="settings-panel__helper-on-hover">
              <ListItemText primary="Ships to Location" />
              <FormHelperText>Only show products that ship to your location</FormHelperText>
              <FormControl>
                <Switch
                  checked={!!currentSettings.location && currentSettings.shipsToMyLocation}
                  disabled={currentSettings.location === "" || isPending}
                  onChange={handleSwitchChange}
                  name="shipsToMyLocation"
                />
              </FormControl>
            </ListItem>
            {/* Foo Example */}
            <ListItem className="settings-panel__helper-on-hover">
              <ListItemText primary="Foo" />
              <FormHelperText>Just an input example</FormHelperText>
              <FormControl>
                <TextField
                  value={currentSettings.foo}
                  label="Foo"
                  name="foo"
                  onChange={handleInputChange}
                  variant="filled"
                  size="small"
                  className="settings-panel__input"
                  disabled={isPending}
                />
              </FormControl>
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>
      <Accordion expanded={expanded === "display"} onChange={handleAccordionChange("display")}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Display</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List component="nav" aria-labelledby="display-list-subheader">
            {/* Popup Size */}
            <ListItem className="settings-panel__helper-on-hover">
              <ListItemText primary="Popup Size" />
              <FormHelperText>Popup size</FormHelperText>
              <FormControl>
                <ButtonGroup
                  variant="contained"
                  aria-label="Basic button group"
                  onClick={handleButtonClick}
                  disabled={isPending}
                >
                  <Button
                    name="popupSize"
                    value="small"
                    size="small"
                    variant={currentSettings.popupSize === "small" ? "contained" : "text"}
                    disabled={isPending}
                  >
                    Small
                  </Button>
                  <Button
                    name="popupSize"
                    value="medium"
                    size="small"
                    variant={currentSettings.popupSize === "medium" ? "contained" : "text"}
                    disabled={isPending}
                  >
                    Medium
                  </Button>
                  <Button
                    name="popupSize"
                    value="large"
                    size="small"
                    variant={currentSettings.popupSize === "large" ? "contained" : "text"}
                    disabled={isPending}
                  >
                    Large
                  </Button>
                </ButtonGroup>
              </FormControl>
            </ListItem>
            {/* Auto-Resize */}
            <ListItem className="settings-panel__helper-on-hover">
              <ListItemText primary="Auto-Resize" />
              <FormHelperText>More results = larger window</FormHelperText>
              <Switch
                checked={currentSettings.autoResize}
                onChange={handleSwitchChange}
                name="autoResize"
                disabled={isPending}
              />
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>
      <Accordion expanded={expanded === "actions"} onChange={handleAccordionChange("actions")}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Actions</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleRestoreDefaults}
              disabled={isPending}
            >
              Restore Defaults
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
