import {
  partial_ratio,
  partial_token_set_ratio,
  partial_token_similarity_sort_ratio,
  partial_token_sort_ratio,
  ratio,
  token_set_ratio,
  token_similarity_sort_ratio,
  token_sort_ratio,
  WRatio,
} from "fuzzball";

/**
 * @group Constants
 * Fuzz-match scorer registry shared between `SupplierBase.fuzzyFilter` and the
 * Advanced drawer section's override selector. Keys are stored in
 * `userSettings.fuzzScorerOverride`; when present at search time they replace
 * each supplier's per-class `fuzzScorer` default.
 *
 * `distance` is intentionally excluded — it's an edit distance (lower = more
 * similar), while all other scorers return 0–100 (higher = more similar), so
 * it doesn't plug into the same cutoff/filter flow.
 * @source
 */
export type FuzzScorerFn = (str1: string, str2: string) => number;

export const FUZZ_SCORERS = {
  ratio,
  partial_ratio,
  token_sort_ratio,
  token_set_ratio,
  token_similarity_sort_ratio,
  partial_token_sort_ratio,
  partial_token_set_ratio,
  partial_token_similarity_sort_ratio,
  WRatio,
} as const satisfies Record<string, FuzzScorerFn>;

export type FuzzScorerName = keyof typeof FUZZ_SCORERS;

/**
 * Ordered list of scorer names for UI option rendering. Kept as a tuple so the
 * select menu preserves the "simple → compound" visual ordering we use in the
 * comparison log.
 * @source
 */
export const FUZZ_SCORER_NAMES: readonly FuzzScorerName[] = [
  "ratio",
  "partial_ratio",
  "token_sort_ratio",
  "token_set_ratio",
  "token_similarity_sort_ratio",
  "partial_token_sort_ratio",
  "partial_token_set_ratio",
  "partial_token_similarity_sort_ratio",
  "WRatio",
];

/**
 * Type guard — narrows an arbitrary string (e.g. out of `userSettings`) to a
 * valid scorer key, so callers can safely index `FUZZ_SCORERS[name]`.
 * @param name - Candidate scorer name.
 * @returns True when `name` is a registered scorer.
 * @example
 * ```ts
 * if (isFuzzScorerName(userSettings.fuzzScorerOverride)) {
 *   const scorer = FUZZ_SCORERS[userSettings.fuzzScorerOverride];
 * }
 * ```
 * @source
 */
export function isFuzzScorerName(name: unknown): name is FuzzScorerName {
  return typeof name === "string" && name in FUZZ_SCORERS;
}
