import { DRAWER_INDEX } from "@/constants/common";
import { useAppContext } from "@/context";
import {
  History as HistoryIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import { Drawer, Tab, Tabs } from "@mui/material";
import React, { useState } from "react";
import DrawerSearchPanel from "./DrawerSearchPanel";
import styles from "./DrawerSystem.module.scss";
import HistoryPanel from "./HistoryPanel";
import SettingsPanelFull from "./SettingsPanelFull";

// TabPanelProps is declared globally in types/props.d.ts

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`drawer-tabpanel-${index}`}
      aria-labelledby={`drawer-tab-${index}`}
      className={styles["drawer-system__tabpanel"]}
      {...other}
    >
      {value === index && children}
    </div>
  );
}

const DrawerSystem: React.FC = () => {
  const appContext = useAppContext();
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>("search-availability");

  const handleTabChange = (_event: React.SyntheticEvent, newValue: DRAWER_INDEX) => {
    appContext.setDrawerTab(newValue);
    // Reset accordion when switching tabs
    if (newValue === DRAWER_INDEX.SEARCH) {
      setExpandedAccordion("search-availability");
    } else if (newValue === DRAWER_INDEX.SETTINGS) {
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
      open={appContext.drawerTab !== DRAWER_INDEX.CLOSED}
      onClose={() => appContext.setDrawerTab(DRAWER_INDEX.CLOSED)}
      variant="temporary"
    >
      <div className={styles["drawer-container"]}>
        {appContext.drawerTab !== DRAWER_INDEX.CLOSED && (
          <Tabs
            value={appContext.drawerTab}
            onChange={handleTabChange}
            variant="fullWidth"
            className={styles["drawer-tabs"]}
          >
            <Tab icon={<SearchIcon />} label="SEARCH" iconPosition="start" />
            <Tab icon={<HistoryIcon />} label="HISTORY" iconPosition="start" />
            <Tab icon={<SettingsIcon />} label="SETTINGS" iconPosition="start" />
          </Tabs>
        )}

        <TabPanel value={appContext.drawerTab} index={DRAWER_INDEX.SEARCH}>
          <DrawerSearchPanel
            expandedAccordion={expandedAccordion}
            onAccordionChange={handleAccordionChange}
          />
        </TabPanel>

        <TabPanel value={appContext.drawerTab} index={DRAWER_INDEX.HISTORY}>
          <HistoryPanel />
        </TabPanel>

        <TabPanel value={appContext.drawerTab} index={DRAWER_INDEX.SETTINGS}>
          <SettingsPanelFull />
        </TabPanel>
      </div>
    </Drawer>
  );
};

export default DrawerSystem;
