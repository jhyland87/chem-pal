import { translateAstToContainsFilter } from "./translateAstToContainsFilter";
import type { SearchAst } from "../types";

/**
 * Translates a {@link SearchAst} into a Wix catalog filter tree.
 *
 * Leaf terms become a `CONTAINS` match on the product `name` field (wrapped in
 * `*…*` wildcards, mirroring the single-term default in `SupplierBaseWix`).
 * Boolean nodes map to Wix's `and`/`or`/`not` combinators, which the catalog
 * `productsWithMetaData(filters: …)` endpoint accepts. Thin wrapper over the
 * shared {@link translateAstToContainsFilter} (its output is structurally a
 * `WixFilterNode`).
 *
 * @category Utils
 * @group Converters
 * @param ast - The parsed query tree.
 * @returns A Wix filter node suitable for `GraphQLQueryVariables.filters`.
 * @example
 * ```ts
 * translateAstToWixFilter({ type: "or",
 *   left: { type: "term", value: "Sodium", phrase: false },
 *   right: { type: "term", value: "Potassium", phrase: false } });
 * // { or: [
 * //   { term: { field: "name", op: "CONTAINS", values: ["*Sodium*"] } },
 * //   { term: { field: "name", op: "CONTAINS", values: ["*Potassium*"] } },
 * // ] }
 * ```
 * @source
 */
export function translateAstToWixFilter(ast: SearchAst): WixFilterNode {
  return translateAstToContainsFilter(ast, (value) => `*${value}*`);
}
