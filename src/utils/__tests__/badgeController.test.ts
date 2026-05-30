import { describe, expect, it } from "vitest";
import {
  IDB_SEARCH_RESULTS_CLEARED,
} from "../idbCache";
import { SearchEvent } from "../../events/searchEvents";
import {
  BadgeEvent,
  initialBadgeState,
  isSameBadgeOutput,
  reduceBadge,
  shouldApplyToBadge,
} from "../badgeController";

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

describe("reduceBadge", () => {
  it("animates on search start", () => {
    const { state, output } = run([{ type: SearchEvent.STARTED }]);
    expect(state.isSearching).toBe(true);
    expect(output).toEqual({ kind: "animate" });
  });

  it("keeps animating when count is 0 mid-search", () => {
    const { output } = run([
      { type: SearchEvent.STARTED },
      { type: SearchEvent.RESULTS_COUNT, count: 0 },
    ]);
    expect(output).toEqual({ kind: "animate" });
  });

  it("shows the count as results stream in", () => {
    const { output } = run([
      { type: SearchEvent.STARTED },
      { type: SearchEvent.RESULTS_COUNT, count: 3 },
    ]);
    expect(output).toEqual({ kind: "text", value: "3" });
  });

  it("clears the badge when a search completes with 0 results", () => {
    const { state, output } = run([
      { type: SearchEvent.STARTED },
      { type: SearchEvent.COMPLETED, count: 0 },
    ]);
    expect(state.isSearching).toBe(false);
    expect(output).toEqual({ kind: "clear" });
  });

  it("pins the final count when a search completes with results", () => {
    const { output } = run([
      { type: SearchEvent.STARTED },
      { type: SearchEvent.COMPLETED, count: 12 },
    ]);
    expect(output).toEqual({ kind: "text", value: "12" });
  });

  it("clears on abort", () => {
    const { state, output } = run([{ type: SearchEvent.STARTED }, { type: SearchEvent.ABORTED }]);
    expect(state.isSearching).toBe(false);
    expect(output).toEqual({ kind: "clear" });
  });

  it("clears on failure", () => {
    const { output } = run([{ type: SearchEvent.STARTED }, { type: SearchEvent.FAILED }]);
    expect(output).toEqual({ kind: "clear" });
  });

  it("clears when results are cleared externally", () => {
    const { output } = run([
      { type: SearchEvent.COMPLETED, count: 5 },
      { type: IDB_SEARCH_RESULTS_CLEARED },
    ]);
    expect(output).toEqual({ kind: "clear" });
  });

  it("clears the badge when filtering drops the count to 0 after completion", () => {
    // After a search settles, the table re-emits its filtered count. Filtering
    // down to 0 should clear the badge (no results visible → no badge).
    const { output } = run([
      { type: SearchEvent.COMPLETED, count: 5 },
      { type: SearchEvent.RESULTS_COUNT, count: 0 },
    ]);
    expect(output).toEqual({ kind: "clear" });
  });

  it("shows the count on popup open with persisted results (no search running)", () => {
    const { output } = run([{ type: SearchEvent.RESULTS_COUNT, count: 8 }]);
    expect(output).toEqual({ kind: "text", value: "8" });
  });

  it("clears on popup open with no persisted results", () => {
    const { output } = run([{ type: SearchEvent.RESULTS_COUNT, count: 0 }]);
    expect(output).toEqual({ kind: "clear" });
  });
});

describe("isSameBadgeOutput", () => {
  it("treats a null previous output as different (first apply always runs)", () => {
    expect(isSameBadgeOutput(null, { kind: "clear" })).toBe(false);
    expect(isSameBadgeOutput(null, { kind: "animate" })).toBe(false);
  });

  it("treats repeated animate as the same (so the ellipsis doesn't restart)", () => {
    expect(isSameBadgeOutput({ kind: "animate" }, { kind: "animate" })).toBe(true);
  });

  it("treats repeated clear as the same", () => {
    expect(isSameBadgeOutput({ kind: "clear" }, { kind: "clear" })).toBe(true);
  });

  it("treats text with the same value as the same, different value as different", () => {
    expect(isSameBadgeOutput({ kind: "text", value: "5" }, { kind: "text", value: "5" })).toBe(true);
    expect(isSameBadgeOutput({ kind: "text", value: "5" }, { kind: "text", value: "6" })).toBe(
      false,
    );
  });

  it("treats different kinds as different", () => {
    expect(isSameBadgeOutput({ kind: "animate" }, { kind: "clear" })).toBe(false);
    expect(isSameBadgeOutput({ kind: "clear" }, { kind: "text", value: "1" })).toBe(false);
  });
});

describe("shouldApplyToBadge", () => {
  it("skips text when the badge already shows that value (open-with-results flicker fix)", () => {
    expect(shouldApplyToBadge("5", { kind: "text", value: "5" })).toBe(false);
  });

  it("applies text when the badge shows a different value", () => {
    expect(shouldApplyToBadge("5", { kind: "text", value: "6" })).toBe(true);
    expect(shouldApplyToBadge("", { kind: "text", value: "6" })).toBe(true);
  });

  it("skips clear when the badge is already empty", () => {
    expect(shouldApplyToBadge("", { kind: "clear" })).toBe(false);
  });

  it("applies clear when the badge currently shows something", () => {
    expect(shouldApplyToBadge("5", { kind: "clear" })).toBe(true);
  });

  it("always applies animate (current text can't reveal whether it's already cycling)", () => {
    expect(shouldApplyToBadge("", { kind: "animate" })).toBe(true);
    expect(shouldApplyToBadge("‥", { kind: "animate" })).toBe(true);
  });
});
