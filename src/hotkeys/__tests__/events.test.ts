import { describe, expect, it } from "vitest";
import {
  ABORT_SEARCH_EVENT,
  FOCUS_GLOBAL_FILTER_EVENT,
  TOGGLE_COLUMN_FILTERS_EVENT,
} from "../events";

describe("hotkey event name constants", () => {
  it("exposes the focus-global-filter event name", () => {
    expect(FOCUS_GLOBAL_FILTER_EVENT).toBe("chempal:focus-global-filter");
  });

  it("exposes the toggle-column-filters event name", () => {
    expect(TOGGLE_COLUMN_FILTERS_EVENT).toBe("chempal:toggle-column-filters");
  });

  it("exposes the abort-search event name", () => {
    expect(ABORT_SEARCH_EVENT).toBe("chempal:abort-search");
  });

  it("uses a unique name per event", () => {
    const names = [
      FOCUS_GLOBAL_FILTER_EVENT,
      TOGGLE_COLUMN_FILTERS_EVENT,
      ABORT_SEARCH_EVENT,
    ];
    expect(new Set(names).size).toBe(names.length);
  });
});
