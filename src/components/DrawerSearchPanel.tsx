import TableColumns from "@/components/SearchPanel/TableColumns";
import { AVAILABILITY_OPTIONS, CACHE, DRAWER_INDEX, PANEL } from "@/constants/common";
import { useAppContext } from "@/context";
import { cstorage } from "@/utils/storage";
import { ExpandMore as ExpandMoreIcon, Search as SearchIcon } from "@mui/icons-material";
import { Accordion, Box, Button, Chip, TextField, Typography } from "@mui/material";
import React, { useEffect, useMemo } from "react";
import ColumnDrawerSection from "./ColumnDrawerSection";
import styles from "./DrawerSearchPanel.module.scss";
import { StyledAccordionDetails, StyledAccordionSummary } from "./StyledComponents";

/**
 * The ordered list of drawer sections. Column ids (`"supplier"`, `"country"`,
 * `"shipping"`, `"price"`) resolve to a ColumnDef with `meta.drawer` and are
 * rendered via `<ColumnDrawerSection>`. The `"availability"` and
 * `"resultLimit"` entries are not backed by table columns and render their
 * own hand-coded accordion here.
 */
const SECTION_ORDER = [
  "availability",
  "supplier",
  "country",
  "shipping",
  "resultLimit",
  "price",
] as const;

const DrawerSearchPanel: React.FC<{
  expandedAccordion: string | false;
  onAccordionChange: (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => void;
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

  // Build a lookup of columns that declared a drawer section in their meta.
  // Memoized per-render only — TableColumns() is pure and cheap.
  const drawerColumns = useMemo(() => {
    const map = new Map<string, ColumnDrawerConfig>();
    for (const column of TableColumns()) {
      const drawer = column.meta?.drawer;
      if (drawer && column.id) map.set(column.id, drawer);
    }
    return map;
  }, []);

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

  const toggleAvailability = (value: string) => {
    const current = searchFilters.availability;
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    setSearchFilters({ ...searchFilters, availability: updated });
  };

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      void handleSearch();
    }
  };

  const renderAvailability = () => (
    <Accordion
      key="search-availability"
      expanded={expandedAccordion === "search-availability"}
      onChange={onAccordionChange("search-availability")}
    >
      <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>
          Availability
          {searchFilters.availability.length > 0 && (
            <span className={styles["accordion-hint"]}>
              ({searchFilters.availability.length} selected)
            </span>
          )}
        </Typography>
      </StyledAccordionSummary>
      <StyledAccordionDetails>
        <Box className={styles["chip-container"]}>
          {AVAILABILITY_OPTIONS.map((option) => (
            <Chip
              key={option}
              label={option}
              size="small"
              onClick={() => toggleAvailability(option)}
              color={searchFilters.availability.includes(option) ? "primary" : "default"}
              variant={searchFilters.availability.includes(option) ? "filled" : "outlined"}
            />
          ))}
        </Box>
      </StyledAccordionDetails>
    </Accordion>
  );

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

      {SECTION_ORDER.map((entry) => {
        if (entry === "availability") return renderAvailability();
        if (entry === "resultLimit") return renderResultLimit();
        const config = drawerColumns.get(entry);
        if (!config) return null;
        return (
          <ColumnDrawerSection
            key={entry}
            columnId={entry}
            config={config}
            expandedAccordion={expandedAccordion}
            onAccordionChange={onAccordionChange}
          />
        );
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
