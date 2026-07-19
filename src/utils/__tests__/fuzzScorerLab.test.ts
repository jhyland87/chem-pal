import { describe, expect, it, vi } from "vitest";
import { FUZZ_SCORER_NAMES } from "@/constants/fuzzScorers";
import {
  collectCachedTitles,
  evaluateCorpusAst,
  explainDrop,
  listSuppliers,
  printAstProbe,
  printFuzzProbe,
  renderAst,
  scoreCorpus,
  type CorpusEntry,
} from "@/utils/fuzzScorerLab";
import { parseSearchQuery } from "@/utils/search-query/parseSearchQuery";

const CORPUS: CorpusEntry[] = [
  { title: "Sodium Chloride ACS Grade 500g", supplier: "Loudwolf", source: "queryCache" },
  { title: "Sodium Borohydride 98%", supplier: "Loudwolf", source: "queryCache" },
  { title: "Potassium Chloride Reagent", supplier: "Onyxmet", source: "queryCache" },
  { title: "Acetone 99.5% 1L", supplier: "Onyxmet", source: "searchResults" },
];

describe("scoreCorpus", () => {
  it("scores every title with every scorer by default", () => {
    const result = scoreCorpus("sodium chloride", CORPUS);
    expect(result.corpusSize).toBe(4);
    expect(result.byTitle).toHaveLength(4);
    for (const row of result.byTitle) {
      expect(Object.keys(row.scores).sort()).toEqual([...FUZZ_SCORER_NAMES].sort());
    }
    expect(result.scorers).toEqual([...FUZZ_SCORER_NAMES]);
  });

  it("ranks each scorer's list descending and puts the exact match first", () => {
    const result = scoreCorpus("sodium chloride", CORPUS);
    for (const name of result.scorers) {
      const scores = result.byScorer[name].map((row) => row.score);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    }
    expect(result.byScorer.token_set_ratio[0].title).toContain("Sodium Chloride");
  });

  it("honors the scorers subset", () => {
    const result = scoreCorpus("acetone", CORPUS, { scorers: ["ratio", "WRatio"] });
    expect(result.scorers).toEqual(["ratio", "WRatio"]);
    expect(Object.keys(result.byScorer)).toEqual(["ratio", "WRatio"]);
    expect(Object.keys(result.byTitle[0].scores)).toEqual(["ratio", "WRatio"]);
  });

  it("honors limit, supplier, and minScore", () => {
    expect(scoreCorpus("sodium", CORPUS, { limit: 2 }).byScorer.ratio).toHaveLength(2);

    const bySupplier = scoreCorpus("sodium", CORPUS, { suppliers: "loudwolf" });
    expect(bySupplier.corpusSize).toBe(2);
    expect(bySupplier.byTitle.every((row) => row.supplier === "Loudwolf")).toBe(true);

    const gated = scoreCorpus("acetone", CORPUS, { minScore: 100 });
    expect(gated.byTitle).toHaveLength(1);
    expect(gated.byTitle[0].title).toContain("Acetone");
  });

  it("accepts a list of suppliers and matches partial names", () => {
    expect(scoreCorpus("sodium", CORPUS, { suppliers: ["Loudwolf", "Onyxmet"] }).corpusSize).toBe(
      4,
    );
    expect(scoreCorpus("sodium", CORPUS, { suppliers: ["Onyxmet"] }).corpusSize).toBe(2);
    // Partial, case-insensitive.
    expect(scoreCorpus("sodium", CORPUS, { suppliers: "loud" }).corpusSize).toBe(2);
    expect(scoreCorpus("sodium", CORPUS, { suppliers: [] }).corpusSize).toBe(4);
  });

  it("warns but returns the other suppliers when one has no cached titles", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = scoreCorpus("sodium", CORPUS, { suppliers: ["Loudwolf", "Nonesuch"] });
    expect(result.corpusSize).toBe(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Nonesuch"));
    // The warning lists what is actually available.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Loudwolf"));
    warn.mockRestore();
  });

  it("treats limit 0 and Infinity as show-everything", () => {
    expect(scoreCorpus("sodium", CORPUS, { limit: 0 }).byScorer.ratio).toHaveLength(4);
    expect(scoreCorpus("sodium", CORPUS, { limit: Infinity }).byScorer.ratio).toHaveLength(4);
    expect(scoreCorpus("sodium", CORPUS, { limit: 1 }).byScorer.ratio).toHaveLength(1);
  });

  it("sorts spread by scorer disagreement, descending", () => {
    const result = scoreCorpus("sodium chloride", CORPUS);
    const spreads = result.spread.map((row) => row.spread);
    expect(spreads).toEqual([...spreads].sort((a, b) => b - a));
    for (const row of result.spread) {
      expect(row.spread).toBe(row.max - row.min);
    }
  });
});

