import TuneIcon from "@mui/icons-material/Tune";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { TableOptionsProps } from "../../types";
import FilterModal from "./FilterModal";
import SearchInput from "./SearchInput";
import "./TableOptions.scss";
export default function TableOptions({ table, searchInput, setSearchInput }: TableOptionsProps) {
  //const settingsContext = useSettings();

  const [filterModalOpen, setFilterModalOpen] = useState(false);

  return (
    <>
      <Toolbar className="table-options-toolbar">
        <Typography component="div">
          <SearchInput searchInput={searchInput} setSearchInput={setSearchInput} />
        </Typography>
        <Tooltip title="Filter list">
          <TuneIcon
            className="table-options-icon"
            fontSize="small"
            onClick={() => setFilterModalOpen(true)}
          />
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
