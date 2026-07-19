import type { SearchAst } from "../types";

/**
 * Escapes a value for use inside a Shopify Storefront search clause.
 *
 * @param value - The raw term word.
 * @returns The escaped word (backslashes and double quotes neutralized).
 * @source
 */
function escapeShopify(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Builds a `title:*word*` clause for each word in a phrase, AND-ing them so a
 * multi-word phrase stays a single logical unit. Mirrors how Shopify already
 * treats the bare multi-word default, keeping the candidate pool broad for the
 * client-side fuzzy filter to refine.
 *
 * @param value - The phrase term value.
 * @returns A Shopify clause string, parenthesized when it has multiple words.
 * @source
 */
function termToClause(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const clauses = words.map((word) => `title:*${escapeShopify(word)}*`);
  return clauses.length === 1 ? clauses[0] : `(${clauses.join(" AND ")})`;
}

/**
 * Translates a {@link SearchAst} into a Shopify Storefront search query string.
 *
 * @category Utils
 * @group Converters
 * @param ast - The parsed query tree.
 * @returns A Shopify search DSL string (e.g. `title:*foo* AND (title:*bar* OR title:*baz*)`).
 * @example
 * ```ts
 * translateAstToShopifyQuery({ type: "and",
 *   left: { type: "term", value: "Carbonate", phrase: false },
 *   right: { type: "or",
 *     left: { type: "term", value: "Sodium", phrase: false },
 *     right: { type: "term", value: "Potassium", phrase: false } } });
 * // "title:*Carbonate* AND (title:*Sodium* OR title:*Potassium*)"
 * ```
 * @source
 */
export function translateAstToShopifyQuery(ast: SearchAst): string {
  switch (ast.type) {
    case "term":
      return termToClause(ast.value);
    case "and":
      return `(${translateAstToShopifyQuery(ast.left)} AND ${translateAstToShopifyQuery(ast.right)})`;
    case "or":
      return `(${translateAstToShopifyQuery(ast.left)} OR ${translateAstToShopifyQuery(ast.right)})`;
    case "not":
      return `NOT ${translateAstToShopifyQuery(ast.operand)}`;
  }
}
