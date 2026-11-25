import { SearchEvent, onSearchEvent } from '@/events/searchEvents';
import { BadgeAnimator } from '@/utils/BadgeAnimator';
import { IDB_SEARCH_RESULTS_CLEARED } from '@/utils/idbCache';
import { getUnseenDrops } from '@/helpers/priceAlerts';
import { watchPriceAlerts } from '@/hooks/usePriceAlerts';
import { claimBadge, isDropBadgeText, showDropBadge } from '@/utils/priceDropBadge';
import { useEffect } from 'react';
import { Logger } from '@/utils/Logger';
import { getErrorMessage } from '@/helpers/exceptions';

const logger = new Logger('badgeController');

/**
 * The single place that decides what the extension toolbar badge shows and when.
 *
 * Every other module only *emits* search-lifecycle events
 * ({@link "../events/searchEvents"}) or fires `IDB_SEARCH_RESULTS_CLEARED`; none
 * of them touch {@link BadgeAnimator} or `chrome.action` directly. This keeps the
 * "what does the badge become" logic auditable in one file instead of scattered
 * across the search hook, results table, popup load path, and speed-dial menu.
 *
 * The badge is a function of three things: whether a search is in flight
 * (`isSearching`), the current result count, and the number of watched products
 * with an unseen price drop. The reducer below is the readable lookup table;
 * {@link useBadgeController} wires the events to it. While the page is hidden and
 * idle, the background worker shows price drops (see {@link "./priceDropBadge"}).
 *
 * @category Utils
 * @source
 */

/** Badge event for a change in the price drops the user hasn't seen. */
export const PRICE_DROPS_CHANGED = 'price-drops-changed';

/**
 * Internal badge state tracked across events.
 * @category Utils
 */
export interface BadgeState {
  /** True between SearchEvent.STARTED and a terminal event (completed/aborted/failed). */
  isSearching: boolean;
  /** The most recent known result count. */
  count: number;
  /** Number of watched products with an unseen price drop. */
  drops: number;
}

/**
 * The initial badge state (idle, no results, no price drops).
 * @category Utils
 */
export const initialBadgeState: BadgeState = { isSearching: false, count: 0, drops: 0 };

/**
 * A badge-lifecycle event fed to {@link reduceBadge}.
 * @category Utils
 */
export type BadgeEvent =
  | { type: SearchEvent.STARTED }
  | { type: SearchEvent.RESULTS_COUNT; count: number }
  | { type: SearchEvent.COMPLETED; count: number }
  | { type: SearchEvent.ABORTED }
  | { type: SearchEvent.FAILED }
  | { type: typeof IDB_SEARCH_RESULTS_CLEARED }
  | { type: typeof PRICE_DROPS_CHANGED; drops: number; isNew: boolean };

/**
 * What the controller should render on the badge after handling an event.
 * @category Utils
 */
export type BadgeOutput =
  | { kind: 'animate' } // show the "Searching…" ellipsis
  | { kind: 'text'; value: string } // pin a result count
  | { kind: 'drops'; count: number; flash: boolean } // show the unseen price drops
  | { kind: 'clear' }; // empty the badge
/**
 * Pure reducer: given the previous {@link BadgeState} and an event, returns the
 * next state and the resulting {@link BadgeOutput}. No side effects, so it can be
 * unit-tested without a DOM or chrome.action mock.
 *
 * The single rule the rest of the app used to get wrong: a count of 0 keeps the
 * ellipsis *while a search is in flight*, but clears the badge once the search
 * has ended (or when no search is running at all, e.g. popup open). Unseen price
 * drops replace the result count, but never interrupt a search.
 *
 * @category Utils
 * @param state - The previous badge state.
 * @param event - The lifecycle event to apply.
 * @returns The next state and the badge output to render.
 * @example
 * ```ts
 * reduceBadge({ isSearching: false, count: 0, drops: 0 }, { type: SearchEvent.STARTED });
 * // => { state: { isSearching: true, count: 0, drops: 0 }, output: { kind: "animate" } }
 * reduceBadge(
 *   { isSearching: true, count: 0, drops: 0 },
 *   { type: SearchEvent.COMPLETED, count: 0 },
 * );
 * // => { state: { isSearching: false, count: 0, drops: 0 }, output: { kind: "clear" } }
 * ```
 * @source
 */
