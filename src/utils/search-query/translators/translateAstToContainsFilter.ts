import type { SearchAst } from '../types';

/**
 * A leaf field-match condition in a CONTAINS filter tree.
 * @category Utils
 * @group Converters
 */
export interface ContainsTermFilter {
  term: { field: string; op: string; values: string[] };
}

/**
 * A node in a generic boolean CONTAINS filter tree, shared by GraphQL backends
 * (Wix, Magento2) whose filter input uses the same `and`/`or`/`not`/`term`
 * shape. Either a leaf {@link ContainsTermFilter} or a boolean combinator.
 * @category Utils
 * @group Converters
 */
export type ContainsFilterNode =
  | ContainsTermFilter
  | { and: ContainsFilterNode[] }
  | { or: ContainsFilterNode[] }
  | { not: ContainsFilterNode };

/**
 * Translates a {@link SearchAst} into a generic boolean CONTAINS filter tree of
 * the form `{ and|or|not | term: { field, op: "CONTAINS", values } }`. Used by
 * GraphQL suppliers that accept this structure server-side, so the boolean
 * matching happens on the backend in a single request.
 *
 * @category Utils
 * @group Converters
 * @param ast - The parsed query tree.
 * @param wrapValue - Maps a term value to the stored value (e.g. add `*…*`
 *   wildcards for Wix). Defaults to identity.
 * @param field - The field name to match against. Defaults to `"name"`.
 * @returns A CONTAINS filter node.
 * @example
 * ```ts
 * translateAstToContainsFilter({ type: "or",
 *   left: { type: "term", value: "foo", phrase: false },
 *   right: { type: "term", value: "bar", phrase: false } });
 * // { or: [
 * //   { term: { field: "name", op: "CONTAINS", values: ["foo"] } },
 * //   { term: { field: "name", op: "CONTAINS", values: ["bar"] } },
 * // ] }
 * ```
 * @source
 */
export function translateAstToContainsFilter(
  ast: SearchAst,
  wrapValue: (value: string) => string = (value) => value,
  field: string = 'name',
): ContainsFilterNode {
  const translate = (node: SearchAst): ContainsFilterNode => {
    switch (node.type) {
      case 'term':
        return { term: { field, op: 'CONTAINS', values: [wrapValue(node.value)] } };
      case 'and':
        return { and: [translate(node.left), translate(node.right)] };
      case 'or':
        return { or: [translate(node.left), translate(node.right)] };
      case 'not':
        return { not: translate(node.operand) };
    }
  };
  return translate(ast);
}
