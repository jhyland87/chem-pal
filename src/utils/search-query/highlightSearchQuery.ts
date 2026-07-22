import { detectTermType } from "./detectTermType";
import { extractAllPositiveTerms } from "./extractPositiveTerms";
import { hasAdvancedSyntax, OPERATOR_WORDS, parseSearchQuery } from "./parseSearchQuery";

/** Number of rainbow colors cycled for nested parentheses (matched pairs share a depth). */
const PAREN_PALETTE_SIZE = 5;

/**
 * How a typed query is being interpreted, driving the search box's visual treatment.
 * @category Utils
 * @group Search
 */
export type HighlightState = "plain" | "advanced" | "error";

/**
 * The token classes the highlighter colorizes.
 * @category Utils
 * @group Search
 */
export type HighlightTokenKind = "keyword" | "paren" | "quoted" | "term" | "whitespace";

/**
 * A single highlightable span over the raw query string.
 * @category Utils
 * @group Search
 */
export interface HighlightToken {
  kind: HighlightTokenKind;
  /** The exact source text of this token (used verbatim so output round-trips). */
  text: string;
  /** Inclusive start offset into the raw query. */
  start: number;
  /** Exclusive end offset into the raw query. */
  end: number;
  /** Nesting depth (mod `PAREN_PALETTE_SIZE`) for a paren token's rainbow color. */
  depth?: number;
  /** True for an unmatched parenthesis or an unterminated quote. */
  error?: boolean;
}

/**
 * Result of highlighting a query: markup plus how the query is interpreted.
 * @category Utils
 * @group Search
 */
export interface HighlightResult {
  /** Token-wrapped, HTML-escaped markup of the raw query (round-trips to the input). */
  html: string;
  /** Whether the query is plain, a valid advanced query, or an invalid one. */
  state: HighlightState;
  /** Human-readable reason, present only when `state` is `"error"`. */
  message?: string;
}

/** HTML entities escaped before injecting query text into the highlight backdrop. */
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapes the HTML-significant characters in a string so query text can be injected into the
 * highlight backdrop without breaking markup or allowing injection.
 * @param value - Raw text to escape.
 * @returns The text with `& < > " '` replaced by entities.
 * @example
 * ```typescript
 * escapeHtml('a < "b"'); // 'a &lt; &quot;b&quot;'
 * ```
 * @source
 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * Tests whether a character is query whitespace (space, tab, or newline).
 * @param char - A single character.
 * @returns True when the character is whitespace.
 * @source
 */
function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n";
}

/**
 * Splits a raw query into highlightable tokens that carry source offsets and, unlike the
 * parser's `tokenize`, preserve whitespace and the quote characters so the rendered markup
 * round-trips exactly to the input. Bare words matching {@link OPERATOR_WORDS} are tagged as
 * `keyword`; parens carry a nesting `depth` for rainbow coloring; unmatched parens and
 * unterminated quotes are flagged with `error`.
 * @category Utils
 * @group Search
 * @param input - The raw query string.
 * @returns Ordered tokens covering every character of `input`.
 * @example
 * ```typescript
 * tokenizeWithSpans("a AND (b)");
 * // term "a", ws, keyword "AND", ws, paren "(" depth 0, term "b", paren ")" depth 0
 * ```
 * @source
 */
export function tokenizeWithSpans(input: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  const openParenTokens: number[] = [];
  let depth = 0;
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (isWhitespace(char)) {
      const start = i;
      while (i < input.length && isWhitespace(input[i])) i++;
      tokens.push({ kind: "whitespace", text: input.slice(start, i), start, end: i });
      continue;
    }

    if (char === "(") {
      tokens.push({
        kind: "paren",
        text: "(",
        start: i,
        end: i + 1,
        depth: depth % PAREN_PALETTE_SIZE,
      });
      openParenTokens.push(tokens.length - 1);
      depth++;
      i++;
      continue;
    }

    if (char === ")") {
      if (openParenTokens.length > 0) {
        openParenTokens.pop();
        depth--;
        tokens.push({
          kind: "paren",
          text: ")",
          start: i,
          end: i + 1,
          depth: depth % PAREN_PALETTE_SIZE,
        });
      } else {
        tokens.push({ kind: "paren", text: ")", start: i, end: i + 1, error: true });
      }
      i++;
      continue;
    }

    if (char === '"') {
      const start = i;
      i++;
      while (i < input.length && input[i] !== '"') i++;
      const terminated = i < input.length;
      if (terminated) i++; // consume the closing quote
      tokens.push({
        kind: "quoted",
        text: input.slice(start, i),
        start,
        end: i,
        error: !terminated,
      });
      continue;
    }

    // Bare word: runs until whitespace, a paren, or a quote.
    const start = i;
    while (
      i < input.length &&
      !isWhitespace(input[i]) &&
      input[i] !== "(" &&
      input[i] !== ")" &&
      input[i] !== '"'
    ) {
      i++;
    }
    const text = input.slice(start, i);
    const kind: HighlightTokenKind = OPERATOR_WORDS.has(text.toUpperCase()) ? "keyword" : "term";
    tokens.push({ kind, text, start, end: i });
  }

  // Any parens still open at the end are unbalanced.
  for (const idx of openParenTokens) {
    tokens[idx].error = true;
  }

  return tokens;
}

