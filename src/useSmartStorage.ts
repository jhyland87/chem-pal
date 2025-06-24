import { useCallback, useEffect, useRef, useState } from "react";

type StorageArea = "local" | "sync" | "session";
type UseSmartStorageOptions = { area?: StorageArea };

type SetValue<T> = (value: T | ((prev: T) => T)) => void;
type ResetValue = () => void;

/**
 * Checks if the Chrome extension storage API is available.
 */
function isChromeStorageAvailable(): boolean {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.storage === "object" &&
    ("local" in chrome.storage || "sync" in chrome.storage || "session" in chrome.storage)
  );
}

/**
 * Gets the correct Chrome storage area or a localStorage fallback.
 */
function getStorage(area: StorageArea) {
  if (isChromeStorageAvailable()) {
    switch (area) {
      case "sync":
        return chrome.storage.sync;
      case "session":
        return chrome.storage.session;
      case "local":
      default:
        return chrome.storage.local;
    }
  }
  // Fallback for web: mimic the API
  return {
    get: (keys: string[], cb: (result: Record<string, unknown>) => void) => {
      const out: Record<string, unknown> = {};
      keys.forEach((key) => {
        const val = localStorage.getItem(key);
        if (val !== null) out[key] = JSON.parse(val);
      });
      cb(out);
    },
    set: (items: Record<string, unknown>, cb?: () => void) => {
      Object.entries(items).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      });
      cb?.();
    },
    remove: (keys: string[], cb?: () => void) => {
      keys.forEach((key) => localStorage.removeItem(key));
      cb?.();
    },
  };
}

/**
 * React hook for smart storage (chrome.storage or localStorage fallback).
 *
 * @param key - Storage key
 * @param defaultValue - Default value if nothing is stored
 * @param options - Optional: area: 'local' | 'sync' | 'session'
 * @returns [value, setValue, resetValue]
 */
export function useSmartStorage<T>(
  key: string,
  defaultValue: T,
  options?: UseSmartStorageOptions,
): [T, SetValue<T>, ResetValue] {
  const area = options?.area ?? "local";
  const storage = useRef(getStorage(area));
  const [value, setValueState] = useState<T>(defaultValue);

  // Load initial value
  useEffect(() => {
    storage.current.get([key], (result: Record<string, unknown>) => {
      if (result && result[key] !== undefined) {
        setValueState(result[key] as T);
      } else {
        // Initialize with default if not present
        storage.current.set({ [key]: defaultValue });
        setValueState(defaultValue);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, area]);

  // Listen for changes (chrome.storage or localStorage)
  useEffect(() => {
    function handleChromeChange(
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) {
      if (areaName === area && changes[key] && changes[key].newValue !== undefined) {
        setValueState(changes[key].newValue as T);
      }
    }
    function handleLocalStorageChange(e: StorageEvent) {
      if (e.key === key && e.newValue !== null) {
        setValueState(JSON.parse(e.newValue));
      }
    }
    if (isChromeStorageAvailable()) {
      chrome.storage.onChanged.addListener(handleChromeChange);
      return () => chrome.storage.onChanged.removeListener(handleChromeChange);
    } else {
      window.addEventListener("storage", handleLocalStorageChange);
      return () => window.removeEventListener("storage", handleLocalStorageChange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, area]);

  // Set value
  const setValue: SetValue<T> = useCallback(
    (val) => {
      setValueState((prev) => {
        const newValue = typeof val === "function" ? (val as (prev: T) => T)(prev) : val;
        storage.current.set({ [key]: newValue });
        return newValue;
      });
    },
    [key],
  );

  // Reset value
  const reset = useCallback(() => {
    storage.current.set({ [key]: defaultValue });
    setValueState(defaultValue);
  }, [key, defaultValue]);

  return [value, setValue, reset];
}
