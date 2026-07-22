import { useEffect, useState } from 'react';

/**
 * Debounces a search-box error message so it only surfaces after the user pauses typing.
 * The message appears `delayMs` after the last change to `resetKey` (the live query text),
 * so every keystroke restarts the timer and the error never flashes mid-type. A cleared
 * error (`undefined`) hides immediately, with no lingering stale message.
 * @param error - The current error message, or `undefined` when the query is valid.
 * @param resetKey - A value that changes on every keystroke (the query text) to restart the timer.
 * @param delayMs - Idle time before the message is shown.
 * @returns The message to display, or `undefined` while typing / when valid.
 * @example
 * ```typescript
 * const hint = useDelayedError(searchError, query, 200);
 * // hint is undefined until the user stops typing for 200ms on an invalid query.
 * ```
 * @source
 */
export function useDelayedError(
  error: string | undefined,
  resetKey: string,
  delayMs: number,
): string | undefined {
  const [shown, setShown] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!error) {
      setShown(undefined);
      return;
    }
    const timer = setTimeout(() => setShown(error), delayMs);
    return () => clearTimeout(timer);
  }, [error, resetKey, delayMs]);

  return shown;
}
