import { useCallback, useEffect, useState } from 'react';

/**
 * The current index plus manual navigation controls returned by
 * {@link useCyclingIndex}.
 * @source
 */
interface CyclingIndex {
  /** The current index, always within `[0, count)`. */
  index: number;
  /** Advances to the next index, wrapping around, and restarts the auto-timer. */
  next: () => void;
  /** Steps to the previous index, wrapping around, and restarts the auto-timer. */
  prev: () => void;
}

/**
 * Cycles an index from `0` to `count - 1`, advancing every `intervalMs` and
 * wrapping back to `0`. Also exposes `next`/`prev` for manual navigation, each of
 * which restarts the auto-advance timer so a manual step isn't immediately
 * followed by an automatic one. Holds at `0` (and starts no timer) when `count`
 * is `1` or less. Resets to `0` whenever `count` changes, so the index always
 * stays in range. Automatically clears its timer on unmount.
 * @param count - The number of items to cycle through.
 * @param intervalMs - The delay between automatic advances, in milliseconds.
 * @returns The current index and manual `next`/`prev` controls.
 * @example
 * ```ts
 * const { index, next, prev } = useCyclingIndex(images.length, 3000);
 * // index advances 0 → 1 → 2 → 0 … every 3s; next()/prev() step manually.
 * ```
 * @source
 */
export function useCyclingIndex(count: number, intervalMs: number): CyclingIndex {
  const [index, setIndex] = useState(0);
  // Bumping this restarts the auto-advance effect after a manual step.
  const [restart, setRestart] = useState(0);

  // Keep the index in range as the item count changes (e.g. an image drops out).
  useEffect(() => {
    setIndex(0);
  }, [count]);

  useEffect(() => {
    if (count <= 1) {
      return;
    }
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [count, intervalMs, restart]);

  const next = useCallback(() => {
    if (count <= 1) return;
    setIndex((current) => (current + 1) % count);
    setRestart((token) => token + 1);
  }, [count]);

  const prev = useCallback(() => {
    if (count <= 1) return;
    setIndex((current) => (current - 1 + count) % count);
    setRestart((token) => token + 1);
  }, [count]);

  return { index: count <= 1 ? 0 : index, next, prev };
}
