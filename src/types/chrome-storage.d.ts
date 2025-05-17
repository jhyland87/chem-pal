export interface ChromeStorageItems {
  [key: string]: unknown;
}

export interface ChromeStorageCallback<T> {
  (items: T): void;
}

export interface ChromeStorage {
  local: {
    set(items: ChromeStorageItems): Promise<void>;
    get(items: string | string[] | ChromeStorageItems): Promise<ChromeStorageItems>;
  };
  session: {
    set(items: ChromeStorageItems): Promise<void>;
    get(items: string | string[] | ChromeStorageItems): Promise<ChromeStorageItems>;
  };
}

export interface Chrome {
  storage: ChromeStorage;
}

declare global {
  interface Window {
    chrome: Chrome;
  }
  const chrome: Chrome;
}
