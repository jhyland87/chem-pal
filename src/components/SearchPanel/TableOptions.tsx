import TuneIcon from "@mui/icons-material/Tune";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { TableOptionsProps } from "../../types";
import FilterModal from "./FilterModal";
import SearchInput from "./SearchInput";

export default function TableOptions({ table, searchInput, setSearchInput }: TableOptionsProps) {
  //const settingsContext = useSettings();

  const [filterModalOpen, setFilterModalOpen] = useState(false);

  return (
    <>
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
          <TuneIcon fontSize="small" onClick={() => setFilterModalOpen(true)} />
        </Tooltip>
      </Toolbar>
      <FilterModal
        filterModalOpen={filterModalOpen}
        setFilterModalOpen={setFilterModalOpen}
        table={table}
      />
    </>
  );
}
