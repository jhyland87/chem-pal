import ArrowForwardIosSharpIcon from "@/icons/ArrowDropDownIcon";
import SearchIcon from "@/icons/SearchIcon";
import SupplierFactory from "@/suppliers/SupplierFactory";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import Input from "@mui/material/Input";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";

import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import type { Table } from "@tanstack/react-table";
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
import { useAppContext } from "./hooks/useContext";

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

function SupplierSelection() {
  const appContext = useAppContext();
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(
    appContext?.userSettings.suppliers ?? [],
  );
  const handleSupplierSelect = (supplierName: string) => {
    const newChecked = [...selectedSuppliers];
    const currentIndex = newChecked.indexOf(supplierName);
    if (currentIndex === -1) {
      newChecked.push(supplierName);
    } else {
      newChecked.splice(currentIndex, 1);
    }
    setSelectedSuppliers(newChecked);
    appContext?.setUserSettings({
      ...appContext.userSettings,
      suppliers: newChecked,
    });
  };

  return (
    <FormControl component="fieldset" variant="standard">
      <FormLabel component="legend">Supplier Selection</FormLabel>
      <List sx={{ width: "100%", maxWidth: 360, bgcolor: "background.paper", paddingLeft: "20px" }}>
        {SupplierFactory.supplierList().map((supplierName) => {
          const labelId = `checkbox-list-label-${supplierName}`;

          return (
            <ListItem key={supplierName} disablePadding>
              <ListItemButton
                sx={{ padding: 0 }}
                role={undefined}
                onClick={() => handleSupplierSelect(supplierName)}
                dense
              >
                <ListItemIcon sx={{ padding: 0 }}>
                  <Checkbox
                    size="small"
                    edge="start"
                    sx={{ padding: 0, minWidth: 20 }}
                    checked={selectedSuppliers.includes(supplierName)}
                    tabIndex={-1}
                    disableRipple
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    inputProps={{ "aria-labelledby": labelId }}
                  />
                </ListItemIcon>
                <ListItemText id={labelId} primary={`${supplierName.replace("Supplier", "")}`} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </FormControl>
  );
}

function CustomizedAccordions({ table }: { table: Table<Product> }) {
  console.log("CustomizedAccordions table:", table);
  const [expanded, setExpanded] = useState<string | false>("");

  /**
   * Gets the list of currently visible column IDs.
   * @returns Array of visible column IDs
   */
  const columnStatus = table
    .getAllColumns()
    .reduce((accu: string[], column: CustomColumn<Product, unknown>) => {
      if (column.getIsVisible() && column.getCanHide()) accu.push(column.id);
      return accu;
    }, []);

  /**
   * Gets a map of column IDs to their header text for filterable columns.
   * @returns Object mapping column IDs to their header text
   */
  const columnNames = table
    .getAllColumns()
    .reduce((accu: Record<string, string>, col: CustomColumn<Product, unknown>) => {
      if (col.getCanFilter()) accu[col.id] = col?.getHeaderText?.() ?? "";
      return accu;
    }, {});
  console.log("column data:", { columnStatus, columnNames });

  const handleChange = (panel: string) => (event: SyntheticEvent, newExpanded: boolean) => {
    setExpanded(newExpanded ? panel : false);
  };

  return (
    <div>
      <FormControl variant="standard" sx={{ width: "100%", padding: "5px" }}>
        <Input
          id="input-with-icon-adornment"
          placeholder="Filter results table.."
          size="small"
          sx={{
            "& .MuiInputBase-input": {
              padding: "0px",
            },
          }}
          startAdornment={
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          }
        />
      </FormControl>
      {table.getAllColumns().map((column: CustomColumn<Product, unknown>) => {
        if (!column.getCanFilter()) return;
        return (
          <FilterMenuAccordion
            expanded={expanded === column.id}
            onChange={handleChange(column.id)}
            disableGutters
            elevation={0}
            square
          >
            <FilterMenuAccordionSummary
              aria-controls="panel1d-content"
              id="panel1d-header"
              expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: "0.9rem" }} />}
            >
              <Typography component="span">{columnNames[column.id]}</Typography>
            </FilterMenuAccordionSummary>
            <FilterMenuAccordionDetails>
              <div>This is for {columnNames[column.id]}.</div>
            </FilterMenuAccordionDetails>
          </FilterMenuAccordion>
        );
      })}
    </div>
  );
}
/*
  return (
    <div>
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
*/

function FilterMenu(props: { table: Table<Product> }, ref: Ref<FilterMenuRef>) {
  const { table } = props;
  console.log("FilterMenu props:", table);
  const [drawerState, setDrawerState] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const toggleDrawer = (newState: boolean) => {
    setDrawerState(newState);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    // Auto-open drawer when tab is clicked
    if (!drawerState) {
      toggleDrawer(true);
    }
  };

  const handleTabClick = () => {
    // Always open drawer when any tab is clicked
    if (!drawerState) {
      toggleDrawer(true);
    }
  };

  const drawerContent = () => (
    <FilterMenuDrawerContent role="presentation">
      <TabPanel value={activeTab} index={0} style={{ padding: 0 }}>
        <CustomizedAccordions table={table} />
      </TabPanel>
      <TabPanel value={activeTab} index={1}>
        <SupplierSelection />
      </TabPanel>
    </FilterMenuDrawerContent>
  );

  useImperativeHandle(ref, () => ({
    toggleDrawer,
    getState: () => drawerState,
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
          <Tab label="Suppliers" {...a11yProps(1)} onClick={handleTabClick} />
        </FilterMenuTabs>
      </FilterMenuTabsContainer>

      {/* Drawer that slides out from the tabs */}
      <FilterMenuDrawer anchor="right" open={drawerState} onClose={() => toggleDrawer(false)}>
        {drawerContent()}
      </FilterMenuDrawer>
    </>
  );
}

export default forwardRef(FilterMenu);
