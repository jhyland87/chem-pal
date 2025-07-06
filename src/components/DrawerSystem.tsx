import SupplierFactory from "@/suppliers/SupplierFactory";
import {
  Accordion,
  Box,
  Checkbox,
  Chip,
  Drawer,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import "./DrawerSystem.scss";

import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";

import {
  ChipContainer,
  StyledAccordionDetails,
  StyledAccordionDetailsNoPadding,
  StyledAccordionSummary,
  StyledListItemText,
  SupplierList,
  SupplierListItem,
} from "./StyledComponents";

import { useAppContext } from "../context";
import SettingsPanelFull from "./SettingsPanelFull";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`drawer-tabpanel-${index}`}
      aria-labelledby={`drawer-tab-${index}`}
      className="drawer-system__tabpanel"
      {...other}
    >
      {value === index && children}
    </div>
  );
}

const SearchPanel: React.FC<{
  expandedAccordion: string | false;
  onAccordionChange: (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => void;
}> = ({ expandedAccordion, onAccordionChange }) => {
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>(["In Stock"]);
  const { selectedSuppliers, setSelectedSuppliers, userSettings, setUserSettings } =
    useAppContext();

  const availability = ["In Stock", "Limited Stock", "Out of Stock", "Pre-order"];
  const suppliers = SupplierFactory.supplierList();

  const toggleAvailability = (option: string) => {
    setSelectedAvailability((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option],
    );
  };

  const toggleSupplier = (supplier: string) => {
    console.log("toggleSupplier", supplier);
    const newSelectedSuppliers = selectedSuppliers.includes(supplier)
      ? selectedSuppliers.filter((s) => s !== supplier)
      : [...selectedSuppliers, supplier];

    setSelectedSuppliers(newSelectedSuppliers);
    console.log("selectedSuppliers", newSelectedSuppliers);
  };

  return (
    <Box>
      <Accordion
        expanded={expandedAccordion === "search-availability"}
        onChange={onAccordionChange("search-availability")}
      >
        <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Availability</Typography>
        </StyledAccordionSummary>
        <StyledAccordionDetails>
          <ChipContainer>
            {availability.map((option) => (
              <Chip
                key={option}
                label={option}
                size="small"
                onClick={() => toggleAvailability(option)}
                color={selectedAvailability.includes(option) ? "primary" : "default"}
                variant={selectedAvailability.includes(option) ? "filled" : "outlined"}
              />
            ))}
          </ChipContainer>
        </StyledAccordionDetails>
      </Accordion>

      <Accordion
        expanded={expandedAccordion === "search-supplier"}
        onChange={onAccordionChange("search-supplier")}
      >
        <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Search Suppliers</Typography>
        </StyledAccordionSummary>
        <StyledAccordionDetailsNoPadding className="supplier-list-accordion">
          <SupplierList dense>
            {suppliers.map((supplier) => (
              <SupplierListItem key={supplier} onClick={() => toggleSupplier(supplier)}>
                <Checkbox
                  edge="start"
                  checked={selectedSuppliers.includes(supplier)}
                  tabIndex={-1}
                  disableRipple
                  size="small"
                />
                <StyledListItemText primary={supplier} />
              </SupplierListItem>
            ))}
          </SupplierList>
        </StyledAccordionDetailsNoPadding>
      </Accordion>

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
    </Box>
  );
};

const DrawerSystem: React.FC = () => {
  const appContext = useAppContext();
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>("search-availability");

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    appContext.setDrawerTab(newValue);
    // Reset accordion when switching tabs
    if (newValue === 0) {
      setExpandedAccordion("search-availability");
    } else if (newValue === 1) {
      setExpandedAccordion("settings-general");
    } else {
      setExpandedAccordion(false);
    }
  };

  const handleAccordionChange =
    (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedAccordion(isExpanded ? panel : false);
    };

  return (
    <Drawer
      anchor="right"
      open={appContext.drawerTab !== -1}
      onClose={() => appContext.setDrawerTab(-1)}
      variant="temporary"
    >
      <div className="drawer-container">
        {appContext.drawerTab !== -1 && (
          <Tabs value={appContext.drawerTab} onChange={handleTabChange} variant="fullWidth">
            <Tab icon={<SearchIcon />} label="SEARCH" iconPosition="start" />
            <Tab icon={<SettingsIcon />} label="SETTINGS" iconPosition="start" />
          </Tabs>
        )}

        <TabPanel value={appContext.drawerTab} index={0}>
          <SearchPanel
            expandedAccordion={expandedAccordion}
            onAccordionChange={handleAccordionChange}
          />
        </TabPanel>

        <TabPanel value={appContext.drawerTab} index={1}>
          <SettingsPanelFull />
        </TabPanel>
      </div>
    </Drawer>
  );
};

export default DrawerSystem;
