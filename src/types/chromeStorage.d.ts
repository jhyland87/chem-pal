/** Interface for Chrome storage items with string keys and unknown values */
export interface ChromeStorageItems {
  /** Storage item key-value pairs where values are of unknown type */
  [key: string]: unknown;
}

/** Callback function type for Chrome storage operations */
export interface ChromeStorageCallback<T> {
  /** Function that receives storage items as parameter */
  (items: T): void;
}

/** Interface for Chrome storage API */
export interface ChromeStorage {
  /** Local storage area that persists between browser sessions */
  local: {
    /** Sets multiple items in local storage */
    set(items: ChromeStorageItems): Promise<void>;
    /** Retrieves one or more items from local storage */
    get(items: string | string[] | ChromeStorageItems): Promise<ChromeStorageItems>;
  };
  /** Session storage area that is cleared when browser session ends */
  session: {
    /** Sets multiple items in session storage */
    set(items: ChromeStorageItems): Promise<void>;
    /** Retrieves one or more items from session storage */
    get(items: string | string[] | ChromeStorageItems): Promise<ChromeStorageItems>;
  };
}

/** Interface for Chrome browser extension API */
export interface Chrome {
  /** Chrome storage API for managing extension data */
  storage: ChromeStorage;
  /** Chrome extension API */
  extension: unknown;
}

/** Interface for Chrome storage items with primitive type values */
export interface ChromeStorageItems {
  /** Storage item key-value pairs where values are primitive types */
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * ChromeStorageItems represents storage items supporting various primitive types
 */
export interface ChromeStorageItems {
  /** Key-value pairs where values can be primitive types */
  [key: string]: string | number | boolean | null | undefined;
}
