// Import necessary modules
import "@testing-library/jest-dom";
import type { ChromeStorageItems } from "types/chromeStorage";
import { promisify } from "util";

// Initialize Chrome mock
const mockChrome = {
  storage: {
    session: {
      set: jest.fn(),
      get: jest.fn(),
    },
    local: {
      set: jest.fn(),
      get: jest.fn(),
    },
  },
};

// Assign mock to global
Object.assign(global, { chrome: mockChrome });

// Promisify chrome.storage.session.set and chrome.storage.session.get
global.chrome.storage.session.set = promisify(global.chrome.storage.session.set) as (
  items: ChromeStorageItems,
) => Promise<void>;

global.chrome.storage.session.get = promisify(global.chrome.storage.session.get) as {
  <T = { [key: string]: any }>(
    keys?: string | string[] | { [key: string]: any } | null,
  ): Promise<T>;
  <T = { [key: string]: any }>(callback: (items: T) => void): void;
};

// Promisify chrome.storage.local.set and chrome.storage.local.get
global.chrome.storage.local.set = promisify(global.chrome.storage.local.set) as (
  items: ChromeStorageItems,
) => Promise<void>;

global.chrome.storage.local.get = promisify(global.chrome.storage.local.get) as {
  <T = { [key: string]: any }>(
    keys?: string | string[] | { [key: string]: any } | null,
  ): Promise<T>;
  <T = { [key: string]: any }>(callback: (items: T) => void): void;
};
