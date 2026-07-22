import { parse as parseLiqe } from 'liqe';
import type { ParsedSearchQuery, SearchAst } from './types';

/**
 * Bare words that act as boolean operators (case-insensitive).
 * @category Utils
 * @group Search
 */
export const OPERATOR_WORDS = new Set(['AND', 'OR', 'NOT']);

/** A token produced by {@link tokenize}. */
interface Token {
  kind: 'word' | 'quoted' | 'paren';
  value: string;
}

/**
 * Splits a raw query into structural tokens: parentheses, double-quoted
 * strings, and bare words. Whitespace is a boundary and is otherwise dropped.
 * Special characters inside a bare word (e.g. `%` in `99%`) are preserved so
 * the caller can re-quote them safely.
 *
 * @param input - The raw query string.
 * @returns The ordered token list.
 * @example
 * ```ts
 * tokenize("Carbonate AND (Sodium OR Potassium)");
 * // [word Carbonate, word AND, paren (, word Sodium, word OR, word Potassium, paren )]
 * ```
 * @source
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let buffer = '';
  const flush = (): void => {
    if (buffer.length > 0) {
      tokens.push({ kind: 'word', value: buffer });
      buffer = '';
    }
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === ' ' || char === '\t' || char === '\n') {
      flush();
    } else if (char === '(' || char === ')') {
      flush();
      tokens.push({ kind: 'paren', value: char });
    } else if (char === '"') {
      flush();
      let content = '';
      i++;
      while (i < input.length && input[i] !== '"') {
        content += input[i];
        i++;
      }
      tokens.push({ kind: 'quoted', value: content });
    } else {
      buffer += char;
    }
  }
  flush();
  return tokens;
}

/**
 * Returns true when a word token is a boolean operator keyword.
 *
 * @param token - The token to test.
 * @returns True for AND/OR/NOT word tokens.
 * @source
 */
function isOperatorToken(token: Token): boolean {
  return token.kind === 'word' && OPERATOR_WORDS.has(token.value.toUpperCase());
}

/**
 * Rewrites a raw query so every run of consecutive non-operator words becomes a
 * single double-quoted phrase before it reaches liqe. This is essential for two
 * reasons: (1) liqe otherwise treats adjacent words as an implicit AND with a
 * precedence that mis-groups `A B OR C D` as `((A AND B) OR C) AND D` instead of
 * the intended `(A B) OR (C D)`; (2) quoting escapes special characters (e.g.
 * `99%`) that liqe's bare-literal grammar rejects.
 *
 * @param input - The raw query string.
 * @returns The query with bare phrase runs quoted, ready for `liqe.parse`.
 * @example
 * ```ts
 * quotePhrases("Potassium Permanganate OR Sodium Borohydride");
 * // '"Potassium Permanganate" OR "Sodium Borohydride"'
 * quotePhrases("Potassium Permanganate AND 99%");
 * // '"Potassium Permanganate" AND "99%"'
 * ```
 * @source
 */
function quotePhrases(input: string): string {
  const tokens = tokenize(input);
  const out: string[] = [];
  let run: string[] = [];

  const flushRun = (): void => {
    if (run.length > 0) {
      // Strip any stray quotes so they can't break the wrapper we add.
      out.push(`"${run.join(' ').replace(/"/g, '')}"`);
      run = [];
    }
  };

  for (const token of tokens) {
    if (token.kind === 'word' && !isOperatorToken(token)) {
      run.push(token.value);
      continue;
    }
    flushRun();
    if (token.kind === 'quoted') {
      out.push(`"${token.value.replace(/"/g, '')}"`);
    } else {
      out.push(token.value);
    }
  }
  flushRun();
  return out.join(' ');
}

/**
 * Normalizes a liqe AST node into our decoupled {@link SearchAst}.
 *
 * @param node - A liqe AST node (typed `unknown` — liqe's types stay internal).
 * @returns The normalized node.
 * @throws When the node shape is unrecognized, so the caller can fall back to a
 *   plain search.
 * @source
 */
function normalizeLiqeNode(node: unknown): SearchAst {
  if (typeof node !== 'object' || node === null || !('type' in node)) {
    throw new Error('Unrecognized liqe node');
  }
  const typed = node as { type: string; [key: string]: unknown };

  switch (typed.type) {
    case 'Tag': {
      const expression = typed.expression as { value?: unknown } | undefined;
      const value = expression?.value;
      const text = value == null ? '' : String(value);
      return { type: 'term', value: text, phrase: text.includes(' ') };
    }
    case 'LogicalExpression': {
      const operator = (typed.operator as { operator?: string } | undefined)?.operator;
      const left = normalizeLiqeNode(typed.left);
      const right = normalizeLiqeNode(typed.right);
      return operator === 'OR' ? { type: 'or', left, right } : { type: 'and', left, right };
    }
    case 'UnaryOperator':
      return { type: 'not', operand: normalizeLiqeNode(typed.operand) };
    case 'ParenthesizedExpression':
      return normalizeLiqeNode(typed.expression);
    case 'EmptyExpression':
      return { type: 'term', value: '', phrase: false };
    default:
      throw new Error(`Unsupported liqe node type: ${typed.type}`);
  }
}

/**
 * Returns true when the query contains boolean operators or parentheses and so
 * should be parsed as an advanced query rather than a plain search term.
 *
 * @category Utils
 * @group Search
 * @param input - The raw query string.
 * @returns True when advanced syntax is present.
 * @source
 */
export function hasAdvancedSyntax(input: string): boolean {
  return tokenize(input).some((token) => token.kind === 'paren' || isOperatorToken(token));
}

/**
 * Parses a raw user search string into a {@link ParsedSearchQuery}.
 *
 * A plain query (no operators/parens) returns a single-term AST with
 * `isAdvanced: false`, so every downstream consumer can preserve today's exact
 * behavior. Any parse failure — unbalanced parentheses, a dangling operator,
 * unsupported syntax — degrades gracefully to that same plain single-term form
 * rather than throwing, so a malformed advanced query never breaks a search.
 *
 * @category Utils
 * @group Search
 * @param input - The raw search string from the search box.
 * @returns The parsed query (always usable; never throws).
 * @example
 * ```ts
 * parseSearchQuery("acetone");
 * // { raw: "acetone", ast: { type: "term", value: "acetone", phrase: false }, isAdvanced: false }
 *
 * parseSearchQuery("Carbonate AND (Sodium OR Potassium)");
 * // { isAdvanced: true, ast: { type: "and", left: {term Carbonate}, right: { type: "or", ... } } }
 * ```
 * @source
 */
export function parseSearchQuery(input: string): ParsedSearchQuery {
  const trimmed = input.trim();

  if (trimmed === '') {
    return { raw: input, ast: { type: 'term', value: '', phrase: false }, isAdvanced: false };
  }

  if (!hasAdvancedSyntax(trimmed)) {
    return {
      raw: input,
      ast: { type: 'term', value: trimmed, phrase: trimmed.includes(' ') },
      isAdvanced: false,
    };
  }

  try {
    const ast = normalizeLiqeNode(parseLiqe(quotePhrases(trimmed)));
    return { raw: input, ast, isAdvanced: true };
  } catch {
    // Malformed advanced syntax — fall back to a plain search over the raw text.
    return {
      raw: input,
      ast: { type: 'term', value: trimmed, phrase: trimmed.includes(' ') },
      isAdvanced: false,
    };
  }
}
