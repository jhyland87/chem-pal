import { useAppContext } from "@/components/SearchPanel/hooks/useContext";
import { ACTION_TYPE } from "@/constants/common";
import { FUZZ_SCORER_NAMES } from "@/constants/fuzzScorers";
import {
  loadExcludedProducts,
  removeExcludedProduct,
  type ExcludedProductsMap,
} from "@/helpers/excludedProducts";
import { formatTimestamp } from "@/helpers/utils";
import { clearExcludedProducts } from "@/utils/idbCache";
import { IS_DEV_BUILD } from "@/utils/isDevBuild";
import { isButtonElement } from "@/utils/typeGuards/common";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TextDecreaseIcon from "@mui/icons-material/TextDecrease";
import TextFormatIcon from "@mui/icons-material/TextFormat";
import TextIncreaseIcon from "@mui/icons-material/TextIncrease";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
//import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  ChangeEvent,
  MouseEvent,
  SyntheticEvent,
  startTransition,
  useActionState,
  useEffect,
  useState,
} from "react";
import { currencies, locations } from "../../config.json";
import styles from "./SettingsPanelFull.module.scss";

// SettingAction type is declared globally in types/settings.d.ts

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
        case ACTION_TYPE.SWITCH_CHANGE:
          newSettings = { ...currentSettings, [action.name]: action.checked };
          break;
        case ACTION_TYPE.INPUT_CHANGE:
          newSettings = { ...currentSettings, [action.name]: action.value };
          break;
        case ACTION_TYPE.BUTTON_CLICK:
          newSettings = { ...currentSettings, [action.name]: action.value };
          break;
        case ACTION_TYPE.RESTORE_DEFAULTS:
          newSettings = {
            ...currentSettings,
            showHelp: false,
            caching: true,
            autocomplete: true,
            autoResize: true,
            showColumnFilters: true,
            showAllColumns: false,
            fontSize: "medium",
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

  const [excludedProducts, setExcludedProducts] = useState<ExcludedProductsMap>({});

  useEffect(() => {
    const load = async () => {
      try {
        const map = await loadExcludedProducts();
        setExcludedProducts(map);
      } catch (error) {
        console.warn("Failed to load excluded products:", error);
      }
    };
    load();
  }, []);

  const handleRemoveExcluded = async (key: string) => {
    try {
      await removeExcludedProduct(key);
      setExcludedProducts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (error) {
      console.warn("Failed to remove excluded product:", error);
    }
  };

  const handleClearAllExcluded = async () => {
    try {
      await clearExcludedProducts();
      setExcludedProducts({});
    } catch (error) {
      console.warn("Failed to clear excluded products:", error);
    }
  };

  const excludedEntries = Object.entries(excludedProducts).sort(
    ([, a], [, b]) => b.excludedAt - a.excludedAt,
  );
  const excludedCount = excludedEntries.length;

  const currentSettings = formState || appContext.userSettings;

  const handleAccordionChange =
    (panel: string) => (_event: SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false);
    };

  return (
    <Box>
      <Accordion
        expanded={expanded === "behavior"}
        onChange={handleAccordionChange("behavior")}
        disableGutters
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          className={styles["settings-panel__accordion-summary"]}
        >
          <Typography variant="body2" fontWeight={500}>
            Behavior
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={styles["settings-panel__accordion-details"]}>
          <List dense component="nav" aria-labelledby="behavior-list-subheader">
            {/* Caching */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary="Cache Search Results" />
              {/*<FormHelperText>Improves performance</FormHelperText>*/}
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
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary="AutoComplete" />
              {/*<FormHelperText>Autocomplete search input</FormHelperText>*/}
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
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary="Currency" />
              {/*<FormHelperText>Convert all currency to this</FormHelperText>*/}
              <FormControl>
                <Select
                  value={currentSettings.currency}
                  onChange={handleInputChange}
                  name="currency"
                  size="small"
                  className={styles["settings-panel__input"]}
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
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary="Location" />
              {/*<FormHelperText>Your country</FormHelperText>*/}
              <FormControl>
                <Select
                  value={currentSettings.location}
                  onChange={handleInputChange}
                  name="location"
                  size="small"
                  className={styles["settings-panel__input"]}
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

            {/* Foo Example */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary="Currency Rate" />
              {/*<FormHelperText>Just an input example</FormHelperText>*/}
              <FormControl>
                <TextField
                  value={currentSettings.currencyRate}
                  name="currencyRate"
                  onChange={handleInputChange}
                  variant="outlined"
                  size="small"
                  className={styles["settings-panel__input"]}
                  disabled={isPending}
                />
              </FormControl>
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>
      <Accordion
        expanded={expanded === "display"}
        onChange={handleAccordionChange("display")}
        disableGutters
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          className={styles["settings-panel__accordion-summary"]}
        >
          <Typography variant="body2" fontWeight={500}>
            Display
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={styles["settings-panel__accordion-details"]}>
          <List dense component="nav" aria-labelledby="display-list-subheader">
            {/* Font Size */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary="Font Size" />
              {/*<FormHelperText>Popup size</FormHelperText>*/}
              <FormControl>
                <ButtonGroup
                  variant="contained"
                  aria-label="Basic button group"
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
            {/* Auto-Resize */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary="Auto-Resize" />
              {/*<FormHelperText>More results = larger window</FormHelperText>*/}
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
      <Accordion
        expanded={expanded === "excluded"}
        onChange={handleAccordionChange("excluded")}
        disableGutters
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          className={styles["settings-panel__accordion-summary"]}
        >
          <Typography variant="body2" fontWeight={500}>
            Excluded Products
            {excludedCount > 0 && (
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ ml: 0.5 }}
              >
                ({excludedCount})
              </Typography>
            )}
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={styles["settings-panel__accordion-details"]}>
          {excludedCount === 0 ? (
            <Typography
              variant="caption"
              color="text.secondary"
              className={styles["settings-panel__excluded-empty"]}
            >
              No excluded products.
            </Typography>
          ) : (
            <>
              <List dense disablePadding>
                {excludedEntries.map(([key, entry]) => (
                  <ListItem
                    key={key}
                    divider
                    className={styles["settings-panel__excluded-item"]}
                    secondaryAction={
                      <Tooltip title="Remove">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleRemoveExcluded(key)}
                          className={styles["settings-panel__excluded-delete-btn"]}
                          aria-label={`Remove ${entry.title || entry.url}`}
                        >
                          <DeleteIcon className={styles["settings-panel__excluded-delete-icon"]} />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemText
                      primary={
                        <Link
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="body2"
                          className={styles["settings-panel__excluded-link"]}
                        >
                          {entry.title || entry.url}
                        </Link>
                      }
                      secondary={`${entry.supplier} — ${formatTimestamp(entry.excludedAt)}`}
                      slotProps={{
                        secondary: {
                          variant: "caption",
                          className: styles["settings-panel__excluded-secondary-text"],
                        },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
              <Box className={styles["settings-panel__excluded-actions"]}>
                <Button
                  variant="outlined"
                  color="warning"
                  size="small"
                  onClick={handleClearAllExcluded}
                >
                  Clear All
                </Button>
              </Box>
            </>
          )}
        </AccordionDetails>
      </Accordion>
      {/* Dev-only Advanced section. `IS_DEV_BUILD` is a Vite-replaced string
          literal, so the entire block is tree-shaken from prod bundles — no
          config flag or runtime check reaches production users. */}
      {IS_DEV_BUILD && (
        <Accordion
          expanded={expanded === "advanced"}
          onChange={handleAccordionChange("advanced")}
          disableGutters
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            className={styles["settings-panel__accordion-summary"]}
          >
            <Typography variant="body2" fontWeight={500}>
              Advanced
            </Typography>
          </AccordionSummary>
          <AccordionDetails className={styles["settings-panel__accordion-details"]}>
            {/* Mirrors the search drawer's single-select filter-input style:
                full-width labeled outlined TextField with italic helper text.
                Using `TextField select` (rather than the horizontal
                ListItem + Select pattern the rest of this panel uses) gives
                long scorer names like `partial_token_similarity_sort_ratio`
                room to render, and keeps the visual consistent with the
                search drawer filters. */}
            <Box sx={{ p: 1 }}>
              <TextField
                select
                fullWidth
                size="small"
                name="fuzzScorerOverride"
                label="Fuzz match method"
                value={currentSettings.fuzzScorerOverride ?? ""}
                onChange={handleInputChange}
                disabled={isPending}
                helperText="Overrides each supplier's default scorer"
                slotProps={{ formHelperText: { sx: { fontStyle: "italic" } } }}
              >
                <MenuItem value="">
                  <em>Default (per supplier)</em>
                </MenuItem>
                {FUZZ_SCORER_NAMES.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
      <Accordion
        expanded={expanded === "actions"}
        onChange={handleAccordionChange("actions")}
        disableGutters
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          className={styles["settings-panel__accordion-summary"]}
        >
          <Typography variant="body2" fontWeight={500}>
            Actions
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={styles["settings-panel__accordion-details--actions"]}>
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
