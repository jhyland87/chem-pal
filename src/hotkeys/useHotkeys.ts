import { hotkeys as hotkeysConfig } from "@/../config.json";
import { useEffect, useMemo } from "react";
import { matches, parseBinding, resolveBinding } from "./matcher";
import type { HotkeyConfig, HotkeyHandlers, ParsedBinding } from "./types";

/**
 * Returns `true` when the event originated from an editable element
 * (input, textarea, select, or a contentEditable host). Hotkeys are
 * suppressed in these cases so typing is not hijacked.
 */
function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

interface CompiledHotkey {
  config: HotkeyConfig;
  binding: ParsedBinding;
}

function compile(configs: HotkeyConfig[]): CompiledHotkey[] {
  return configs.map((config) => ({
    config,
    binding: parseBinding(resolveBinding(config.keys)),
  }));
}

/**
 * Installs a single global `keydown` listener on `document` that dispatches
 * to the supplied handler map based on the application's hotkey config.
 *
 * The hook is intentionally generic: it has no knowledge of the concrete
 * actions. Callers pass a `handlers` map keyed by the `id` field from
 * `config.json`, and the hook takes care of:
 * - Skipping events originating from inputs / textareas / contentEditable hosts
 * - Matching modifier combos strictly (so `ctrl+s` won't fire on `ctrl+shift+s`)
 * - Calling `preventDefault` + `stopPropagation` when a binding fires
 * - Awaiting async handlers and logging any errors
 * @param handlers - Map of hotkey action id -> handler.
 * @example
 * ```ts
 * useHotkeys({
 *   showHotkeyHelp: () => setHelpOpen(true),
 *   goToSearch: () => setPanel(PANEL.SEARCH_HOME),
 * });
 * ```
 * @source
 */
export function useHotkeys(handlers: HotkeyHandlers): void {
  const compiled = useMemo(() => compile(hotkeysConfig as HotkeyConfig[]), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event)) return;

      for (const { config, binding } of compiled) {
        if (!matches(event, binding)) continue;
        const handler = handlers[config.id];
        if (!handler) continue;

        event.preventDefault();
        event.stopPropagation();

        try {
          const result = handler();
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error(`Hotkey handler "${config.id}" failed`, { error });
            });
          }
        } catch (error) {
          console.error(`Hotkey handler "${config.id}" threw`, { error });
        }
        return;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [compiled, handlers]);
}

/**
 * Returns the raw list of hotkey configs loaded from `config.json`. Useful
 * for the help modal or any UI that needs to enumerate the bindings.
 * @returns Array of hotkey configs, in declaration order.
 * @example
 * ```ts
 * const hotkeys = getHotkeyConfigs();
 * hotkeys.forEach((h) => console.log(h.id, h.description));
 * ```
 * @source
 */
export function getHotkeyConfigs(): HotkeyConfig[] {
  return hotkeysConfig as HotkeyConfig[];
}
