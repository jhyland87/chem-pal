import { CURRENCY_SYMBOL_MAP } from "@/constants/currency";
import { useAppContext } from "@/context";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import {
  Accordion,
  Autocomplete,
  Box,
  Chip,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { ChangeEvent, ReactNode, SyntheticEvent } from "react";
import styles from "./DrawerSearchPanel.module.scss";
import { StyledAccordionDetails, StyledAccordionSummary } from "./StyledComponents";

type CountryOption = { code: string; label: string };

interface ColumnDrawerSectionProps {
  columnId: string;
  config: ColumnDrawerConfig;
  expandedAccordion: string | false;
  onAccordionChange: (panel: string) => (event: SyntheticEvent, isExpanded: boolean) => void;
}

/**
 * Renders one drawer accordion section for a column that declared
 * `meta.drawer`. The widget (`autocompleteStrings`, `autocompleteObjects`,
 * `chips`, `numberRange`) determines the input, and `config.bind` tells the
 * component which slice of app state to read/write.
 *
 * Keeps columns free of context knowledge — columns describe what the user
 * sees, this component wires it up.
 * @source
 */
export default function ColumnDrawerSection({
  columnId,
  config,
  expandedAccordion,
  onAccordionChange,
}: ColumnDrawerSectionProps) {
  const {
    selectedSuppliers,
    setSelectedSuppliers,
    searchFilters,
    setSearchFilters,
    userSettings,
    setUserSettings,
  } = useAppContext();

  const panelId = `search-${columnId}`;
  const isExpanded = expandedAccordion === panelId;
  const summary = (hint?: ReactNode) => (
    <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Typography>
        {config.label}
        {hint !== undefined && <span className={styles["accordion-hint"]}>{hint}</span>}
      </Typography>
    </StyledAccordionSummary>
  );

  // autocompleteStrings — e.g. Search Suppliers (keys: string[]).
  if (config.widget === "autocompleteStrings") {
    if (config.bind.kind !== "selectedSuppliers" && config.bind.kind !== "searchFilters") {
      return null;
    }

    const { options, optionLabels, emptyHelperText, placeholder } = config;
    const currentValue =
      config.bind.kind === "selectedSuppliers"
        ? selectedSuppliers
        : (searchFilters[config.bind.key] as string[]);

    const handleChange = (_event: SyntheticEvent, newValue: string[]) => {
      if (config.bind.kind === "selectedSuppliers") {
        setSelectedSuppliers(newValue);
      } else if (config.bind.kind === "searchFilters") {
        setSearchFilters({ ...searchFilters, [config.bind.key]: newValue });
      }
    };

    return (
      <Accordion expanded={isExpanded} onChange={onAccordionChange(panelId)}>
        {summary(currentValue.length > 0 ? ` (${currentValue.length} selected)` : undefined)}
        <StyledAccordionDetails>
          <Autocomplete
            multiple
            size="small"
            options={[...options]}
            getOptionLabel={(option) => optionLabels?.[option] ?? option}
            filterOptions={(opts, { inputValue }) => {
              const term = inputValue.toLowerCase();
              return opts.filter((opt) =>
                (optionLabels?.[opt] ?? opt).toLowerCase().includes(term),
              );
            }}
            value={currentValue}
            onChange={handleChange}
            renderInput={(params) => (
              <TextField
                {...params}
                label={`Filter by ${config.label.toLowerCase()}`}
                placeholder={placeholder}
                helperText={currentValue.length === 0 ? emptyHelperText : undefined}
                slotProps={{ formHelperText: { sx: { fontStyle: "italic" } } }}
              />
            )}
          />
        </StyledAccordionDetails>
      </Accordion>
    );
  }

  // autocompleteObjects — e.g. Country (options are { code, label }).
  if (config.widget === "autocompleteObjects") {
    if (config.bind.kind !== "searchFilters") return null;
    const bindKey = config.bind.key;
    const { options, emptyHelperText, placeholder } = config;
    const selectedCodes = searchFilters[bindKey] as string[];
    const currentValue: CountryOption[] = options.filter((opt) => selectedCodes.includes(opt.code));

    const handleChange = (_event: SyntheticEvent, newValue: CountryOption[]) => {
      setSearchFilters({
        ...searchFilters,
        [bindKey]: newValue.map((opt) => opt.code),
      });
    };

    return (
      <Accordion expanded={isExpanded} onChange={onAccordionChange(panelId)}>
        {summary(selectedCodes.length > 0 ? ` (${selectedCodes.length} selected)` : undefined)}
        <StyledAccordionDetails>
          <Autocomplete
            multiple
            size="small"
            options={[...options]}
            getOptionLabel={(option) => option.label}
            filterOptions={(opts, { inputValue }) => {
              const term = inputValue.toLowerCase();
              return opts.filter(
                (opt) =>
                  opt.label.toLowerCase().includes(term) || opt.code.toLowerCase().includes(term),
              );
            }}
            value={currentValue}
            onChange={handleChange}
            isOptionEqualToValue={(option, value) => option.code === value.code}
            renderInput={(params) => (
              <TextField
                {...params}
                label={`Filter by ${config.label.toLowerCase()}`}
                placeholder={placeholder}
                helperText={selectedCodes.length === 0 ? emptyHelperText : undefined}
                slotProps={{ formHelperText: { sx: { fontStyle: "italic" } } }}
              />
            )}
          />
        </StyledAccordionDetails>
      </Accordion>
    );
  }

  // chips — e.g. Shipping Type (chip toggle for a fixed string list).
  if (config.widget === "chips") {
    if (config.bind.kind !== "searchFilters") return null;
    const bindKey = config.bind.key;
    const { options, formatChipLabel } = config;
    const selected = searchFilters[bindKey] as string[];

    const toggle = (value: string) => {
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];
      setSearchFilters({ ...searchFilters, [bindKey]: next });
    };

    return (
      <Accordion expanded={isExpanded} onChange={onAccordionChange(panelId)}>
        {summary(selected.length > 0 ? ` (${selected.length} selected)` : undefined)}
        <StyledAccordionDetails>
          <Box className={styles["chip-container"]}>
            {options.map((option) => (
              <Chip
                key={option}
                label={formatChipLabel ? formatChipLabel(option) : option}
                size="small"
                onClick={() => toggle(option)}
                color={selected.includes(option) ? "primary" : "default"}
                variant={selected.includes(option) ? "filled" : "outlined"}
              />
            ))}
          </Box>
        </StyledAccordionDetails>
      </Accordion>
    );
  }

  // numberRange — e.g. Price Range (two numeric inputs with optional adornment).
  if (config.widget === "numberRange") {
    if (config.bind.kind !== "userSettingsRange") return null;
    const { minKey, maxKey } = config.bind;
    const minValue = userSettings[minKey] as number | undefined;
    const maxValue = userSettings[maxKey] as number | undefined;
    // Resolve the `"currency"` sentinel at render time so the symbol follows
    // the user's current currency setting (USD → "$", EUR → "€", etc.).
    const adornment =
      config.adornment === "currency"
        ? (userSettings.currency ? CURRENCY_SYMBOL_MAP[userSettings.currency] : undefined)
        : config.adornment;

    const hint =
      minValue != null || maxValue != null
        ? ` (${
            minValue != null && maxValue != null
              ? `${adornment ?? ""}${minValue} - ${adornment ?? ""}${maxValue}`
              : minValue != null
                ? `min ${adornment ?? ""}${minValue}`
                : `max ${adornment ?? ""}${maxValue}`
          })`
        : undefined;

    const handleNumberChange = (key: keyof UserSettings) =>
      (e: ChangeEvent<HTMLInputElement>) => {
        setUserSettings({
          ...userSettings,
          [key]: e.target.value ? parseFloat(e.target.value) : undefined,
        });
      };

    return (
      <Accordion expanded={isExpanded} onChange={onAccordionChange(panelId)}>
        {summary(hint)}
        <StyledAccordionDetails>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Min"
              type="number"
              size="small"
              value={minValue ?? ""}
              onChange={handleNumberChange(minKey)}
              slotProps={{
                input: adornment
                  ? {
                      startAdornment: <InputAdornment position="start">{adornment}</InputAdornment>,
                    }
                  : undefined,
                htmlInput: { min: 0 },
              }}
            />
            <TextField
              label="Max"
              type="number"
              size="small"
              value={maxValue ?? ""}
              onChange={handleNumberChange(maxKey)}
              slotProps={{
                input: adornment
                  ? {
                      startAdornment: <InputAdornment position="start">{adornment}</InputAdornment>,
                    }
                  : undefined,
                htmlInput: { min: 0 },
              }}
            />
          </Box>
        </StyledAccordionDetails>
      </Accordion>
    );
  }

  return null;
}
