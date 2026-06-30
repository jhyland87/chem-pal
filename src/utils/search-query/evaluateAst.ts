import { partial_ratio } from "fuzzball";
import type { FuzzScorerFn } from "@/constants/fuzzScorers";
import type { SearchAst } from "./types";

/** Options for {@link scoreAstMatch}. */
export interface AstEvalOptions {
  /** Scorer used for a matched leaf's relevance (ranking only, not the gate). */
  scorer: FuzzScorerFn;
  /** Relevance floor (0–100) applied to a matched leaf's score. */
  threshold: number;
  /**
   * When true, a phrase word that isn't a literal substring of the title may
   * still count as present if it fuzzily matches (≥ {@link FUZZY_WORD_CUTOFF}),
   * giving mild typo tolerance. When false (or omitted), only exact
   * case-insensitive substring presence counts.
   */
  fuzzyWords?: boolean;
}

/**
 * Per-word fuzzy-presence cutoff. Deliberately high so chemically-similar but
 * distinct words don't cross-match (e.g. "sodium" must not satisfy "potassium"),
 * while still tolerating small typos.
 */
const FUZZY_WORD_CUTOFF = 88;

/**
 * Binary substring scorer: returns 100 when `term` is a case-insensitive
 * substring of `title`, else 0. Retained as a simple, deterministic scorer for
 * ranking/tests; the leaf *gate* in {@link scoreAstMatch} uses per-word presence.
 *
 * @param term - The phrase to look for.
 * @param title - The product title to search within.
 * @returns 100 on a substring hit, otherwise 0.
 * @example
 * ```ts
 * substringScorer("sodium", "Sodium Chloride"); // 100
 * substringScorer("zinc", "Sodium Chloride");   // 0
 * ```
 * @source
 */
export function substringScorer(term: string, title: string): number {
  return title.toLowerCase().includes(term.toLowerCase()) ? 100 : 0;
}

/**
 * Evaluates a single phrase leaf against a title. The leaf matches only when
 * *every* word of the phrase is present in the title (each as a case-insensitive
 * substring, or — when `fuzzyWords` is set — a high-confidence fuzzy match). This
 * keeps distinct chemical names apart: "sodium hydroxide" requires both "sodium"
 * and "hydroxide", so it never matches "sodium carbonate" or "potassium
 * hydroxide". A matched leaf's score is the configured scorer's similarity,
 * floored at the threshold so it survives downstream ranking.
 *
 * @param title - The product title to test.
 * @param value - The phrase to match.
 * @param options - Scorer, threshold, and fuzzy-word toggle.
 * @returns The leaf relevance score, or `null` when the phrase isn't fully present.
 * @source
 */
function evaluateLeaf(title: string, value: string, options: AstEvalOptions): number | null {
  const lowerTitle = title.toLowerCase();
  const words = value.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return options.threshold;
  }

  const isPresent = (word: string): boolean =>
    lowerTitle.includes(word) ||
    (options.fuzzyWords === true && partial_ratio(word, lowerTitle) >= FUZZY_WORD_CUTOFF);

  if (!words.every(isPresent)) {
    return null;
  }

  return Math.max(options.scorer(value.toLowerCase(), lowerTitle), options.threshold);
}

/**
 * Evaluates a product title against a {@link SearchAst}, returning a relevance
 * score when the boolean predicate holds, or `null` when it doesn't (so the item
 * is filtered out).
 *
 * Leaf matching is precise — every word of a phrase must be present (see
 * {@link evaluateLeaf}) — so the fuzzy similarity of one shared word can't pull
 * in a different chemical. Boolean nodes combine leaf scores: `and` takes the
 * weakest required match (`min`), `or` takes the best satisfied branch (`max`),
 * and `not` contributes a neutral score equal to the threshold.
 *
 * @param title - The product title to test.
 * @param ast - The parsed query tree.
 * @param options - The leaf scorer, threshold, and fuzzy-word toggle.
 * @returns A 0–100 relevance score, or `null` if the predicate fails.
 * @example
 * ```ts
 * const ast = { type: "or",
 *   left: { type: "term", value: "sodium hydroxide", phrase: true },
 *   right: { type: "term", value: "potassium carbonate", phrase: true } };
 * scoreAstMatch("Sodium Hydroxide 98%", ast, { scorer: ratio, threshold: 50 }); // a number
 * scoreAstMatch("Potassium Hydroxide", ast, { scorer: ratio, threshold: 50 });  // null
 * ```
 * @source
 */
export function scoreAstMatch(
  title: string,
  ast: SearchAst,
  options: AstEvalOptions,
): number | null {
  switch (ast.type) {
    case "term":
      return evaluateLeaf(title, ast.value, options);
    case "and": {
      const left = scoreAstMatch(title, ast.left, options);
      if (left === null) return null;
      const right = scoreAstMatch(title, ast.right, options);
      if (right === null) return null;
      return Math.min(left, right);
    }
    case "or": {
      const left = scoreAstMatch(title, ast.left, options);
      const right = scoreAstMatch(title, ast.right, options);
      if (left === null && right === null) return null;
      return Math.max(left ?? 0, right ?? 0);
    }
    case "not": {
      const operand = scoreAstMatch(title, ast.operand, options);
      return operand === null ? options.threshold : null;
    }
    default:
      return null;
  }
}
