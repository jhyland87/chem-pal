import { DRAWER_INDEX } from "@/constants/common";
import { useAppContext } from "@/context";
import { i18n } from "@/helpers/i18n";
import {
  History as HistoryIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import { Drawer, Tab, Tabs } from "@mui/material";
import { useState, FC, SyntheticEvent } from "react";
import DrawerSearchPanel from "./DrawerSearchPanel";
import styles from "./DrawerSystem.module.scss";
import HistoryPanel from "./HistoryPanel";
import SettingsPanel from "./SettingsPanel";

// TabPanelProps is declared globally in types/props.d.ts

/**
 * Renders its children only when the active drawer tab `value` matches this
 * panel's `index`, hiding the panel otherwise. Used to switch between the
 * Search, History, and Settings drawer tabs.
 * @param props - The {@link TabPanelProps}: `children`, the active `value`, and
 *   this panel's `index`.
 * @returns A `tabpanel` element that shows `children` when active, otherwise hidden.
 * @example
 * ```tsx
 * <TabPanel value={activeTab} index={DRAWER_INDEX.SEARCH}>
 *   <DrawerSearchPanel />
 * </TabPanel>
 * // Renders DrawerSearchPanel only when activeTab === DRAWER_INDEX.SEARCH.
 * ```
 * @source
 */
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

/**
 * The right-hand slide-out drawer hosting the Search, History, and Settings
 * tabs. Driven by `appContext.drawerTab`: opens when a tab is selected, closes
 * on backdrop click, and renders the matching panel via the local `TabPanel`.
 * @returns The drawer element; an empty (closed) drawer when no tab is active.
 * @example
 * ```tsx
 * // Mounted once near the app root; visibility is controlled via app context.
 * <DrawerSystem />
 * // appContext.setDrawerTab(DRAWER_INDEX.SETTINGS) opens it to the Settings tab.
 * ```
 * @source
 */
const DrawerSystem: FC = () => {
  const appContext = useAppContext();
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>("search-availability");

  const handleTabChange = (_event: SyntheticEvent, newValue: DRAWER_INDEX) => {
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
    (panel: string) => (_event: SyntheticEvent, isExpanded: boolean) => {
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
            value={appContext.drawerTab ?? DRAWER_INDEX.CLOSED}
            onChange={handleTabChange}
            variant="fullWidth"
            className={styles["drawer-tabs"]}
          >
            <Tab icon={<SearchIcon />} label={i18n("drawer_tab_search")} iconPosition="start" />
            <Tab icon={<HistoryIcon />} label={i18n("drawer_tab_history")} iconPosition="start" />
            <Tab icon={<SettingsIcon />} label={i18n("drawer_tab_settings")} iconPosition="start" />
          </Tabs>
        )}

        <TabPanel value={appContext.drawerTab ?? DRAWER_INDEX.CLOSED} index={DRAWER_INDEX.SEARCH}>
          <DrawerSearchPanel
            expandedAccordion={expandedAccordion}
            onAccordionChange={handleAccordionChange}
          />
        </TabPanel>

        <TabPanel value={appContext.drawerTab ?? DRAWER_INDEX.CLOSED} index={DRAWER_INDEX.HISTORY}>
          <HistoryPanel />
        </TabPanel>

        <TabPanel value={appContext.drawerTab ?? DRAWER_INDEX.CLOSED} index={DRAWER_INDEX.SETTINGS}>
          <SettingsPanel />
        </TabPanel>
      </div>
    </Drawer>
  );
};

export default DrawerSystem;
