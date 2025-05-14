import Box from "@mui/material/Box";

import TuneIcon from "@mui/icons-material/Tune";
import FormGroup from "@mui/material/FormGroup";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import { MouseEvent, useState } from "react";

import IconButton from "@mui/material/IconButton";
import Slider, { SliderValueLabelProps } from "@mui/material/Slider";
import Tooltip from "@mui/material/Tooltip";
import { FilterInputProps } from "../types";

function valuetext(value: number) {
  return `${value}°C`;
}

const ITEM_HEIGHT = 48;

function ValueLabelComponent(props: SliderValueLabelProps) {
  const { children, value } = props;

  return (
    <Tooltip
      enterTouchDelay={0}
      placement="top"
      title={value}
      style={{
        paddingTop: "0px",
        paddingBottom: "0px",
        paddingLeft: "0px",
        paddingRight: "0px",
        margin: 0,
      }}
    >
      {children}
    </Tooltip>
  );
}

export default function RangeFilterInput({ rangeValues = [], column, ...props }: FilterInputProps) {
  console.log("[RangeFilterInput] rangeValues:", rangeValues);
  console.log("[RangeFilterInput] column:", column);
  console.log("[RangeFilterInput] props:", props);
  const [value, setValue] = useState<number[]>([20, 37]);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChange = (event: Event, newValue: number[]) => {
    setValue(newValue);
  };

  return (
    <div>
      <Box
        sx={{
          width: 300,
          paddingTop: "0px",
          paddingBottom: "0px",
          paddingLeft: "2px",
          paddingRight: "2px",
        }}
      >
        <Tooltip
          title="Filter list"
          style={{
            paddingTop: "0px",
            paddingBottom: "0px",
            paddingLeft: "0px",
            paddingRight: "0px",
          }}
        >
          <IconButton
            size="small"
            aria-label="more"
            id="filter-button"
            aria-controls={open ? "long-menu" : undefined}
            aria-expanded={open ? "true" : undefined}
            aria-haspopup="true"
            onClick={handleClick}
          >
            <TuneIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu
          id="long-menu"
          style={{
            paddingTop: "0px",
            paddingBottom: "0px",
            paddingLeft: "0px",
            paddingRight: "0px",
          }}
          sx={{
            "& .MuiPaper-root": {
              maxHeight: ITEM_HEIGHT * 4.5,
              width: "20ch",
              paddingTop: "0px",
              paddingBottom: "0px",
              paddingLeft: "0px",
              paddingRight: "0px",
            },
          }}
          aria-labelledby="long-button"
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          variant="selectedMenu"
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "center",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "center",
          }}
          slotProps={{
            paper: {
              style: {
                maxHeight: ITEM_HEIGHT * 4.5,
                width: "15ch",
                margin: 0,
                paddingTop: "0px",
                paddingBottom: "0px",
                paddingLeft: "0px",
                paddingRight: "0px",
              },
            },
          }}
        >
          <MenuList
            dense
            sx={{
              paddingTop: "0px",
              paddingBottom: "0px",
              paddingLeft: "0px",
              paddingRight: "0px",
            }}
            style={{
              paddingTop: "0px",
              paddingBottom: "0px",
              paddingLeft: "0px",
              paddingRight: "0px",
            }}
          >
            <FormGroup
              sx={{
                paddingTop: "0px",
                paddingBottom: "0px",
                paddingLeft: "0px",
                paddingRight: "0px",
              }}
              style={{
                paddingTop: "0px",
                paddingBottom: "0px",
                paddingLeft: "0px",
                paddingRight: "0px",
              }}
            >
              <MenuItem
                dense
                sx={{
                  paddingTop: "0px",
                  paddingBottom: "0px",
                  paddingLeft: "0px",
                  paddingRight: "0px",
                }}
                style={{
                  paddingTop: "0px",
                  paddingBottom: "0px",
                  paddingLeft: "0px",
                  paddingRight: "0px",
                }}
              >
                <Slider
                  valueLabelDisplay="auto"
                  style={{
                    paddingTop: "0px",
                    paddingBottom: "0px",
                    paddingLeft: "0px",
                    paddingRight: "0px",
                  }}
                  slots={{
                    valueLabel: ValueLabelComponent,
                  }}
                  aria-label="custom thumb label Small"
                  size="small"
                  getAriaLabel={() => "Temperature range"}
                  value={value}
                  onChange={handleChange}
                  getAriaValueText={valuetext}
                />
              </MenuItem>
            </FormGroup>
          </MenuList>
        </Menu>
      </Box>
    </div>
  );
}

/**

      <Select
        labelId="demo-simple-select-standard-label"
        id="demo-simple-select-standard"
        size="small"
        style={{
          colorScheme: "light",
        }}
        //value={age}
        //onChange={handleChange}
        //label={name}
        sx={{
          width: "100%",
          height: "20px",
        }}
        {...props}
      >
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        <option key={0} value={0}>
          test
        </option>
      </Select>

 */

/*

<div>
      <div className="flex space-x-2">
        <DebouncedInput
          type="number"
          color="secondary.light"
          value={(columnFilterValue as [number, number])?.[0] ?? ""}
          onChange={(value) => column.setFilterValue((old: [number, number]) => [value, old?.[1]])}
          placeholder={`Min`}
          className="w-24 border shadow rounded half-width-input"
          style={{
            ...baseInputStyle,
          }}
        />
        <DebouncedInput
          type="number"
          color="secondary.light"
          value={(columnFilterValue as [number, number])?.[1] ?? ""}
          onChange={(value) => column.setFilterValue((old: [number, number]) => [old?.[0], value])}
          placeholder={`Max`}
          className="w-24 border shadow rounded half-width-input"
          style={{
            ...baseInputStyle,
          }}
        />
      </div>
      <div className="h-1" />
    </div>
*/
