import { vi } from "vitest";

type CreateProperties = {
  url?: string;
  active?: boolean;
  pinned?: boolean;
  index?: number;
  windowId?: number;
  openerTabId?: number;
};

const mockChrome = {
  tabs: {
    create: vi
      .fn()
      .mockImplementation((createProperties: CreateProperties) => Promise.resolve({ id: 1 })),
    // Add other commonly used tab methods with mock implementations
    get: vi.fn().mockImplementation((tabId: number) => Promise.resolve({ id: tabId })),
    query: vi.fn().mockImplementation(() => Promise.resolve([])),
    update: vi
      .fn()
      .mockImplementation((tabId: number, updateProperties: Partial<CreateProperties>) =>
        Promise.resolve({ id: tabId }),
      ),
    remove: vi.fn().mockImplementation((tabIds: number | number[]) => Promise.resolve()),
    // Add event listeners
    onCreated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },
  },
};

// Preserve existing chrome APIs while adding tabs
if (!global.chrome) {
  global.chrome = {} as typeof chrome;
}
Object.assign(global.chrome, mockChrome);

/**
 * Sets up the Chrome tabs mock globally.
 * This should be called at the start of your test suite.
 *
 * @returns The mock Chrome tabs object for direct access if needed
 */
export const setupChromeTabsMock = () => {
  if (!global.chrome) {
    global.chrome = {} as typeof chrome;
  }
  Object.assign(global.chrome, mockChrome);
  return mockChrome.tabs;
};

/**
 * Resets all mock function calls.
 * This should be called in beforeEach or afterEach to ensure a clean state.
 */
export const resetChromeTabsMock = () => {
  vi.clearAllMocks();
};

/**
 * Restores all mock functions to their original state.
 * This should be called in afterAll to clean up after tests.
 */
export const restoreChromeTabsMock = () => {
  vi.restoreAllMocks();
};

// Export the mock tabs for direct access if needed
export default mockChrome.tabs;
