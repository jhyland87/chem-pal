import type { SearchAst } from "../types";

/**
 * Translates a {@link SearchAst} into FreeFind's refined-search syntax (the
 * engine LiMac delegates to). Phrases are parenthesized so multi-word terms stay
 * grouped, and boolean nodes use FreeFind's `AND`/`OR`/`NOT` keywords.
 *
 * @category Utils
 * @group Converters
 * @param ast - The parsed query tree.
 * @returns A FreeFind query string.
 * @example
 * ```ts
 * translateAstToFreefind({ type: "or",
 *   left: { type: "term", value: "sulfuric acid", phrase: true },
 *   right: { type: "term", value: "boric acid", phrase: true } });
 * // "(sulfuric acid) OR (boric acid)"
 * ```
 * @source
 */
export function translateAstToFreefind(ast: SearchAst): string {
  switch (ast.type) {
    case "term":
      return `(${ast.value})`;
    case "and":
      return `${translateAstToFreefind(ast.left)} AND ${translateAstToFreefind(ast.right)}`;
    case "or":
      return `${translateAstToFreefind(ast.left)} OR ${translateAstToFreefind(ast.right)}`;
    case "not":
      return `NOT ${translateAstToFreefind(ast.operand)}`;
  }
}
