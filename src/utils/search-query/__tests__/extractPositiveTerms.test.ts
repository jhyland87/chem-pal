import { describe, expect, it } from "vitest";
import { extractAllPositiveTerms, extractOrGroups } from "../extractPositiveTerms";
import { parseSearchQuery } from "../parseSearchQuery";
import type { SearchAst } from "../types";

const term = (value: string): SearchAst => ({ type: "term", value, phrase: false });

describe("extractOrGroups", () => {
  it("returns a single group for a single term", () => {
    expect(extractOrGroups(term("acetone"))).toEqual([["acetone"]]);
  });

  it("splits OR into separate groups", () => {
    const ast: SearchAst = { type: "or", left: term("sodium"), right: term("potassium") };
    expect(extractOrGroups(ast)).toEqual([["sodium"], ["potassium"]]);
  });

  it("combines AND terms within a group", () => {
    const ast: SearchAst = { type: "and", left: term("sodium"), right: term("chloride") };
    expect(extractOrGroups(ast)).toEqual([["sodium", "chloride"]]);
  });

  it("distributes AND over OR (cartesian)", () => {
    // (a OR b) AND c
    const ast: SearchAst = {
      type: "and",
      left: { type: "or", left: term("a"), right: term("b") },
      right: term("c"),
    };
    expect(extractOrGroups(ast)).toEqual([
      ["a", "c"],
      ["b", "c"],
    ]);
  });

  it("drops negated branches", () => {
    const ast: SearchAst = {
      type: "and",
      left: term("sodium"),
      right: { type: "not", operand: term("borohydride") },
    };
    expect(extractOrGroups(ast)).toEqual([["sodium"]]);
  });
});

describe("extractAllPositiveTerms", () => {
  it("flattens OR phrases to unique terms", () => {
    expect(
      extractAllPositiveTerms(parseSearchQuery("potassium hydroxide OR sodium carbonate").ast),
    ).toEqual(["potassium hydroxide", "sodium carbonate"]);
  });

  it("drops negated terms", () => {
    expect(extractAllPositiveTerms(parseSearchQuery("Sodium AND NOT Borohydride").ast)).toEqual([
      "Sodium",
    ]);
  });

  it("dedupes a common factor", () => {
    expect(
      extractAllPositiveTerms(parseSearchQuery("(Sodium OR Potassium) AND Hydroxide").ast).sort(),
    ).toEqual(["Hydroxide", "Potassium", "Sodium"]);
  });
});
