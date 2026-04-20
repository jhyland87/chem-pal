import Divider from "@mui/material/Divider";
import Modal from "@mui/material/Modal";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";
import { formatBinding } from "./matcher";
import styles from "./HotkeyHelpModal.module.scss";
import { HotkeyCombo, HotkeyHelpBox, HotkeyRow } from "./HotkeyHelpModal.styled";
import type { HotkeyConfig } from "./types";
import { getHotkeyConfigs } from "./useHotkeys";

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
 * Static layout (positioning, sizing, text alignment, font families) lives
 * in the sibling `HotkeyHelpModal.module.scss`. Theme-dependent styling
 * (palette, spacing, radius, shadow) lives in `HotkeyHelpModal.styled.ts`.
 * The modal itself is driven entirely off the config — adding a new entry
 * to `config.json` is sufficient to make it appear here with no code
 * change.
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
      <HotkeyHelpBox className={styles["hotkey-help-box"]}>
        <Typography
          id="hotkey-help-title"
          variant="subtitle1"
          component="h2"
          className={styles["hotkey-help-title"]}
          sx={{ mb: 0.5 }}
        >
          Keyboard Shortcuts
        </Typography>
        <Divider />
        {Object.entries(grouped).map(([group, entries]) => (
          <div key={group}>
            <Typography
              variant="overline"
              color="text.secondary"
              className={styles["hotkey-group-heading"]}
              sx={{ mt: 1 }}
            >
              {group}
            </Typography>
            {entries.map((entry) => (
              <HotkeyRow key={entry.id} className={styles["hotkey-row"]}>
                <HotkeyCombo component="span" className={styles["hotkey-combo"]}>
                  {formatBinding(entry.keys)}
                </HotkeyCombo>
                <Typography variant="body2" className={styles["hotkey-description"]}>
                  {entry.description}
                </Typography>
              </HotkeyRow>
            ))}
          </div>
        ))}
      </HotkeyHelpBox>
    </Modal>
  );
}