describe("printers", () => {
  // Regression: the printers resolve `limit` into a local, and a self-referential
  // `const` there throws before any table renders.
  it("render without throwing, at any limit", () => {
    const spies = [
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "table").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "groupCollapsed").mockImplementation(() => {}),
      vi.spyOn(console, "groupEnd").mockImplementation(() => {}),
    ];
    const fuzz = scoreCorpus("sodium", CORPUS);
    const ast = evaluateCorpusAst("sodium AND NOT borohydride", CORPUS);
    for (const limit of [undefined, 0, 1, Infinity]) {
      expect(() => printFuzzProbe(fuzz, limit)).not.toThrow();
      expect(() => printAstProbe(ast, limit)).not.toThrow();
    }
    for (const spy of spies) spy.mockRestore();
  });
});

describe("listSuppliers", () => {
  it("counts titles per supplier, most first", () => {
    expect(listSuppliers(CORPUS)).toEqual([
      { supplier: "Loudwolf", titles: 2 },
      { supplier: "Onyxmet", titles: 2 },
    ]);
  });

  it("buckets entries with no supplier under (unknown)", () => {
    expect(listSuppliers([{ title: "X", source: "queryCache" }])).toEqual([
      { supplier: "(unknown)", titles: 1 },
    ]);
  });
});

describe("collectCachedTitles source aliases", () => {
  it("accepts results/cache/both without touching the other store", async () => {
    // No IDB seeded here, so every source resolves to an empty corpus rather than throwing.
    for (const source of [
      "both",
      "cache",
      "results",
      "all",
      "queryCache",
      "searchResults",
    ] as const) {
      expect(Array.isArray(await collectCachedTitles(source))).toBe(true);
    }
  });
});

describe("renderAst", () => {
  it("renders each node type", () => {
    expect(renderAst({ type: "term", value: "acetone", phrase: false })).toBe("acetone");
    expect(renderAst({ type: "term", value: "acetic acid", phrase: true })).toBe('"acetic acid"');
    expect(renderAst(parseSearchQuery("sodium AND chloride").ast)).toBe("(sodium AND chloride)");
    expect(renderAst(parseSearchQuery("sodium OR potassium").ast)).toBe("(sodium OR potassium)");
    expect(renderAst(parseSearchQuery("sodium AND NOT borohydride").ast)).toBe(
      "(sodium AND NOT borohydride)",
    );
  });
});

describe("explainDrop", () => {
  it("names the missing AND leaf", () => {
    const { ast } = parseSearchQuery("sodium AND chloride");
    expect(explainDrop("Potassium Chloride Reagent", ast, false)).toEqual(["sodium"]);
    expect(explainDrop("Sodium Chloride ACS Grade 500g", ast, false)).toEqual([]);
  });

  it("reports both OR branches only when neither matched", () => {
    const { ast } = parseSearchQuery("sodium OR potassium");
    expect(explainDrop("Acetone 99.5% 1L", ast, false)).toEqual(["sodium", "potassium"]);
    expect(explainDrop("Sodium Chloride ACS Grade 500g", ast, false)).toEqual([]);
  });

  it("blames a satisfied NOT branch rather than returning no reason", () => {
    const { ast } = parseSearchQuery("sodium AND NOT borohydride");
    expect(explainDrop("Sodium Borohydride 98%", ast, false)).toEqual(["NOT borohydride"]);
    // A title the NOT correctly lets through is blamed on the missing term instead.
    expect(explainDrop("Potassium Chloride Reagent", ast, false)).toEqual(["sodium"]);
    expect(explainDrop("Sodium Chloride ACS Grade 500g", ast, false)).toEqual([]);
  });
});

