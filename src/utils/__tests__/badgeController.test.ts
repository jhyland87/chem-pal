import { priceAlerts } from '@/../config.json';
import {
  resetChromeActionMock,
  restoreChromeActionMock,
  setupChromeActionMock,
} from '@/__fixtures__/helpers/chrome/actionMock';
import { SearchEvent, emitSearchEvent } from '@/events/searchEvents';
import { renderHook } from '@testing-library/react';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { BadgeAnimator } from '../BadgeAnimator';
import {
  BadgeEvent,
  initialBadgeState,
  PRICE_DROPS_CHANGED,
  isSameBadgeOutput,
  reduceBadge,
  shouldApplyToBadge,
  useBadgeController,
} from '../badgeController';
import { IDB_SEARCH_RESULTS_CLEARED } from '../idbCache';
import type { PriceAlert } from '@/helpers/priceAlerts';
import { MESSAGE_TYPE } from '@/constants/common';

// Stands in for the stored alerts; `emit` delivers a change to the controller.
const alertsCtl = vi.hoisted(() => ({
  initial: [] as unknown[],
  emit: (_alerts: unknown[]): void => {},
}));
vi.mock('@/hooks/usePriceAlerts', () => ({
  watchPriceAlerts: (onLoad: (alerts: unknown[]) => void) => {
    alertsCtl.emit = onLoad;
    return { ready: Promise.resolve().then(() => onLoad(alertsCtl.initial)), stop: () => {} };
  },
}));

/** Builds alerts whose drops, found at the given times, haven't been seen. */
const unseen = (...times: number[]) =>
  times.map((at) => ({ hasUnseenDrop: true, lastDrop: { at } }) as PriceAlert);

/**
 * Drives a sequence of events through the pure reducer and returns the final
 * state plus the last output (the badge action that would be applied).
 */
function run(events: BadgeEvent[]) {
  let state = initialBadgeState;
  let output = reduceBadge(state, { type: SearchEvent.RESULTS_COUNT, count: 0 }).output;
  for (const event of events) {
    const result = reduceBadge(state, event);
    state = result.state;
    output = result.output;
  }
  return { state, output };
}

/**
 * Builds a terminal-event outcome payload. The badge only reads `count`, so the
 * timing/supplier fields are fixed filler.
 * @param count - Result count to report.
 * @returns A SearchOutcomeDetail for a COMPLETED/ABORTED/FAILED emit.
 */
function outcome(count: number) {
  return { count, durationMs: 1000, suppliersQueried: 3, suppliersCompleted: 3 };
}

