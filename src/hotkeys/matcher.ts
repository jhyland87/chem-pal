import type { KeyBinding, ParsedBinding } from "./types";

/**
 * Detects whether the current platform is macOS. Used to expand the `mod`
 * token and to select the `mac` branch of a platform-aware `KeyBinding`.
 * Falls back to `navigator.platform` for broad compatibility; the newer
 * `userAgentData` API is preferred when available.
 * @returns `true` on macOS, `false` otherwise.
 * @example
 * ```ts
 * isMac(); // true on macOS
 * ```
 * @source
 */
export function isMac(): boolean {
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData;
  if (uaData?.platform) return /mac/i.test(uaData.platform);
  return /mac/i.test(navigator.platform);
}

/**
 * Resolves a platform-aware `KeyBinding` down to a single string for the
 * current platform. Pass-through when already a string.
 * @param binding - Shared binding string, or a `{ mac, other }` object.
 * @returns The platform-specific binding string.
 * @example
 * ```ts
 * resolveBinding("mod+s");                       // => "mod+s"
 * resolveBinding({ mac: "meta+s", other: "ctrl+shift+s" }); // => "meta+s" on macOS
 * ```
 * @source
 */
export function resolveBinding(binding: KeyBinding): string {
  if (typeof binding === "string") return binding;
  return isMac() ? binding.mac : binding.other;
}

type ModifierFlag = "meta" | "ctrl" | "alt" | "shift";

const MOD_ALIASES: Record<string, ModifierFlag> = {
  meta: "meta",
  cmd: "meta",
  command: "meta",
  ctrl: "ctrl",
  control: "ctrl",
  alt: "alt",
  option: "alt",
  shift: "shift",
};

/**
 * Parses a key-binding string such as `"mod+shift+r"` into a `ParsedBinding`.
 * The final `+`-separated token is treated as the key; earlier tokens are
 * modifiers. The `mod` token expands to `meta` on macOS and `ctrl` elsewhere.
 * @param binding - The key-binding string. Tokens are case-insensitive.
 * @returns The parsed binding, ready for matching against a `KeyboardEvent`.
 * @example
 * ```ts
 * parseBinding("mod+shift+r");
 * // => on macOS: { meta: true, ctrl: false, alt: false, shift: true, key: "r" }
 * // => on other: { meta: false, ctrl: true,  alt: false, shift: true, key: "r" }
 * ```
 * @source
 */
export function parseBinding(binding: string): ParsedBinding {
  const tokens = binding
    .split("+")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const parsed: ParsedBinding = {
    meta: false,
    ctrl: false,
    alt: false,
    shift: false,
    key: "",
  };

  const mac = isMac();
  const last = tokens.pop() ?? "";

  for (const token of tokens) {
    if (token === "mod") {
      if (mac) parsed.meta = true;
      else parsed.ctrl = true;
      continue;
    }
    const flag = MOD_ALIASES[token];
    if (flag) parsed[flag] = true;
  }

  parsed.key = last;
  return parsed;
}

/**
 * Checks whether a `KeyboardEvent` matches a `ParsedBinding`. Matching is
 * strict on modifiers — any modifier that is not required in the binding
 * must not be held down, so `ctrl+s` will not also fire for `ctrl+shift+s`.
 * Key comparison is case-insensitive via `event.key`.
 * @param event - The incoming keyboard event.
 * @param binding - Parsed binding returned from {@link parseBinding}.
 * @returns `true` if the event matches the binding.
 * @example
 * ```ts
 * const b = parseBinding("mod+shift+r");
 * matches(event, b); // true when ⌘⇧R (mac) or Ctrl+Shift+R (other)
 * ```
 * @source
 */
export function matches(event: KeyboardEvent, binding: ParsedBinding): boolean {
  if (event.metaKey !== binding.meta) return false;
  if (event.ctrlKey !== binding.ctrl) return false;
  if (event.altKey !== binding.alt) return false;
  // `?` is produced by Shift+/ — event.key is already "?", so don't require shift
  // separately. For other keys, enforce the shift flag strictly.
  if (binding.key !== "?" && event.shiftKey !== binding.shift) return false;
  return event.key.toLowerCase() === binding.key.toLowerCase();
}

/**
 * Formats a key-binding string into a human-readable label for display in
 * the help modal. Uses platform-appropriate symbols (⌘ ⌥ ⌃ ⇧) on macOS
 * and spelled-out names (Ctrl, Alt, Shift) elsewhere.
 * @param binding - The key-binding source (same shape as in config).
 * @returns A pretty label such as `"⌘⇧R"` or `"Ctrl+Shift+R"`.
 * @example
 * ```ts
 * formatBinding("mod+shift+r"); // "⌘⇧R" on macOS, "Ctrl+Shift+R" on other
 * formatBinding("shift+?");      // "⇧?" on macOS, "Shift+?" on other
 * ```
 * @source
 */
export function formatBinding(binding: KeyBinding): string {
  const mac = isMac();
  const resolved = resolveBinding(binding);
  const tokens = resolved.split("+").map((t) => t.trim().toLowerCase());
  const last = tokens.pop() ?? "";

  const symbols: Record<string, string> = mac
    ? { mod: "⌘", meta: "⌘", cmd: "⌘", command: "⌘", ctrl: "⌃", control: "⌃", alt: "⌥", option: "⌥", shift: "⇧" }
    : { mod: "Ctrl", meta: "Meta", cmd: "Cmd", command: "Cmd", ctrl: "Ctrl", control: "Ctrl", alt: "Alt", option: "Alt", shift: "Shift" };

  const parts = tokens.map((t) => symbols[t] ?? t);
  const keyLabel = last.length === 1 ? last.toUpperCase() : last.charAt(0).toUpperCase() + last.slice(1);
  parts.push(keyLabel);
  return mac ? parts.join("") : parts.join("+");
}
