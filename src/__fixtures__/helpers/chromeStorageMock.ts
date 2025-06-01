import { vi } from "vitest";

type StorageValue = unknown;

const mockChrome = {
  storage: {
    session: new Map<string, StorageValue>(),
    local: new Map<string, StorageValue>(),
  },
};

// Assign mock to global
Object.assign(global, { chrome: mockChrome });

// In-memory storage for the mock
/*const storage = {
  session: new Map<string, StorageValue>(),
  local: new Map<string, StorageValue>(),
};*/

/**
 * Creates a mock implementation for Chrome storage methods that actually stores and retrieves data.
 * This allows tests to verify that data is being stored and retrieved correctly.
 */
const createStorageMock = (area: "session" | "local") => {
  const get = vi
    .fn()
    .mockImplementation(
      async (keys?: string | string[] | { [key: string]: StorageValue } | null) => {
        if (!keys) {
          // Return all items
          return Object.fromEntries(mockChrome.storage[area]);
        }

        if (typeof keys === "string") {
          // Return single item
          return { [keys]: mockChrome.storage[area].get(keys) };
        }

        if (Array.isArray(keys)) {
          // Return multiple items
          return Object.fromEntries(
            keys
              .map((key) => [key, mockChrome.storage[area].get(key)])
              .filter(([, value]) => value !== undefined),
          );
        }

        // Return items matching the object keys
        return Object.fromEntries(
          Object.keys(keys)
            .map((key) => [key, mockChrome.storage[area].get(key)])
            .filter(([, value]) => value !== undefined),
        );
      },
    );

  const set = vi.fn().mockImplementation(async (items: ChromeStorageItems) => {
    Object.entries(items).forEach(([key, value]) => {
      mockChrome.storage[area].set(key, value);
    });
  });

  return { get, set };
};

/**
 * Creates a complete Chrome storage mock with both session and local storage.
 * The mock actually stores data in memory, allowing tests to verify storage behavior.
 */
export const createChromeStorageMock = () => {
  const session = createStorageMock("session");
  const local = createStorageMock("local");

  return {
    storage: {
      session,
      local,
    },
  };
};

/**
 * Sets up the Chrome storage mock globally.
 * This should be called at the start of your test suite.
 *
 * @returns The mock Chrome object for direct access if needed
 */
export const setupChromeStorageMock = () => {
  const mockChrome = createChromeStorageMock();
  vi.stubGlobal("chrome", mockChrome);
  return mockChrome;
};

/**
 * Clears all stored data and resets mock function calls.
 * This should be called in beforeEach or afterEach to ensure a clean state.
 */
export const resetChromeStorageMock = () => {
  mockChrome.storage.session.clear();
  mockChrome.storage.local.clear();
  vi.clearAllMocks();
};

/**
 * Restores all mock functions to their original state and clears stored data.
 * This should be called in afterAll to clean up after tests.
 */
export const restoreChromeStorageMock = () => {
  mockChrome.storage.session.clear();
  mockChrome.storage.local.clear();
  vi.restoreAllMocks();
};
