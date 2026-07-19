import { useAppContext } from "@/components/SearchPanel/hooks/useContext";
import { ACTION_TYPE, IDB_STORE } from "@/constants/common";
import { COUNTRIES } from "@/constants/countries";
import { CURRENCIES } from "@/constants/currency";
import { FUZZ_SCORER_NAMES } from "@/constants/fuzzScorers";
import { getCurrencyRate } from "@/helpers/currency";
import {
  loadExcludedProducts,
  removeExcludedProduct,
  type ExcludedProductsMap,
} from "@/helpers/excludedProducts";
import { getAvailableLocales, i18n } from "@/helpers/i18n";
import { formatBytes, formatTimestamp, getLanguageName } from "@/helpers/utils";
// Names only, from a dependency-free constant — importing SupplierFactory here
// would pull every supplier implementation into the options-page bundle.
import { SUPPLIER_CLASS_NAMES } from "@/constants/suppliers";
import {
  clearExcludedProducts,
  clearPriceHistory,
  clearSupplierProductDataCache,
  clearSupplierQueryCache,
  getAllPriceSeries,
  getIdbStorageBreakdown,
} from "@/utils/idbCache";
import { isButtonElement } from "@/utils/typeGuards/common";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TextDecreaseIcon from "@mui/icons-material/TextDecrease";
import TextFormatIcon from "@mui/icons-material/TextFormat";
import TextIncreaseIcon from "@mui/icons-material/TextIncrease";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
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
import styles from "./SettingsPanel.module.scss";

// Languages the extension ships a translation (`messages.json`) for. Derived at
// build time from src/_locales, so adding a locale folder adds a dropdown option.
const AVAILABLE_LOCALES = getAvailableLocales();

// SettingAction type is declared globally in types/settings.d.ts

// Cap the country menu (250+ entries) so it stays short; users narrow by typing.
const countryFilter = createFilterOptions<{ code: string; name: string }>({
  limit: 15,
  stringify: (option) => `${option.name} ${option.code}`,
});
// No limit for currency: with a 15-cap the alphabetical first page (AED…BHD) hid
// common codes like USD unless the user knew to type them. The full list stays
// scrollable and still narrows on type.
const currencyFilter = createFilterOptions<{ code: string; symbol: string }>({
  stringify: (option) => `${option.code} ${option.symbol}`,
});

/**
 * Compute a factor that scales a store's serialized JSON size up to its real
 * on-disk footprint. It's the origin's actual storage usage (from
 * `navigator.storage.estimate()`) divided by the summed JSON size of every
 * IndexedDB store, so multiplying a store's JSON bytes by it apportions the true
 * usage (indexes, keys, encoding overhead) proportionally. Falls back to `1`
 * when the estimate is unavailable, yielding the raw JSON size.
 * @param jsonTotalBytes - Summed JSON byte size across all IndexedDB stores.
 * @returns The usage-to-JSON scale factor, or `1` when no estimate is available.
 * @example
 * ```ts
 * const scale = await getStorageUsageScale(50_000); // e.g. 1.4 when usage is 70 KB
 * ```
 * @source
 */
async function getStorageUsageScale(jsonTotalBytes: number): Promise<number> {
  if (jsonTotalBytes <= 0) return 1;
  try {
    const usage = (await navigator.storage?.estimate?.())?.usage;
    if (usage && usage > 0) return usage / jsonTotalBytes;
  } catch (error) {
    console.warn("Failed to read storage estimate:", error);
  }
  return 1;
}

/**
 * The full settings panel shown in the drawer's Settings tab. Renders all user
 * preference controls (currencies, locations, toggles, numeric limits, excluded
 * products, etc.) and persists changes to `userSettings` via app context.
 * @returns The settings panel element.
 * @example
 * ```tsx
 * // Rendered inside the Settings drawer tab.
 * <SettingsPanel />
 * ```
 * @source
 */
