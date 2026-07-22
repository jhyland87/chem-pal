import { hotkeys as hotkeysConfig, sequenceResetMs } from '@/../config.json';
import { useEffect, useMemo, useRef } from 'react';
import { matches, normalizeKey, parseBinding, parseSequence, resolveBinding } from './matcher';
import type { HotkeyConfig, HotkeyHandlers, ParsedBinding } from './types';

/**
 * Idle window (ms) after which an in-progress key sequence is abandoned.
 * Pressing the next key of a sequence more than this long after the previous
 * one resets the buffer, so a stale partial press can't complete a sequence
 * later. Sourced from `config.json` (`sequenceResetMs`).
 */
const SEQUENCE_RESET_MS = sequenceResetMs;

/** Keys that are modifiers on their own; excluded from the sequence buffer. */
const MODIFIER_KEYS = new Set(['meta', 'control', 'alt', 'shift']);

/**
 * Returns `true` when the event originated from an editable element
 * (input, textarea, select, or a contentEditable host). Hotkeys are
 * suppressed in these cases so typing is not hijacked.
 */
function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

interface CompiledChord {
  config: HotkeyConfig;
  binding: ParsedBinding;
}

interface CompiledSequence {
  config: HotkeyConfig;
  sequence: string[];
}

interface CompiledHotkeys {
  chords: CompiledChord[];
  sequences: CompiledSequence[];
}

function compile(configs: HotkeyConfig[]): CompiledHotkeys {
  const chords: CompiledChord[] = [];
  const sequences: CompiledSequence[] = [];
  for (const config of configs) {
    if (config.sequential) {
      sequences.push({ config, sequence: parseSequence(resolveBinding(config.keys)) });
    } else {
      chords.push({ config, binding: parseBinding(resolveBinding(config.keys)) });
    }
  }
  return { chords, sequences };
}

/**
 * Options accepted by {@link useHotkeys}. All fields optional.
 * @source
 */
export interface UseHotkeysOptions {
  /**
   * Called after a hotkey's handler is invoked, with the matched config.
   * Typical use: flash a status-bar confirmation when `config.flash` is set.
   */
  onTriggered?: (config: HotkeyConfig) => void;
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
 * @param handlers - Map of hotkey action id → handler.
 * @param options - Optional hooks, e.g. `onTriggered` for status-bar feedback.
 * @example
 * ```ts
 * useHotkeys(
 *   { showHotkeyHelp: () => setHelpOpen(true) },
 *   { onTriggered: (cfg) => cfg.flash && flashStatusText(cfg.flash) },
 * );
 * ```
 * @source
 */
/**
 * Invokes a matched hotkey's handler (when one is registered) and notifies
 * `onTriggered`. A hotkey with only a `flash` and no handler still notifies,
 * so a flash-only shortcut shows its status message. `onTriggered` is skipped
 * when the handler throws, so a failed action doesn't flash a confirmation.
 */
function invokeHandler(
  config: HotkeyConfig,
  handlers: HotkeyHandlers,
  onTriggered?: (config: HotkeyConfig) => void,
): void {
  const handler = handlers[config.id];
  if (handler) {
    try {
      const result = handler();
      if (result instanceof Promise) {
        result.catch((error) => {
          console.error(`Hotkey handler "${config.id}" failed`, { error });
        });
      }
    } catch (error) {
      console.error(`Hotkey handler "${config.id}" threw`, { error });
      return;
    }
  }
  onTriggered?.(config);
}

/**
 * A hotkey does something worth firing for if it has a registered handler or a
 * `flash` message (flash-only shortcuts). Hotkeys with neither are skipped so
 * their key combo isn't swallowed for no effect.
 */
function isActionable(config: HotkeyConfig, handlers: HotkeyHandlers): boolean {
  return Boolean(handlers[config.id]) || Boolean(config.flash);
}

export function useHotkeys(handlers: HotkeyHandlers, options: UseHotkeysOptions = {}): void {
  // Trusted static config: JSON import infers literal types that don't widen to
  // HotkeyConfig[]; shape is validated by config.json's authored structure.
  const compiled = useMemo(() => compile(hotkeysConfig as HotkeyConfig[]), []);
  const { onTriggered } = options;

  // Rolling buffer of recently pressed keys, for matching sequential hotkeys.
  const sequenceBuffer = useRef<string[]>([]);
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    const { chords, sequences } = compiled;
    const maxSequenceLength = sequences.reduce((max, s) => Math.max(max, s.sequence.length), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event)) return;

      // Chord hotkeys: single-event modifier combos matched strictly.
      for (const { config, binding } of chords) {
        if (!matches(event, binding)) continue;
        if (!isActionable(config, handlers)) continue;
        event.preventDefault();
        event.stopPropagation();
        invokeHandler(config, handlers, onTriggered);
        return;
      }

      // Sequential hotkeys: keys pressed one after another (e.g. konami code).
      if (sequences.length === 0) return;
      const key = normalizeKey(event.key);
      if (MODIFIER_KEYS.has(key)) return; // ignore lone modifier presses

      const now = Date.now();
      if (now - lastKeyTime.current > SEQUENCE_RESET_MS) {
        sequenceBuffer.current = [];
      }
      lastKeyTime.current = now;

      sequenceBuffer.current.push(key);
      if (sequenceBuffer.current.length > maxSequenceLength) {
        sequenceBuffer.current = sequenceBuffer.current.slice(-maxSequenceLength);
      }

      for (const { config, sequence } of sequences) {
        if (!isActionable(config, handlers)) continue;
        const tail = sequenceBuffer.current.slice(-sequence.length);
        if (tail.length !== sequence.length) continue;
        if (!tail.every((k, i) => k === sequence[i])) continue;
        event.preventDefault();
        event.stopPropagation();
        invokeHandler(config, handlers, onTriggered);
        sequenceBuffer.current = [];
        return;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [compiled, handlers, onTriggered]);
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
  // Trusted static config: JSON import infers literal types that don't widen to
  // HotkeyConfig[]; shape is validated by config.json's authored structure.
  return hotkeysConfig as HotkeyConfig[];
}
