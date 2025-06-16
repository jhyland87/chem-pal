import TuneIcon from "@/icons/TuneIcon";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useRef } from "react";
//import FilterModal from "./FilterModal";
import FilterMenu from "./FilterMenu";
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
export default function TableOptions({ table, onSearch }: TableOptionsProps) {
  //const [filterModalOpen, setFilterModalOpen] = useState(false);

  const filterRef = useRef<{
    toggleDrawer: (open: boolean) => void;
    getState: () => boolean;
  }>(null);

  return (
    <>
      <FilterMenu ref={filterRef} table={table} />
      <Toolbar className="table-options-toolbar fullwidth">
        <Typography component="div" className="search-input">
          <SearchInput
            //searchInput={searchInput}
            //className="search-input"
            //setSearchInput={setSearchInput}
            onSearch={onSearch}
          />
        </Typography>
        <Tooltip title="Filter list">
          <button
            className="svg-button-icon"
            onClick={() => filterRef.current?.toggleDrawer(!filterRef.current?.getState())}
          >
            <TuneIcon className="table-options-icon" />
          </button>
        </Tooltip>
      </Toolbar>
      {/* <FilterModal
          filterModalOpen={filterModalOpen}
          setFilterModalOpen={setFilterModalOpen}
          table={table}
        /> */}
    </>
  );
}
