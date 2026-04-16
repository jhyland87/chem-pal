import { useStorageCompression } from "@/../config.json";
import Logger from "@/utils/Logger";
import { compressToUTF16, decompressFromUTF16 } from "lz-string";

/**
 * Transparent lz-string compression layer for chrome.storage.
 *
 * @remarks
 * Wraps `chrome.storage.local` and `chrome.storage.session` so that values written
 * are LZ-compressed (UTF-16) before being stored, and decompressed automatically on
 * read. Pre-existing uncompressed values are passed through unchanged on read so the
 * wrapper is fully backward-compatible with data already in users' browsers.
 *
 * The module is split into two layers:
 * - **Pure codec** ({@link encodeValue}, {@link decodeValue}, {@link encodeItems},
 *   {@link decodeItems}, {@link decodeChanges}): no `chrome.*` access; directly
 *   unit-testable.
 * - **Adapter** ({@link cstorage}): a thin shim that delegates to the codec and
 *   talks to `chrome.storage`.
 * @category Utils
 * @source
 */

const logger = new Logger("storage");

/** Wire-format version. Bumped if the envelope shape ever changes. */
export const LZ_VERSION = 1 as const;

/**
 * Envelope wrapping a compressed JSON payload.
 * Detected on read via {@link isLzEnvelope}.
 */
export interface LzEnvelope {
  __lz: typeof LZ_VERSION;
  d: string;
}

/**
 * Type-guard: returns `true` if `value` is an {@link LzEnvelope}.
 * @param value - Arbitrary value pulled from chrome.storage.
 */
export function isLzEnvelope(value: unknown): value is LzEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { __lz?: unknown }).__lz === LZ_VERSION &&
    typeof (value as { d?: unknown }).d === "string"
  );
}

/**
 * JSON-stringifies and LZ-compresses a value, returning an {@link LzEnvelope}.
 * When `useStorageCompression` is `false` in config.json, the value is stored
 * as-is (no compression). If serialization fails (e.g. circular structures)
 * the original value is returned untouched and an error is logged.
 * @param value - Any JSON-serializable value.
 */
export function encodeValue(value: unknown): LzEnvelope | unknown {
  if (!useStorageCompression) return value;
  try {
    const json = JSON.stringify(value);
    if (json === undefined) {
      // value was undefined or a function — store as-is
      return value;
    }
    return { __lz: LZ_VERSION, d: compressToUTF16(json) };
  } catch (error) {
    logger.error("Failed to encode value, storing raw", { error });
    return value;
  }
}

/**
 * Decodes a value read from chrome.storage. If the value is an
 * {@link LzEnvelope}, it is decompressed and JSON-parsed; otherwise the value
 * is returned unchanged (backward-compatible passthrough for legacy data).
 * @param value - Raw value read from chrome.storage.
 */
export function decodeValue(value: unknown): unknown {
  if (!isLzEnvelope(value)) {
    return value;
  }
  try {
    const json = decompressFromUTF16(value.d);
    if (json === null || json === "") {
      logger.error("Failed to decompress envelope, returning raw", { d: value.d });
      return value;
    }
    return JSON.parse(json);
  } catch (error) {
    logger.error("Failed to decode envelope, returning raw", { error });
    return value;
  }
}

/**
 * Encodes every value of an items map for `chrome.storage.X.set`.
 * @param items - Record of key/value pairs to write.
 */
export function encodeItems(items: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(items)) {
    out[key] = encodeValue(value);
  }
  return out;
}

/**
 * Decodes every value of an items map returned from `chrome.storage.X.get`.
 * Tolerates mixed compressed and legacy entries (used by full-scan reads
 * such as `chrome.storage.local.get(null)`).
 * @param items - Record returned from chrome.storage.
 */
export function decodeItems(items: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(items)) {
    out[key] = decodeValue(value);
  }
  return out;
}

/**
 * Decodes the `oldValue` / `newValue` of every change in a
 * `chrome.storage.onChanged` payload.
 * @param changes - Raw changes object from chrome.storage.onChanged.
 */
