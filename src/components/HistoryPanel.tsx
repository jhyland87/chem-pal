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
 *
 * History is persisted in chrome.storage.local (same mechanism as user settings / cache).
 * Clicking a query re-triggers the search via the app context's pendingSearchQuery.
 * @category Components
 */
const HistoryPanel: React.FC = () => {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const { setPendingSearchQuery, setDrawerTab } = useAppContext();

  useEffect(() => {
    chrome.storage.local
      .get(["searchHistory"])
      .then((data) => {
        if (Array.isArray(data.searchHistory)) {
          setHistory(data.searchHistory);
        }
      })
      .catch((error) => {
        console.warn("Failed to load search history:", error);
      });
  }, []);

  const handleClearHistory = () => {
    chrome.storage.local
      .set({ searchHistory: [] })
      .then(() => setHistory([]))
      .catch((error) => {
        console.warn("Failed to clear search history:", error);
      });
  };

  const handleReSearch = (query: string) => {
    setPendingSearchQuery(query);
    setDrawerTab(-1); // Close the drawer
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