export default function SettingsPanel() {
  const appContext = useAppContext();
  const [expanded, setExpanded] = useState<string | false>("behavior");
  // Developer-only fuzz controls stay hidden until the Konami hotkey unlocks them.
  const advancedMode = appContext?.advancedMode ?? false;

  if (!appContext) {
    return <div>{i18n("settings_loading")}</div>;
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
        case ACTION_TYPE.SUPPLIER_TOGGLE:
          newSettings = { ...currentSettings, disabledSuppliers: action.value };
          break;
        case ACTION_TYPE.RESTORE_DEFAULTS:
          newSettings = {
            ...currentSettings,
            showHelp: false,
            caching: true,
            trackPriceHistory: true,
            priceHistoryMaxPoints: 0,
            fontSize: "medium",
            openInTab: false,
            autoHideEmptyColumns: true,
            disabledSuppliers: [],
            hideColumns: [
              "description",
              "uom",
              "sds",
              "specs",
              "coa",
              "cas",
              "pubchem",
              "formula",
              "moleweight",
              "purity",
              "concentration",
            ],
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
  const [priceHistoryCleared, setPriceHistoryCleared] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [cacheStats, setCacheStats] = useState<{ records: number; bytes: number }>();
  const [priceStats, setPriceStats] = useState<{
    products: number;
    points: number;
    bytes: number;
  }>();

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

  // Loads cache + price-history stats in one pass. Sizes are the stores' JSON
  // byte sizes scaled by the origin's real storage usage, so they reflect the
  // true on-disk footprint rather than the raw serialized size. Cache records
  // combine the query and product-detail caches (variants live inline in product
  // entries, so they're counted within the product cache, not a separate store).
  const loadStorageStats = async () => {
    try {
      const [breakdown, series] = await Promise.all([
        getIdbStorageBreakdown(),
        getAllPriceSeries(),
      ]);
      const scale = await getStorageUsageScale(breakdown.totalBytes);

      const queryStore = breakdown.byStore[IDB_STORE.SUPPLIER_QUERY_CACHE];
      const productStore = breakdown.byStore[IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE];
      setCacheStats({
        records: queryStore.count + productStore.count,
        bytes: Math.round((queryStore.bytes + productStore.bytes) * scale),
      });

      setPriceStats({
        products: new Set(series.map((entry) => entry.productKey)).size,
        points: series.reduce((sum, entry) => sum + entry.points.length, 0),
        bytes: Math.round(breakdown.byStore[IDB_STORE.PRICE_HISTORY].bytes * scale),
      });
    } catch (error) {
      console.warn("Failed to load storage stats:", error);
    }
  };

  useEffect(() => {
    void loadStorageStats();
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

  const handleClearPriceHistory = async () => {
    try {
      await clearPriceHistory();
      setPriceHistoryCleared(true);
      await loadStorageStats();
    } catch (error) {
      console.warn("Failed to clear price history:", error);
    }
  };

  // Clears the supplier query cache and product-detail cache (leaving price
  // history and other stores untouched), then refreshes the displayed stats.
  const handleClearCache = async () => {
    try {
      await Promise.all([clearSupplierQueryCache(), clearSupplierProductDataCache()]);
      setCacheCleared(true);
      await loadStorageStats();
    } catch (error) {
      console.warn("Failed to clear cache:", error);
    }
  };

  const excludedEntries = Object.entries(excludedProducts).sort(
    ([, a], [, b]) => b.excludedAt - a.excludedAt,
  );
  const excludedCount = excludedEntries.length;

  const currentSettings = formState || appContext.userSettings;

  // Toggles a supplier's disabled state. Switch on = enabled, so toggling off adds the
  // supplier's class name to the disabledSuppliers deny-list and toggling on removes it.
  const handleSupplierToggle = (supplierClassName: SupplierClassName) => () => {
    const disabled = currentSettings.disabledSuppliers ?? [];
    const next = disabled.includes(supplierClassName)
      ? disabled.filter((name) => name !== supplierClassName)
      : [...disabled, supplierClassName];
    updateSetting({ type: ACTION_TYPE.SUPPLIER_TOGGLE, value: next });
  };

  // The language setting may be stored as a full locale (e.g. "en-US") while the
  // dropdown lists base locale codes ("en", "pl") that have a translation. Match
  // on the base code, and fall back to empty when the stored language has no
  // shipped translation so the Select doesn't render an out-of-range value.
  const currentLanguageBase = (currentSettings.language ?? "").split("-")[0];
  const selectedLanguage = AVAILABLE_LOCALES.includes(currentLanguageBase)
    ? currentLanguageBase
    : "";

  // Fetch the live USD→currency rate for the selected currency and show it under
  // the dropdown. Fetched directly (not read from stored settings) so the hint
  // always reflects the current selection; getCurrencyRate is LRU-cached, so this
  // returns the same value the price table converts with. Hidden for USD (rate 1).
  const selectedCurrency = currentSettings.currency;
  const [displayRate, setDisplayRate] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!selectedCurrency || selectedCurrency === "USD") {
      setDisplayRate(undefined);
      return;
    }
    let cancelled = false;
    const loadRate = async () => {
      try {
        const rate = await getCurrencyRate("USD", selectedCurrency);
        if (!cancelled) setDisplayRate(rate);
      } catch (error) {
        console.error("Failed to fetch currency rate for display", { error });
        if (!cancelled) setDisplayRate(undefined);
      }
    };
    void loadRate();
    return () => {
      cancelled = true;
    };
  }, [selectedCurrency]);

  const currencyRateHint =
    selectedCurrency && selectedCurrency !== "USD" && displayRate !== undefined
      ? i18n("settings_currency_rate_hint", [
          new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(displayRate),
          selectedCurrency,
        ])
      : undefined;

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
            {i18n("settings_section_behavior")}
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={styles["settings-panel__accordion-details"]}>
          <List dense component="nav" aria-labelledby="behavior-list-subheader">
            {/* Caching */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary={i18n("settings_cache_results")} />
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
            {/* Currency — laid out as a column so the rate hint sits on its own
                right-aligned row below the dropdown (no wrap, and the label/dropdown
                row above it doesn't shift when the hint appears). */}
            <ListItem
              className={styles["settings-panel__helper-on-hover"]}
              sx={{ flexDirection: "column", alignItems: "stretch", rowGap: 0.5 }}
            >
              <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                <ListItemText primary={i18n("settings_currency")} />
                <FormControl>
                  <Autocomplete
                    options={CURRENCIES}
                    getOptionLabel={(option) => `${option.code} (${option.symbol})`}
                    isOptionEqualToValue={(option, value) => option.code === value.code}
                    filterOptions={currencyFilter}
                    value={CURRENCIES.find((c) => c.code === currentSettings.currency) ?? undefined}
                    onChange={(_event, option) =>
                      updateSetting({
                        type: ACTION_TYPE.INPUT_CHANGE,
                        name: "currency",
                        value: option?.code ?? "",
                      })
                    }
                    size="small"
                    className={styles["settings-panel__input"]}
                    disabled={isPending}
                    disableClearable
                    renderInput={(params) => (
                      <TextField {...params} placeholder={i18n("settings_currency")} />
                    )}
                  />
                </FormControl>
              </Box>
              {currencyRateHint && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ alignSelf: "flex-end", whiteSpace: "nowrap" }}
                >
                  {currencyRateHint}
                </Typography>
              )}
            </ListItem>
            {/* Location */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary={i18n("settings_location")} />
              {/*<FormHelperText>Your country</FormHelperText>*/}
              <FormControl>
                <Autocomplete
                  options={COUNTRIES}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) => option.code === value.code}
                  filterOptions={countryFilter}
                  value={COUNTRIES.find((c) => c.code === currentSettings.location) ?? null}
                  onChange={(_event, option) =>
                    updateSetting({
                      type: ACTION_TYPE.INPUT_CHANGE,
                      name: "location",
                      value: option?.code ?? "",
                    })
                  }
                  size="small"
                  className={styles["settings-panel__input"]}
                  disabled={isPending}
                  renderInput={(params) => (
                    <TextField {...params} placeholder={i18n("settings_location_placeholder")} />
                  )}
                />
              </FormControl>
            </ListItem>
            {/* Language */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary={i18n("settings_language")} />
              <FormControl>
                <Select
                  value={selectedLanguage}
                  onChange={handleInputChange}
                  name="language"
                  size="small"
                  className={styles["settings-panel__input"]}
                  disabled={isPending}
                >
                  {AVAILABLE_LOCALES.map((localeCode) => (
                    <MenuItem key={localeCode} value={localeCode}>
                      {getLanguageName(localeCode)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>
      <Accordion
        expanded={expanded === "cache"}
        onChange={handleAccordionChange("cache")}
        disableGutters
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          className={styles["settings-panel__accordion-summary"]}
        >
          <Typography variant="body2" fontWeight={500}>
            {i18n("settings_section_cache")}
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={styles["settings-panel__accordion-details"]}>
          <List dense component="nav" aria-labelledby="cache-list-subheader">
            {/* Do Not Cache Empty Results */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary={i18n("settings_do_not_cache_empty")} />
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(currentSettings.doNotCacheEmptyResults)}
                    onChange={handleSwitchChange}
                    name="doNotCacheEmptyResults"
                    disabled={isPending}
                  />
                }
                labelPlacement="start"
                label=""
              />
            </ListItem>
            {/* Cache TTL (minutes) — 0 disables expiration */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary={i18n("settings_cache_ttl")} />
              <FormControl>
                <TextField
                  value={currentSettings.cacheTtlMinutes ?? 0}
                  name="cacheTtlMinutes"
                  onChange={handleInputChange}
                  type="number"
                  variant="outlined"
                  size="small"
                  className={styles["settings-panel__input"]}
                  disabled={isPending}
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                />
              </FormControl>
            </ListItem>
            {/* Cache stats + clear button */}
            <ListItem
              className={styles["settings-panel__helper-on-hover"]}
              sx={{ flexDirection: "column", alignItems: "flex-start", rowGap: 0.5 }}
            >
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Button variant="outlined" color="warning" size="small" onClick={handleClearCache}>
                  {i18n("settings_clear_cache")}
                </Button>
                {cacheCleared && (
                  <Typography variant="caption" sx={{ ml: 1 }}>
                    {i18n("settings_cache_cleared")}
                  </Typography>
                )}
              </Box>
              {cacheStats && (
                <Typography variant="caption" color="text.secondary">
                  {i18n("settings_cache_stats", [
                    cacheStats.records.toLocaleString(),
                    formatBytes(cacheStats.bytes),
                  ])}
                </Typography>
              )}
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>
      <Accordion
        expanded={expanded === "priceHistory"}
        onChange={handleAccordionChange("priceHistory")}
        disableGutters
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          className={styles["settings-panel__accordion-summary"]}
        >
          <Typography variant="body2" fontWeight={500}>
            {i18n("settings_section_price_history")}
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={styles["settings-panel__accordion-details"]}>
          <List dense component="nav" aria-labelledby="price-history-list-subheader">
            {/* Master toggle — on by default */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText
                primary={i18n("settings_track_price_history")}
                secondary={i18n("settings_track_price_history_desc")}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={currentSettings.trackPriceHistory ?? true}
                    onChange={handleSwitchChange}
                    name="trackPriceHistory"
                    disabled={isPending}
                  />
                }
                labelPlacement="start"
                label=""
              />
            </ListItem>
            {/* Max points per product — 0 means unlimited */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary={i18n("settings_max_price_points")} />
              <FormControl>
                <TextField
                  value={currentSettings.priceHistoryMaxPoints ?? 0}
                  name="priceHistoryMaxPoints"
                  onChange={handleInputChange}
                  type="number"
                  variant="outlined"
                  size="small"
                  className={styles["settings-panel__input"]}
                  disabled={isPending || currentSettings.trackPriceHistory === false}
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                />
              </FormControl>
            </ListItem>
            <ListItem
              className={styles["settings-panel__helper-on-hover"]}
              sx={{ flexDirection: "column", alignItems: "flex-start", rowGap: 0.5 }}
            >
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Button
                  variant="outlined"
                  color="warning"
                  size="small"
                  onClick={handleClearPriceHistory}
                >
                  {i18n("settings_clear_price_history")}
                </Button>
                {priceHistoryCleared && (
                  <Typography variant="caption" sx={{ ml: 1 }}>
                    {i18n("settings_price_history_cleared")}
                  </Typography>
                )}
              </Box>
              {priceStats && (
                <Typography variant="caption" color="text.secondary">
                  {i18n("settings_price_history_stats", [
                    priceStats.products.toLocaleString(),
                    priceStats.points.toLocaleString(),
                    formatBytes(priceStats.bytes),
                  ])}
                </Typography>
              )}
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
            {i18n("settings_section_display")}
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={styles["settings-panel__accordion-details"]}>
          <List dense component="nav" aria-labelledby="display-list-subheader">
            {/* Font Size */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText primary={i18n("settings_font_size")} />
              {/*<FormHelperText>Popup size</FormHelperText>*/}
              <FormControl>
                <ButtonGroup
                  variant="contained"
                  aria-label={i18n("settings_font_size")}
                  onClick={handleButtonClick}
                  disabled={isPending}
                >
                  <Button
                    name="fontSize"
                    value="small"
                    size="small"
                    aria-label={i18n("settings_font_small")}
                    title={i18n("settings_font_small")}
                    variant={currentSettings.fontSize === "small" ? "contained" : "text"}
                    disabled={isPending}
                  >
                    <TextDecreaseIcon fontSize="small" sx={{ pointerEvents: "none" }} />
                  </Button>
                  <Button
                    name="fontSize"
                    value="medium"
                    size="small"
                    aria-label={i18n("settings_font_medium")}
                    title={i18n("settings_font_medium")}
                    variant={currentSettings.fontSize === "medium" ? "contained" : "text"}
                    disabled={isPending}
                  >
                    <TextFormatIcon fontSize="small" sx={{ pointerEvents: "none" }} />
                  </Button>
                  <Button
                    name="fontSize"
                    value="large"
                    size="small"
                    aria-label={i18n("settings_font_large")}
                    title={i18n("settings_font_large")}
                    variant={currentSettings.fontSize === "large" ? "contained" : "text"}
                    disabled={isPending}
                  >
                    <TextIncreaseIcon fontSize="small" sx={{ pointerEvents: "none" }} />
                  </Button>
                </ButtonGroup>
              </FormControl>
            </ListItem>
            {/* Open in tab — when on, clicking the toolbar icon opens the full-tab
                view instead of the popup (enforced by the service worker). */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText
                primary={i18n("settings_open_in_tab")}
                secondary={i18n("settings_open_in_tab_desc")}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={currentSettings.openInTab ?? false}
                    onChange={handleSwitchChange}
                    name="openInTab"
                    disabled={isPending}
                  />
                }
                labelPlacement="start"
                label=""
              />
            </ListItem>
            {/* Auto hide empty columns — when on, columns with no data in the
                current result set are hidden automatically (see ResultsTable). */}
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText
                primary={i18n("settings_auto_hide_empty_columns")}
                secondary={i18n("settings_auto_hide_empty_columns_desc")}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={currentSettings.autoHideEmptyColumns ?? true}
                    onChange={handleSwitchChange}
                    name="autoHideEmptyColumns"
                    disabled={isPending}
                  />
                }
                labelPlacement="start"
                label=""
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
            {i18n("settings_section_excluded")}
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
              {i18n("settings_excluded_empty")}
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
                      <Tooltip title={i18n("settings_remove")}>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleRemoveExcluded(key)}
                          className={styles["settings-panel__excluded-delete-btn"]}
                          aria-label={i18n("settings_remove_item", [
                            entry.title || entry.url || "",
                          ])}
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
                  {i18n("settings_clear_all")}
                </Button>
              </Box>
            </>
          )}
        </AccordionDetails>
      </Accordion>
      {/* Per-supplier enable/disable. Each switch on = supplier enabled; toggling
          off adds it to the disabledSuppliers deny-list, excluding it from every
          search and hiding it from the search filter menu. */}
      <Accordion
        expanded={expanded === "suppliers"}
        onChange={handleAccordionChange("suppliers")}
        disableGutters
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          className={styles["settings-panel__accordion-summary"]}
        >
          <Typography variant="body2" fontWeight={500}>
            {i18n("settings_section_supplier_status")}
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={styles["settings-panel__accordion-details"]}>
          <Typography
            variant="caption"
            sx={{ px: 2, py: 1, display: "block", fontStyle: "italic", color: "text.secondary" }}
          >
            {i18n("settings_supplier_status_desc")}
          </Typography>
          <List dense sx={{ width: "100%" }}>
            {SUPPLIER_CLASS_NAMES.map((supplierClassName) => (
              <ListItem
                key={supplierClassName}
                className={styles["settings-panel__helper-on-hover"]}
              >
                <ListItemText primary={supplierClassName.replace(/^Supplier/, "")} />
                <FormControlLabel
                  control={
                    <Switch
                      checked={
                        !(currentSettings.disabledSuppliers ?? []).includes(supplierClassName)
                      }
                      onChange={handleSupplierToggle(supplierClassName)}
                      name={supplierClassName}
                      disabled={isPending}
                    />
                  }
                  labelPlacement="start"
                  label=""
                />
              </ListItem>
            ))}
          </List>
        </AccordionDetails>
      </Accordion>
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
            {i18n("settings_section_advanced")}
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
          {advancedMode && (
            <Box sx={{ p: 1 }}>
              <TextField
                select
                fullWidth
                size="small"
                name="fuzzScorerOverride"
                label={i18n("settings_fuzz_scorer")}
                value={currentSettings.fuzzScorerOverride ?? ""}
                onChange={handleInputChange}
                disabled={isPending}
                helperText={i18n("settings_fuzz_scorer_helper")}
                slotProps={{ formHelperText: { sx: { fontStyle: "italic" } } }}
              >
                <MenuItem value="">
                  <em>{i18n("settings_fuzz_scorer_default")}</em>
                </MenuItem>
                {FUZZ_SCORER_NAMES.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          )}
          <Box sx={{ p: 1 }}>
            <TextField
              fullWidth
              size="small"
              type="number"
              name="maxAllowableSearchTime"
              label={i18n("settings_max_search_time")}
              value={currentSettings.maxAllowableSearchTime ?? ""}
              onChange={handleInputChange}
              disabled={isPending}
              helperText={i18n("settings_max_search_time_helper")}
              slotProps={{
                formHelperText: { sx: { fontStyle: "italic" } },
                htmlInput: { min: 0, step: 1000 },
              }}
            />
          </Box>
          {advancedMode && (
            <ListItem className={styles["settings-panel__helper-on-hover"]}>
              <ListItemText
                primary={i18n("settings_disable_fuzzy")}
                secondary={i18n("settings_disable_fuzzy_desc")}
                slotProps={{ secondary: { sx: { fontStyle: "italic" } } }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={currentSettings.fuzzyFilteringDisabled ?? false}
                    onChange={handleSwitchChange}
                    name="fuzzyFilteringDisabled"
                    disabled={isPending}
                  />
                }
                labelPlacement="start"
                label=""
              />
            </ListItem>
          )}
        </AccordionDetails>
      </Accordion>
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
            {i18n("settings_section_actions")}
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
              {i18n("settings_restore_defaults")}
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
