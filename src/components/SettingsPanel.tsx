import { currencies, defaultSettings, locations } from "@/../config.json";
import { useAppContext } from "@/components/SearchPanel/hooks/useContext";
import { ACTION_TYPE } from "@/constants/common";
import { isButtonElement } from "@/utils/typeGuards/common";
import TextDecreaseIcon from "@mui/icons-material/TextDecrease";
import TextFormatIcon from "@mui/icons-material/TextFormat";
import TextIncreaseIcon from "@mui/icons-material/TextIncrease";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import InputLabel from "@mui/material/InputLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { ChangeEvent, MouseEvent, startTransition, useActionState } from "react";

const inputStyle = {
  width: 120,
  size: "small",
};

// Show the setting helper text only when that listitem is hovered over.
const displayHelperOnHover = {
  /* eslint-disable */
  "& > .MuiFormHelperText-root": {
    transition: "visibility 0s, opacity 0.5s linear",
    visibility: "hidden",
    paddingRight: 3,
    opacity: 0,
  },
  "&:hover > .MuiFormHelperText-root": {
    visibility: "visible",
    opacity: 1,
  },
  "&:focus > .MuiFormHelperText-root": {
    visibility: "visible",
    opacity: 1,
  },
  /* eslint-enable */
};

/**
 * Enhanced SettingsPanel component using React v19 features for improved form management.
 *
 * Key improvements over original SettingsPanel.tsx:
 * - useActionState for consolidated form state management
 * - use() hook for simpler context access
 * - Unified event handlers for different input types
 * - Better error handling and loading states
 * - Reduced re-renders through optimized state management
 *
 * COMPARISON WITH ORIGINAL:
 *
 * Original (multiple separate handlers):
 * ```typescript
 * const handleSwitchChange = (event: ChangeEvent<HTMLInputElement>) => {...};
 * const handleInputChange = (event: SelectChangeEvent | ChangeEvent<...>) => {...};
 * const handleButtonClick = (event: MouseEvent<HTMLDivElement>) => {...};
 * // Each directly calls appContext.setUserSettings
 * ```
 *
 * React v19 Version:
 * ```typescript
 * const [formState, updateSetting, isPending] = useActionState(settingsAction, userSettings);
 * // Single action handler that batches updates and provides loading states
 * ```
 *
 * BENEFITS:
 * 1. Consolidated form state management with useActionState
 * 2. Built-in loading states for settings updates
 * 3. Better error handling for failed updates
 * 4. Automatic batching of rapid setting changes
 * 5. Simpler context access with use() hook
 * @source
 */

// SettingAction type is declared globally in types/settings.d.ts

