import { describe, expect, it } from "vitest";
import { highlightSearchQuery, tokenizeWithSpans } from "../highlightSearchQuery";

/** Strips span markup and unescapes entities to recover the original text from `html`. */
const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

describe("tokenizeWithSpans", () => {
  it("covers every character in order (round-trips)", () => {
    const input = '  a AND ("b c" OR d) ';
    const tokens = tokenizeWithSpans(input);
    expect(tokens.map((t) => t.text).join("")).toBe(input);
  });

  it("classifies operators, parens, quotes, and terms", () => {
    const kinds = tokenizeWithSpans("a AND (b)").map((t) => `${t.kind}:${t.text}`);
    expect(kinds).toEqual([
      "term:a",
      "whitespace: ",
      "keyword:AND",
      "whitespace: ",
      "paren:(",
      "term:b",
      "paren:)",
    ]);
  });

  it("treats operator words case-insensitively", () => {
    expect(tokenizeWithSpans("a or b").find((t) => t.text === "or")?.kind).toBe("keyword");
  });

  it("assigns matched parens the same depth and nested ones a deeper depth", () => {
    const parens = tokenizeWithSpans("(a (b) c)").filter((t) => t.kind === "paren");
    // outer "(" and ")" share depth 0; inner pair shares depth 1
    expect(parens.map((p) => p.depth)).toEqual([0, 1, 1, 0]);
    expect(parens.some((p) => p.error)).toBe(false);
  });

  it("flags an unmatched closing paren", () => {
    const parens = tokenizeWithSpans("a)").filter((t) => t.kind === "paren");
    expect(parens[0].error).toBe(true);
  });

  it("flags an unmatched opening paren", () => {
    const parens = tokenizeWithSpans("(a").filter((t) => t.kind === "paren");
    expect(parens[0].error).toBe(true);
  });

  it("flags an unterminated quote", () => {
    const quoted = tokenizeWithSpans('a "b c').find((t) => t.kind === "quoted");
    expect(quoted?.error).toBe(true);
    expect(quoted?.text).toBe('"b c');
  });
});

describe("highlightSearchQuery", () => {
  it("marks a plain query as plain", () => {
    expect(highlightSearchQuery("sodium chloride").state).toBe("plain");
  });

  it("marks a valid boolean query as advanced", () => {
    expect(highlightSearchQuery("sodium AND chloride").state).toBe("advanced");
    expect(highlightSearchQuery("(a OR b) AND c").state).toBe("advanced");
  });

  it("errors on a query with no inclusive constraint", () => {
    const result = highlightSearchQuery("NOT foo AND NOT bar");
    expect(result.state).toBe("error");
    expect(result.message).toMatch(/at least one term/i);
  });

  it("errors on a single negation", () => {
    expect(highlightSearchQuery("NOT foo").state).toBe("error");
  });

  it("stays valid when a negation is paired with an inclusive term", () => {
    expect(highlightSearchQuery("SomeString AND (NOT foo AND NOT bar)").state).toBe("advanced");
  });

  it("errors on unbalanced parentheses with a specific message", () => {
    const result = highlightSearchQuery("a AND (b");
    expect(result.state).toBe("error");
    expect(result.message).toMatch(/parenthes/i);
  });

  it("wraps tokens in themed spans", () => {
    const html = highlightSearchQuery("a AND b").html;
    expect(html).toContain('<span class="hl-keyword">AND</span>');
    // Plain-string terms in an advanced query carry the string color class.
    expect(html).toContain('<span class="hl-term hl-term-string">a</span>');
  });

  it("colors parens by depth", () => {
    const html = highlightSearchQuery("(a AND (b OR c))").html;
    expect(html).toContain("hl-paren-0");
    expect(html).toContain("hl-paren-1");
  });

  it("tints a term by detected type (CAS / formula) for a plain query", () => {
    expect(highlightSearchQuery("7647-14-5").html).toContain('hl-term hl-term-cas');
    expect(highlightSearchQuery("NaOH").html).toContain('hl-term hl-term-formula');
    // A plain word carries no type class.
    expect(highlightSearchQuery("acetone").html).toBe('<span class="hl-term">acetone</span>');
  });

  it("tints term types inside an advanced query and its quoted phrases", () => {
    const html = highlightSearchQuery("NaOH OR 7647-14-5").html;
    expect(html).toContain("hl-term-formula");
    expect(html).toContain("hl-term-cas");
    expect(highlightSearchQuery('"O=C=O"').html).toContain("hl-term-smiles");
  });

  it("colors plain-string terms only inside an advanced query", () => {
    // Plain query: a bare string stays uncolored.
    expect(highlightSearchQuery("foo").html).not.toContain("hl-term-string");
    // Advanced query: string terms get the string color.
    expect(highlightSearchQuery("foo OR bar").html).toContain("hl-term-string");
  });

  it("colors a quoted string the same as an unquoted term (no separate quoted color)", () => {
    const html = highlightSearchQuery('"sodium chloride" OR NaCl').html;
    // The quoted phrase is a string term → string color, rendered as hl-term (not hl-quoted).
    expect(html).toContain('<span class="hl-term hl-term-string">&quot;sodium chloride&quot;</span>');
    expect(html).not.toContain("hl-quoted");
  });

  it("escapes HTML in the query and round-trips the text", () => {
    const input = 'a AND "<b> & c"';
    const result = highlightSearchQuery(input);
    expect(result.html).not.toContain("<b>");
    expect(stripHtml(result.html)).toBe(input);
  });
});
