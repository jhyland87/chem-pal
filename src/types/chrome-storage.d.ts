declare interface ChromeStorageItems {
  [key: string]: unknown;
}

declare interface ChromeStorageCallback<T> {
  (items: T): void;
}

declare interface ChromeStorage {
  local: {
    set(items: ChromeStorageItems): Promise<void>;
    get(items: string | string[] | ChromeStorageItems): Promise<ChromeStorageItems>;
  };
  session: {
    set(items: ChromeStorageItems): Promise<void>;
    get(items: string | string[] | ChromeStorageItems): Promise<ChromeStorageItems>;
  };
}

export type Chrome = {
  storage: ChromeStorage;
  extension: unknown;
};
/*
declare global {
  interface Window {
    chrome: Chrome;
  }
  const chrome: Chrome;
}
  */
/**
 * ChromeStorageItems represents storage items supporting various primitive types
 * @param {string|number|boolean|null|undefined} [key] - Storage items supporting various primitive types
 */
declare type ChromeStorageItems = { [key: string]: string | number | boolean | null | undefined };
