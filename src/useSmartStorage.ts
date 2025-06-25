import { useCallback, useEffect, useRef, useState } from "react";

type StorageArea = "local" | "sync" | "session";
type UseSmartStorageOptions = { area?: StorageArea };

type SetValue<T> = (value: T | ((prev: T) => T)) => void;
type ResetValue = () => void;

/**
 * Checks if the Chrome extension storage API is available.
 *
 * @returns `true` if Chrome extension storage is available, `false` otherwise
 *
 * @example
 * ```typescript
 * if (isChromeStorageAvailable()) {
 *   console.log('Chrome extension storage is available');
 * } else {
 *   console.log('Using localStorage fallback');
 * }
 * ```
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
 *
 * @param area - The storage area to use: 'local', 'sync', or 'session'
 * @returns A storage object with get, set, and remove methods
 *
 * @example
 * ```typescript
 * const storage = getStorage('local');
 * storage.get(['myKey'], (result) => {
 *   console.log('Retrieved:', result.myKey);
 * });
 * ```
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
 * This hook provides persistent storage that works in both Chrome extensions and web applications.
 * It automatically handles the differences between Chrome extension storage and localStorage.
 *
 * @param key - Storage key for the data
 * @param defaultValue - Default value if nothing is stored
 * @param options - Optional configuration including storage area
 * @returns A tuple containing [value, setValue, resetValue]
 *
 * @example
 * ```typescript
 * // Basic usage
 * const [user, setUser, resetUser] = useSmartStorage('userProfile', { name: '', age: 0 });
 *
 * // With custom storage area
 * const [settings, setSettings] = useSmartStorage('appSettings', defaultSettings, { area: 'sync' });
 *
 * // Usage in component
 * function MyComponent() {
 *   const [count, setCount, resetCount] = useSmartStorage('counter', 0);
 *
 *   return (
 *     <div>
 *       <p>Count: {count}</p>
 *       <button onClick={() => setCount(count + 1)}>Increment</button>
 *       <button onClick={resetCount}>Reset</button>
 *     </div>
 *   );
 * }
 * ```
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

/**
 * Creates a setter function for a specific property of an object stored in smart storage.
 *
 * This helper function simplifies updating individual properties of complex objects
 * without manually spreading the previous state.
 *
 * @param setValue - The setValue function from useSmartStorage
 * @param property - The property key to update
 * @returns A function that takes a new value and updates only the specified property
 *
 * @example
 * ```typescript
 * // Basic usage
 * const [user, setUser] = useSmartStorage('user', { name: '', age: 0, theme: 'light' });
 * const setName = createPropertySetter(setUser, 'name');
 * const setAge = createPropertySetter(setUser, 'age');
 *
 * // Usage in event handlers
 * <button onClick={() => setName('John')}>Set Name</button>
 * <button onClick={() => setAge(25)}>Set Age</button>
 *
 * // With boolean values
 * const [settings, setSettings] = useSmartStorage('settings', { darkMode: false });
 * const setDarkMode = createPropertySetter(setSettings, 'darkMode');
 *
 * <button onClick={() => setDarkMode(true)}>Enable Dark Mode</button>
 * <button onClick={() => setDarkMode(!settings.darkMode)}>Toggle Dark Mode</button>
 *
 * // With complex objects
 * const setUserProfile = createPropertySetter(setUser, 'profile');
 * setUserProfile({ avatar: 'url', bio: 'Hello world' });
 * ```
 */
export const createPropertySetter = <T extends Record<string, unknown>, K extends keyof T>(
  setValue: (value: T | ((prev: T) => T)) => void,
  property: K,
) => {
  return (newValue: T[K]) => {
    setValue((prev) => ({ ...prev, [property]: newValue }));
  };
};

/**
 * Creates a setter function for form input elements that automatically extracts the value.
 *
 * This is a wrapper around createPropertySetter that handles React form events
 * and extracts the value from the event target.
 *
 * @param setValue - The setValue function from useSmartStorage
 * @param property - The property key to update
 * @returns A function that can be used as an onChange handler for form inputs
 *
 * @example
 * ```typescript
 * // Basic usage with text inputs
 * const [user, setUser] = useSmartStorage('user', { name: '', email: '' });
 * const setName = createInputSetter(setUser, 'name');
 * const setEmail = createInputSetter(setUser, 'email');
 *
 * <input
 *   type="text"
 *   value={user.name}
 *   onChange={setName}
 *   placeholder="Enter name"
 * />
 *
 * // With select elements
 * const [settings, setSettings] = useSmartStorage('settings', { theme: 'light' });
 * const setTheme = createInputSetter(setSettings, 'theme');
 *
 * <select value={settings.theme} onChange={setTheme}>
 *   <option value="light">Light</option>
 *   <option value="dark">Dark</option>
 * </select>
 *
 * // With number inputs
 * const setAge = createInputSetter(setUser, 'age');
 * <input
 *   type="number"
 *   value={user.age}
 *   onChange={setAge}
 * />
 * ```
 */
export const createInputSetter = <T extends Record<string, unknown>, K extends keyof T>(
  setValue: (value: T | ((prev: T) => T)) => void,
  property: K,
) => {
  const setProperty = createPropertySetter(setValue, property);
  return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setProperty(e.target.value as T[K]);
  };
};
