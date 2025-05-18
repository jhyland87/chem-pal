import BookmarkIcon from "@mui/icons-material/Bookmark";
import HistoryIcon from "@mui/icons-material/History";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
import StoreIcon from "@mui/icons-material/Store";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { SyntheticEvent } from "react";
import IconTextFader from "./IconTextFader";

/**
 * Generates props for a tab component.
 * @param {number} index - The index of the tab
 * @param {string} name - The name of the tab panel
 * @returns {Object} Tab props including id, panel, and aria-controls
 */
function tabProps(index: number, name: string) {
  return {
    id: `full-width-tab-${index}`,
    panel: name,
    "aria-controls": `full-width-tabpanel-${index}`,
  };
}

/**
 * Props for the TabHeader component
 * @param {number} page - Current active tab index
 * @param {Function} setPage - Function to update the active tab
 */
type TabHeaderProps = {
  page: number;
  setPage: (page: number) => void;
};

/**
 * TabHeader component that renders a navigation bar with tabs for different sections of the application.
 * Each tab includes an icon and text that fades based on the active state.
 *
 * @component
 * @category Component
 * @param {TabHeaderProps} props - Component props
 * @param {number} props.page - Current active tab index
 * @param {Function} props.setPage - Function to update the active tab
 *
 * @example
 * ```tsx
 * <TabHeader page={currentPage} setPage={setCurrentPage} />
 * ```
 */
export default function TabHeader({ page, setPage }: TabHeaderProps) {
  const handleChange = (e: SyntheticEvent, newValue: number) => setPage(newValue);

  return (
    <Tabs
      sx={{
        "& .MuiTabs-indicator": {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
        },
        borderRadius: 0,
      }}
      value={page}
      onChange={handleChange}
      indicatorColor="secondary"
      textColor="inherit"
      variant="fullWidth"
      aria-label="full width tabs example"
    >
      <Tab
        label={
          <IconTextFader text="Search" active={page === 0}>
            <SearchIcon />
          </IconTextFader>
        }
        {...tabProps(0, "search-panel")}
      />
      <Tab
        label={
          <IconTextFader text="Suppliers" active={page === 1}>
            <StoreIcon />
          </IconTextFader>
        }
        {...tabProps(1, "suppliers-panel")}
      />
      <Tab
        label={
          <IconTextFader text="Favorites" active={page === 2}>
            <BookmarkIcon />
          </IconTextFader>
        }
        {...tabProps(2, "favorites-panel")}
      />
      <Tab
        label={
          <IconTextFader text="History" active={page === 3}>
            <HistoryIcon />
          </IconTextFader>
        }
        {...tabProps(3, "history-panel")}
      />
      <Tab
        label={
          <IconTextFader text="Settings" active={page === 4}>
            <SettingsIcon />
          </IconTextFader>
        }
        {...tabProps(4, "settings-panel")}
      />
    </Tabs>
  );
}
