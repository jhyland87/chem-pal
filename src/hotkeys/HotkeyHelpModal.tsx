import Divider from "@mui/material/Divider";
import Modal from "@mui/material/Modal";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { formatBindingTokens } from "./matcher";
import styles from "./HotkeyHelpModal.module.scss";
import {
  HotkeyCombo,
  HotkeyComboGroup,
  HotkeyHelpBox,
  HotkeyRow,
} from "./HotkeyHelpModal.styled";
import type { HotkeyConfig } from "./types";
import { getHotkeyConfigs } from "./useHotkeys";

interface HotkeyHelpModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Bucket configs by their `group` field, preserving first-seen order so the
 * tab order follows the order entries appear in `config.json`. Using a Map
 * (rather than a Record) is what guarantees that ordering — Record iteration
 * order is technically spec-defined but insertion-based Maps are clearer.
 */
function groupByGroup(configs: HotkeyConfig[]): Map<string, HotkeyConfig[]> {
  const groups = new Map<string, HotkeyConfig[]>();
  for (const config of configs) {
    const group = config.group || "General";
    const bucket = groups.get(group);
    if (bucket) {
      bucket.push(config);
    } else {
      groups.set(group, [config]);
    }
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
  const groupNames = useMemo(() => Array.from(grouped.keys()), [grouped]);
  const [activeGroup, setActiveGroup] = useState<string>(groupNames[0] ?? "");

  // Reset to the first tab each time the modal opens — avoids reopening on a
  // stale group if the config list changes underneath us.
  useEffect(() => {
    if (open && groupNames.length > 0) {
      setActiveGroup(groupNames[0]);
    }
  }, [open, groupNames]);

  const handleTabChange = (_event: SyntheticEvent, value: string) => {
    setActiveGroup(value);
  };

  const activeEntries = grouped.get(activeGroup) ?? [];

  return (
    <Modal
      data-testid="hotkey-help-modal"
      open={open}
      onClose={onClose}
      aria-labelledby="hotkey-help-title"
      sx={{ zIndex: (theme) => theme.zIndex.modal + 10 }}
    >
      <HotkeyHelpBox
        className={styles["hotkey-help-box"]}
        onClick={(e) => e.stopPropagation()}
      >
        <Typography
          id="hotkey-help-title"
          variant="subtitle1"
          component="h2"
          className={styles["hotkey-help-title"]}
          sx={{ mb: 0.5 }}
        >
          Keyboard Shortcuts
        </Typography>
        <Tabs
          value={activeGroup}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          className={styles["hotkey-tabs"]}
        >
          {groupNames.map((group) => (
            <Tab key={group} label={group} value={group} />
          ))}
        </Tabs>
        <Divider />
        <div className={styles["hotkey-tab-panel"]}>
          {activeEntries.map((entry) => (
            <HotkeyRow key={entry.id} className={styles["hotkey-row"]}>
              <HotkeyComboGroup className={styles["hotkey-combo-group"]}>
                {formatBindingTokens(entry.keys).map((token, i) => (
                  <HotkeyCombo key={`${entry.id}-${i}`} className={styles["hotkey-combo"]}>
                    {token}
                  </HotkeyCombo>
                ))}
              </HotkeyComboGroup>
              <Typography variant="body2" className={styles["hotkey-description"]}>
                {entry.description}
              </Typography>
            </HotkeyRow>
          ))}
        </div>
      </HotkeyHelpBox>
    </Modal>
  );
}