/**
 * Renders one token to an HTML span (or bare escaped text for whitespace), tagging it with
 * the classes the stylesheet themes: `hl-<kind>`, `hl-paren-<depth>`, and `hl-error`.
 * @param token - The token to render.
 * @returns The token's HTML fragment.
 * @example
 * ```typescript
 * renderToken({ kind: "keyword", text: "AND", start: 0, end: 3 });
 * // '<span class="hl-keyword">AND</span>'
 * ```
 * @source
 */
function renderToken(token: HighlightToken, advanced: boolean): string {
  const text = escapeHtml(token.text);
  if (token.kind === "whitespace") return text;

  // A quoted phrase is colored exactly like the equivalent bare term — the
  // quotes only affect parsing, not the term's type — so both use `hl-term`.
  const isTermLike = token.kind === "term" || token.kind === "quoted";
  const classes = [isTermLike ? "hl-term" : `hl-${token.kind}`];
  if (token.kind === "paren" && token.depth !== undefined) {
    classes.push(`hl-paren-${token.depth}`);
  }
  // Tint a term by what it looks like — CAS, SMILES, or formula. Detection runs
  // on the inner text of a quoted token.
  if (isTermLike) {
    const inner = token.kind === "quoted" ? token.text.replace(/^"|"$/g, "") : token.text;
    const termType = detectTermType(inner);
    if (termType !== "string") {
      classes.push(`hl-term-${termType}`);
    } else if (advanced) {
      // A plain-string term gets its own color, but only inside an advanced
      // query (a lone plain search stays uncolored).
      classes.push("hl-term-string");
    }
  }
  if (token.error) classes.push("hl-error");

  return `<span class="${classes.join(" ")}">${text}</span>`;
}

/**
 * Highlights a search query for the search box, returning token-colored markup plus how the
 * query is interpreted. The result mirrors {@link parseSearchQuery}'s own grammar:
 * - `"plain"` — no advanced syntax (rendered without coloring by the input component).
 * - `"advanced"` — a valid boolean query with at least one inclusive term.
 * - `"error"` — advanced syntax that is malformed (e.g. unbalanced parens) or has no
 *   inclusive constraint (only `NOT`/exclusions), which would match almost everything.
 * @category Utils
 * @group Search
 * @param input - The raw query string from the search box.
 * @returns The markup, interpretation state, and an error message when invalid.
 * @example
 * ```typescript
 * highlightSearchQuery("acetone").state;            // "plain"
 * highlightSearchQuery("a AND b").state;            // "advanced"
 * highlightSearchQuery("NOT a AND NOT b").state;    // "error" (no inclusive term)
 * highlightSearchQuery("a AND (b").state;           // "error" (unbalanced parens)
 * ```
 * @source
 */
export function highlightSearchQuery(input: string): HighlightResult {
  const tokens = tokenizeWithSpans(input);
  const advanced = hasAdvancedSyntax(input);
  const html = tokens.map((token) => renderToken(token, advanced)).join("");

  if (!advanced) {
    return { html, state: "plain" };
  }

  const parsed = parseSearchQuery(input);

  // Advanced syntax present but the parser fell back to a plain term ⇒ malformed.
  if (!parsed.isAdvanced) {
    const hasUnbalancedParens = tokens.some((token) => token.kind === "paren" && token.error);
    return {
      html,
      state: "error",
      message: hasUnbalancedParens ? "Unbalanced parentheses." : "Invalid advanced query syntax.",
    };
  }

  if (extractAllPositiveTerms(parsed.ast).length === 0) {
    return {
      html,
      state: "error",
      message: "Add at least one term to include — a query of only exclusions matches everything.",
    };
  }

  return { html, state: "advanced" };
}
