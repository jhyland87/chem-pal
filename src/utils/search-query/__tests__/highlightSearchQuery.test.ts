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
    expect(html).toContain('<span class="hl-term">a</span>');
  });

  it("colors parens by depth", () => {
    const html = highlightSearchQuery("(a AND (b OR c))").html;
    expect(html).toContain("hl-paren-0");
    expect(html).toContain("hl-paren-1");
  });

  it("escapes HTML in the query and round-trips the text", () => {
    const input = 'a AND "<b> & c"';
    const result = highlightSearchQuery(input);
    expect(result.html).not.toContain("<b>");
    expect(stripHtml(result.html)).toBe(input);
  });
});
