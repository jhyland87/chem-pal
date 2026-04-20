import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Modal from "@mui/material/Modal";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";
import { formatBinding } from "./matcher";
import { getHotkeyConfigs } from "./useHotkeys";
import type { HotkeyConfig } from "./types";

interface HotkeyHelpModalProps {
  open: boolean;
  onClose: () => void;
}

function groupByGroup(configs: HotkeyConfig[]): Record<string, HotkeyConfig[]> {
  const groups: Record<string, HotkeyConfig[]> = {};
  for (const config of configs) {
    const group = config.group || "General";
    if (!groups[group]) groups[group] = [];
    groups[group].push(config);
  }
  return groups;
}

/**
 * Modal that lists every hotkey defined in `config.json`, grouped by the
 * `group` field. Each row shows the formatted key combo (platform-aware)
 * and the human-readable description.
 *
 * The modal is driven entirely off the config — adding a new entry to
 * `config.json` is sufficient to make it appear here with no code change.
 * @param props - Component props.
 * @example
 * ```tsx
 * <HotkeyHelpModal open={open} onClose={() => setOpen(false)} />
 * ```
 * @source
 */
export default function HotkeyHelpModal({ open, onClose }: HotkeyHelpModalProps) {
  const grouped = useMemo(() => groupByGroup(getHotkeyConfigs()), []);

  return (
    <Modal
      data-testid="hotkey-help-modal"
      open={open}
      onClose={onClose}
      aria-labelledby="hotkey-help-title"
      sx={{ zIndex: (theme) => theme.zIndex.modal + 10 }}
    >
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(460px, 90vw)",
          maxHeight: "80vh",
          overflowY: "auto",
          bgcolor: "background.paper",
          color: "text.primary",
          borderRadius: 2,
          boxShadow: 24,
          p: 3,
          outline: "none",
        }}
      >
        <Typography
          id="hotkey-help-title"
          variant="h6"
          component="h2"
          sx={{ textAlign: "center", mb: 1.5 }}
        >
          Keyboard Shortcuts
        </Typography>
        <Divider />
        {Object.entries(grouped).map(([group, entries]) => (
          <Box key={group}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: "block", mt: 2 }}
            >
              {group}
            </Typography>
            {entries.map((entry) => (
              <Box
                key={entry.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  py: 0.75,
                }}
              >
                <Typography variant="body2" sx={{ flex: "1 1 auto" }}>
                  {entry.description}
                </Typography>
                <Box
                  component="span"
                  sx={{
                    flex: "0 0 auto",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: "0.85rem",
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    border: 1,
                    borderColor: "divider",
                    bgcolor: "action.hover",
                  }}
                >
                  {formatBinding(entry.keys)}
                </Box>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    </Modal>
  );
}