describe('reduceBadge', () => {
  it('animates on search start', () => {
    const { state, output } = run([{ type: SearchEvent.STARTED }]);
    expect(state.isSearching).toBe(true);
    expect(output).toEqual({ kind: 'animate' });
  });

  it('keeps animating when count is 0 mid-search', () => {
    const { output } = run([
      { type: SearchEvent.STARTED },
      { type: SearchEvent.RESULTS_COUNT, count: 0 },
    ]);
    expect(output).toEqual({ kind: 'animate' });
  });

  it('shows the count as results stream in', () => {
    const { output } = run([
      { type: SearchEvent.STARTED },
      { type: SearchEvent.RESULTS_COUNT, count: 3 },
    ]);
    expect(output).toEqual({ kind: 'text', value: '3' });
  });

  it('clears the badge when a search completes with 0 results', () => {
    const { state, output } = run([
      { type: SearchEvent.STARTED },
      { type: SearchEvent.COMPLETED, count: 0 },
    ]);
    expect(state.isSearching).toBe(false);
    expect(output).toEqual({ kind: 'clear' });
  });

  it('pins the final count when a search completes with results', () => {
    const { output } = run([
      { type: SearchEvent.STARTED },
      { type: SearchEvent.COMPLETED, count: 12 },
    ]);
    expect(output).toEqual({ kind: 'text', value: '12' });
  });

  it('clears on abort', () => {
    const { state, output } = run([{ type: SearchEvent.STARTED }, { type: SearchEvent.ABORTED }]);
    expect(state.isSearching).toBe(false);
    expect(output).toEqual({ kind: 'clear' });
  });

  it('clears on failure', () => {
    const { output } = run([{ type: SearchEvent.STARTED }, { type: SearchEvent.FAILED }]);
    expect(output).toEqual({ kind: 'clear' });
  });

  it('clears when results are cleared externally', () => {
    const { output } = run([
      { type: SearchEvent.COMPLETED, count: 5 },
      { type: IDB_SEARCH_RESULTS_CLEARED },
    ]);
    expect(output).toEqual({ kind: 'clear' });
  });

  it('clears the badge when filtering drops the count to 0 after completion', () => {
    // After a search settles, the table re-emits its filtered count. Filtering
    // down to 0 should clear the badge (no results visible → no badge).
    const { output } = run([
      { type: SearchEvent.COMPLETED, count: 5 },
      { type: SearchEvent.RESULTS_COUNT, count: 0 },
    ]);
    expect(output).toEqual({ kind: 'clear' });
  });

  it('shows price drops over the result count once idle, but not during a search', () => {
    const drops: BadgeEvent = { type: PRICE_DROPS_CHANGED, drops: 2, isNew: true };
    const started: BadgeEvent = { type: SearchEvent.STARTED };

    expect(run([drops]).output).toEqual({ kind: 'drops', count: 2, flash: true });
    expect(run([started, drops]).output).toEqual({ kind: 'animate' });
    expect(run([started, { type: SearchEvent.RESULTS_COUNT, count: 3 }, drops]).output).toEqual({
      kind: 'text',
      value: '3',
    });
    for (const ended of [
      { type: SearchEvent.COMPLETED, count: 12 },
      { type: SearchEvent.ABORTED },
      { type: SearchEvent.FAILED },
    ] satisfies BadgeEvent[]) {
      expect(run([drops, started, ended]).output).toEqual({
        kind: 'drops',
        count: 2,
        flash: false,
      });
    }
  });

  it('goes back to the result count once the drops are seen', () => {
    const { output } = run([
      { type: SearchEvent.COMPLETED, count: 12 },
      { type: PRICE_DROPS_CHANGED, drops: 2, isNew: true },
      { type: PRICE_DROPS_CHANGED, drops: 0, isNew: false },
    ]);
    expect(output).toEqual({ kind: 'text', value: '12' });
  });

  it('shows the count on popup open with persisted results (no search running)', () => {
    const { output } = run([{ type: SearchEvent.RESULTS_COUNT, count: 8 }]);
    expect(output).toEqual({ kind: 'text', value: '8' });
  });

  it('clears on popup open with no persisted results', () => {
    const { output } = run([{ type: SearchEvent.RESULTS_COUNT, count: 0 }]);
    expect(output).toEqual({ kind: 'clear' });
  });
});

describe('isSameBadgeOutput', () => {
  it('treats a null previous output as different (first apply always runs)', () => {
    expect(isSameBadgeOutput(null, { kind: 'clear' })).toBe(false);
    expect(isSameBadgeOutput(null, { kind: 'animate' })).toBe(false);
  });

  it("treats repeated animate as the same (so the ellipsis doesn't restart)", () => {
    expect(isSameBadgeOutput({ kind: 'animate' }, { kind: 'animate' })).toBe(true);
  });

  it('treats repeated clear as the same', () => {
    expect(isSameBadgeOutput({ kind: 'clear' }, { kind: 'clear' })).toBe(true);
  });

  it('treats text with the same value as the same, different value as different', () => {
    expect(isSameBadgeOutput({ kind: 'text', value: '5' }, { kind: 'text', value: '5' })).toBe(
      true,
    );
    expect(isSameBadgeOutput({ kind: 'text', value: '5' }, { kind: 'text', value: '6' })).toBe(
      false,
    );
  });

  it('repeats price drops only to flash them or change their number', () => {
    const shown = { kind: 'drops', count: 1, flash: true } as const;
    expect(isSameBadgeOutput(shown, { ...shown, flash: false })).toBe(true);
    expect(isSameBadgeOutput(shown, shown)).toBe(false);
    expect(isSameBadgeOutput(shown, { ...shown, count: 2, flash: false })).toBe(false);
  });

  it('treats different kinds as different', () => {
    expect(isSameBadgeOutput({ kind: 'animate' }, { kind: 'clear' })).toBe(false);
    expect(isSameBadgeOutput({ kind: 'clear' }, { kind: 'text', value: '1' })).toBe(false);
  });
});

