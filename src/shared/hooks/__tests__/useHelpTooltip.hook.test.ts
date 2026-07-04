import { AppContext } from "@/context";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHelpTooltip } from "../useHelpTooltip.hook";

function createWrapper(showHelp: boolean | undefined) {
  const value = {
    userSettings: { showHelp },
    setUserSettings: vi.fn(),
    searchResults: [],
    setSearchResults: vi.fn(),
    setDrawerTab: vi.fn(),
    toggleDrawer: vi.fn(),
    setSelectedSuppliers: vi.fn(),
    pendingSearchQuery: null,
    setPendingSearchQuery: vi.fn(),
    searchFilters: {},
    setSearchFilters: vi.fn(),
    setBookmarksFolderId: vi.fn(),
  } as unknown as AppContextProps;

  return ({ children }: { children: ReactNode }) =>
    createElement(AppContext.Provider, { value }, children);
}

describe("useHelpTooltip", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts hidden", () => {
    const { result } = renderHook(() => useHelpTooltip(), {
      wrapper: createWrapper(true),
    });
    expect(result.current.showHelp).toBe(false);
  });

  it("shows after the delay and hides again after the duration", async () => {
    const { result } = renderHook(() => useHelpTooltip(500, 2000), {
      wrapper: createWrapper(true),
    });

    // After the show delay elapses, the tooltip becomes visible.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.showHelp).toBe(true);

    // Once the duration elapses, it hides itself.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000 - 500);
    });
    expect(result.current.showHelp).toBe(false);
  });

  it("never shows when showHelp setting is false", async () => {
    const { result } = renderHook(() => useHelpTooltip(500, 2000), {
      wrapper: createWrapper(false),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.showHelp).toBe(false);
  });

  it("handleTooltipOpen and handleTooltipClose toggle visibility", () => {
    const { result } = renderHook(() => useHelpTooltip(), {
      wrapper: createWrapper(false),
    });

    act(() => result.current.handleTooltipOpen());
    expect(result.current.showHelp).toBe(true);

    act(() => result.current.handleTooltipClose());
    expect(result.current.showHelp).toBe(false);
  });

  it("exposes setShowHelp for direct state control", () => {
    const { result } = renderHook(() => useHelpTooltip(), {
      wrapper: createWrapper(false),
    });

    act(() => result.current.setShowHelp(true));
    expect(result.current.showHelp).toBe(true);
  });

  it("uses default delay and duration when none provided", async () => {
    const { result } = renderHook(() => useHelpTooltip(), {
      wrapper: createWrapper(true),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.showHelp).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(result.current.showHelp).toBe(false);
  });
});
