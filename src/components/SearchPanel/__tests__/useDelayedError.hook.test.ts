import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDelayedError } from "../useDelayedError.hook";

describe("useDelayedError", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("surfaces the message only after the delay elapses", () => {
    const { result } = renderHook(() => useDelayedError("bad query", "a", 200));
    expect(result.current).toBeUndefined();
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("bad query");
  });

  it("restarts the timer on each keystroke (resetKey change)", () => {
    const { result, rerender } = renderHook(({ key }) => useDelayedError("bad query", key, 200), {
      initialProps: { key: "a" },
    });
    act(() => vi.advanceTimersByTime(150));
    rerender({ key: "ab" }); // "kept typing" before the timer fired
    act(() => vi.advanceTimersByTime(150));
    expect(result.current).toBeUndefined(); // still within a fresh 200ms window
    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe("bad query");
  });

  it("hides immediately when the error clears", () => {
    const { result, rerender } = renderHook(
      ({ error }: { error: string | undefined }) => useDelayedError(error, "a", 200),
      { initialProps: { error: "bad query" as string | undefined } },
    );
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("bad query");
    rerender({ error: undefined });
    expect(result.current).toBeUndefined();
  });
});
