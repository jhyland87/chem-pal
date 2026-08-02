import { CACHE } from '@/constants/common';
import { cstorage } from '@/utils/storage';

/**
 * A persistent, bounded ring buffer of the most recent runtime exceptions,
 * shared across the popup, options page, and service worker via
 * `chrome.storage.session`. It feeds the "recent exceptions" section of a bug
 * report when the user opens one without a specific error in hand.
 *
 * Session-scoped on purpose: entries survive a service-worker restart but are
 * dropped when the browser closes, so nothing lingers on disk.
 *
 * @module errorBuffer
 * @category Helpers
 * @source
 */

/**
 * Where a captured error originated: a global window/worker hook, an unhandled
 * promise rejection, React's error hooks, or an aggregated supplier-search failure.
 * @category Helpers
 * @group Bug reporting
 */
export type ErrorSource = 'window' | 'unhandledrejection' | 'react' | 'search';

/**
 * A single captured exception, trimmed to what a bug report needs.
 * @category Helpers
 * @group Bug reporting
 */
export interface CapturedError {
  /** Capture time, epoch milliseconds. */
  ts: number;
  /** Which global hook (or React) surfaced the error. */
  source: ErrorSource;
  /** The error message. */
  message: string;
  /** The stack trace, already truncated. */
  stack?: string;
}

/** Maximum number of exceptions retained; older entries are discarded. */
const MAX_ERRORS = 20;

/** `chrome.storage.session` key holding the serialized ring buffer. */
const STORAGE_KEY = CACHE.ERROR_RING_BUFFER;

/** Cap on a single stored stack trace, so one huge trace can't dominate. */
const STACK_LIMIT = 1500;

/** Serializes concurrent writes so a read-modify-write can't lose entries. */
let writeChain: Promise<void> = Promise.resolve();

/** Guards {@link installErrorCapture} against double-registration. */
let captureInstalled = false;

/**
 * Truncates a string to `limit` characters, appending an ellipsis marker when cut.
 * @param text - The text to bound.
 * @param limit - Maximum length to keep.
 * @returns The original text, or a truncated copy with a marker.
 * @example
 * ```ts
 * truncate("abcdef", 3); // => "abc…"
 * ```
 * @source
 */
function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

/**
 * Renders an `Error` together with its `cause` chain (ES2022) into a single
 * stack string, so a wrapped error's root cause isn't lost. Non-`Error` causes
 * are stringified; the walk is depth-limited to guard against cyclic or
 * pathologically deep chains.
 * @param error - The error to render.
 * @returns The stack (or `name: message`) plus each `Caused by:` link.
 * @example
 * ```ts
 * formatErrorChain(new Error("outer", { cause: new Error("inner") }));
 * // => "Error: outer\n…\nCaused by: Error: inner\n…"
 * ```
 * @source
 */
export function formatErrorChain(error: Error): string {
  return renderErrorChain(error, 0);
}

/** Indents every line of `text` by two spaces (for nested error rendering). */
function indentLines(text: string): string {
  return text.replace(/\n/g, '\n  ');
}

/**
 * Recursive worker for {@link formatErrorChain}: renders an error's stack, then
 * its aggregated sub-errors (`AggregateError.errors`) and its `cause`, each
 * indented and depth-limited to guard against cyclic or very deep chains.
 * @param error - The error to render.
 * @param depth - Current recursion depth.
 * @returns The rendered stack plus nested sub-errors and causes.
 * @source
 */
function renderErrorChain(error: Error, depth: number): string {
  const parts = [error.stack ?? `${error.name}: ${error.message}`];
  if (depth >= 5) return parts.join('\n');

  if (error instanceof AggregateError && Array.isArray(error.errors)) {
    error.errors.forEach((sub: unknown, index) => {
      const rendered = sub instanceof Error ? renderErrorChain(sub, depth + 1) : String(sub);
      parts.push(indentLines(`[${index}] ${rendered}`));
    });
  }

  const cause: unknown = Reflect.get(error, 'cause');
  if (cause instanceof Error) {
    parts.push(`Caused by: ${renderErrorChain(cause, depth + 1)}`);
  } else if (cause != null) {
    parts.push(`Caused by: ${String(cause)}`);
  }
  return parts.join('\n');
}