export function reduceBadge(
  state: BadgeState,
  event: BadgeEvent,
): { state: BadgeState; output: BadgeOutput } {
  switch (event.type) {
    case SearchEvent.STARTED: {
      const next = { ...state, isSearching: true, count: 0 };
      return { state: next, output: { kind: 'animate' } };
    }
    case SearchEvent.RESULTS_COUNT: {
      const next = { ...state, count: event.count };
      return { state: next, output: render(next) };
    }
    case SearchEvent.COMPLETED: {
      const next = { ...state, isSearching: false, count: event.count };
      return { state: next, output: render(next) };
    }
    case SearchEvent.ABORTED:
    case SearchEvent.FAILED:
    case IDB_SEARCH_RESULTS_CLEARED: {
      const next = { ...state, isSearching: false, count: 0 };
      return { state: next, output: render(next) };
    }
    case PRICE_DROPS_CHANGED: {
      const next = { ...state, drops: event.drops };
      return { state: next, output: render(next, event.isNew) };
    }
    default:
      return { state, output: render(state) };
  }
}

/**
 * Derives the badge output from a {@link BadgeState}: unseen price drops win when idle; otherwise a
 * positive count shows the number, zero-while-searching keeps the ellipsis, and zero-when-idle clears.
 */
function render(state: BadgeState, flash: boolean = false): BadgeOutput {
  if (state.drops > 0 && !state.isSearching) return { kind: 'drops', count: state.drops, flash };
  if (state.count > 0) return { kind: 'text', value: String(state.count) };
  if (state.isSearching) return { kind: 'animate' };
  return { kind: 'clear' };
}

/**
 * True when two {@link BadgeOutput}s would put the badge in the same visible
 * state. Used to skip redundant re-applies within a session — most importantly,
 * so a repeated `animate` doesn't restart (and visibly reset) the ellipsis cycle.
 * @category Utils
 * @param a - The previously applied output (or `null` if none yet).
 * @param b - The output about to be applied.
 * @returns Whether they are visually equivalent.
 * @example
 * ```ts
 * isSameBadgeOutput({ kind: "text", value: "5" }, { kind: "text", value: "5" }); // true
 * isSameBadgeOutput({ kind: "animate" }, { kind: "clear" }); // false
 * ```
 * @source
 */
export function isSameBadgeOutput(a: BadgeOutput | null, b: BadgeOutput): boolean {
  if (a === null || a.kind !== b.kind) return false;
  if (a.kind === 'text' && b.kind === 'text') return a.value === b.value;
  if (a.kind === 'drops' && b.kind === 'drops') return a.count === b.count && !b.flash;
  return true;
}

/**
 * Decides whether an output actually needs to be written to the badge, given the
 * badge's *current* on-screen text. This is what prevents the open-with-results
 * flicker: the toolbar badge persists across popup opens, so if it already shows
 * the desired text (or is already empty), re-applying would blank-then-rewrite it
 * (`BadgeAnimator.setText` clears before setting) — a visible flash.
 *
 * `animate` always returns `true` because a single text read can't tell whether
 * the ellipsis is already cycling; the in-session {@link isSameBadgeOutput} guard
 * handles repeated `animate` instead. `drops` always does too: its color may
 * have been left mid-flash, and {@link showDropBadge} keeps matching text as is.
 *
 * @category Utils
 * @param current - The badge's current text (from `chrome.action.getBadgeText`).
 * @param output - The output about to be applied.
 * @returns Whether the output should be written.
 * @example
 * ```ts
 * shouldApplyToBadge("5", { kind: "text", value: "5" }); // false — already shown
 * shouldApplyToBadge("5", { kind: "text", value: "6" }); // true
 * shouldApplyToBadge("", { kind: "clear" }); // false — already empty
 * ```
 * @source
 */
export function shouldApplyToBadge(current: string, output: BadgeOutput): boolean {
  switch (output.kind) {
    case 'text':
      return current !== output.value;
    case 'clear':
      return current !== '';
    case 'animate':
    case 'drops':
      return true;
  }
}

/**
 * Reads the badge's current text and applies the output only if it would change
 * what's shown. Async because `chrome.action.getBadgeText` is promise-based.
 */
