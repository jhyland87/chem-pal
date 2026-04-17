import TableColumns from "@/components/SearchPanel/TableColumns";
import { CACHE, DRAWER_INDEX, PANEL } from "@/constants/common";
import { useAppContext } from "@/context";
import { cstorage } from "@/utils/storage";
import { ExpandMore as ExpandMoreIcon, Search as SearchIcon } from "@mui/icons-material";
import { Accordion, Box, Button, TextField, Typography } from "@mui/material";
import { FC, KeyboardEvent, SyntheticEvent, useEffect, useMemo } from "react";
import ColumnDrawerSection from "./ColumnDrawerSection";
import styles from "./DrawerSearchPanel.module.scss";
import { StyledAccordionDetails, StyledAccordionSummary } from "./StyledComponents";

/**
 * Pre-search filter drawer. Renders the product-name field, then walks
 * `TableColumns()` in column-config order and emits one accordion section
 * per column with a `meta.drawer` payload (via `ColumnDrawerSection`). The
 * non-column "Results Limit" section is injected just before the `price`
 * entry to preserve its historical position.
 *
 * Adding, removing, or reordering a drawer-backed column in TableColumns.tsx
 * is reflected here automatically — no edits to this file are required.
 * @param props - Component props.
 * @param props.expandedAccordion - Currently open accordion's panel id
 *                                  (e.g. `"search-country"`), or `false`.
 * @param props.onAccordionChange - Factory from panelId to MUI Accordion's
 *                                  `onChange` handler.
 * @returns The search drawer body (title input, filter accordions, submit).
 * @example
 * ```tsx
 * const [expanded, setExpanded] = useState<string | false>(false);
 * const handleChange = (panel: string) => (_e: SyntheticEvent, isOpen: boolean) =>
 *   setExpanded(isOpen ? panel : false);
 *
 * <DrawerSearchPanel expandedAccordion={expanded} onAccordionChange={handleChange} />
 * // Renders (with current TableColumns config):
 * //   [Product name or keyword]
 * //   ▸ Supplier (0 selected)
 * //   ▸ Country (0 selected)
 * //   ▸ Shipping Type
 * //   ▸ Availability
 * //   ▸ Results Limit (15 per supplier)   ← non-column, injected before Price
 * //   ▸ Price Range
 * //   [Search]
 * ```
 * @source
 */
const DrawerSearchPanel: FC<{
  expandedAccordion: string | false;
  onAccordionChange: (panel: string) => (event: SyntheticEvent, isExpanded: boolean) => void;
}> = ({ expandedAccordion, onAccordionChange }) => {
  const {
    userSettings,
    setUserSettings,
    setDrawerTab,
    setPendingSearchQuery,
    searchFilters,
    setSearchFilters,
    setPanel,
  } = useAppContext();

  // Collect columns that declared a drawer section in their meta, preserving
  // the order they appear in TableColumns(). Memoized per-render only —
  // TableColumns() is pure and cheap.
  const drawerColumns = useMemo(
    () =>
      TableColumns().flatMap((column) => {
        const drawer = column.meta?.drawer;
        return drawer && column.id ? [{ id: column.id, drawer }] : [];
      }),
    [],
  );

  // Hydrate the title query field from the shared live search input value so
  // the drawer shows whatever the user last typed in any search input, even
  // if it hasn't been submitted yet.
  useEffect(() => {
    const loadSearchInput = async () => {
      try {
        const data = await cstorage.session.get([CACHE.SEARCH_INPUT]);
        const stored = data[CACHE.SEARCH_INPUT];
        if (typeof stored === "string" && stored !== searchFilters.titleQuery) {
          setSearchFilters({ ...searchFilters, titleQuery: stored });
        }
      } catch (error) {
        console.warn("Failed to load search input from session storage:", { error });
      }
    };
    loadSearchInput();
    // Run once on mount; we intentionally don't depend on searchFilters to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTitleQueryChange = async (value: string) => {
    setSearchFilters({ ...searchFilters, titleQuery: value });
    try {
      await cstorage.session.set({ [CACHE.SEARCH_INPUT]: value });
    } catch (error) {
      console.warn("Failed to persist search input to session storage:", { error });
    }
  };

  const handleSearch = async (): Promise<void> => {
    const query = searchFilters.titleQuery.trim();
    if (!query) return;
    // Clear the live in-progress draft in session storage now that the query
    // has been promoted to a real search. We intentionally do NOT write
    // CACHE.QUERY or CACHE.SEARCH_IS_NEW_SEARCH here: those are consumed by
    // useSearch's mount effect, which would fire a duplicate performSearch in
    // parallel with the pendingSearchQuery path below. HistoryPanel.handleReSearch
    // follows the same single-path pattern.
    try {
      await cstorage.session.set({ [CACHE.SEARCH_INPUT]: "" });
    } catch (error) {
      console.warn("Failed to clear search input draft in session storage:", { error });
    }
    // Clear the drawer's visible field to match the cleared draft so re-opening
    // the drawer doesn't show stale text from the just-submitted query.
    setSearchFilters({ ...searchFilters, titleQuery: "" });
    // Stage the query for ResultsTable's pendingSearchQuery effect to consume.
    // This works whether SearchPanel is already mounted (effect re-fires on the
    // context update) or is about to mount (fresh mount reads pendingSearchQuery
    // from context on first render).
    setPendingSearchQuery(query);
    setDrawerTab(DRAWER_INDEX.CLOSED);
    // Switch to the results panel so SearchPanel / ResultsTable mount if the
    // user triggered the search from the home panel. When already on RESULTS,
    // this is a harmless no-op.
    setPanel?.(PANEL.RESULTS);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      void handleSearch();
    }
  };

  const renderResultLimit = () => (
    <Accordion
      key="per-supplier-limit"
      expanded={expandedAccordion === "per-supplier-limit"}
      onChange={onAccordionChange("per-supplier-limit")}
    >
      <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>
          Results Limit
          {userSettings.supplierResultLimit != null && (
            <span className={styles["accordion-hint"]}>
              ({userSettings.supplierResultLimit} per supplier)
            </span>
          )}
        </Typography>
      </StyledAccordionSummary>
      <StyledAccordionDetails>
        <TextField
          style={{ width: "100%" }}
          label="Results Limit (per Supplier)"
          value={userSettings.supplierResultLimit}
          onChange={(e) =>
            setUserSettings({
              ...userSettings,
              supplierResultLimit: parseInt(e.target.value) || undefined,
            })
          }
        />
      </StyledAccordionDetails>
    </Accordion>
  );

  return (
    <Box>
      {/* Title / Search Query */}
      <Box sx={{ p: "12px 16px" }}>
        <TextField
          fullWidth
          label="Product name or keyword"
          size="small"
          value={searchFilters.titleQuery}
          onChange={(e) => handleTitleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </Box>

      {drawerColumns.flatMap(({ id, drawer }) => {
        // "Results Limit" is a user setting (not a filter on a column), so it
        // has no column to anchor it to. Inject it right before the price
        // section to preserve its historical position in the drawer UX.
        const resultLimit = id === "price" ? [renderResultLimit()] : [];
        return [
          ...resultLimit,
          <ColumnDrawerSection
            key={id}
            columnId={id}
            config={drawer}
            expandedAccordion={expandedAccordion}
            onAccordionChange={onAccordionChange}
          />,
        ];
      })}

      <Box sx={{ p: 2 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<SearchIcon />}
          onClick={() => void handleSearch()}
          disabled={!searchFilters.titleQuery.trim()}
        >
          Search
        </Button>
      </Box>
    </Box>
  );
};

export default DrawerSearchPanel;
