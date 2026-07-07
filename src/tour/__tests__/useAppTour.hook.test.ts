import { CACHE } from "@/constants/common";
import { cstorage } from "@/utils/storage";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTS, STATUS } from "react-joyride";
import type { EventData } from "react-joyride";
import {
  setupChromeStorageMock,
  resetChromeStorageMock,
} from "@/__fixtures__/helpers/chrome/storageMock";
import { FULL_STEPS, POPUP_STEPS, SPEED_DIAL_STEP_ID, TAB_RESUME_STEPS } from "../tourSteps";
import { useAppTour } from "../useAppTour";

vi.mock("@/utils/displayContext", () => ({
  isTabView: vi.fn(() => false),
  openExtensionTab: vi.fn(async () => undefined),
}));

import { isTabView, openExtensionTab } from "@/utils/displayContext";

const isTabViewMock = vi.mocked(isTabView);
const openExtensionTabMock = vi.mocked(openExtensionTab);

function endEvent(status: (typeof STATUS)[keyof typeof STATUS]): EventData {
  return { type: EVENTS.TOUR_END, status, step: {} } as unknown as EventData;
}

describe("useAppTour", () => {
  beforeEach(() => {
    setupChromeStorageMock();
    resetChromeStorageMock();
    isTabViewMock.mockReturnValue(false);
    openExtensionTabMock.mockClear();
  });

  afterEach(() => {
    resetChromeStorageMock();
  });

  it("opens the welcome prompt on first open, without running steps", async () => {
    const setSpeedDialVisible = vi.fn();
    const { result } = renderHook(() => useAppTour({ setSpeedDialVisible }));

    await waitFor(() => expect(result.current.welcome.open).toBe(true));
    expect(result.current.tour.run).toBe(false);
    expect(result.current.tour.steps).toHaveLength(0);
  });

  it("launches the popup steps when 'Start tour' is clicked", async () => {
    const setSpeedDialVisible = vi.fn();
    const { result } = renderHook(() => useAppTour({ setSpeedDialVisible }));
    await waitFor(() => expect(result.current.welcome.open).toBe(true));

    act(() => result.current.welcome.onStart());

    expect(result.current.welcome.open).toBe(false);
    expect(result.current.tour.run).toBe(true);
    expect(result.current.tour.steps).toHaveLength(POPUP_STEPS.length);
  });

  it("snoozes the prompt for 24h when 'Maybe later' is clicked", async () => {
    const setSpeedDialVisible = vi.fn();
    const { result } = renderHook(() => useAppTour({ setSpeedDialVisible }));
    await waitFor(() => expect(result.current.welcome.open).toBe(true));

    const before = Date.now();
    await act(async () => {
      result.current.welcome.onDismiss();
    });

    expect(result.current.welcome.open).toBe(false);
    expect(result.current.tour.run).toBe(false);
    const local = await cstorage.local.get([CACHE.TOUR_SNOOZE_UNTIL]);
    expect(Number(local[CACHE.TOUR_SNOOZE_UNTIL])).toBeGreaterThan(before);
    // Not marked permanently seen — it should re-prompt after the snooze.
    const seen = await cstorage.local.get([CACHE.HAS_SEEN_TOUR]);
    expect(seen[CACHE.HAS_SEEN_TOUR]).toBeUndefined();
  });

  it("does not prompt while snoozed, but re-prompts once the snooze expires", async () => {
    const setSpeedDialVisible = vi.fn();

    await cstorage.local.set({ [CACHE.TOUR_SNOOZE_UNTIL]: Date.now() + 60_000 });
    const snoozed = renderHook(() => useAppTour({ setSpeedDialVisible }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(snoozed.result.current.welcome.open).toBe(false);

    await cstorage.local.set({ [CACHE.TOUR_SNOOZE_UNTIL]: Date.now() - 1_000 });
    const expired = renderHook(() => useAppTour({ setSpeedDialVisible }));
    await waitFor(() => expect(expired.result.current.welcome.open).toBe(true));
  });

  it("does not run once the tour has been seen", async () => {
    await cstorage.local.set({ [CACHE.HAS_SEEN_TOUR]: true });
    const setSpeedDialVisible = vi.fn();
    const { result } = renderHook(() => useAppTour({ setSpeedDialVisible }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.welcome.open).toBe(false);
    expect(result.current.tour.run).toBe(false);
  });

  it("resumes in the tab when handed off from the popup (no welcome)", async () => {
    isTabViewMock.mockReturnValue(true);
    await cstorage.session.set({ [CACHE.TOUR_RESUME]: true });
    const setSpeedDialVisible = vi.fn();
    const { result } = renderHook(() => useAppTour({ setSpeedDialVisible }));

    await waitFor(() => expect(result.current.tour.run).toBe(true));
    expect(result.current.welcome.open).toBe(false);
    expect(result.current.tour.steps).toHaveLength(TAB_RESUME_STEPS.length);
    const session = await cstorage.session.get([CACHE.TOUR_RESUME]);
    expect(session[CACHE.TOUR_RESUME]).toBeUndefined();
  });

  it("launches the full tour after Start when opened directly in a tab", async () => {
    isTabViewMock.mockReturnValue(true);
    const setSpeedDialVisible = vi.fn();
    const { result } = renderHook(() => useAppTour({ setSpeedDialVisible }));

    await waitFor(() => expect(result.current.welcome.open).toBe(true));
    act(() => result.current.welcome.onStart());
    expect(result.current.tour.steps).toHaveLength(FULL_STEPS.length);
  });

  it("persists the seen flag and stops when the pointed tour finishes", async () => {
    const setSpeedDialVisible = vi.fn();
    const { result } = renderHook(() => useAppTour({ setSpeedDialVisible }));
    await waitFor(() => expect(result.current.welcome.open).toBe(true));

    act(() => result.current.welcome.onStart());
    await act(async () => {
      result.current.tour.onEvent(endEvent(STATUS.FINISHED), {} as never);
    });

    await waitFor(() => expect(result.current.tour.run).toBe(false));
    const local = await cstorage.local.get([CACHE.HAS_SEEN_TOUR]);
    expect(local[CACHE.HAS_SEEN_TOUR]).toBe(true);
  });

  it("forces the speed dial open while its step is spotlighted", async () => {
    const setSpeedDialVisible = vi.fn();
    const { result } = renderHook(() => useAppTour({ setSpeedDialVisible }));
    await waitFor(() => expect(result.current.welcome.open).toBe(true));
    act(() => result.current.welcome.onStart());

    act(() => {
      result.current.tour.onEvent(
        { type: EVENTS.STEP_BEFORE, step: { id: SPEED_DIAL_STEP_ID } } as unknown as EventData,
        {} as never,
      );
    });
    expect(setSpeedDialVisible).toHaveBeenCalledWith(true);
    expect(result.current.isSpeedDialLocked).toBe(true);

    act(() => {
      result.current.tour.onEvent(
        { type: EVENTS.STEP_AFTER, step: { id: SPEED_DIAL_STEP_ID } } as unknown as EventData,
        {} as never,
      );
    });
    expect(setSpeedDialVisible).toHaveBeenLastCalledWith(false);
    expect(result.current.isSpeedDialLocked).toBe(false);
  });

  it("replays the pointed tour directly (no welcome) via startTour", async () => {
    await cstorage.local.set({ [CACHE.HAS_SEEN_TOUR]: true });
    const setSpeedDialVisible = vi.fn();
    const { result } = renderHook(() => useAppTour({ setSpeedDialVisible }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.tour.run).toBe(false);

    const keyBefore = result.current.tour.joyrideKey;
    act(() => result.current.startTour());

    expect(result.current.welcome.open).toBe(false);
    expect(result.current.tour.run).toBe(true);
    expect(result.current.tour.steps).toHaveLength(POPUP_STEPS.length);
    expect(result.current.tour.joyrideKey).toBe(keyBefore + 1);
  });
});
