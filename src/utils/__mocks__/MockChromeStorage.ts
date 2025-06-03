/**
 * Type guard to check if a value is a string key
 */
function isStringKey(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Type guard to check if a value is a string array
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isStringKey);
}

/**
 * Type guard to check if a value is a record
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is a function
 */
function isFunction(value: unknown): value is Function {
  return typeof value === "function";
}

/**
 * A mock implementation of chrome.storage.StorageArea that stores data in memory
 * Useful for testing and development without a Chrome extension context
 */
export class MockChromeStorage implements chrome.storage.StorageArea {
  private storage: Map<string, unknown> = new Map();
  private listeners: Set<(changes: { [key: string]: chrome.storage.StorageChange }) => void> =
    new Set();

  /**
   * Get one or more items from storage
   */
  get<T = { [key: string]: unknown }>(keys?: keyof T | (keyof T)[] | Partial<T> | null): Promise<T>;
  get<T = { [key: string]: unknown }>(
    keys: keyof T | (keyof T)[] | Partial<T> | null,
    callback: (items: T) => void,
  ): void;
  get<T = { [key: string]: unknown }>(callback: (items: T) => void): void;
  get<T = { [key: string]: unknown }>(
    keysOrCallback?: keyof T | (keyof T)[] | Partial<T> | null | ((items: T) => void),
    callback?: (items: T) => void,
  ): Promise<T> | void {
    const keys = isFunction(keysOrCallback) ? null : keysOrCallback;
    const cb = isFunction(keysOrCallback) ? keysOrCallback : callback;

    const getItems = (): T => {
      const result: Record<string, unknown> = {};

      if (keys === null) {
        // Get all items
        this.storage.forEach((value, key) => {
          result[key] = value;
        });
      } else if (isStringKey(keys)) {
        // Get single item
        result[keys] = this.storage.get(keys) ?? null;
      } else if (isStringArray(keys)) {
        // Get multiple items
        keys.forEach((key) => {
          result[key] = this.storage.get(key) ?? null;
        });
      } else if (isRecord(keys)) {
        // Get items with default values
        Object.keys(keys).forEach((key) => {
          result[key] = this.storage.has(key) ? this.storage.get(key) : keys[key as keyof T];
        });
      }

      return result as T;
    };

    if (cb) {
      cb(getItems());
      return;
    }

    return Promise.resolve(getItems());
  }

  /**
   * Set one or more items in storage
   */
  set<T = { [key: string]: unknown }>(items: Partial<T>): Promise<void>;
  set<T = { [key: string]: unknown }>(items: Partial<T>, callback: () => void): void;
  set<T = { [key: string]: unknown }>(
    items: Partial<T>,
    callback?: () => void,
  ): Promise<void> | void {
    const setItems = (): void => {
      const changes: { [key: string]: chrome.storage.StorageChange } = {};

      // Record changes and update storage
      Object.entries(items as Record<string, unknown>).forEach(([key, newValue]) => {
        const oldValue = this.storage.get(key);
        this.storage.set(key, newValue);

        changes[key] = {
          oldValue,
          newValue,
        };
      });

      // Notify listeners
      this.notifyListeners(changes);
    };

    if (callback) {
      setItems();
      callback();
      return;
    }

    return Promise.resolve(setItems());
  }

  /**
   * Remove one or more items from storage
   */
  remove<T = { [key: string]: unknown }>(keys: keyof T | (keyof T)[]): Promise<void>;
  remove<T = { [key: string]: unknown }>(keys: keyof T | (keyof T)[], callback: () => void): void;
  remove<T = { [key: string]: unknown }>(
    keys: keyof T | (keyof T)[],
    callback?: () => void,
  ): Promise<void> | void {
    const removeItems = (): void => {
      const keysToRemove = Array.isArray(keys) ? keys : [keys];
      const changes: { [key: string]: chrome.storage.StorageChange } = {};

      // Record changes and remove items
      keysToRemove.forEach((key) => {
        const keyStr = String(key);
        const oldValue = this.storage.get(keyStr);
        this.storage.delete(keyStr);

        changes[keyStr] = {
          oldValue,
          newValue: null,
        };
      });

      // Notify listeners
      this.notifyListeners(changes);
    };

    if (callback) {
      removeItems();
      callback();
      return;
    }

    return Promise.resolve(removeItems());
  }