describe("evaluateCorpusAst", () => {
  it("partitions the whole corpus into matched and dropped", () => {
    const result = evaluateCorpusAst("sodium", CORPUS);
    expect(result.matched.length + result.dropped.length).toBe(result.corpusSize);
    expect(result.corpusSize).toBe(CORPUS.length);
  });

  it("applies AND, OR, and NOT predicates", () => {
    const and = evaluateCorpusAst("sodium AND chloride", CORPUS);
    expect(and.matched.map((row) => row.title)).toEqual(["Sodium Chloride ACS Grade 500g"]);

    const or = evaluateCorpusAst("acetone OR borohydride", CORPUS);
    expect(or.matched).toHaveLength(2);

    const not = evaluateCorpusAst("sodium AND NOT borohydride", CORPUS);
    expect(not.matched.map((row) => row.title)).toEqual(["Sodium Chloride ACS Grade 500g"]);
    expect(not.isAdvanced).toBe(true);
    expect(not.astText).toBe("(sodium AND NOT borohydride)");
  });

  it("attaches the failed terms to each drop", () => {
    const result = evaluateCorpusAst("sodium AND chloride", CORPUS, { fuzzyWords: false });
    const acetone = result.dropped.find((row) => row.title.startsWith("Acetone"));
    expect(acetone?.failedTerms).toEqual(["sodium", "chloride"]);
    const potassium = result.dropped.find((row) => row.title.startsWith("Potassium"));
    expect(potassium?.failedTerms).toEqual(["sodium"]);
  });

  it("gives every dropped title at least one reason", () => {
    const result = evaluateCorpusAst("sodium AND NOT borohydride", CORPUS);
    expect(result.dropped.length).toBeGreaterThan(0);
    expect(result.dropped.every((row) => row.failedTerms.length > 0)).toBe(true);
    const borohydride = result.dropped.find((row) => row.title.includes("Borohydride"));
    expect(borohydride?.failedTerms).toEqual(["NOT borohydride"]);
  });

  it("ranks survivors descending", () => {
    const scores = evaluateCorpusAst("chloride", CORPUS).matched.map((row) => row.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("keeps the same survivors across scorers while the ranking can differ", () => {
    const a = evaluateCorpusAst("chloride", CORPUS, { scorer: "ratio" });
    const b = evaluateCorpusAst("chloride", CORPUS, { scorer: "partial_ratio" });
    expect(new Set(a.matched.map((row) => row.title))).toEqual(
      new Set(b.matched.map((row) => row.title)),
    );
    expect(a.matched.map((row) => row.score)).not.toEqual(b.matched.map((row) => row.score));
  });

  it("flags titles whose survival depends on fuzzyWords", () => {
    // "chloirde" is a transposition typo — no title contains it, but it clears
    // the per-word partial_ratio cutoff against "Chloride".
    const result = evaluateCorpusAst("chloirde", CORPUS, { fuzzyWords: true });
    expect(result.matched.length).toBeGreaterThan(0);
    expect(result.fuzzyWordsDelta.length).toBeGreaterThan(0);
    expect(result.fuzzyWordsDelta.every((row) => row.onlyWith === "fuzzyWords")).toBe(true);

    const exact = evaluateCorpusAst("chloirde", CORPUS, { fuzzyWords: false });
    expect(exact.matched).toHaveLength(0);
  });

  it("skips the fuzzyWords diff when compareFuzzyWords is false", () => {
    const result = evaluateCorpusAst("chloirde", CORPUS, { compareFuzzyWords: false });
    expect(result.fuzzyWordsDelta).toEqual([]);
  });

  it("reports a plain query as non-advanced but still evaluates it", () => {
    const result = evaluateCorpusAst("acetone", CORPUS);
    expect(result.isAdvanced).toBe(false);
    expect(result.matched.map((row) => row.title)).toEqual(["Acetone 99.5% 1L"]);
  });

  it("honors the supplier filter", () => {
    const result = evaluateCorpusAst("sodium", CORPUS, { suppliers: "loudwolf" });
    expect(result.corpusSize).toBe(2);
  });
});
