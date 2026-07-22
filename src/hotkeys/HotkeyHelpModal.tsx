import Divider from "@mui/material/Divider";
import Modal from "@mui/material/Modal";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { i18n } from "@/helpers/i18n";
import { useDebouncedCallback } from "@/shared/hooks";
import { useEffect, useMemo, useState, type ChangeEvent, type SyntheticEvent } from "react";
import { formatBindingTokens, formatSequenceTokens, resolveBinding } from "./matcher";
import styles from "./HotkeyHelpModal.module.scss";
import { HotkeyCombo, HotkeyComboGroup, HotkeyHelpBox, HotkeyRow } from "./HotkeyHelpModal.styled";
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
 * Localized tab label for a hotkey group, keyed by the lowercased group name
 * (e.g. `hotkeys_group_search`). Falls back to the raw group when no message
 * is defined.
 * @param group - The raw group name from `config.json`.
 * @returns The localized group label.
 * @source
 */
function localizeGroup(group: string): string {
  return i18n(`hotkeys_group_${group.toLowerCase()}`) || group;
}

/**
 * Localized description for a hotkey, keyed by the lowercased hotkey id
 * (e.g. `hotkeys_desc_gotosearch`). Falls back to the English `description`
 * declared in `config.json`.
 * @param config - The hotkey config entry.
 * @returns The localized description.
 * @source
 */
function localizeDescription(config: HotkeyConfig): string {
  return i18n(`hotkeys_desc_${config.id.toLowerCase()}`) || config.description;
}

/**
 * Per-key display labels for a hotkey's combo. Sequential hotkeys render as an
 * ordered key sequence (e.g. `↑ ↑ ↓ ↓ ← →`); chord hotkeys render as their
 * platform-aware modifier + key tokens (e.g. `⌘ ⇧ E`).
 * @param config - The hotkey config entry.
 * @returns The tokens to render as individual combo chips.
 * @source
 */
function comboTokens(config: HotkeyConfig): string[] {
  return config.sequential
    ? formatSequenceTokens(resolveBinding(config.keys))
    : formatBindingTokens(config.keys);
}

/**
 * Tests whether a hotkey matches a search query. Matches against the localized
 * description, the localized group label, and the rendered key tokens so a user
 * can find a shortcut by name, category, or the keys themselves.
 * @param config - The hotkey config entry.
 * @param query - The lowercased search query.
 * @returns `true` when the entry should appear in the filtered results.
 * @source
 */
function entryMatches(config: HotkeyConfig, query: string): boolean {
  const haystack = [
    localizeDescription(config),
    localizeGroup(config.group),
    ...comboTokens(config),
    resolveBinding(config.keys),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
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
/**
 * Renders the combo-chips + description row for a single hotkey entry.
 */
function renderRow(entry: HotkeyConfig) {
  return (
    <HotkeyRow key={entry.id} className={styles["hotkey-row"]}>
      <HotkeyComboGroup className={styles["hotkey-combo-group"]}>
        {comboTokens(entry).map((token, i) => (
          <HotkeyCombo key={`${entry.id}-${i}`} className={styles["hotkey-combo"]}>
            {token}
          </HotkeyCombo>
        ))}
      </HotkeyComboGroup>
      <Typography variant="body2" className={styles["hotkey-description"]}>
        {localizeDescription(entry)}
      </Typography>
    </HotkeyRow>
  );
}

export default function HotkeyHelpModal({ open, onClose }: HotkeyHelpModalProps) {
  // Exclude `unlisted` hotkeys — they stay functional but never appear here.
  const grouped = useMemo(
    () => groupByGroup(getHotkeyConfigs().filter((config) => !config.unlisted)),
    [],
  );
  const groupNames = useMemo(() => Array.from(grouped.keys()), [grouped]);
  const [activeGroup, setActiveGroup] = useState<string>(groupNames[0] ?? "");
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const debouncedSetQuery = useDebouncedCallback((value: string) => setQuery(value), 200);

  // Reset to the first tab and clear the search each time the modal opens —
  // avoids reopening on a stale group or a leftover query.
  useEffect(() => {
    if (open && groupNames.length > 0) {
      setActiveGroup(groupNames[0]);
      setInputValue("");
      setQuery("");
    }
  }, [open, groupNames]);

  const handleTabChange = (_event: SyntheticEvent, value: string) => {
    setActiveGroup(value);
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value);
    debouncedSetQuery(value);
  };

  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  // While searching, show every group that has matches as its own section
  // rather than the single active tab, so results span all categories.
  const searchSections = useMemo(() => {
    if (!isSearching) return [];
    const sections: Array<{ group: string; entries: HotkeyConfig[] }> = [];
    for (const [group, entries] of grouped) {
      const matched = entries.filter((entry) => entryMatches(entry, normalizedQuery));
      if (matched.length > 0) sections.push({ group, entries: matched });
    }
    return sections;
  }, [grouped, isSearching, normalizedQuery]);

  const activeEntries = grouped.get(activeGroup) ?? [];

  return (
    <Modal
      data-testid="hotkey-help-modal"
      open={open}
      onClose={onClose}
      aria-labelledby="hotkey-help-title"
      sx={{ zIndex: (theme) => theme.zIndex.modal + 10 }}
    >
      <HotkeyHelpBox className={styles["hotkey-help-box"]} onClick={(e) => e.stopPropagation()}>
        <div className={styles["hotkey-help-header"]}>
          <Typography
            id="hotkey-help-title"
            variant="subtitle1"
            component="h2"
            className={styles["hotkey-help-title"]}
          >
            {i18n("hotkeys_title")}
          </Typography>
          <TextField
            value={inputValue}
            onChange={handleSearchChange}
            size="small"
            variant="outlined"
            placeholder={i18n("hotkeys_search_placeholder")}
            className={styles["hotkey-search"]}
            slotProps={{ htmlInput: { "aria-label": i18n("hotkeys_search_placeholder") } }}
          />
        </div>
        {!isSearching && (
          <Tabs
            value={activeGroup}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            className={styles["hotkey-tabs"]}
          >
            {groupNames.map((group) => (
              <Tab key={group} label={localizeGroup(group)} value={group} />
            ))}
          </Tabs>
        )}
        <Divider />
        <div className={styles["hotkey-tab-panel"]}>
          {!isSearching && activeEntries.map((entry) => renderRow(entry))}
          {isSearching && searchSections.length === 0 && (
            <Typography variant="body2" className={styles["hotkey-no-matches"]}>
              {i18n("hotkeys_no_matches")}
            </Typography>
          )}
          {isSearching &&
            searchSections.map((section) => (
              <div key={section.group}>
                <Typography variant="caption" className={styles["hotkey-section-heading"]}>
                  {localizeGroup(section.group)}
                </Typography>
                {section.entries.map((entry) => renderRow(entry))}
              </div>
            ))}
        </div>
      </HotkeyHelpBox>
    </Modal>
  );
}
