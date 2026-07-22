import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedCallback } from '../useDebouncedCallback.hook';

describe('useDebouncedCallback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not invoke the callback until the delay elapses', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 200));

    act(() => result.current());
    expect(callback).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(199));
    expect(callback).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('forwards the latest arguments to the trailing call', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 200));

    act(() => result.current('a', 1));
    act(() => vi.advanceTimersByTime(200));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('a', 1);
  });

  it('collapses rapid calls into a single trailing invocation', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 200));

    act(() => {
      result.current('first');
      vi.advanceTimersByTime(100);
      result.current('second');
      vi.advanceTimersByTime(100);
      result.current('third');
    });
    // Only the last call's timer should still be pending.
    expect(callback).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(200));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('third');
  });

  it('always uses the most recent callback reference', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useDebouncedCallback(cb, 200), {
      initialProps: { cb: first },
    });

    act(() => result.current());
    rerender({ cb: second });
    act(() => vi.advanceTimersByTime(200));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('clears any pending timer on unmount so the callback never fires', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 200));

    act(() => result.current());
    unmount();
    act(() => vi.advanceTimersByTime(500));

    expect(callback).not.toHaveBeenCalled();
  });
});
