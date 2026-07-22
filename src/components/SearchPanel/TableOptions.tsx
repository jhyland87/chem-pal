import TuneIcon from "@/icons/TuneIcon";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Table } from "@tanstack/react-table";
//import FilterModal from "./FilterModal";
import SearchInput from "./SearchInput";
import styles from "./TableOptions.module.scss";

/**
 * Props for {@link TableOptions}.
 * @example
 * ```tsx
 * const props: TableOptionsProps = {
 *   table, onSearch: (q) => runSearch(q), onToggleDrawer: () => {}, isDrawerOpen: false,
 * };
 * ```
 * @source
 */
interface TableOptionsProps {
  /** The TanStack table instance the toolbar operates on. */
  table: Table<Product>;
  /** Called with the query when a search is submitted from the toolbar input. */
  onSearch: (query: string) => void;
  /** Toggles the filter drawer open/closed. */
  onToggleDrawer: () => void;
  /** Whether the filter drawer is currently open. */
  isDrawerOpen: boolean;
}

/**
 * TableOptions component that provides a toolbar with search input and filter controls
 * for the product results table. It manages the filter modal state and renders
 * the search input and filter icon.
 *
 * @component
 * @param props - Component props
 * @example
 * ```tsx
 * <TableOptions
 *   table={table}
 *   searchInput={searchInput}
 *   setSearchInput={setSearchInput}
 * />
 * ```
 * @source
 */
export default function TableOptions({ onSearch, onToggleDrawer }: TableOptionsProps) {
  //const [filterModalOpen, setFilterModalOpen] = useState(false);

  return (
    <>
      <Toolbar className={`${styles["table-options-toolbar"]} ${styles.fullwidth}`}>
        <Typography component="div" className={styles["search-input"]}>
          <SearchInput
            //searchInput={searchInput}
            //className="search-input"
            //setSearchInput={setSearchInput}
            onSearch={onSearch}
          />
        </Typography>
        <Tooltip title="Filter list">
          <button className={styles["svg-button-icon"]} onClick={onToggleDrawer}>
            <TuneIcon className={styles["table-options-icon"]} />
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
