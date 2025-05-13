import BookmarkIcon from "@mui/icons-material/Bookmark";
import HistoryIcon from "@mui/icons-material/History";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
import StoreIcon from "@mui/icons-material/Store";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

import { SyntheticEvent } from "react";
import IconTextFader from "./IconTextFader";

function tabProps(index: number, name: string) {
  return {
    id: `full-width-tab-${index}`,
    panel: name,
    "aria-controls": `full-width-tabpanel-${index}`,
  };
}

export default function TabHeader({
  page,
  setPage,
}: {
  page: number;
  setPage: (page: number) => void;
}) {
  const handleChange = (event: SyntheticEvent, newValue: number) => {
    setPage(newValue);
  };

  return (
    <Tabs
      value={page}
      onChange={handleChange}
      indicatorColor="secondary"
      textColor="inherit"
      variant="fullWidth"
      aria-label="full width tabs example"
    >
      <Tab
        label={<IconTextFader icon={<SearchIcon />} text="Search" />}
        {...tabProps(0, "search-panel")}
      />
      <Tab
        label={<IconTextFader icon={<StoreIcon />} text="Search" />}
        {...tabProps(1, "suppliers-panel")}
      />
      <Tab
        label={<IconTextFader icon={<BookmarkIcon />} text="Favorites" />}
        {...tabProps(2, "favorites-panel")}
      />
      <Tab
        label={<IconTextFader icon={<HistoryIcon />} text="History" />}
        {...tabProps(3, "history-panel")}
      />
      <Tab
        label={<IconTextFader icon={<SettingsIcon />} text="Settings" />}
        {...tabProps(4, "settings-panel")}
      />
    </Tabs>
  );
}
