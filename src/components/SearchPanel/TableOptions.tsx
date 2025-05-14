import ChecklistIcon from "@mui/icons-material/Checklist";
import CloseIcon from "@mui/icons-material/Close";
import DoneIcon from "@mui/icons-material/Done";
import SearchIcon from "@mui/icons-material/Search";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { ChangeEvent, MouseEvent, useState } from "react";
import { useSettings } from "../../context";
import { TableOptionsProps } from "../../types";
import SearchInput from "./SearchInput";

const ITEM_HEIGHT = 48;

export default function TableOptions({ table, searchInput, setSearchInput }: TableOptionsProps) {
  const settingsContext = useSettings();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleToggleAllColumns = (event: ChangeEvent<HTMLInputElement>) => {
    const isChecked =
      typeof settingsContext.settings.showAllColumns === "boolean"
        ? settingsContext.settings.showAllColumns
        : event.target.checked;

    settingsContext.setSettings({
      ...settingsContext.settings,
      showAllColumns: !isChecked,
    });
  };

  const handleToggleColumnFilterVisibility = (event: ChangeEvent<HTMLInputElement>) => {
    const isChecked =
      typeof settingsContext.settings.showColumnFilters === "boolean"
        ? settingsContext.settings.showColumnFilters
        : event.target.checked;

    settingsContext.setSettings({
      ...settingsContext.settings,
      showColumnFilters: !isChecked,
    });
  };

  return (
    <Toolbar
      sx={[
        {
          pl: { sm: 2 },
          pr: { xs: 1, sm: 1 },
        },
      ]}
    >
      <Typography
        sx={{ flex: "1 1 100%" }}
        //variant='h6'
        id="tableTitle"
        component="div"
      >
        <SearchInput searchInput={searchInput} setSearchInput={setSearchInput} />
      </Typography>
      <Tooltip title="Filter list">
        <IconButton
          size="small"
          aria-label="more"
          id="filter-button"
          aria-controls={open ? "long-menu" : undefined}
          aria-expanded={open ? "true" : undefined}
          aria-haspopup="true"
          onClick={handleClick}
        >
          <ChecklistIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        id="long-menu"
        sx={{
          "& .MuiPaper-root": {
            maxHeight: ITEM_HEIGHT * 4.5,
            width: "20ch",
          },
        }}
        aria-labelledby="long-button"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        variant="selectedMenu"
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        slotProps={{
          paper: {
            style: {
              maxHeight: ITEM_HEIGHT * 4.5,
              width: "20ch",
            },
          },
        }}
      >
        <MenuList dense sx={{ paddingTop: "2px" }}>
          <FormGroup>
            <MenuItem dense>
              <FormControlLabel
                sx={{ width: "100%", marginLeft: "0px", marginRight: "0px" }}
                control={
                  <Checkbox
                    size="small"
                    onChange={handleToggleColumnFilterVisibility}
                    aria-label="Show column filters"
                    sx={{ margin: 0, padding: 0 }}
                    icon={<SearchIcon fontSize="small" />}
                    checkedIcon={<SearchOffIcon fontSize="small" />}
                  />
                }
                label={settingsContext.settings.showAllColumns ? "Hide Filters" : "Show Filters"}
              />
            </MenuItem>
            <Divider sx={{ marginTop: "4px", marginBottom: "4px" }} />
            {table.getAllLeafColumns().map((column) => {
              return (
                <div key={column.id} className="px-1" style={{ width: "100%" }}>
                  <FormControlLabel
                    sx={{ width: "100%", marginLeft: "0px", marginRight: "0px" }}
                    control={
                      <Checkbox
                        sx={{ margin: 0, padding: "0 1px 0 20px" }}
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                        disabled={!column.getCanHide()}
                      />
                    }
                    label={column.id}
                  />
                </div>
              );
            })}
            <Divider sx={{ marginTop: "4px", marginBottom: "4px" }} />
            <MenuItem dense>
              <FormControlLabel
                sx={{ width: "100%", marginLeft: "0px", marginRight: "0px" }}
                control={
                  <Checkbox
                    size="small"
                    onChange={handleToggleAllColumns}
                    aria-label="Toggle All Columns"
                    sx={{ margin: 0, padding: 0 }}
                    icon={<CloseIcon fontSize="small" />}
                    checkedIcon={<DoneIcon fontSize="small" />}
                  />
                }
                label={settingsContext.settings.showAllColumns ? "Hide all" : "Show all"}
              />
            </MenuItem>
          </FormGroup>
        </MenuList>
      </Menu>
    </Toolbar>
  );
}
