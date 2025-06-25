import { Accordion, Box, Checkbox, Chip, Drawer, Tab, Tabs, Typography } from "@mui/material";
import React, { useState } from "react";

import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";

import {
  ChipContainer,
  DrawerContainer,
  StyledAccordionDetails,
  StyledAccordionDetailsNoPadding,
  StyledAccordionSummary,
  StyledListItemText,
  SupplierList,
  SupplierListItem,
} from "./StyledComponents";

import SettingsPanelFull from "./SettingsPanelFull";

interface DrawerSystemProps {
  isOpen: boolean;
  onClose: () => void;
}

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
      style={{ flex: 1, overflow: "auto", padding: "8px 0" }}
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
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(["Akmekem"]);

  const availability = ["In Stock", "Limited Stock", "Out of Stock", "Pre-order"];
  const suppliers = [
    "Akmekem",
    "Ambeed",
    "BioFuran Chem",
    "Carolina",
    "Carolina Chemical",
    "Chemsavers",
    "FTF Scientific",
    "Sigma-Aldrich",
    "Fisher Scientific",
    "VWR International",
    "Merck KGaA",
    "Thermo Fisher",
    "Bio-Rad",
    "Qiagen",
    "Promega",
  ];

  const toggleAvailability = (option: string) => {
    setSelectedAvailability((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option],
    );
  };

  const toggleSupplier = (supplier: string) => {
    setSelectedSuppliers((prev) =>
      prev.includes(supplier) ? prev.filter((s) => s !== supplier) : [...prev, supplier],
    );
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
          <Typography>Supplier</Typography>
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
    </Box>
  );
};

const DrawerSystem: React.FC<DrawerSystemProps> = ({ isOpen, onClose }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>("search-availability");

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
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
    <Drawer anchor="right" open={isOpen} onClose={onClose} variant="temporary">
      <DrawerContainer>
        <Tabs value={selectedTab} onChange={handleTabChange} variant="fullWidth">
          <Tab icon={<SearchIcon />} label="SEARCH" iconPosition="start" />
          <Tab icon={<SettingsIcon />} label="SETTINGS" iconPosition="start" />
        </Tabs>

        <TabPanel value={selectedTab} index={0}>
          <SearchPanel
            expandedAccordion={expandedAccordion}
            onAccordionChange={handleAccordionChange}
          />
        </TabPanel>

        <TabPanel value={selectedTab} index={1}>
          <SettingsPanelFull />
        </TabPanel>
      </DrawerContainer>
    </Drawer>
  );
};

export default DrawerSystem;
