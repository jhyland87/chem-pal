import TuneIcon from "@mui/icons-material/Tune";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { TableOptionsProps } from "../../types";
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
 * @param {TableOptionsProps} props - Component props
 * @param {Table<Product>} props.table - The table instance from TanStack Table
 * @param {string} props.searchInput - The current search input value
 * @param {Function} props.setSearchInput - Function to update the search input value
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
  //const appContext = useAppContext();

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