describe('shouldApplyToBadge', () => {
  it('skips text when the badge already shows that value (open-with-results flicker fix)', () => {
    expect(shouldApplyToBadge('5', { kind: 'text', value: '5' })).toBe(false);
  });

  it('applies text when the badge shows a different value', () => {
    expect(shouldApplyToBadge('5', { kind: 'text', value: '6' })).toBe(true);
    expect(shouldApplyToBadge('', { kind: 'text', value: '6' })).toBe(true);
  });

  it('skips clear when the badge is already empty', () => {
    expect(shouldApplyToBadge('', { kind: 'clear' })).toBe(false);
  });

  it('applies clear when the badge currently shows something', () => {
    expect(shouldApplyToBadge('5', { kind: 'clear' })).toBe(true);
  });

  it("always applies animate (current text can't reveal whether it's already cycling)", () => {
    expect(shouldApplyToBadge('', { kind: 'animate' })).toBe(true);
    expect(shouldApplyToBadge('‥', { kind: 'animate' })).toBe(true);
  });
});

describe('useBadgeController (integration with the chrome.action mock)', () => {
  let mockChromeAction: ReturnType<typeof setupChromeActionMock>;
  let animateSpy: MockInstance;
  let setTextSpy: MockInstance;
  let clearSpy: MockInstance;

  beforeEach(() => {
    alertsCtl.initial = [];
    mockChromeAction = setupChromeActionMock();
    // Stub `animate` to a no-op so it never schedules a real ellipsis timer that
    // could leak into the next test — we only assert that the controller *routes*
    // to it (BadgeAnimator's own frame/timer behavior is covered in
    // BadgeAnimator.test.ts). `setText`/`clear` call through so they update the
    // mocked badge state, which the flicker assertions rely on.
    animateSpy = vi.spyOn(BadgeAnimator, 'animate').mockImplementation(() => {});
    setTextSpy = vi.spyOn(BadgeAnimator, 'setText');
    clearSpy = vi.spyOn(BadgeAnimator, 'clear');
  });

  afterEach(() => {
    // Restore only our own BadgeAnimator spies — NOT vi.restoreAllMocks(), which
    // would also strip the fixture's chrome.action vi.fn() implementations
    // (getBadgeText/setBadgeText), breaking state tracking in later tests.
    animateSpy.mockRestore();
    setTextSpy.mockRestore();
    clearSpy.mockRestore();
    resetChromeActionMock();
  });

  afterAll(() => {
    restoreChromeActionMock();
  });

  /**
   * Drain the controller's chained async applies. Each apply is pure microtasks
   * (it awaits the `getBadgeText` async mock, no timers), so flushing the
   * microtask queue a few times settles the chain.
   */
  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };

  it('starts the ellipsis animation on search start', async () => {
    const { unmount } = renderHook(() => useBadgeController());

    emitSearchEvent(SearchEvent.STARTED, { query: 'acetone' });
    await flush();

    expect(animateSpy).toHaveBeenCalledWith('ellipsis', 300);
    unmount();
  });

  it('shows the streaming count, then pins the final count', async () => {
    const { unmount } = renderHook(() => useBadgeController());

    emitSearchEvent(SearchEvent.STARTED, { query: 'acetone' });
    await flush();
    emitSearchEvent(SearchEvent.RESULTS_COUNT, { count: 3 });
    await flush();
    expect(setTextSpy).toHaveBeenLastCalledWith('3');
    expect(mockChromeAction._state.badgeText).toBe('3');

    emitSearchEvent(SearchEvent.COMPLETED, outcome(3));
    await flush();
    expect(mockChromeAction._state.badgeText).toBe('3');

    unmount();
  });

  it('clears the badge when a search completes with zero results', async () => {
    const { unmount } = renderHook(() => useBadgeController());

    emitSearchEvent(SearchEvent.STARTED, { query: 'xyzzy' });
    await flush();
    emitSearchEvent(SearchEvent.COMPLETED, outcome(0));
    await flush();

    expect(mockChromeAction._state.badgeText).toBe('');
    unmount();
  });

  it('clears the badge on abort', async () => {
    const { unmount } = renderHook(() => useBadgeController());

    emitSearchEvent(SearchEvent.STARTED, { query: 'acetone' });
    await flush();
    emitSearchEvent(SearchEvent.ABORTED, { ...outcome(3), reason: 'user_aborted' });
    await flush();

    expect(mockChromeAction._state.badgeText).toBe('');
    unmount();
  });

  it('clears the badge when results are cleared externally', async () => {
    const { unmount } = renderHook(() => useBadgeController());

    emitSearchEvent(SearchEvent.COMPLETED, outcome(5));
    await flush();
    expect(mockChromeAction._state.badgeText).toBe('5');

    window.dispatchEvent(new CustomEvent(IDB_SEARCH_RESULTS_CLEARED));
    await flush();
    expect(mockChromeAction._state.badgeText).toBe('');

    unmount();
  });

  it('does NOT rewrite the badge when opening with the count it already shows (flicker fix)', async () => {
    // Simulate the persistent badge already showing the restored count on open.
    mockChromeAction._state.badgeText = '50';
    const { unmount } = renderHook(() => useBadgeController());
    mockChromeAction.setBadgeText.mockClear();

    // App emits the restored count on popup open.
    emitSearchEvent(SearchEvent.RESULTS_COUNT, { count: 50 });
    await flush();

    // The value was already correct, so the badge must not be re-written
    // (setText would clear-then-set, causing a visible blink).
    expect(mockChromeAction.setBadgeText).not.toHaveBeenCalled();
    expect(mockChromeAction._state.badgeText).toBe('50');

    unmount();
  });

  it('does not restart the animation when count keeps reporting 0 mid-search', async () => {
    const { unmount } = renderHook(() => useBadgeController());

    emitSearchEvent(SearchEvent.STARTED, { query: 'acetone' });
    await flush();
    animateSpy.mockClear();

    // ResultsTable re-emitting 0 while the search runs must not re-trigger animate.
    emitSearchEvent(SearchEvent.RESULTS_COUNT, { count: 0 });
    emitSearchEvent(SearchEvent.RESULTS_COUNT, { count: 0 });
    await flush();

    expect(animateSpy).not.toHaveBeenCalled();
    unmount();
  });

  it('stops touching the badge after the hook unmounts', async () => {
    const { unmount } = renderHook(() => useBadgeController());
    unmount();
    mockChromeAction.setBadgeText.mockClear();

    emitSearchEvent(SearchEvent.COMPLETED, outcome(7));
    await flush();

    expect(mockChromeAction.setBadgeText).not.toHaveBeenCalled();
  });

  describe('price drops', () => {
    const { color } = priceAlerts.badge;
    let flashSpy: MockInstance;
    let visibility: MockInstance;

    beforeEach(() => {
      flashSpy = vi.spyOn(BadgeAnimator, 'flash').mockResolvedValue(undefined);
      visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    });

    afterEach(() => {
      flashSpy.mockRestore();
      visibility.mockRestore();
    });

    it('shows earlier drops on open without flashing or showing the results first', async () => {
      alertsCtl.initial = unseen(1);
      const { unmount } = renderHook(() => useBadgeController());
      emitSearchEvent(SearchEvent.RESULTS_COUNT, { count: 50 });
      await flush();

      expect(mockChromeAction._state).toMatchObject({
        badgeText: '↓1',
        badgeBackgroundColor: color,
      });
      expect(setTextSpy).not.toHaveBeenCalledWith('50');
      expect(flashSpy).not.toHaveBeenCalled();
      unmount();
    });

    it('flashes a new drop, then restores the results and color once it is seen', async () => {
      const { unmount } = renderHook(() => useBadgeController());
      emitSearchEvent(SearchEvent.COMPLETED, outcome(5));
      await flush();

      alertsCtl.emit(unseen(1));
      await flush();
      expect(mockChromeAction._state.badgeText).toBe('↓1');
      expect(flashSpy).toHaveBeenCalledTimes(1);

      // An update that brings no new drop.
      alertsCtl.emit(unseen(1));
      await flush();
      expect(flashSpy).toHaveBeenCalledTimes(1);

      alertsCtl.emit([]);
      await flush();
      expect(mockChromeAction._state.badgeText).toBe('5');
      expect(mockChromeAction._state.badgeBackgroundColor).toEqual([0, 0, 0, 0]);
      unmount();
    });

    it('waits for a search to end', async () => {
      const { unmount } = renderHook(() => useBadgeController());
      await flush();
      emitSearchEvent(SearchEvent.STARTED, { query: 'acetone' });
      emitSearchEvent(SearchEvent.RESULTS_COUNT, { count: 3 });
      alertsCtl.emit(unseen(1));
      await flush();
      expect(mockChromeAction._state.badgeText).toBe('3');

      emitSearchEvent(SearchEvent.COMPLETED, outcome(3));
      await flush();
      expect(mockChromeAction._state.badgeText).toBe('↓1');
      unmount();
    });

    it('leaves drops to the worker while hidden, and catches up when shown', async () => {
      const { unmount } = renderHook(() => useBadgeController());
      emitSearchEvent(SearchEvent.COMPLETED, outcome(5));
      await flush();

      visibility.mockReturnValue('hidden');
      alertsCtl.emit(unseen(1));
      await flush();
      expect(mockChromeAction._state.badgeText).toBe('5');

      // What the worker does when the drop is seen elsewhere.
      alertsCtl.emit([]);
      mockChromeAction._state.badgeText = '';
      await flush();
      visibility.mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      await flush();
      expect(mockChromeAction._state.badgeText).toBe('5');
      unmount();
    });

    it('claims the badge while visible or searching', async () => {
      const onMessage = { addListener: vi.fn(), removeListener: vi.fn() };
      const { runtime } = chrome;
      chrome.runtime = { onMessage } as unknown as typeof chrome.runtime;
      try {
        const { unmount } = renderHook(() => useBadgeController());
        const [listener] = onMessage.addListener.mock.calls[0];
        const isClaimed = (message: unknown = { type: MESSAGE_TYPE.BADGE_OWNER }) => {
          const sendResponse = vi.fn();
          listener(message, {}, sendResponse);
          return sendResponse.mock.calls.length > 0;
        };

        expect(isClaimed()).toBe(true);
        expect(isClaimed({ type: 'OTHER' })).toBe(false);
        expect(isClaimed('text')).toBe(false);

        visibility.mockReturnValue('hidden');
        expect(isClaimed()).toBe(false);
        emitSearchEvent(SearchEvent.STARTED, { query: 'acetone' });
        expect(isClaimed()).toBe(true);

        unmount();
        expect(onMessage.removeListener).toHaveBeenCalledWith(listener);
      } finally {
        chrome.runtime = runtime;
      }
    });
  });
});