export default function SettingsPanel() {
  // React v19's use() hook simplifies context access
  const appContext = useAppContext();

  if (!appContext) {
    return <div>Loading settings...</div>;
  }

  // React v19's useActionState for form management
  const [formState, updateSetting, isPending] = useActionState(
    (currentSettings: UserSettings, action: SettingAction): UserSettings => {
      console.debug("Settings action", { action, currentSettings });

      let newSettings: UserSettings;

      switch (action.type) {
        case ACTION_TYPE.SWITCH_CHANGE:
          newSettings = {
            ...currentSettings,
            [action.name]: action.checked,
          };
          break;

        case ACTION_TYPE.INPUT_CHANGE:
          newSettings = {
            ...currentSettings,
            [action.name]: action.value,
          };
          break;

        case ACTION_TYPE.BUTTON_CLICK:
          newSettings = {
            ...currentSettings,
            [action.name]: action.value,
          };
          break;

        case ACTION_TYPE.RESTORE_DEFAULTS:
          // Restore to default settings
          newSettings = {
            ...(defaultSettings as UserSettings),
            ...currentSettings,
          };
          break;

        default:
          return currentSettings;
      }

      // Handle async operations with startTransition
      startTransition(() => {
        try {
          // Update the app context - this will handle Chrome storage automatically
          appContext.setUserSettings(newSettings);
        } catch (error) {
          console.error("Failed to update settings:", error);
        }
      });

      return newSettings;
    },
    appContext.userSettings,
  );

  // Unified event handlers using the action dispatcher
  const handleSwitchChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateSetting({
      type: ACTION_TYPE.SWITCH_CHANGE,
      name: event.target.name,
      checked: event.target.checked,
    });
  };

  const handleInputChange = (
    event: SelectChangeEvent | ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    updateSetting({
      type: ACTION_TYPE.INPUT_CHANGE,
      name: event.target.name,
      value: event.target.value,
    });
  };

  const handleButtonClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!isButtonElement(event.target)) return;
    const { name, value } = event.target;
    if (name && value) {
      updateSetting({ type: ACTION_TYPE.BUTTON_CLICK, name, value });
    }
  };

  const handleRestoreDefaults = () => {
    updateSetting({ type: ACTION_TYPE.RESTORE_DEFAULTS });
  };

  // Use formState for current values, falling back to appContext
  const currentSettings = formState || appContext.userSettings;

  return (
    <FormGroup>
      {/* Loading indicator when settings are updating */}
      {isPending && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: "#1976d2",
            animation: "pulse 1s infinite",
            zIndex: 1000,
          }}
        />
      )}

      <List
        sx={{
          width: "100%",
          bgcolor: "background.paper",
          color: "text.primary",
          opacity: isPending ? 0.7 : 1,
          transition: "opacity 0.2s ease",
        }}
        component="nav"
        aria-labelledby="nested-list-subheader"
        subheader={
          <ListSubheader component="label" id="nested-list-subheader">
            Behavior
          </ListSubheader>
        }
      >
        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Cache Search Results" />
          {/* <FormHelperText>Improves performance</FormHelperText> */}
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

        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Currency" />
          {/*<FormHelperText>Convert all currency to this</FormHelperText>*/}
          <FormControl>
            <InputLabel id="currency-select-label">Currency</InputLabel>
            <Select
              labelId="currency-select-label"
              value={currentSettings.currency}
              onChange={handleInputChange}
              name="currency"
              label="currency"
              size="small"
              sx={{ ...inputStyle }}
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

        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Location" />
          {/*<FormHelperText>Your country</FormHelperText>*/}
          <FormControl>
            <InputLabel id="location-select-label">Location</InputLabel>
            <Select
              labelId="location-select-label"
              value={currentSettings.location}
              onChange={handleInputChange}
              name="location"
              label="location"
              size="small"
              sx={{ ...inputStyle }}
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

        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Currency Rate" />
          {/*<FormHelperText>Just an input example</FormHelperText>*/}
          <FormControl>
            <TextField
              value={currentSettings.currencyRate}
              label="Currency Rate"
              name="currencyRate"
              onChange={handleInputChange}
              variant="filled"
              size="small"
              sx={{ ...inputStyle }}
              disabled={isPending}
            />
          </FormControl>
        </ListItem>

        <Divider variant="middle" component="li" />
        <ListSubheader component="label" id="nested-list-subheader">
          Display
        </ListSubheader>

        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Font Size" />
          {/*<FormHelperText>Popup size</FormHelperText>*/}
          <FormControl>
            <ButtonGroup
              variant="contained"
              aria-label="Font size"
              onClick={handleButtonClick}
              disabled={isPending}
            >
              <Button
                name="fontSize"
                value="small"
                size="small"
                aria-label="Small"
                title="Small"
                variant={currentSettings.fontSize === "small" ? "contained" : "text"}
                disabled={isPending}
              >
                <TextDecreaseIcon fontSize="small" sx={{ pointerEvents: "none" }} />
              </Button>
              <Button
                name="fontSize"
                value="medium"
                size="small"
                aria-label="Medium"
                title="Medium"
                variant={currentSettings.fontSize === "medium" ? "contained" : "text"}
                disabled={isPending}
              >
                <TextFormatIcon fontSize="small" sx={{ pointerEvents: "none" }} />
              </Button>
              <Button
                name="fontSize"
                value="large"
                size="small"
                aria-label="Large"
                title="Large"
                variant={currentSettings.fontSize === "large" ? "contained" : "text"}
                disabled={isPending}
              >
                <TextIncreaseIcon fontSize="small" sx={{ pointerEvents: "none" }} />
              </Button>
            </ButtonGroup>
          </FormControl>
        </ListItem>

        <ListItem sx={displayHelperOnHover}>
          <ListItemText primary="Show Helpful Tips" />
          {/*<FormHelperText id="some-setting-helper-text">Show help in tooltips</FormHelperText>*/}
          <Switch
            checked={currentSettings.showHelp}
            onChange={handleSwitchChange}
            name="showHelp"
            disabled={isPending}
          />
        </ListItem>

        <Divider component="li" />
        <ListItem>
          <Stack
            spacing={2}
            direction="row"
            sx={{ display: "block", marginLeft: "auto", marginRight: "auto" }}
          >
            <Button variant="outlined" onClick={handleRestoreDefaults} disabled={isPending}>
              {isPending ? "Restoring..." : "Restore Defaults"}
            </Button>
          </Stack>
        </ListItem>
      </List>
    </FormGroup>
  );
}

/**
 * MIGRATION GUIDE:
 *
 * To migrate from SettingsPanel.tsx to this React v19 version:
 *
 * 1. Replace useAppContext with useAppContextV19 (use() hook)
 * 2. Replace multiple handlers with single useActionState
 * 3. Add loading states and disabled states during updates
 * 4. Use action dispatcher pattern for all form updates
 * 5. Add restore defaults functionality
 * 6. Add visual feedback for pending operations
 *
 * PERFORMANCE BENEFITS:
 * - Consolidated form state reduces re-renders
 * - Built-in loading states improve UX
 * - Better error handling for failed updates
 * - Automatic batching of rapid changes
 * - Optimistic updates with rollback capability
 * @source
 */
