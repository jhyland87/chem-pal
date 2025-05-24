import TuneIcon from "@/icons/TuneIcon";
import { type TableOptionsProps } from "@/types/props";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import FilterModal from "./FilterModal";
import SearchInput from "./SearchInput";
import "./TableOptions.scss";

/**
 * TableOptions component that provides a toolbar with search input and filter controls
 * for the product results table. It manages the filter modal state and renders
 * the search input and filter icon.
 *
 * @component
 *
 * @param props - Component props
 *
 * @example
 * ```tsx
 * <TableOptions
 *   table={table}
 *   searchInput={searchInput}
 *   setSearchInput={setSearchInput}
 * />
 * ```
 */
export default function TableOptions({ table, searchInput, setSearchInput }: TableOptionsProps) {
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  return (
    <>
      <Toolbar className="table-options-toolbar fullwidth">
        <Typography component="div" className="search-input">
          <SearchInput
            searchInput={searchInput}
            //className="search-input"
            setSearchInput={setSearchInput}
          />
        </Typography>
        <Tooltip title="Filter list">
          <button className="svg-button-icon" onClick={() => setFilterModalOpen(true)}>
            <TuneIcon className="table-options-icon" />
          </button>
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
