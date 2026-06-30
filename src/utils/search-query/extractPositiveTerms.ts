import type { SearchAst } from "./types";

/**
 * Extracts the positive (non-negated) OR-groups from a query tree as a
 * disjunctive-normal-form-ish list: the outer array is OR-ed alternatives, and
 * each inner array is an AND-group of phrases. Negated branches are dropped,
 * since a keyword-only backend has nothing positive to search for in them.
 *
 * Used by the keyword-only fallback (one backend request per OR-group) and as a
 * basis for native filter construction.
 *
 * @param ast - The parsed query tree.
 * @returns OR-groups, each an AND-group of phrase strings. Empty groups are omitted.
 * @example
 * ```ts
 * // (a AND b) OR c
 * extractOrGroups(ast); // [["a", "b"], ["c"]]
 * // a AND NOT b
 * extractOrGroups(ast); // [["a"]]
 * ```
 * @source
 */
export function extractOrGroups(ast: SearchAst): string[][] {
  switch (ast.type) {
    case "term":
      return ast.value === "" ? [] : [[ast.value]];
    case "or":
      return [...extractOrGroups(ast.left), ...extractOrGroups(ast.right)];
    case "and": {
      const left = extractOrGroups(ast.left);
      const right = extractOrGroups(ast.right);
      if (left.length === 0) return right;
      if (right.length === 0) return left;
      // Cartesian product so each combined alternative keeps its AND-group terms.
      const combined: string[][] = [];
      for (const l of left) {
        for (const r of right) {
          combined.push([...l, ...r]);
        }
      }
      return combined;
    }
    case "not":
      // Negated branches yield no positive search terms.
      return [];
    default:
      return [];
  }
}

/**
 * Flattens a query tree to its unique positive (non-negated) terms. Used by
 * backends that only offer a single OR-ish full-text search field (e.g. Magento
 * `search`): send all positive terms as one query to get a broad candidate pool,
 * then refine with the client-side boolean predicate.
 *
 * @param ast - The parsed query tree.
 * @returns Unique positive term strings, in first-seen order.
 * @example
 * ```ts
 * // potassium hydroxide OR sodium carbonate
 * extractAllPositiveTerms(ast); // ["potassium hydroxide", "sodium carbonate"]
 * // Sodium AND NOT Borohydride
 * extractAllPositiveTerms(ast); // ["Sodium"]
 * ```
 * @source
 */
export function extractAllPositiveTerms(ast: SearchAst): string[] {
  return [...new Set(extractOrGroups(ast).flat())];
}
