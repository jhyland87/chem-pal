import { describe, expect, it } from "vitest";
import { parseSearchQuery } from "../../parseSearchQuery";
import type { SearchAst } from "../../types";
import { translateAstToFreefind } from "../translateAstToFreefind";
import { translateAstToShopifyQuery } from "../translateAstToShopifyQuery";
import { translateAstToTypesenseFilter } from "../translateAstToTypesenseFilter";
import { translateAstToWixFilter } from "../translateAstToWixFilter";

const ast = (query: string): SearchAst => parseSearchQuery(query).ast;

describe("translateAstToWixFilter", () => {
  it("maps a single term to a CONTAINS term", () => {
    expect(translateAstToWixFilter(ast("Sodium"))).toEqual({
      term: { field: "name", op: "CONTAINS", values: ["*Sodium*"] },
    });
  });

  it("maps OR/AND/NOT to combinators", () => {
    expect(translateAstToWixFilter(ast("Sodium OR Potassium"))).toEqual({
      or: [
        { term: { field: "name", op: "CONTAINS", values: ["*Sodium*"] } },
        { term: { field: "name", op: "CONTAINS", values: ["*Potassium*"] } },
      ],
    });
    expect(translateAstToWixFilter(ast("a AND NOT b"))).toEqual({
      and: [
        { term: { field: "name", op: "CONTAINS", values: ["*a*"] } },
        { not: { term: { field: "name", op: "CONTAINS", values: ["*b*"] } } },
      ],
    });
  });
});

describe("translateAstToShopifyQuery", () => {
  it("builds a nested boolean query string", () => {
    expect(translateAstToShopifyQuery(ast("Carbonate AND (Sodium OR Potassium)"))).toBe(
      "(title:*Carbonate* AND (title:*Sodium* OR title:*Potassium*))",
    );
  });

  it("splits a multi-word phrase into AND-ed word wildcards", () => {
    expect(translateAstToShopifyQuery(ast("Sodium Borohydride OR x"))).toBe(
      "((title:*Sodium* AND title:*Borohydride*) OR title:*x*)",
    );
  });

  it("emits NOT", () => {
    expect(translateAstToShopifyQuery(ast("foo OR NOT bar"))).toBe(
      "(title:*foo* OR NOT title:*bar*)",
    );
  });
});

describe("translateAstToTypesenseFilter", () => {
  it("builds a filter_by over name", () => {
    expect(translateAstToTypesenseFilter(ast("Sodium OR Potassium"))).toBe(
      "(name:`Sodium` || name:`Potassium`)",
    );
  });

  it("pushes negation to leaves with De Morgan", () => {
    expect(translateAstToTypesenseFilter(ast("a AND NOT b"))).toBe("(name:`a` && name:!`b`)");
    // NOT (a OR b) => !a AND !b
    expect(translateAstToTypesenseFilter(ast("NOT (a OR b)"))).toBe("(name:!`a` && name:!`b`)");
  });
});

describe("translateAstToFreefind", () => {
  it("parenthesizes phrases and uses keywords", () => {
    expect(translateAstToFreefind(ast("(sulfuric acid) OR (boric acid)"))).toBe(
      "(sulfuric acid) OR (boric acid)",
    );
    expect(translateAstToFreefind(ast("(sodium borohydride) AND (95%)"))).toBe(
      "(sodium borohydride) AND (95%)",
    );
  });
});
