/**
 * @group Hotkeys
 * @groupDescription Type definitions for the modular hotkey system.
 * @source
 */

/**
 * A platform-aware key binding. Either a single string shared across platforms,
 * or an object with separate `mac` / `other` bindings.
 *
 * Supported tokens (case-insensitive, joined by `+`):
 * - `mod` - meta (⌘) on macOS, ctrl on Windows/Linux
 * - `meta` / `cmd` / `command` - meta key
 * - `ctrl` / `control` - control key
 * - `alt` / `option` - alt key
 * - `shift` - shift key
 * - The final token is the key itself (`r`, `s`, `?`, `enter`, `escape`, ...)
 * @source
 */
export type KeyBinding = string | { mac: string; other: string };

/**
 * A single hotkey entry as loaded from `config.json`. `id` is the logical
 * action name that is resolved at runtime against a handler registry.
 * @source
 */
export interface HotkeyConfig {
  /** Logical action id used to look up the runtime handler. */
  id: string;
  /** Key binding (platform-aware). */
  keys: KeyBinding;
  /** Human-readable description shown in the help modal. */
  description: string;
  /** Grouping label used to organize the help modal list. */
  group: string;
}

/**
 * Parsed representation of a key binding that can be matched against a
 * `KeyboardEvent`. Modifier flags are strict: a modifier set to `false`
 * must NOT be pressed (so `ctrl+s` does not also fire `ctrl+shift+s`).
 * @source
 */
export interface ParsedBinding {
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

/**
 * Map of hotkey action id -> handler function. Used by `useHotkeys`.
 * A handler may return a promise; errors are logged but not thrown.
 * @source
 */
export type HotkeyHandlers = Record<string, () => void | Promise<void>>;
