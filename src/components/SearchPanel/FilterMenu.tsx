import ArrowForwardIosSharpIcon from "@/icons/ArrowDropDownIcon";
import MuiAccordion, { AccordionProps } from "@mui/material/Accordion";
import MuiAccordionDetails from "@mui/material/AccordionDetails";
import MuiAccordionSummary, {
  accordionSummaryClasses,
  AccordionSummaryProps,
} from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import { styled } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import * as React from "react";
import { forwardRef, Ref, useImperativeHandle, useState, type SyntheticEvent } from "react";

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

const Accordion = styled((props: AccordionProps) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "&:not(:last-child)": {
    borderBottom: 0,
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "&::before": {
    display: "none",
  },
}));

const AccordionSummary = styled((props: AccordionSummaryProps) => (
  <MuiAccordionSummary
    sx={{
      display: "flex",
      minHeight: "28px",
      maxHeight: "48px",
      overflowY: "scroll",
      minWidth: "40px",
    }}
    expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: "0.9rem" }} />}
    {...props}
  />
))(({ theme }) => ({
  backgroundColor: "rgba(0, 0, 0, .03)",
  flexDirection: "row-reverse",
  [`& .${accordionSummaryClasses.expandIconWrapper}.${accordionSummaryClasses.expanded}`]: {
    transform: "rotate(90deg)",
  },
  [`& .${accordionSummaryClasses.content}`]: {
    margin: "1px 0px 1px 0px",
    marginLeft: theme.spacing(1),
  },
  ...theme.applyStyles("dark", {
    backgroundColor: "rgba(255, 255, 255, .05)",
  }),
}));

const AccordionDetails = styled(MuiAccordionDetails)(() => ({
  padding: 0,
  borderTop: "1px solid rgba(0, 0, 0, .125)",
}));

function CustomizedAccordions() {
  const [expanded, setExpanded] = useState<string | false>("panel1");

  const handleChange = (panel: string) => (event: SyntheticEvent, newExpanded: boolean) => {
    setExpanded(newExpanded ? panel : false);
  };

  return (
    <div>
      <Accordion expanded={expanded === "panel1"} onChange={handleChange("panel1")}>
        <AccordionSummary aria-controls="panel1d-content" id="panel1d-header">
          <Typography component="span">Athlete</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <div>Search and filter options for athletes will go here.</div>
        </AccordionDetails>
      </Accordion>
      <Accordion expanded={expanded === "panel2"} onChange={handleChange("panel2")}>
        <AccordionSummary aria-controls="panel2d-content" id="panel2d-header">
          <Typography component="span">Country</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <div>Search and filter options for countries will go here.</div>
        </AccordionDetails>
      </Accordion>
      <Accordion expanded={expanded === "panel3"} onChange={handleChange("panel3")}>
        <AccordionSummary aria-controls="panel3d-content" id="panel3d-header">
          <Typography component="span">Sport</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <div>Search and filter options for sports will go here.</div>
        </AccordionDetails>
      </Accordion>
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
    <Box sx={{ width: 300, padding: "0px" }} role="presentation">
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
    </Box>
  );

  useImperativeHandle(ref, () => ({
    toggleDrawer,
    getState: () => state.right,
  }));

  return (
    <>
      {/* Continuous right border/frame */}
      <Box
        sx={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: "33px",
          bgcolor: "background.paper",
          borderLeft: "1px solid #e0e0e0", // Match the tab border color
          zIndex: 1400, // Above drawer backdrop
        }}
      />

      {/* Fixed tabs on the right side */}
      <Box
        sx={{
          position: "fixed",
          right: 0,
          top: "17%",
          transform: "translateY(-20%)",
          zIndex: 1500, // Higher than backdrop and border
          bgcolor: "background.paper",
          borderTop: "1px solid #e0e0e0", // Light grey border
          borderBottom: "1px solid #e0e0e0",
          // Remove border radius for sharp 90° angles
        }}
      >
        <Tabs
          orientation="vertical"
          value={activeTab}
          onChange={handleTabChange}
          aria-label="Filter menu tabs"
          sx={{
            minWidth: "32px",
            width: "32px",
            bgcolor: "background.paper", // Ensure background matches
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "& .MuiTab-root": {
              minWidth: "33px",
              minHeight: "60px",
              padding: "8px 4px",
              writingMode: "vertical-rl",
              textOrientation: "upright",
              fontSize: "0.75rem",
              bgcolor: "background.paper", // Match background
              borderBottom: "1px solid #e0e0e0", // Subtle separator between tabs
              // eslint-disable-next-line @typescript-eslint/naming-convention
              "&:last-child": {
                borderBottom: "none", // Remove border from last tab
              },
              // eslint-disable-next-line @typescript-eslint/naming-convention
              "&.Mui-selected": {
                bgcolor: "action.selected", // Slightly different background for selected tab
              },
            },
          }}
        >
          <Tab label="Filters" {...a11yProps(0)} onClick={handleTabClick} />
          <Tab label="Sort" {...a11yProps(1)} onClick={handleTabClick} />
        </Tabs>
      </Box>

      {/* Drawer that slides out from the tabs */}
      <Drawer
        anchor="right"
        open={state.right}
        onClose={() => toggleDrawer(false)}
        sx={{
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "& .MuiDrawer-paper": {
            marginRight: "33px", // Account for thinner tab width
          },
        }}
      >
        {drawerContent()}
      </Drawer>
    </>
  );
}

export default forwardRef(FilterMenu);
