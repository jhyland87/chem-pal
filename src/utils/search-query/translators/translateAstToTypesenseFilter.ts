import type { SearchAst } from "../types";

/**
 * Builds a single Typesense `name` condition. The value is backtick-quoted so
 * phrases and special characters are handled literally. Negation uses Typesense's
 * substring-exclusion operator `:!`.
 *
 * @param value - The phrase to match.
 * @param negated - Whether this leaf is negated.
 * @returns A Typesense filter condition string.
 * @source
 */
function leaf(value: string, negated: boolean): string {
  const safe = value.replace(/`/g, "");
  return negated ? `name:!\`${safe}\`` : `name:\`${safe}\``;
}

/**
 * Recursively builds a Typesense `filter_by` expression, pushing negation down
 * to the leaves via De Morgan's laws (Typesense has no expression-level NOT, only
 * the per-field `:!` substring-exclusion operator).
 *
 * @param ast - The (sub-)tree to translate.
 * @param negated - Whether the current context is under an odd number of NOTs.
 * @returns A Typesense filter expression string.
 * @source
 */
function build(ast: SearchAst, negated: boolean): string {
  switch (ast.type) {
    case "term":
      return leaf(ast.value, negated);
    case "and": {
      const op = negated ? "||" : "&&";
      return `(${build(ast.left, negated)} ${op} ${build(ast.right, negated)})`;
    }
    case "or": {
      const op = negated ? "&&" : "||";
      return `(${build(ast.left, negated)} ${op} ${build(ast.right, negated)})`;
    }
    case "not":
      return build(ast.operand, !negated);
  }
}

/**
 * Translates a {@link SearchAst} into a Typesense `filter_by` string over the
 * `name` field, for use alongside `q: "*"` in a Typesense search request.
 *
 * @param ast - The parsed query tree.
 * @returns A Typesense `filter_by` expression.
 * @example
 * ```ts
 * translateAstToTypesenseFilter({ type: "and",
 *   left: { type: "term", value: "Sodium Borohydride", phrase: true },
 *   right: { type: "not", operand: { type: "term", value: "triacetoxy", phrase: false } } });
 * // "(name:`Sodium Borohydride` && name:!`triacetoxy`)"
 * ```
 * @source
 */
export function translateAstToTypesenseFilter(ast: SearchAst): string {
  return build(ast, false);
}
