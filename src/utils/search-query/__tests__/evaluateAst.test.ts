import { ratio } from "fuzzball";
import { describe, expect, it } from "vitest";
import { scoreAstMatch, substringScorer } from "../evaluateAst";
import { parseSearchQuery } from "../parseSearchQuery";
import type { SearchAst } from "../types";

const term = (value: string): SearchAst => ({ type: "term", value, phrase: false });

// Deterministic exact-substring scorer for stable assertions.
const opts = { scorer: substringScorer, threshold: 1 };

describe("scoreAstMatch", () => {
  it("matches a single term as a substring", () => {
    expect(scoreAstMatch("Sodium Chloride", term("sodium"), opts)).toBe(100);
    expect(scoreAstMatch("Acetone", term("sodium"), opts)).toBeNull();
  });

  it("AND requires both branches", () => {
    const ast: SearchAst = { type: "and", left: term("sodium"), right: term("chloride") };
    expect(scoreAstMatch("Sodium Chloride", ast, opts)).toBe(100);
    expect(scoreAstMatch("Sodium Hydroxide", ast, opts)).toBeNull();
  });

  it("OR needs at least one branch", () => {
    const ast: SearchAst = { type: "or", left: term("sodium"), right: term("potassium") };
    expect(scoreAstMatch("Potassium Nitrate", ast, opts)).toBe(100);
    expect(scoreAstMatch("Acetone", ast, opts)).toBeNull();
  });

  it("NOT excludes matches of the operand", () => {
    const ast: SearchAst = {
      type: "and",
      left: term("sodium"),
      right: { type: "not", operand: term("borohydride") },
    };
    expect(scoreAstMatch("Sodium Chloride", ast, opts)).toBe(1);
    expect(scoreAstMatch("Sodium Borohydride", ast, opts)).toBeNull();
  });

  it("combines scores with min for AND and max for OR using a real scorer", () => {
    const ast: SearchAst = {
      type: "or",
      left: term("sodium chloride"),
      right: term("xyz"),
    };
    const score = scoreAstMatch("Sodium Chloride", ast, { scorer: ratio, threshold: 50 });
    expect(score).not.toBeNull();
    expect(score).toBeGreaterThan(50);
  });

  describe("chemical-name precision (regression for cross-matching)", () => {
    const ast = parseSearchQuery("sodium hydroxide OR potassium carbonate").ast;
    const opts = { scorer: ratio, threshold: 50, fuzzyWords: true };
    const matches = (title: string): boolean => scoreAstMatch(title, ast, opts) !== null;

    it("matches the intended chemicals", () => {
      expect(matches("Sodium Hydroxide, Pellets, 98%")).toBe(true);
      expect(matches("Potassium Carbonate Anhydrous")).toBe(true);
    });

    it("does not cross-match similar chemicals sharing one word", () => {
      expect(matches("Potassium Hydroxide")).toBe(false);
      expect(matches("Sodium Carbonate")).toBe(false);
      expect(matches("Sodium Bicarbonate")).toBe(false);
    });

    it("tolerates a small typo per word when fuzzyWords is on", () => {
      expect(matches("Sodium Hydroxde Solution")).toBe(true);
    });

    it("is strict (substring only) when fuzzyWords is off", () => {
      const strict = (title: string): boolean =>
        scoreAstMatch(title, ast, { scorer: ratio, threshold: 50 }) !== null;
      expect(strict("Sodium Hydroxide")).toBe(true);
      expect(strict("Sodium Hydroxde")).toBe(false);
      expect(strict("Potassium Hydroxide")).toBe(false);
    });
  });
});
