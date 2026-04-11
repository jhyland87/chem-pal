import { CACHE, DRAWER_INDEX, PANEL } from "@/constants/common";
import { useAppContext } from "@/context";
import { cstorage } from "@/utils/storage";
import { Delete as DeleteIcon, FilterList as FilterListIcon } from "@mui/icons-material";
import {
  Box,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import styles from "./HistoryPanel.module.scss";

/**
 * HistoryPanel component that displays past search queries,
 * when they were executed, and how many results were returned.
 * History is persisted in `chrome.storage.local` (same mechanism as user settings / cache).
 * Clicking a query re-triggers the search via the app context's `pendingSearchQuery`.
 *
 * @example
 * ```tsx
 * // Rendered inside the drawer's tab panel:
 * <HistoryPanel />
 * // Displays:
 * //   3 searches
 * //   acetone        Mar 26, 2:15 PM — 12 results
 * //   sodium chloride Mar 25, 9:00 AM — 8 results
 * //   benzene        Mar 24, 4:30 PM — 5 results
 * ```
 * @category Components
 * @source
 */
const HistoryPanel: React.FC = () => {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const { setPendingSearchQuery, setDrawerTab, setSearchFilters, setSelectedSuppliers, setPanel } =
    useAppContext();

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await cstorage.local.get([CACHE.SEARCH_HISTORY]);
        if (Array.isArray(data[CACHE.SEARCH_HISTORY])) {
          setHistory(data[CACHE.SEARCH_HISTORY] as SearchHistoryEntry[]);
        }
      } catch (error) {
        console.warn("Failed to load search history:", error);
      }
    };
    loadHistory();
  }, []);

  /**
   * Clears all search history entries from both local state and
   * `chrome.storage.local`, resetting the panel to its empty state.
   * @example
   * ```ts
   * handleClearHistory();
   * // chrome.storage.local.search_history => []
   * // UI shows "No search history yet."
   * ```
   * @source
   */
  const handleClearHistory = async () => {
    try {
      await cstorage.local.set({ [CACHE.SEARCH_HISTORY]: [] });
      setHistory([]);
    } catch (error) {
      console.warn("Failed to clear search history:", error);
    }
  };

  /**
   * Re-executes a previous search by setting the pending search query
   * in the app context and closing the drawer.
   * @param query - The search term to re-run (e.g. `"sodium chloride"`)
   * @example
   * ```ts
   * handleReSearch("acetone");
   * // Sets pendingSearchQuery to "acetone"
   * // Sets drawerTab to -1 (closes drawer)
   * ```
   * @source
   */
  const handleReSearch = (entry: SearchHistoryEntry) => {
    // Restore filters that were active when this search was originally executed
    if (entry.filters) {
      setSearchFilters(entry.filters);
    }
    if (entry.selectedSuppliers) {
      setSelectedSuppliers(entry.selectedSuppliers);
    }
    setPendingSearchQuery(entry.query);
    setDrawerTab(DRAWER_INDEX.CLOSED); // Close the drawer
    setPanel?.(PANEL.RESULTS); // Navigate to results panel
  };

  /**
   * Formats a Unix epoch timestamp (in milliseconds) into a short,
   * human-readable date string using the user's locale.
   * @param epochMs - Timestamp in milliseconds since Unix epoch
   * @returns A locale-formatted string like `"Mar 26, 2:15 PM"`
   * @example
   * ```ts
   * formatTimestamp(1711468500000);
   * // => "Mar 26, 2:15 PM"
   * ```
   * @source
   */
  const getFilterSummary = (entry: SearchHistoryEntry): string | null => {
    const parts: string[] = [];
    if (entry.filters) {
      if (entry.filters.availability.length > 0)
        parts.push(`Availability: ${entry.filters.availability.join(", ")}`);
      if (entry.filters.country.length > 0)
        parts.push(`Country: ${entry.filters.country.join(", ")}`);
      if (entry.filters.shippingType.length > 0)
        parts.push(`Shipping: ${entry.filters.shippingType.join(", ")}`);
    }
    if (entry.selectedSuppliers && entry.selectedSuppliers.length > 0) {
      parts.push(`Suppliers: ${entry.selectedSuppliers.length} selected`);
    }
    return parts.length > 0 ? parts.join("\n") : null;
  };

  const formatTimestamp = (epochMs: number) => {
    const date = new Date(epochMs);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Box className={styles["history-panel"]}>
      <Box className={styles["history-panel__header"]}>
        <Typography variant="caption" color="text.secondary">
          {history.length} {history.length === 1 ? "search" : "searches"}
        </Typography>
        {history.length > 0 && (
          <Tooltip title="Clear history">
            <IconButton
              size="small"
              onClick={handleClearHistory}
              className={styles["history-panel__clear-btn"]}
            >
              <DeleteIcon className={styles["history-panel__clear-icon"]} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {history.length === 0 ? (
        <Typography
          variant="caption"
          color="text.secondary"
          className={styles["history-panel__empty"]}
        >
          No search history yet.
        </Typography>
      ) : (
        <List dense disablePadding>
          {history.map((entry, idx) => (
            <ListItem
              key={`${entry.timestamp}-${idx}`}
              divider
              className={styles["history-panel__list-item"]}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => handleReSearch(entry)}
                      sx={{ fontWeight: "bold" }}
                      className={styles["history-panel__link"]}
                    >
                      {entry.query}
                    </Link>
                    {getFilterSummary(entry) && (
                      <Tooltip title={getFilterSummary(entry)!} sx={{ whiteSpace: "pre-line" }}>
                        <FilterListIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                      </Tooltip>
                    )}
                  </Box>
                }
                secondary={`${formatTimestamp(entry.timestamp)} — ${entry.resultCount} result${entry.resultCount !== 1 ? "s" : ""}`}
                secondaryTypographyProps={{
                  variant: "caption",
                  className: styles["history-panel__secondary-text"],
                }}
                className={styles["history-panel__list-item-text"]}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default HistoryPanel;