/**
 * Normalizes an arbitrary thrown value (or rejection reason) into a
 * `{ message, stack }` pair, folding any `cause` chain into the stack. Non-`Error`
 * values are coerced to a string message.
 * @param reason - The thrown value or rejection reason.
 * @returns The extracted message and truncated stack.
 * @example
 * ```ts
 * describeError(new Error("boom")); // => { message: "boom", stack: "Error: boom\n…" }
 * describeError("nope");            // => { message: "nope" }
 * ```
 * @source
 */
function describeError(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) {
    return {
      message: reason.message,
      stack: truncate(formatErrorChain(reason), STACK_LIMIT),
    };
  }
  return { message: String(reason) };
}

/**
 * Reads the current ring buffer from session storage, tolerating a missing or
 * malformed value by returning an empty list.
 * @returns The stored exceptions, oldest first.
 * @example
 * ```ts
 * const errors = await getRecentErrors();
 * errors.length; // 0..MAX_ERRORS
 * ```
 * @source
 */
export async function getRecentErrors(): Promise<CapturedError[]> {
  try {
    const stored = await cstorage.session.get(STORAGE_KEY);
    const value: unknown = stored[STORAGE_KEY];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * Appends one exception to the ring buffer, trimming to the most recent
 * `MAX_ERRORS`. Never throws — a failure to record must not cascade into
 * the code path that raised the original error. Writes are serialized so
 * concurrent captures don't clobber each other.
 * @param entry - The exception to record, minus its timestamp.
 * @returns A promise that resolves once the write settles.
 * @example
 * ```ts
 * await recordError({ source: "react", message: "render failed" });
 * ```
 * @source
 */
export async function recordError(entry: Omit<CapturedError, 'ts'>): Promise<void> {
  writeChain = writeChain.then(async () => {
    try {
      const current = await getRecentErrors();
      const next = [...current, { ...entry, ts: Date.now() }].slice(-MAX_ERRORS);
      await cstorage.session.set({ [STORAGE_KEY]: next });
    } catch {
      // Best-effort: a diagnostic buffer must never surface its own failures.
    }
  });
  return writeChain;
}

/**
 * Records an arbitrary thrown value into the ring buffer, folding its `cause`
 * chain (and any `AggregateError` sub-errors) into the stored stack. Convenience
 * over {@link recordError} for callers that hold the raw error.
 * @param reason - The thrown value or rejection reason.
 * @param source - Where the error originated.
 * @returns A promise that resolves once the write settles.
 * @example
 * ```ts
 * await recordException(new AggregateError(errs, "search failed"), "search");
 * ```
 * @source
 */
export async function recordException(reason: unknown, source: ErrorSource): Promise<void> {
  return recordError({ source, ...describeError(reason) });
}

/**
 * Registers global `error` and `unhandledrejection` listeners that push captured
 * exceptions into the ring buffer. Idempotent, and safe in both window and
 * service-worker contexts (both expose `self` with `addEventListener`).
 * @returns Nothing.
 * @example
 * ```ts
 * installErrorCapture(); // call once per context, before the app runs
 * ```
 * @source
 */
export function installErrorCapture(): void {
  if (captureInstalled) return;
  if (typeof self === 'undefined' || typeof self.addEventListener !== 'function') return;
  captureInstalled = true;

  self.addEventListener('error', (event: ErrorEvent) => {
    const described = event.error ? describeError(event.error) : { message: event.message };
    void recordError({ source: 'window', ...described });
  });

  self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    void recordError({ source: 'unhandledrejection', ...describeError(event.reason) });
  });
}
