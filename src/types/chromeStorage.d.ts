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

export interface Chrome {
  storage: ChromeStorage;
  extension: unknown;
}
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
 * @param- Storage items supporting various primitive types
 */
export interface ChromeStorageItems {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * ChromeStorageItems represents storage items supporting various primitive types
 */
export interface ChromeStorageItems {
  /** Key-value pairs where values can be primitive types */
  [key: string]: string | number | boolean | null | undefined;
}
