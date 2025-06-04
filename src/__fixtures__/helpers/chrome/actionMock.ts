import { vi } from "vitest";

type ActionIcon = {
  [size: number]: string;
};

type ActionPopup = {
  popup?: string;
  tabId?: number;
  windowId?: number;
};

const mockChromeAction = {
  // Store state for the mock
  _state: {
    icon: {} as ActionIcon,
    popup: {} as ActionPopup,
    title: "",
    badgeText: "",
    badgeBackgroundColor: "",
    badgeTextColor: "",
    enabled: true,
    userSettings: {
      isOnToolbar: true,
    },
  },

  // Mock implementations of chrome.action methods
  setIcon: vi
    .fn()
    .mockImplementation(async (details: { imageData?: ActionIcon; path?: ActionIcon }) => {
      if (details.imageData) {
        mockChromeAction._state.icon = details.imageData;
      } else if (details.path) {
        mockChromeAction._state.icon = details.path;
      }
    }),

  setPopup: vi.fn().mockImplementation(async (details: { popup: string; tabId?: number }) => {
    mockChromeAction._state.popup = {
      popup: details.popup,
      tabId: details.tabId,
    };
  }),

  getPopup: vi.fn().mockImplementation(async (details?: { tabId?: number }) => {
    return mockChromeAction._state.popup.popup || "";
  }),

  setTitle: vi.fn().mockImplementation(async (details: { title: string; tabId?: number }) => {
    mockChromeAction._state.title = details.title;
  }),

  getTitle: vi.fn().mockImplementation(async (details?: { tabId?: number }) => {
    return mockChromeAction._state.title;
  }),

  setBadgeText: vi
    .fn()
    .mockImplementation((details: { text: string; tabId?: number }, callback?: () => void) => {
      mockChromeAction._state.badgeText = details.text;
      if (callback) {
        callback();
      }
    }),

  getBadgeText: vi.fn().mockImplementation(async (details?: { tabId?: number }) => {
    return mockChromeAction._state.badgeText;
  }),

  setBadgeBackgroundColor: vi
    .fn()
    .mockImplementation(async (details: { color: string; tabId?: number }) => {
      mockChromeAction._state.badgeBackgroundColor = details.color;
    }),

  getBadgeBackgroundColor: vi.fn().mockImplementation(async (details?: { tabId?: number }) => {
    return mockChromeAction._state.badgeBackgroundColor;
  }),

  setBadgeTextColor: vi
    .fn()
    .mockImplementation(async (details: { color: string; tabId?: number }) => {
      mockChromeAction._state.badgeTextColor = details.color;
    }),

  getBadgeTextColor: vi.fn().mockImplementation(async (details?: { tabId?: number }) => {
    return mockChromeAction._state.badgeTextColor;
  }),

  enable: vi.fn().mockImplementation(async (tabId?: number) => {
    mockChromeAction._state.enabled = true;
  }),

  disable: vi.fn().mockImplementation(async (tabId?: number) => {
    mockChromeAction._state.enabled = false;
  }),

  isEnabled: vi.fn().mockImplementation(async (details?: { tabId?: number }) => {
    return mockChromeAction._state.enabled;
  }),

  getUserSettings: vi.fn().mockImplementation(async () => {
    return mockChromeAction._state.userSettings;
  }),

  openPopup: vi.fn().mockImplementation(async () => {
    // Mock implementation - in real Chrome this would open the popup
    return Promise.resolve();
  }),

  // Event listeners
  onClicked: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn().mockReturnValue(false),
    hasListeners: vi.fn().mockReturnValue(false),
    getRules: vi.fn().mockResolvedValue([]),
    removeRules: vi.fn().mockResolvedValue(undefined),
    addRules: vi.fn().mockResolvedValue([]),
  },

  onUserSettingsChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn().mockReturnValue(false),
    hasListeners: vi.fn().mockReturnValue(false),
    getRules: vi.fn().mockResolvedValue([]),
    removeRules: vi.fn().mockResolvedValue(undefined),
    addRules: vi.fn().mockResolvedValue([]),
  },
};

/**
 * Creates a mock implementation for Chrome action methods.
 * This allows tests to verify that action methods are being called correctly.
 */
export const createChromeActionMock = () => {
  return mockChromeAction;
};

/**
 * Sets up the Chrome action mock globally.
 * This should be called at the start of your test suite.
 *
 * @returns The mock Chrome action object for direct access if needed
 */
export const setupChromeActionMock = () => {
  const mock = createChromeActionMock();
  if (!global.chrome) {
    global.chrome = {} as typeof chrome;
  }
  global.chrome.action = mock;
  return mock;
};

/**
 * Resets the mock state and clears mock function calls.
 * This should be called in beforeEach or afterEach to ensure a clean state.
 */
export const resetChromeActionMock = () => {
  mockChromeAction._state = {
    icon: {},
    popup: {},
    title: "",
    badgeText: "",
    badgeBackgroundColor: "",
    badgeTextColor: "",
    enabled: true,
    userSettings: {
      isOnToolbar: true,
    },
  };
  vi.clearAllMocks();
};

/**
 * Restores all mock functions to their original state and resets the mock state.
 * This should be called in afterAll to clean up after tests.
 */
export const restoreChromeActionMock = () => {
  mockChromeAction._state = {
    icon: {},
    popup: {},
    title: "",
    badgeText: "",
    badgeBackgroundColor: "",
    badgeTextColor: "",
    enabled: true,
    userSettings: {
      isOnToolbar: true,
    },
  };
  vi.restoreAllMocks();
};
