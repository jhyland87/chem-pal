import {
  AVAILABILITY_OPTIONS,
  SHIPPING_OPTIONS,
  SUPPLIER_COUNTRY_OPTIONS,
} from "@/constants/common";
import { useAppContext } from "@/context";
import SupplierFactory from "@/suppliers/SupplierFactory";
import { ExpandMore as ExpandMoreIcon, Search as SearchIcon } from "@mui/icons-material";
import {
  Accordion,
  Autocomplete,
  Box,
  Button,
  Chip,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import React from "react";
import styles from "./DrawerSearchPanel.module.scss";
import { StyledAccordionDetails, StyledAccordionSummary } from "./StyledComponents";

const suppliers = SupplierFactory.supplierList();
const supplierNames = SupplierFactory.supplierDisplayNames();

const DrawerSearchPanel: React.FC<{
  expandedAccordion: string | false;
  onAccordionChange: (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => void;
}> = ({ expandedAccordion, onAccordionChange }) => {
  const {
    selectedSuppliers,
    setSelectedSuppliers,
    userSettings,
    setUserSettings,
    setDrawerTab,
    setPendingSearchQuery,
    searchFilters,
    setSearchFilters,
  } = useAppContext();

  const toggleChip = (field: "availability" | "country" | "shippingType", value: string) => {
    const current = searchFilters[field];
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    setSearchFilters({ ...searchFilters, [field]: updated });
  };

  const handleSearch = () => {
    const query = searchFilters.titleQuery.trim();
    if (!query) return;
    setPendingSearchQuery(query);
    setDrawerTab(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <Box>
      {/* Title / Search Query */}
      <Box sx={{ p: "12px 16px" }}>
        <TextField
          fullWidth
          label="Product name or keyword"
          size="small"
          value={searchFilters.titleQuery}
          onChange={(e) => setSearchFilters({ ...searchFilters, titleQuery: e.target.value })}
          onKeyDown={handleKeyDown}
        />
      </Box>

      {/* Availability */}
      <Accordion
        expanded={expandedAccordion === "search-availability"}
        onChange={onAccordionChange("search-availability")}
      >
        <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Availability</Typography>
        </StyledAccordionSummary>
        <StyledAccordionDetails>
          <Box className={styles["chip-container"]}>
            {AVAILABILITY_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                size="small"
                onClick={() => toggleChip("availability", option)}
                color={searchFilters.availability.includes(option) ? "primary" : "default"}
                variant={searchFilters.availability.includes(option) ? "filled" : "outlined"}
              />
            ))}
          </Box>
        </StyledAccordionDetails>
      </Accordion>

      {/* Search Suppliers */}
      <Accordion
        expanded={expandedAccordion === "search-supplier"}
        onChange={onAccordionChange("search-supplier")}
      >
        <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Search Suppliers</Typography>
        </StyledAccordionSummary>
        <StyledAccordionDetails>
          <Autocomplete
            multiple
            size="small"
            options={suppliers}
            getOptionLabel={(option) => supplierNames[option] ?? option}
            filterOptions={(options, { inputValue }) => {
              const term = inputValue.toLowerCase();
              return options.filter((opt) =>
                (supplierNames[opt] ?? opt).toLowerCase().includes(term),
              );
            }}
            value={selectedSuppliers}
            onChange={(_event, newValue) => {
              setSelectedSuppliers(newValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Filter by supplier"
                placeholder="Type supplier name"
                helperText={
                  selectedSuppliers.length === 0 ? "All suppliers included by default" : undefined
                }
                slotProps={{ formHelperText: { sx: { fontStyle: "italic" } } }}
              />
            )}
          />
        </StyledAccordionDetails>
      </Accordion>

      {/* Country */}
      <Accordion
        expanded={expandedAccordion === "search-country"}
        onChange={onAccordionChange("search-country")}
      >
        <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Country</Typography>
        </StyledAccordionSummary>
        <StyledAccordionDetails>
          <Autocomplete
            multiple
            size="small"
            options={[...SUPPLIER_COUNTRY_OPTIONS]}
            getOptionLabel={(option) => option.label}
            filterOptions={(options, { inputValue }) => {
              const term = inputValue.toLowerCase();
              return options.filter(
                (opt) =>
                  opt.label.toLowerCase().includes(term) || opt.code.toLowerCase().includes(term),
              );
            }}
            value={SUPPLIER_COUNTRY_OPTIONS.filter((opt) =>
              searchFilters.country.includes(opt.code),
            )}
            onChange={(_event, newValue) => {
              setSearchFilters({
                ...searchFilters,
                country: newValue.map((opt) => opt.code),
              });
            }}
            isOptionEqualToValue={(option, value) => option.code === value.code}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Filter by country"
                placeholder="Type country or code"
                helperText={
                  searchFilters.country.length === 0
                    ? "All countries included by default"
                    : undefined
                }
                slotProps={{ formHelperText: { sx: { fontStyle: "italic" } } }}
              />
            )}
          />
        </StyledAccordionDetails>
      </Accordion>

      {/* Shipping Type */}
      <Accordion
        expanded={expandedAccordion === "search-shipping"}
        onChange={onAccordionChange("search-shipping")}
      >
        <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Shipping Type</Typography>
        </StyledAccordionSummary>
        <StyledAccordionDetails>
          <Box className={styles["chip-container"]}>
            {SHIPPING_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option.charAt(0).toUpperCase() + option.slice(1)}
                size="small"
                onClick={() => toggleChip("shippingType", option)}
                color={searchFilters.shippingType.includes(option) ? "primary" : "default"}
                variant={searchFilters.shippingType.includes(option) ? "filled" : "outlined"}
              />
            ))}
          </Box>
        </StyledAccordionDetails>
      </Accordion>

      {/* Results Limit */}
      <Accordion
        expanded={expandedAccordion === "per-supplier-limit"}
        onChange={onAccordionChange("per-supplier-limit")}
      >
        <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Results Limit</Typography>
        </StyledAccordionSummary>
        <StyledAccordionDetails>
          <TextField
            style={{ width: "100%" }}
            label="Results Limit (per Supplier)"
            value={userSettings.supplierResultLimit}
            onChange={(e) =>
              setUserSettings({
                ...userSettings,
                supplierResultLimit: parseInt(e.target.value) || undefined,
              })
            }
          />
        </StyledAccordionDetails>
      </Accordion>

      {/* Price Range */}
      <Accordion
        expanded={expandedAccordion === "search-price"}
        onChange={onAccordionChange("search-price")}
      >
        <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Price Range</Typography>
        </StyledAccordionSummary>
        <StyledAccordionDetails>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Min"
              type="number"
              size="small"
              value={userSettings.priceMin ?? ""}
              onChange={(e) =>
                setUserSettings({
                  ...userSettings,
                  priceMin: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              slotProps={{ htmlInput: { min: 0 } }}
            />
            <TextField
              label="Max"
              type="number"
              size="small"
              value={userSettings.priceMax ?? ""}
              onChange={(e) =>
                setUserSettings({
                  ...userSettings,
                  priceMax: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              slotProps={{ htmlInput: { min: 0 } }}
            />
          </Box>
        </StyledAccordionDetails>
      </Accordion>

      <Box sx={{ p: 2 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<SearchIcon />}
          onClick={handleSearch}
          disabled={!searchFilters.titleQuery.trim()}
        >
          Search
        </Button>
      </Box>
    </Box>
  );
};

export default DrawerSearchPanel;
