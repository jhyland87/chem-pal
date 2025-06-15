import { AppContext } from "@/context";
import { use } from "react";

/**
 * React v19's use() hook can work with Context directly
 *
 * Benefits over useContext:
 * - No need for separate error handling wrapper
 * - Works with Suspense boundaries
 * - Cleaner, more direct API
 * - Future-proof for React's direction
 */
export function useAppContextV19() {
  // No need for separate useContext - use() handles it
  // The context provider's error handling is sufficient
  return use(AppContext);
}

/**
 * Promise-based Chrome storage with use() hook
 *
 * This demonstrates how React v19's use() hook can handle promises directly,
 * eliminating the need for useEffect + useState patterns for async data.
 *
 * Benefits:
 * - Direct promise handling without useEffect
 * - Automatic Suspense integration
 * - Cleaner error boundaries
 * - Reduces boilerplate code
 */
export function useChromeStorageV19<T>(key: string, defaultValue: T) {
  // The use() hook can handle promises directly
  // This will suspend the component until the promise resolves
  const storedValue = use(
    chrome.storage.session.get([key]).then((data) => {
      return data[key] !== undefined ? (data[key] as T) : defaultValue;
    }),
  );

  const setValue = (value: T) => {
    chrome.storage.session.set({ [key]: value });
  };

  return [storedValue, setValue] as const;
}

/**
 * Enhanced version with error handling and type safety
 */
export function useChromeStorageV19Enhanced<T>(
  key: string,
  defaultValue: T,
  options?: {
    storage?: "session" | "local";
    serializer?: {
      serialize: (value: T) => string;
      deserialize: (value: string) => T;
    };
  },
) {
  const storage = options?.storage === "local" ? chrome.storage.local : chrome.storage.session;
  const { serializer } = options || {};

  const storedValue = use(
    storage
      .get([key])
      .then((data) => {
        const rawValue = data[key];
        if (rawValue === undefined) return defaultValue;

        if (serializer) {
          try {
            return serializer.deserialize(rawValue as string);
          } catch (error) {
            console.warn(`Failed to deserialize ${key}:`, error);
            return defaultValue;
          }
        }

        return rawValue as T;
      })
      .catch((error) => {
        console.error(`Failed to load ${key} from Chrome storage:`, error);
        return defaultValue;
      }),
  );

  const setValue = async (value: T) => {
    try {
      const valueToStore = serializer ? serializer.serialize(value) : value;
      await storage.set({ [key]: valueToStore });
    } catch (error) {
      console.error(`Failed to save ${key} to Chrome storage:`, error);
      throw error;
    }
  };

  const removeValue = async () => {
    try {
      await storage.remove([key]);
    } catch (error) {
      console.error(`Failed to remove ${key} from Chrome storage:`, error);
      throw error;
    }
  };

  return {
    value: storedValue,
    setValue,
    removeValue,
  };
}

/**
 * Reactive Chrome storage hook that watches for changes
 * Uses React v19's use() hook with a custom promise that updates on storage changes
 */
export function useReactiveChromeStorageV19<T>(key: string, defaultValue: T) {
  // Create a promise that resolves and updates when storage changes
  const createStoragePromise = () => {
    return new Promise<T>((resolve) => {
      // Initial load
      chrome.storage.session.get([key]).then((data) => {
        resolve(data[key] !== undefined ? (data[key] as T) : defaultValue);
      });

      // Listen for changes
      const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
        if (changes[key]) {
          resolve(
            changes[key].newValue !== undefined ? (changes[key].newValue as T) : defaultValue,
          );
        }
      };

      chrome.storage.onChanged.addListener(listener);

      // Cleanup is handled by React's concurrent features
      // This is a simplified example - in practice you'd want proper cleanup
    });
  };

  const value = use(createStoragePromise());

  const setValue = (newValue: T) => {
    chrome.storage.session.set({ [key]: newValue });
  };

  return [value, setValue] as const;
}
