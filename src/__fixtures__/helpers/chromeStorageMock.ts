import { vi } from "vitest";

type StorageValue = unknown;

// Store the real Maps separately
const storageMaps = {
  session: new Map<string, StorageValue>(),
  local: new Map<string, StorageValue>(),
  sync: new Map<string, StorageValue>(),
};

const mockChrome = {
  storage: storageMaps,
};

// Assign mock to global
Object.assign(global, { chrome: mockChrome });

/**
 * Creates a mock implementation for Chrome storage methods that actually stores and retrieves data.
 * This allows tests to verify that data is being stored and retrieved correctly.
 */
const createStorageMock = (area: "session" | "local" | "sync") => {
  const get = vi
    .fn()
    .mockImplementation(
      async (keys?: string | string[] | { [key: string]: StorageValue } | null) => {
        if (!keys) {
          // Return all items
          return Object.fromEntries(storageMaps[area]);
        }

        if (typeof keys === "string") {
          // Return single item
          return { [keys]: storageMaps[area].get(keys) };
        }

        if (Array.isArray(keys)) {
          // Return multiple items
          return Object.fromEntries(
            keys
              .map((key) => [key, storageMaps[area].get(key)])
              .filter(([, value]) => value !== undefined),
          );
        }

        // Return items matching the object keys
        return Object.fromEntries(
          Object.keys(keys)
            .map((key) => [key, storageMaps[area].get(key)])
            .filter(([, value]) => value !== undefined),
        );
      },
    );

  const set = vi.fn().mockImplementation(async (items: ChromeStorageItems) => {
    Object.entries(items).forEach(([key, value]) => {
      storageMaps[area].set(key, value);
    });
  });

  // Reference to the underlying Map
  const map = storageMaps[area];

  const clear = vi.fn().mockImplementation(async () => map.clear());
  const remove = vi.fn().mockImplementation(async (keys) => {
    (Array.isArray(keys) ? keys : [keys]).forEach((key) => map.delete(key));
  });
  const getBytesInUse = vi.fn().mockResolvedValue(0);
  const setAccessLevel = vi.fn().mockResolvedValue(undefined);
  // Add missing properties
  const onChanged = {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn().mockReturnValue(false),
    hasListeners: vi.fn().mockReturnValue(false),
    getRules: vi.fn().mockResolvedValue([]),
    removeRules: vi.fn().mockResolvedValue(undefined),
    addRules: vi.fn().mockResolvedValue([]),
  };
  const getKeys = vi.fn().mockResolvedValue([]);
  return {
    get,
    set,
    clear,
    remove,
    getBytesInUse,
    setAccessLevel,
    QUOTA_BYTES: 102400,
    onChanged,
    getKeys,
  };
};

/**
 * Creates a complete Chrome storage mock with both session and local storage.
 * The mock actually stores data in memory, allowing tests to verify storage behavior.
 */
export const createChromeStorageMock = () => {
  const session = createStorageMock("session");
  const local = createStorageMock("local");
  const sync = createStorageMock("sync");

  // Add missing properties to satisfy type checker
  return {
    storage: {
      session,
      local,
      sync,
      AccessLevel: {
        TRUSTED_AND_UNTRUSTED_CONTEXTS:
          "TRUSTED_AND_UNTRUSTED_CONTEXTS" as "TRUSTED_AND_UNTRUSTED_CONTEXTS",
        TRUSTED_CONTEXTS: "TRUSTED_CONTEXTS" as "TRUSTED_CONTEXTS",
      },
      managed: {},
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
        hasListeners: vi.fn().mockReturnValue(false),
        getRules: vi.fn().mockResolvedValue([]),
        removeRules: vi.fn().mockResolvedValue(undefined),
        addRules: vi.fn().mockResolvedValue([]),
      },
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
  if (!global.chrome) {
    global.chrome = {} as typeof chrome;
  }
  global.chrome.storage = mockChrome.storage as any;
  return mockChrome;
};

/**
 * Clears all stored data and resets mock function calls.
 * This should be called in beforeEach or afterEach to ensure a clean state.
 */
export const resetChromeStorageMock = () => {
  storageMaps.session.clear();
  storageMaps.local.clear();
  storageMaps.sync.clear();
  vi.clearAllMocks();
};

/**
 * Restores all mock functions to their original state and clears stored data.
 * This should be called in afterAll to clean up after tests.
 */
export const restoreChromeStorageMock = () => {
  storageMaps.session.clear();
  storageMaps.local.clear();
  storageMaps.sync.clear();
  vi.restoreAllMocks();
};
