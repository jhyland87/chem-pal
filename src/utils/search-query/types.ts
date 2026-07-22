/**
 * Normalized search-query AST shared across the advanced-search feature.
 *
 * This tree is intentionally decoupled from `liqe`'s own AST so the rest of the
 * codebase (evaluator, translators, suppliers) never imports liqe types. Only
 * {@link parseSearchQuery} knows about liqe; everything downstream consumes
 * {@link SearchAst}.
 *
 * @group Search
 */

/**
 * A single search phrase leaf (e.g. `Potassium Permanganate`).
 * @category Utils
 * @group Search
 */
export interface TermNode {
  type: 'term';
  /** The phrase to match against a product title. */
  value: string;
  /** True when the value came from (or was normalized to) a multi-word phrase. */
  phrase: boolean;
}

/**
 * Boolean AND of two sub-expressions.
 * @category Utils
 * @group Search
 */
export interface AndNode {
  type: 'and';
  left: SearchAst;
  right: SearchAst;
}

/**
 * Boolean OR of two sub-expressions.
 * @category Utils
 * @group Search
 */
export interface OrNode {
  type: 'or';
  left: SearchAst;
  right: SearchAst;
}

/**
 * Boolean negation of a sub-expression.
 * @category Utils
 * @group Search
 */
export interface NotNode {
  type: 'not';
  operand: SearchAst;
}

/**
 * A node in the normalized search-query tree.
 * @category Utils
 * @group Search
 */
export type SearchAst = TermNode | AndNode | OrNode | NotNode;

/**
 * The result of parsing a raw search string.
 * @category Utils
 * @group Search
 */
export interface ParsedSearchQuery {
  /** The original, untrimmed user input. */
  raw: string;
  /** The normalized AST. Always present — a plain query yields a single {@link TermNode}. */
  ast: SearchAst;
  /** True when the query used boolean operators or parentheses. */
  isAdvanced: boolean;
}
