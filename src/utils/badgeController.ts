import { useEffect } from "react";
import { BadgeAnimator } from "@/utils/BadgeAnimator";
import { IDB_SEARCH_RESULTS_CLEARED } from "@/utils/idbCache";
import { SearchEvent, onSearchEvent } from "@/events/searchEvents";

/**
 * The single place that decides what the extension toolbar badge shows and when.
 *
 * Every other module only *emits* search-lifecycle events
 * ({@link "../events/searchEvents"}) or fires `IDB_SEARCH_RESULTS_CLEARED`; none
 * of them touch {@link BadgeAnimator} or `chrome.action` directly. This keeps the
 * "what does the badge become" logic auditable in one file instead of scattered
 * across the search hook, results table, popup load path, and speed-dial menu.
 *
 * The badge is a function of two things: whether a search is in flight
 * (`isSearching`) and the current result count. The reducer below is the
 * readable lookup table; {@link useBadgeController} wires the events to it.
 *
 * @category Utils
 * @source
 */

/** Internal badge state tracked across events. */
export interface BadgeState {
  /** True between SearchEvent.STARTED and a terminal event (completed/aborted/failed). */
  isSearching: boolean;
  /** The most recent known result count. */
  count: number;
}

/** The initial badge state (idle, no results). */
export const initialBadgeState: BadgeState = { isSearching: false, count: 0 };

/** A badge-lifecycle event fed to {@link reduceBadge}. */
export type BadgeEvent =
  | { type: SearchEvent.STARTED }
  | { type: SearchEvent.RESULTS_COUNT; count: number }
  | { type: SearchEvent.COMPLETED; count: number }
  | { type: SearchEvent.ABORTED }
  | { type: SearchEvent.FAILED }
  | { type: typeof IDB_SEARCH_RESULTS_CLEARED };

/** What the controller should render on the badge after handling an event. */
export type BadgeOutput =
  | { kind: "animate" } // show the "Searching…" ellipsis
  | { kind: "text"; value: string } // pin a result count
  | { kind: "clear" }; // empty the badge
/**
 * Pure reducer: given the previous {@link BadgeState} and an event, returns the
 * next state and the resulting {@link BadgeOutput}. No side effects, so it can be
 * unit-tested without a DOM or chrome.action mock.
 *
 * The single rule the rest of the app used to get wrong: a count of 0 keeps the
 * ellipsis *while a search is in flight*, but clears the badge once the search
 * has ended (or when no search is running at all, e.g. popup open).
 *
 * @param state - The previous badge state.
 * @param event - The lifecycle event to apply.
 * @returns The next state and the badge output to render.
 * @example
 * ```ts
 * reduceBadge({ isSearching: false, count: 0 }, { type: SearchEvent.STARTED });
 * // => { state: { isSearching: true, count: 0 }, output: { kind: "animate" } }
 * reduceBadge({ isSearching: true, count: 0 }, { type: SearchEvent.COMPLETED, count: 0 });
 * // => { state: { isSearching: false, count: 0 }, output: { kind: "clear" } }
 * ```
 * @source
 */
export function reduceBadge(
  state: BadgeState,
  event: BadgeEvent,
): { state: BadgeState; output: BadgeOutput } {
  switch (event.type) {
    case SearchEvent.STARTED: {
      const next = { isSearching: true, count: 0 };
      return { state: next, output: { kind: "animate" } };
    }
    case SearchEvent.RESULTS_COUNT: {
      const next = { ...state, count: event.count };
      return { state: next, output: render(next) };
    }
    case SearchEvent.COMPLETED: {
      const next = { isSearching: false, count: event.count };
      return { state: next, output: render(next) };
    }
    case SearchEvent.ABORTED:
    case SearchEvent.FAILED:
    case IDB_SEARCH_RESULTS_CLEARED: {
      const next = { isSearching: false, count: 0 };
      return { state: next, output: { kind: "clear" } };
    }
    default:
      return { state, output: render(state) };
  }
}

/**
 * Derives the badge output from a {@link BadgeState}: a positive count shows the
 * number, zero-while-searching keeps the ellipsis, and zero-when-idle clears.
 */
function render(state: BadgeState): BadgeOutput {
  if (state.count > 0) return { kind: "text", value: state.count.toString() };
  if (state.isSearching) return { kind: "animate" };
  return { kind: "clear" };
}

/**
 * True when two {@link BadgeOutput}s would put the badge in the same visible
 * state. Used to skip redundant re-applies within a session — most importantly,
 * so a repeated `animate` doesn't restart (and visibly reset) the ellipsis cycle.
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
  if (a.kind === "text" && b.kind === "text") return a.value === b.value;
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
 * handles repeated `animate` instead.
 *
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
    case "text":
      return current !== output.value;
    case "clear":
      return current !== "";
    case "animate":
      return true;
  }
}

/**
 * Reads the badge's current text and applies the output only if it would change
 * what's shown. Async because `chrome.action.getBadgeText` is promise-based.
 */
async function applyBadgeOutput(output: BadgeOutput): Promise<void> {
  let current = "";
  try {
    current = await chrome.action.getBadgeText({});
  } catch (error) {
    console.warn("Failed to read current badge text:", { error });
  }

  if (!shouldApplyToBadge(current, output)) return;

  switch (output.kind) {
    case "animate":
      BadgeAnimator.animate("ellipsis", 300);
      break;
    case "text":
      BadgeAnimator.setText(output.value);
      break;
    case "clear":
      BadgeAnimator.clear();
      break;
  }
}

/**
 * Mount-once hook that subscribes to all search-lifecycle events plus
 * `IDB_SEARCH_RESULTS_CLEARED`, runs them through {@link reduceBadge}, and applies
 * the result to the badge. Call this exactly once, near the top of `App`, before
 * any code that emits search events.
 *
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
    // Serialize applies so their async getBadgeText reads don't interleave.
    let applyChain: Promise<void> = Promise.resolve();

    const handle = (event: BadgeEvent) => {
      const result = reduceBadge(state, event);
      state = result.state;
      if (isSameBadgeOutput(lastOutput, result.output)) return;
      lastOutput = result.output;
      const output = result.output;
      applyChain = applyChain.then(() => applyBadgeOutput(output));
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

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      window.removeEventListener(IDB_SEARCH_RESULTS_CLEARED, onResultsCleared);
    };
  }, []);
}
