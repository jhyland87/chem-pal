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

type TabHeaderProps = {
  page: number;
  setPage: (page: number) => void;
};

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