export function decodeChanges(
  changes: Record<string, chrome.storage.StorageChange>,
): Record<string, chrome.storage.StorageChange> {
  const out: Record<string, chrome.storage.StorageChange> = {};
  for (const [key, change] of Object.entries(changes)) {
    const decoded: chrome.storage.StorageChange = {};
    if ("oldValue" in change) decoded.oldValue = decodeValue(change.oldValue);
    if ("newValue" in change) decoded.newValue = decodeValue(change.newValue);
    out[key] = decoded;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*                         Adapter (Layer B)                                  */
/* -------------------------------------------------------------------------- */

type StorageAreaKeys = string | string[] | Record<string, unknown> | null;

/**
 * Builds a per-area storage facade (`local` / `session`) that mirrors the
 * native `chrome.storage.StorageArea` shape but transparently compresses on
 * write and decompresses on read.
 * @param area - "local" or "session".
 */
function makeArea(area: "local" | "session") {
  return {
    // Return type intentionally permissive ({ [key: string]: any }) to mirror
    // the native `chrome.storage.StorageArea.get` shape, so existing call
    // sites that index into the result continue to type-check unchanged.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async get(keys?: StorageAreaKeys): Promise<{ [key: string]: any }> {
      const raw = await chrome.storage[area].get(keys ?? null);
      return decodeItems(raw);
    },
    async set(items: Record<string, unknown>): Promise<void> {
      await chrome.storage[area].set(encodeItems(items));
    },
    async remove(keys: string | string[]): Promise<void> {
      await chrome.storage[area].remove(keys);
    },
    async clear(): Promise<void> {
      await chrome.storage[area].clear();
    },
  };
}

/**
 * Listener registered by callers of {@link cstorage.onChanged.addListener}.
 */
export type ChangedListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: chrome.storage.AreaName,
) => void;

/**
 * Inner listener registered with `chrome.storage.onChanged`.
 */
type InnerChangedListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: chrome.storage.AreaName,
) => void;

const listenerMap = new WeakMap<ChangedListener, InnerChangedListener>();

/**
 * Compression-aware wrapper around `chrome.storage`. Use exactly like
 * `chrome.storage.local` / `chrome.storage.session`, but values are
 * transparently LZ-compressed at rest.
 *
 * @example
 * ```ts
 * await cstorage.local.set({ USER_SETTINGS: settings });
 * const { USER_SETTINGS } = await cstorage.local.get<{ USER_SETTINGS: UserSettings }>("USER_SETTINGS");
 * ```
 */
export const cstorage = {
  local: makeArea("local"),
  session: makeArea("session"),
  onChanged: {
    /**
     * Registers a listener that receives change events with `oldValue` /
     * `newValue` already decompressed.
     */
    addListener(listener: ChangedListener): void {
      const inner: InnerChangedListener = (changes, areaName) => {
        listener(decodeChanges(changes), areaName);
      };
      listenerMap.set(listener, inner);
      chrome.storage.onChanged.addListener(inner);
    },
    /** Removes a listener previously added via {@link addListener}. */
    removeListener(listener: ChangedListener): void {
      const inner = listenerMap.get(listener);
      if (inner) {
        chrome.storage.onChanged.removeListener(inner);
        listenerMap.delete(listener);
      }
    },
  },
};

export default cstorage;

/* -------------------------------------------------------------------------- */
/*                  Console debug utility (_decodeCache)                      */
/* -------------------------------------------------------------------------- */

/**
 * Reads and decodes a compressed value from chrome.storage, logging the
 * result to the console. Registered as `window._decodeCache` for quick
 * inspection during development.
 *
 * @example
 * ```js
 * // From the browser console:
 * _decodeCache('table_state')
 * _decodeCache('search_results', 'local')
 * ```
 * @param key - The storage key to look up (e.g. `'table_state'`).
 * @param area - `'session'` (default) or `'local'`.
 * @returns The decoded value (also logged to the console).
 */
async function decodeCache(key: string, area: "session" | "local" = "session"): Promise<unknown> {
  try {
    const data = await cstorage[area].get([key]);
    const value = data[key];
    //console.log(`%c_decodeCache("${key}", "${area}"):`, "color: #4fc3f7; font-weight: bold", value);
    return value;
  } catch (error) {
    console.error(`Failed to decode cache key "${key}" from ${area}:`, error);
    return undefined;
  }
}

// Register the global so it's callable from the browser console.
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any)._decodeCache = decodeCache;
}
