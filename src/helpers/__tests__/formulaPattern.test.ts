import { describe, expect, it } from "vitest";
import { buildFormulaPattern, pickBestFormula, scoreFormula } from "../formulaPattern";

describe("buildFormulaPattern", () => {
  it("finds every formula candidate in the input", () => {
    const re = buildFormulaPattern("<su[bp]>[1-9][0-9]*</su[bp]>");
    const matches = [..."H<sub>2</sub>O and CO<sub>2</sub>".matchAll(re)].map((m) => m[0]);
    expect(matches).toEqual(["H<sub>2</sub>O", "CO<sub>2</sub>"]);
  });
});

describe("scoreFormula / pickBestFormula", () => {
  it("scores a real formula above a two-letter coincidence", () => {
    expect(scoreFormula("NaOSOCH3")).toBeGreaterThan(scoreFormula("IN"));
    expect(scoreFormula("NaOSOCH3")).toBeGreaterThan(scoreFormula("CS"));
  });

  it("picks the most-likely candidate", () => {
    expect(pickBestFormula(["IN", "CS", "NaOSOCH3"])).toBe("NaOSOCH3");
  });

  it("returns undefined for an empty candidate list", () => {
    expect(pickBestFormula([])).toBeUndefined();
  });
});