  /**
   * Clear all items from storage
   */
  clear(): Promise<void>;
  clear(callback: () => void): void;
  clear(callback?: () => void): Promise<void> | void {
    const clearItems = (): void => {
      const changes: { [key: string]: chrome.storage.StorageChange } = {};

      // Record changes for all items
      this.storage.forEach((value, key) => {
        changes[key] = {
          oldValue: value,
          newValue: null,
        };
      });

      // Clear storage
      this.storage.clear();

      // Notify listeners
      this.notifyListeners(changes);
    };

    if (callback) {
      clearItems();
      callback();
      return;
    }

    return Promise.resolve(clearItems());
  }

  /**
   * Get the number of bytes being used by storage
   * This is an approximation since we're storing in memory
   */
  getBytesInUse<T = { [key: string]: unknown }>(
    keys?: keyof T | (keyof T)[] | null,
  ): Promise<number>;
  getBytesInUse<T = { [key: string]: unknown }>(
    keys: keyof T | (keyof T)[] | null,
    callback: (bytesInUse: number) => void,
  ): void;
  getBytesInUse(callback: (bytesInUse: number) => void): void;
  getBytesInUse<T = { [key: string]: unknown }>(
    keysOrCallback?: keyof T | (keyof T)[] | null | ((bytesInUse: number) => void),
    callback?: (bytesInUse: number) => void,
  ): Promise<number> | void {
    const keys = isFunction(keysOrCallback) ? null : keysOrCallback;
    const cb = isFunction(keysOrCallback) ? keysOrCallback : callback;

    const calculateBytes = (): number => {
      let totalBytes = 0;
      let itemsToCheck: [string, unknown][] = [];

      if (keys === null) {
        // Check all items
        itemsToCheck = Array.from(this.storage.entries());
      } else if (isStringKey(keys)) {
        // Check single item
        const value = this.storage.get(keys);
        if (value !== undefined) {
          itemsToCheck = [[keys, value]];
        }
      } else if (isStringArray(keys)) {
        // Check multiple items
        itemsToCheck = keys
          .map((key) => [key, this.storage.get(key)])
          .filter(([_, value]) => value !== undefined) as [string, unknown][];
      }

      // Calculate approximate bytes used
      itemsToCheck.forEach(([key, value]) => {
        totalBytes += key.length;
        totalBytes += JSON.stringify(value).length;
      });

      return totalBytes;
    };

    if (cb) {
      cb(calculateBytes());
      return;
    }

    return Promise.resolve(calculateBytes());
  }

  /**
   * Set the access level for the storage area
   */
  setAccessLevel(accessOptions: { accessLevel: chrome.storage.AccessLevel }): Promise<void>;
  setAccessLevel(
    accessOptions: { accessLevel: chrome.storage.AccessLevel },
    callback: () => void,
  ): void;
  setAccessLevel(
    accessOptions: { accessLevel: chrome.storage.AccessLevel },
    callback?: () => void,
  ): Promise<void> | void {
    if (callback) {
      callback();
      return;
    }

    return Promise.resolve();
  }

  /**
   * Event that fires when storage changes
   */
  onChanged = {
    addListener: (callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void) => {
      this.listeners.add(callback);
    },
    removeListener: (
      callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void,
    ) => {
      this.listeners.delete(callback);
    },
    hasListener: (callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void) => {
      return this.listeners.has(callback);
    },
    hasListeners: () => this.listeners.size > 0,
    getRules: () => Promise.resolve([]),
    removeRules: () => Promise.resolve(),
    addRules: () => Promise.resolve([]),
  };

  /**
   * Get all keys in storage
   */
  getKeys(): Promise<string[]> {
    return Promise.resolve(Array.from(this.storage.keys()));
  }

  private notifyListeners(changes: { [key: string]: chrome.storage.StorageChange }): void {
    if (Object.keys(changes).length > 0) {
      this.listeners.forEach((listener) => listener(changes));
    }
  }
}

/**
 * Create mock storage instances that can be used to replace chrome.storage
 */
export const createMockChromeStorage = () => ({
  local: new MockChromeStorage(),
  sync: new MockChromeStorage(),
  session: new MockChromeStorage(),
});
