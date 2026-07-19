import { defaultSettings } from "@/../config.json";
import { CACHE } from "@/constants/common";
import { diff } from "@/helpers/collectionUtils";
import { getCountryName } from "@/helpers/country";
import { getCurrencyRate } from "@/helpers/currency";
import { setLocale } from "@/helpers/i18n";
import { cstorage } from "@/utils/storage";
import { isValidUserSettings } from "@/utils/typeGuards/common";
import { useCallback, useEffect, useRef, useState } from "react";

// config.json is trusted static config; validate once so the JSON-inferred type
// narrows to UserSettings without an `as` assertion. Falls back to an empty
// object if the shipped defaults are ever malformed.
const DEFAULT_SETTINGS: UserSettings = isValidUserSettings(defaultSettings) ? defaultSettings : {};

/**
 * Return shape of {@link useUserSettings}.
 */
interface UseUserSettings {
  /** The current, storage-backed user settings. */
  userSettings: UserSettings;
  /** Persists a new settings object to `chrome.storage.local` and updates state. */
  setUserSettings: (next: UserSettings) => void;
}

/**
 * Owns the user-settings slice for a standalone extension surface (the options
 * page) without pulling in the full app reducer. It hydrates from
 * `chrome.storage.local` (key `user_settings`, via the LZ-aware `cstorage`
 * wrapper), persists edits, keeps `country` in sync with `location`, refreshes
 * the USD→currency rate when the currency changes, drives the active UI locale
 * from the language setting, and re-hydrates live when another surface (e.g. the
 * popup's Settings tab) writes the same key — mirroring the behavior of
 * `App.tsx` so both surfaces stay consistent.
 * @category Hooks
 * @returns The current `userSettings` and a `setUserSettings` persister.
 * @example
 * ```tsx
 * function OptionsApp() {
 *   const { userSettings, setUserSettings } = useUserSettings();
 *   // userSettings.currency === "USD"
 *   setUserSettings({ ...userSettings, currency: "EUR" });
 *   // → writes { currency: "EUR", country: <derived>, … } to cstorage.local
 * }
 * ```
 * @source
 */
export function useUserSettings(): UseUserSettings {
  const [userSettings, setSettingsState] = useState<UserSettings>(DEFAULT_SETTINGS);

  // Latest settings, readable from effects without re-subscribing them.
  const latestRef = useRef<UserSettings>(userSettings);
  latestRef.current = userSettings;

  // Hydrate from storage on mount, merging stored values over the defaults.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const stored = (await cstorage.local.get([CACHE.USER_SETTINGS]))[CACHE.USER_SETTINGS];
        if (!cancelled && isValidUserSettings(stored)) {
          setSettingsState({ ...DEFAULT_SETTINGS, ...stored });
        }
      } catch (error) {
        console.error("Failed to load user settings:", { error });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist an edit. Keeps `country` (full name) in sync with `location` (code)
  // on every change so consumers can read it directly, matching App.tsx.
  const setUserSettings = useCallback((next: UserSettings) => {
    const newSettings: UserSettings = { ...next, country: getCountryName(next.location) };
    setSettingsState(newSettings);
    void (async () => {
      try {
        await cstorage.local.set({ [CACHE.USER_SETTINGS]: newSettings });
      } catch (error) {
        console.error("Failed to save user settings:", { error });
      }
    })();
  }, []);

  // Drive the active UI locale from the language setting. Stored values may be a
  // full locale ("en-US"); the message tables are keyed by base code ("en").
  const language = userSettings.language;
  useEffect(() => {
    if (language) setLocale(language.split("-")[0]);
  }, [language]);

  // Fetch the USD→currency rate whenever the currency changes and persist it, so
  // price columns reconvert. The rate is async (LRU-cached), hence a separate
  // effect rather than being resolved inside setUserSettings.
  const currency = userSettings.currency;
  useEffect(() => {
    if (!currency) return;
    let cancelled = false;
    const loadRate = async () => {
      try {
        const rate = await getCurrencyRate("USD", currency);
        if (cancelled) return;
        const current = latestRef.current;
        if (current.currencyRate === rate) return;
        const updated: UserSettings = { ...current, currencyRate: rate };
        setSettingsState(updated);
        await cstorage.local.set({ [CACHE.USER_SETTINGS]: updated });
      } catch (error) {
        console.error("Failed to get currency rate:", { error });
      }
    };
    void loadRate();
    return () => {
      cancelled = true;
    };
  }, [currency]);

  // Re-hydrate when another extension surface writes user_settings, so this page
  // reflects edits made in the popup's Settings tab live. This path never writes
  // back (avoids an echo loop); the diff guard skips no-op echoes of our own writes.
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: chrome.storage.AreaName,
    ) => {
      if (areaName !== "local") return;
      const change = changes[CACHE.USER_SETTINGS];
      if (!change || !isValidUserSettings(change.newValue)) return;
      const incoming = change.newValue;
      setSettingsState((current) => (diff(current, incoming).length === 0 ? current : incoming));
    };
    cstorage.onChanged.addListener(listener);
    return () => cstorage.onChanged.removeListener(listener);
  }, []);

  return { userSettings, setUserSettings };
}