async function applyBadgeOutput(output: BadgeOutput): Promise<void> {
  let current = '';
  try {
    current = await chrome.action.getBadgeText({});
  } catch (error) {
    logger.warn(`Failed to read current badge text: ${getErrorMessage(error)}`, { error });
  }

  if (!shouldApplyToBadge(current, output)) return;

  switch (output.kind) {
    case 'animate':
      BadgeAnimator.animate('ellipsis', 300);
      break;
    case 'text':
      void BadgeAnimator.setText(output.value);
      break;
    case 'clear':
      void BadgeAnimator.clear();
      break;
    case 'drops':
      await showDropBadge(output.count, output.flash);
      return;
  }
  if (isDropBadgeText(current)) await BadgeAnimator.resetColor();
}

/**
 * Mount-once hook that subscribes to all search-lifecycle events,
 * `IDB_SEARCH_RESULTS_CLEARED` and the price alerts, runs them through {@link reduceBadge},
 * and applies the result to the badge. Call this exactly once, near the top of `App`, before
 * any code that emits search events.
 *
 * @category Utils
 * @example
 * ```tsx
 * function App() {
 *   useBadgeController();
 *   // …
 * }
 * ```
 * @source
 */
export function useBadgeController(): void {
  useEffect(() => {
    // Badge state is external; keep it in the closure, not React state.
    let state = initialBadgeState;
    // Skip re-emitting an identical output (e.g. repeated mid-search 0 → animate).
    let lastOutput: BadgeOutput | null = null;
    const isOwner = () => state.isSearching || document.visibilityState === 'visible';
    const releaseBadge = claimBadge(isOwner);
    // Newest drop already shown; undefined until the alerts have loaded.
    let latestDrop: number | undefined;
    const alerts = watchPriceAlerts((loaded) => {
      const unseen = getUnseenDrops(loaded);
      const newest = Math.max(0, ...unseen.map(({ lastDrop }) => lastDrop?.at ?? 0));
      const isNew = latestDrop !== undefined && newest > latestDrop;
      latestDrop = Math.max(latestDrop ?? 0, newest);
      // Nothing to show yet, and the badge may hold the results of an earlier session.
      if (unseen.length === 0 && state.drops === 0) return;
      handle({ type: PRICE_DROPS_CHANGED, drops: unseen.length, isNew });
      // The worker is changing the badge, so what was applied last no longer holds.
      if (!isOwner()) lastOutput = null;
    });
    // Serialize applies so their async getBadgeText reads don't interleave. Starts once the price
    // drops are known, so they don't replace a result count that was only just shown.
    let applyChain = alerts.ready;

    const handle = (event: BadgeEvent) => {
      const result = reduceBadge(state, event);
      state = result.state;
      if (event.type === PRICE_DROPS_CHANGED && !isOwner()) return;
      if (isSameBadgeOutput(lastOutput, result.output)) return;
      lastOutput = result.output;
      const output = result.output;
      const previous = applyChain;
      applyChain = (async () => {
        await previous;
        // A newer output may have replaced it while it waited.
        if (output === lastOutput) await applyBadgeOutput(output);
      })();
    };

    const unsubscribers = [
      onSearchEvent(SearchEvent.STARTED, () => handle({ type: SearchEvent.STARTED })),
      onSearchEvent(SearchEvent.RESULTS_COUNT, ({ count }) =>
        handle({ type: SearchEvent.RESULTS_COUNT, count }),
      ),
      onSearchEvent(SearchEvent.COMPLETED, ({ count }) =>
        handle({ type: SearchEvent.COMPLETED, count }),
      ),
      onSearchEvent(SearchEvent.ABORTED, () => handle({ type: SearchEvent.ABORTED })),
      onSearchEvent(SearchEvent.FAILED, () => handle({ type: SearchEvent.FAILED })),
    ];

    const onResultsCleared = () => handle({ type: IDB_SEARCH_RESULTS_CLEARED });
    window.addEventListener(IDB_SEARCH_RESULTS_CLEARED, onResultsCleared);

    // Catches up on drops that were left to the worker.
    const onVisible = () => {
      if (isOwner()) handle({ type: PRICE_DROPS_CHANGED, drops: state.drops, isNew: false });
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      alerts.stop();
      releaseBadge();
      for (const unsubscribe of unsubscribers) unsubscribe();
      window.removeEventListener(IDB_SEARCH_RESULTS_CLEARED, onResultsCleared);
    };
  }, []);
}
