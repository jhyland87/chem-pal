/**
 * Mock storage object to simulate Chrome's storage.local
 */
export const mockStorage: Record<string, unknown> = {};

/**
 * Mock implementation of Chrome's storage.local API
 */
export const mockChromeStorage = {
  storage: {
    local: {
      set: (items: Record<string, unknown>) =>
        new Promise<void>((resolve) => {
          console.log("mock chrome.storage.local.set", items);
          Object.assign(mockStorage, items);
          resolve();
        }),
      get: (keys: string | string[] | null) =>
        new Promise<Record<string, unknown>>((resolve) => {
          console.log("mock chrome.storage.local.get", keys);
          const result: Record<string, unknown> = {};
          if (typeof keys === "string") {
            if (keys in mockStorage) {
              result[keys] = mockStorage[keys];
            }
          } else if (Array.isArray(keys)) {
            keys.forEach((key) => {
              if (key in mockStorage) {
                result[key] = mockStorage[key];
              }
            });
          } else if (keys === null) {
            Object.assign(result, mockStorage);
          }
          resolve(result);
        }),
    },
  },
};

/**
 * Setup Chrome storage mock for tests
 */
export const setupChromeStorageMock = () => {
  Object.assign(global, { chrome: mockChromeStorage });
};
