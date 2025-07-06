import ArrowForwardIosSharpIcon from "@/icons/ArrowDropDownIcon";
import SearchIcon from "@/icons/SearchIcon";
import SupplierFactory from "@/suppliers/SupplierFactory";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import type { SelectChangeEvent } from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import type { Table } from "@tanstack/react-table";
import * as React from "react";
import {
  forwardRef,
  Ref,
  useImperativeHandle,
  useState,
  type ComponentType,
  type SyntheticEvent,
} from "react";
import {
  FilterListItemIcon,
  FilterMenuAccordion,
  FilterMenuAccordionDetails,
  FilterMenuAccordionSummary,
  FilterMenuDrawer,
  FilterMenuDrawerContent,
  FilterMenuDrawerTrigger,
  FilterMenuDrawerTriggers,
  FilterMenuInput,
  FilterMenuInputAdornment,
  FilterMenuTabContent,
} from "../Styles";
import { useAppContext } from "./hooks/useContext";
import ColumnVisibilitySelect from "./Inputs/ColumnVisibilitySelect";
import RangeColumnFilter from "./Inputs/RangeColumnFilter";
import SelectColumnFilter from "./Inputs/SelectColumnFilter";
import TextColumnFilter from "./Inputs/TextColumnFilter";

type FilterMenuRef = {
  toggleDrawer: (open: boolean) => void;
  getState: () => boolean;
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number | false;
  style?: React.CSSProperties;
}

/**
 * Map of filter variants to their corresponding filter components.
 * Each variant (text, range, select) has a dedicated component for handling its specific filtering needs.
 */
const filterComponentMap: Record<string, ComponentType<FilterVariantInputProps>> = {
  text: TextColumnFilter,
  range: RangeColumnFilter,
  select: SelectColumnFilter,
};

/**
 * Renders the appropriate filter component based on the column's filter variant.
 * Falls back to text filter if no variant is specified or if the variant is not found.
 *
 * @component
 *
 * @param props - Component props
 *
 * @returns The rendered filter component
 */
