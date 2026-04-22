import { describe, expect, it } from "vitest";
import {
  FUZZ_SCORER_NAMES,
  FUZZ_SCORERS,
  isFuzzScorerName,
} from "../fuzzScorers";

describe("fuzzScorers", () => {
  describe("FUZZ_SCORERS registry", () => {
    it("every entry is a callable (str1, str2) => number", () => {
      for (const [name, fn] of Object.entries(FUZZ_SCORERS)) {
        expect(typeof fn, `scorer "${name}" is not a function`).toBe("function");
        const score = fn("foo", "foo");
        expect(typeof score, `scorer "${name}" did not return a number`).toBe("number");
        expect(Number.isFinite(score)).toBe(true);
      }
    });

    it("returns 100 for identical non-empty strings (for every 0–100 scorer)", () => {
      for (const [name, fn] of Object.entries(FUZZ_SCORERS)) {
        expect(fn("sodium chloride", "sodium chloride"), `scorer "${name}"`).toBe(100);
      }
    });

    it("excludes edit-distance (`distance`) — the registry is 0–100 scorers only", () => {
      // `distance` returns a raw edit distance (lower = closer), so it isn't
      // interchangeable with the other scorers and is intentionally omitted.
      expect("distance" in FUZZ_SCORERS).toBe(false);
    });
  });

  describe("FUZZ_SCORER_NAMES", () => {
    it("contains every key in FUZZ_SCORERS (and nothing else)", () => {
      expect([...FUZZ_SCORER_NAMES].sort()).toEqual(Object.keys(FUZZ_SCORERS).sort());
    });

    it("preserves a stable, readable ordering (simple → compound)", () => {
      // First entry should be the baseline `ratio`, last should be `WRatio`.
      expect(FUZZ_SCORER_NAMES[0]).toBe("ratio");
      expect(FUZZ_SCORER_NAMES[FUZZ_SCORER_NAMES.length - 1]).toBe("WRatio");
    });
  });

  describe("isFuzzScorerName", () => {
    it("returns true for every registered scorer name", () => {
      for (const name of FUZZ_SCORER_NAMES) {
        expect(isFuzzScorerName(name)).toBe(true);
      }
    });

    it("returns false for unknown strings", () => {
      expect(isFuzzScorerName("not_a_scorer")).toBe(false);
      expect(isFuzzScorerName("")).toBe(false);
      expect(isFuzzScorerName("Ratio")).toBe(false); // case-sensitive
      expect(isFuzzScorerName("distance")).toBe(false); // intentionally excluded
    });

    it("returns false for non-string inputs", () => {
      expect(isFuzzScorerName(null)).toBe(false);
      expect(isFuzzScorerName(undefined)).toBe(false);
      expect(isFuzzScorerName(42)).toBe(false);
      expect(isFuzzScorerName({})).toBe(false);
      expect(isFuzzScorerName([])).toBe(false);
    });

    it("narrows the type so FUZZ_SCORERS[name] is callable", () => {
      const candidate: unknown = "token_set_ratio";
      if (isFuzzScorerName(candidate)) {
        // Compile-time narrowing — this line only type-checks if the guard
        // narrows `candidate` to a valid key of FUZZ_SCORERS.
        expect(FUZZ_SCORERS[candidate]("acetone", "acetone")).toBe(100);
      } else {
        throw new Error("expected candidate to be narrowed to a valid scorer name");
      }
    });
  });
});
