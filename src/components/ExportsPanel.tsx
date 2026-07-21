import { downloadBlob } from "@/helpers/exportResults";
import { i18n } from "@/helpers/i18n";
import { formatBytes, formatTimestamp } from "@/helpers/utils";
import {
  clearExports,
  deleteExport,
  type ExportRecord,
  getAllExports,
  IDB_EXPORTS_UPDATED,
} from "@/utils/idbCache";
import { Delete as DeleteIcon, FileDownload as FileDownloadIcon } from "@mui/icons-material";
import { Box, IconButton, List, ListItem, ListItemText, Tooltip, Typography } from "@mui/material";
import { FC, useCallback, useEffect, useState } from "react";
import styles from "./ExportsPanel.module.scss";

/**
 * ExportsPanel lists the `.xlsx` result exports cached in IndexedDB, newest
 * first, and lets the user re-download or delete each one (or clear them all).
 * The list live-refreshes on the `IDB_EXPORTS_UPDATED` event, so exports created
 * from the results context menu appear without reopening the drawer.
 *
 * @example
 * ```tsx
 * // Rendered inside the History drawer tab's "Exported data" accordion:
 * <ExportsPanel />
 * // Displays:
 * //   2 exports
 * //   chempal-export-acetone-2026-07-21-14-03-22.xlsx
 * //     Jul 21, 2:03 PM — 12 results · 18 KB      [download] [delete]
 * ```
 * @category Components
 * @source
 */
const ExportsPanel: FC = () => {
  const [exports, setExports] = useState<ExportRecord[]>([]);

  const loadExports = useCallback(async () => {
    try {
      setExports(await getAllExports());
    } catch (error) {
      console.warn("Failed to load exports:", error);
    }
  }, []);

  useEffect(() => {
    void loadExports();
    const handler = () => void loadExports();
    window.addEventListener(IDB_EXPORTS_UPDATED, handler);
    return () => window.removeEventListener(IDB_EXPORTS_UPDATED, handler);
  }, [loadExports]);

  /**
   * Re-downloads a cached export from its stored Blob.
   * @param record - The export record to download.
   * @source
   */
  const handleDownload = (record: ExportRecord) => {
    downloadBlob(record.blob, record.filename);
  };

  /**
   * Deletes one cached export; the list refreshes via `IDB_EXPORTS_UPDATED`.
   * @param id - The export record id to delete.
   * @source
   */
  const handleDelete = async (id: string) => {
    try {
      await deleteExport(id);
    } catch (error) {
      console.warn("Failed to delete export:", error);
    }
  };

  /**
   * Clears every cached export; the list refreshes via `IDB_EXPORTS_UPDATED`.
   * @source
   */
  const handleClear = async () => {
    try {
      await clearExports();
    } catch (error) {
      console.warn("Failed to clear exports:", error);
    }
  };

  return (
    <Box className={styles["exports-panel"]}>
      <Box className={styles["exports-panel__header"]}>
        <Typography variant="caption" color="text.secondary">
          {exports.length === 1
            ? i18n("exports_count_single", [String(exports.length)])
            : i18n("exports_count_plural", [String(exports.length)])}
        </Typography>
        {exports.length > 0 && (
          <Tooltip title={i18n("exports_clear")}>
            <IconButton
              size="small"
              onClick={() => void handleClear()}
              aria-label={i18n("exports_clear")}
              className={styles["exports-panel__clear-btn"]}
            >
              <DeleteIcon className={styles["exports-panel__clear-icon"]} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {exports.length === 0 ? (
        <Typography
          variant="caption"
          color="text.secondary"
          className={styles["exports-panel__empty"]}
        >
          {i18n("exports_empty")}
        </Typography>
      ) : (
        <List dense disablePadding>
          {exports.map((record) => (
            <ListItem
              key={record.id}
              divider
              className={styles["exports-panel__list-item"]}
              secondaryAction={
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  <Tooltip title={i18n("exports_download")}>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleDownload(record)}
                      aria-label={i18n("exports_download")}
                    >
                      <FileDownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={i18n("exports_delete")}>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => void handleDelete(record.id)}
                      aria-label={i18n("exports_delete")}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              }
            >
              <ListItemText
                primary={record.filename}
                secondary={`${formatTimestamp(record.createdAt)} — ${
                  record.rowCount === 1
                    ? i18n("exports_result_single", [String(record.rowCount)])
                    : i18n("exports_result_plural", [String(record.rowCount)])
                } · ${formatBytes(record.sizeBytes)}`}
                slotProps={{
                  primary: {
                    variant: "body2",
                    className: styles["exports-panel__filename"],
                  },
                  secondary: {
                    variant: "caption",
                    className: styles["exports-panel__secondary-text"],
                  },
                }}
                className={styles["exports-panel__list-item-text"]}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default ExportsPanel;
