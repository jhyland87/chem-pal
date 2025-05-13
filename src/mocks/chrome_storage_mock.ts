// Define types for storage items
type StorageValue = string | number | boolean | object | null;
type StorageItems = { [key: string]: StorageValue };
type StorageKeys = string | string[] | { [key: string]: StorageValue };

export default {
  local: {
    get: (keys: StorageKeys) =>
      new Promise<StorageItems>((resolve) => {
        const result: StorageItems = {};
        if (Array.isArray(keys)) {
          keys.forEach((key) => {
            result[key] = localStorage.getItem(key)
              ? JSON.parse(localStorage.getItem(key) as string)
              : null;
          });
        } else if (typeof keys === "string") {
          result[keys] = localStorage.getItem(keys)
            ? JSON.parse(localStorage.getItem(keys) as string)
            : null;
        } else if (typeof keys === "object" && keys !== null) {
          Object.keys(keys).forEach((key) => {
            result[key] = localStorage.getItem(key)
              ? JSON.parse(localStorage.getItem(key) as string)
              : keys[key];
          });
        }
        resolve(result);
      }),
    set: (items: StorageItems) =>
      new Promise<void>(() => {
        for (const key in items) {
          localStorage.setItem(key, JSON.stringify(items[key]));
        }
      }),

    remove: (keys: string | string[]) =>
      new Promise<void>(() => {
        if (Array.isArray(keys)) {
          keys.forEach((key) => localStorage.removeItem(key));
        } else {
          localStorage.removeItem(keys);
        }
      }),
    clear: () =>
      new Promise(() => {
        localStorage.clear();
      }),
  },
};
