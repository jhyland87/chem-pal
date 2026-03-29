import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a debounced version of the provided callback.
 * The callback will only execute after `delay` ms of inactivity.
 * Automatically cleans up pending timers on unmount.
 * @param callback - The function to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns A debounced version of the callback with the same signature
 * @source
 */
export function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  callbackRef.current = callback;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  );
}