function FilterVariantComponent({ column }: FilterVariantComponentProps) {
  const ComponentToRender = filterComponentMap[column.columnDef?.meta?.filterVariant ?? "text"];
  if (!ComponentToRender)
    return <div>Filter Component not found: {column.columnDef?.meta?.filterVariant}</div>;
  return <ComponentToRender column={column} />;
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

function SupplierSelection() {
  const appContext = useAppContext();
  const { selectedSuppliers, setSelectedSuppliers } = appContext;

  const handleSupplierSelect = (supplierName: string) => {
    const newChecked = selectedSuppliers.includes(supplierName)
      ? selectedSuppliers.filter((s) => s !== supplierName)
      : [...selectedSuppliers, supplierName];

    setSelectedSuppliers(newChecked);
  };

  return (
    <FormControl component="fieldset" variant="standard">
      {/*<FormLabel component="legend">Supplier Selection</FormLabel>*/}
      <List sx={{ width: "100%", maxWidth: 360, paddingLeft: "1px" }}>
        {SupplierFactory.supplierList().map((supplierName) => {
          const labelId = `checkbox-list-label-${supplierName}`;

          return (
            <ListItem key={supplierName} disablePadding>
              <ListItemButton
                sx={{ padding: "0px 0px 0px 15px" }}
                role={undefined}
                onClick={() => handleSupplierSelect(supplierName)}
                dense
              >
                <FilterListItemIcon>
                  <Checkbox
                    size="small"
                    edge="start"
                    sx={{ padding: 0, maxWidth: 10 }}
                    checked={selectedSuppliers.includes(supplierName)}
                    tabIndex={-1}
                    disableRipple
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    inputProps={{ "aria-labelledby": labelId }}
                  />
                </FilterListItemIcon>
                <ListItemText id={labelId} primary={`${supplierName.replace("Supplier", "")}`} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </FormControl>
  );
}

function SearchResultFilters({ table }: { table: Table<Product> }) {
  console.log("SearchResultFilters table:", table);
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
  const [columnVisibility, setColumnVisibility] = useState<string[]>(columnStatus);

  /**
   * Handles changes to column visibility selection.
   * Updates the visibility state and applies changes to the table columns.
   *
   * @param event - The change event from the select component
   */
  const handleColumnVisibilityChange = (event: SelectChangeEvent<typeof columnVisibility>) => {
    const {
      target: { value },
    } = event;
    const newColumnVisibility = typeof value === "string" ? value.split(",") : value;
    setColumnVisibility(newColumnVisibility);

    table.getAllColumns().forEach((column: CustomColumn<Product, unknown>) => {
      if (typeof column === "undefined") return;
      column.setColumnVisibility?.(!column.getCanHide() || newColumnVisibility.includes(column.id));
    });
  };

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
        <FilterMenuInput
          id="input-with-icon-adornment"
          placeholder="Filter results table.."
          size="small"
          startAdornment={
            <FilterMenuInputAdornment position="start">
              <SearchIcon />
            </FilterMenuInputAdornment>
          }
        />
      </FormControl>
      <FilterMenuAccordion
        expanded={expanded === "column-visibility"}
        onChange={handleChange("column-visibility")}
        disableGutters
        elevation={0}
        square
      >
        <FilterMenuAccordionSummary
          aria-controls="panel1d-content"
          id="panel1d-header"
          expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: "0.9rem" }} />}
        >
          <Typography component="span">Column Visibility</Typography>
        </FilterMenuAccordionSummary>
        <FilterMenuAccordionDetails>
          <Box sx={{ padding: "5px" }}>
            <ColumnVisibilitySelect
              columnNames={columnNames}
              columnVisibility={columnVisibility}
              handleColumnVisibilityChange={handleColumnVisibilityChange}
            />
          </Box>
        </FilterMenuAccordionDetails>
      </FilterMenuAccordion>
      {table.getAllColumns().map((column: CustomColumn<Product, unknown>) => {
        if (!column.getCanFilter()) return null;
        return (
          <FilterMenuAccordion
            key={column.id}
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
              <Box sx={{ padding: "5px" }}>
                <FilterVariantComponent column={column} />
              </Box>
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
  const [activeTab, setActiveTab] = useState<number | false>(false);

  const toggleDrawer = (newState: boolean) => {
    setDrawerState(newState);
  };

  const handleTabClick = (tabIndex: number) => {
    // If clicking the same tab that's already active and drawer is open, close the drawer
    if (tabIndex === activeTab && drawerState) {
      toggleDrawer(false);
      setActiveTab(false); // Reset active tab when closing
    } else {
      // Always close any open drawer first, then open the new one
      if (drawerState) {
        toggleDrawer(false);
        // Small delay to allow drawer to close before opening new one
        setTimeout(() => {
          setActiveTab(tabIndex);
          toggleDrawer(true);
        }, 150);
      } else {
        // If drawer is closed, simply open the selected tab
        setActiveTab(tabIndex);
        toggleDrawer(true);
      }
    }
  };

  const drawerContent = () => (
    <FilterMenuDrawerContent role="presentation">
      <FilterMenuTabContent>
        <TabPanel value={activeTab} index={0} style={{ padding: 0 }}>
          <SearchResultFilters table={table} />
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          <SupplierSelection />
        </TabPanel>
      </FilterMenuTabContent>
    </FilterMenuDrawerContent>
  );

  useImperativeHandle(ref, () => ({
    toggleDrawer,
    getState: () => drawerState,
  }));

  return (
    <>
      {/* Drawer trigger buttons that stick out from the right side - hidden when drawer is open */}
      {!drawerState && (
        <FilterMenuDrawerTriggers>
          <FilterMenuDrawerTrigger
            onClick={() => handleTabClick(0)}
            className={activeTab === 0 ? "active" : ""}
          >
            <ManageSearchIcon />
          </FilterMenuDrawerTrigger>
          <FilterMenuDrawerTrigger
            onClick={() => handleTabClick(1)}
            className={activeTab === 1 ? "active" : ""}
          >
            <SearchIcon />
          </FilterMenuDrawerTrigger>
        </FilterMenuDrawerTriggers>
      )}

      {/* Drawer that slides out */}
      <FilterMenuDrawer
        anchor="right"
        open={drawerState}
        onClose={() => {
          toggleDrawer(false);
          setActiveTab(false); // Reset active tab when closing via outside click
        }}
      >
        {drawerContent()}
      </FilterMenuDrawer>
    </>
  );
}

export default forwardRef(FilterMenu);
