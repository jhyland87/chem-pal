import ArrowForwardIosSharpIcon from "@/icons/ArrowDropDownIcon";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import * as React from "react";
import { forwardRef, Ref, useImperativeHandle, useState, type SyntheticEvent } from "react";
import {
  FilterMenuAccordion,
  FilterMenuAccordionDetails,
  FilterMenuAccordionSummary,
  FilterMenuBorder,
  FilterMenuDrawer,
  FilterMenuDrawerContent,
  FilterMenuTabs,
  FilterMenuTabsContainer,
} from "../Styles";

type FilterMenuRef = {
  toggleDrawer: (open: boolean) => void;
  getState: () => boolean;
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
  style?: React.CSSProperties;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, style, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      style={style}
      {...other}
    >
      {value === index && <Box sx={{ p: 0 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `vertical-tab-${index}`,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "aria-controls": `vertical-tabpanel-${index}`,
  };
}

function CustomizedAccordions() {
  const [expanded, setExpanded] = useState<string | false>("panel1");

  const handleChange = (panel: string) => (event: SyntheticEvent, newExpanded: boolean) => {
    setExpanded(newExpanded ? panel : false);
  };

  return (
    <div>
      <FilterMenuAccordion
        expanded={expanded === "panel1"}
        onChange={handleChange("panel1")}
        disableGutters
        elevation={0}
        square
      >
        <FilterMenuAccordionSummary
          aria-controls="panel1d-content"
          id="panel1d-header"
          expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: "0.9rem" }} />}
        >
          <Typography component="span">Athlete</Typography>
        </FilterMenuAccordionSummary>
        <FilterMenuAccordionDetails>
          <div>Search and filter options for athletes will go here.</div>
        </FilterMenuAccordionDetails>
      </FilterMenuAccordion>
      <FilterMenuAccordion
        expanded={expanded === "panel2"}
        onChange={handleChange("panel2")}
        disableGutters
        elevation={0}
        square
      >
        <FilterMenuAccordionSummary
          aria-controls="panel2d-content"
          id="panel2d-header"
          expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: "0.9rem" }} />}
        >
          <Typography component="span">Country</Typography>
        </FilterMenuAccordionSummary>
        <FilterMenuAccordionDetails>
          <div>Search and filter options for countries will go here.</div>
        </FilterMenuAccordionDetails>
      </FilterMenuAccordion>
      <FilterMenuAccordion
        expanded={expanded === "panel3"}
        onChange={handleChange("panel3")}
        disableGutters
        elevation={0}
        square
      >
        <FilterMenuAccordionSummary
          aria-controls="panel3d-content"
          id="panel3d-header"
          expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: "0.9rem" }} />}
        >
          <Typography component="span">Sport</Typography>
        </FilterMenuAccordionSummary>
        <FilterMenuAccordionDetails>
          <div>Search and filter options for sports will go here.</div>
        </FilterMenuAccordionDetails>
      </FilterMenuAccordion>
    </div>
  );
}

function FilterMenu(props: object, ref: Ref<FilterMenuRef>) {
  const [state, setState] = useState({
    top: false,
    left: false,
    bottom: false,
    right: false,
  });

  const [activeTab, setActiveTab] = useState(0);

  const toggleDrawer = (open: boolean) => {
    setState({ ...state, ["right"]: open });
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    // Auto-open drawer when tab is clicked
    if (!state.right) {
      toggleDrawer(true);
    }
  };

  const handleTabClick = () => {
    // Always open drawer when any tab is clicked
    if (!state.right) {
      toggleDrawer(true);
    }
  };

  const drawerContent = () => (
    <FilterMenuDrawerContent role="presentation">
      <TabPanel value={activeTab} index={0} style={{ padding: 0 }}>
        <CustomizedAccordions />
      </TabPanel>
      <TabPanel value={activeTab} index={1}>
        <div>
          <p>Sort options will go here</p>
          <ul>
            <li>Name (A-Z)</li>
            <li>Price (Low to High)</li>
            <li>Date Added</li>
          </ul>
        </div>
      </TabPanel>
    </FilterMenuDrawerContent>
  );

  useImperativeHandle(ref, () => ({
    toggleDrawer,
    getState: () => state.right,
  }));

  return (
    <>
      {/* Continuous right border/frame */}
      <FilterMenuBorder />

      {/* Fixed tabs on the right side */}
      <FilterMenuTabsContainer>
        <FilterMenuTabs
          orientation="vertical"
          value={activeTab}
          onChange={handleTabChange}
          aria-label="Filter menu tabs"
        >
          <Tab label="Filters" {...a11yProps(0)} onClick={handleTabClick} />
          <Tab label="Sort" {...a11yProps(1)} onClick={handleTabClick} />
        </FilterMenuTabs>
      </FilterMenuTabsContainer>

      {/* Drawer that slides out from the tabs */}
      <FilterMenuDrawer anchor="right" open={state.right} onClose={() => toggleDrawer(false)}>
        {drawerContent()}
      </FilterMenuDrawer>
    </>
  );
}

export default forwardRef(FilterMenu);
