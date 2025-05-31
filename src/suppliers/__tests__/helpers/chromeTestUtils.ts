import type { ChromeStorageItems } from "@/types/chromeStorage";
import { vi } from "vitest";

/**
 * Creates a mock Chrome storage object with spy functions for testing.
 * This mock includes both session and local storage with promisified get/set methods.
 */
export const createChromeMock = () => {
  const mockChrome = {
    storage: {
      session: {
        set: vi.fn(),
        get: vi.fn(),
      },
      local: {
        set: vi.fn(),
        get: vi.fn(),
      },
    },
  };

  // Promisify chrome.storage.session.set and chrome.storage.session.get
  mockChrome.storage.session.set = vi
    .fn()
    .mockImplementation((items: ChromeStorageItems) => Promise.resolve());
  mockChrome.storage.session.get = vi
    .fn()
    .mockImplementation((keys?: string | string[] | { [key: string]: any } | null) =>
      Promise.resolve({}),
    );

  // Promisify chrome.storage.local.set and chrome.storage.local.get
  mockChrome.storage.local.set = vi
    .fn()
    .mockImplementation((items: ChromeStorageItems) => Promise.resolve());
  mockChrome.storage.local.get = vi
    .fn()
    .mockImplementation((keys?: string | string[] | { [key: string]: any } | null) =>
      Promise.resolve({}),
    );

  return mockChrome;
};

/**
 * Sets up the Chrome mock globally for testing.
 * This should be called in a beforeEach block or at the start of a test suite.
 *
 * @returns The mock Chrome object for direct access if needed
 *
 * @example
 * ```typescript
 * describe("MyTest", () => {
 *   beforeEach(() => {
 *     setupChromeMock();
 *   });
 * });
 * ```
 */
export const setupChromeMock = () => {
  const mockChrome = createChromeMock();
  //Object.assign(global, { chrome: mockChrome });
  vi.stubGlobal("chrome", mockChrome);
  return mockChrome;
};

/**
 * Clears all Chrome mock function calls.
 * This should be called in a beforeEach block or afterEach block to reset the mock state.
 *
 * @example
 * ```typescript
 * describe("MyTest", () => {
 *   afterEach(() => {
 *     clearChromeMock();
 *   });
 * });
 * ```
 */
export const clearChromeMock = () => {
  if (global.chrome?.storage) {
    vi.clearAllMocks();
  }
};

export const resetChromeMock = () => {
  if (global.chrome?.storage) {
    vi.resetAllMocks();
  }
};

export const restoreChromeMock = () => {
  if (global.chrome?.storage) {
    vi.restoreAllMocks();
  }
};
