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
import { Delete as DeleteIcon } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { useAppContext } from "@/context";
import "./HistoryPanel.scss";

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
  const { setPendingSearchQuery, setDrawerTab } = useAppContext();

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await chrome.storage.local.get(["search_history"]);
        if (Array.isArray(data.search_history)) {
          setHistory(data.search_history);
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
      await chrome.storage.local.set({ search_history: [] });
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
  const handleReSearch = (query: string) => {
    setPendingSearchQuery(query);
    setDrawerTab(-1); // Close the drawer
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
    <Box className="history-panel">
      <Box className="history-panel__header">
        <Typography variant="caption" color="text.secondary">
          {history.length} {history.length === 1 ? "search" : "searches"}
        </Typography>
        {history.length > 0 && (
          <Tooltip title="Clear history">
            <IconButton size="small" onClick={handleClearHistory} className="history-panel__clear-btn">
              <DeleteIcon className="history-panel__clear-icon" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {history.length === 0 ? (
        <Typography variant="caption" color="text.secondary" className="history-panel__empty">
          No search history yet.
        </Typography>
      ) : (
        <List dense disablePadding>
          {history.map((entry, idx) => (
            <ListItem key={`${entry.timestamp}-${idx}`} divider className="history-panel__list-item">
              <ListItemText
                primary={
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => handleReSearch(entry.query)}
                    className="history-panel__link"
                  >
                    {entry.query}
                  </Link>
                }
                secondary={`${formatTimestamp(entry.timestamp)} — ${entry.resultCount} result${entry.resultCount !== 1 ? "s" : ""}`}
                secondaryTypographyProps={{ variant: "caption", className: "history-panel__secondary-text" }}
                className="history-panel__list-item-text"
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default HistoryPanel;
