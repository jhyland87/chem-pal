import { FUZZ_SCORER_NAMES, FUZZ_SCORERS } from "@/constants/fuzzScorers";
import type { FuzzScorerName } from "@/constants/fuzzScorers";
import { getAllSupplierQueryCacheEntries, getSearchResults } from "@/utils/idbCache";
import { scoreAstMatch } from "@/utils/search-query/evaluateAst";
import { parseSearchQuery } from "@/utils/search-query/parseSearchQuery";
import type { SearchAst } from "@/utils/search-query/types";

/**
 * Dev-console probes for exercising the fuzzy-filter layers against the local
 * product cache, with no live search and no network. {@link fuzzTest} compares
 * every scorer in `FUZZ_SCORERS` on the plain-query path; {@link astTest} runs
 * the advanced boolean path through `parseSearchQuery` → `scoreAstMatch`.
 *
 * The IO and printing wrappers are kept separate from the pure cores
 * ({@link scoreCorpus}, {@link evaluateCorpusAst}) so the scoring logic is
 * directly unit-testable.
 * @category Utils
 * @group Search
 * @showCategories
 * @categoryDescription Offline fuzzy-filter experimentation helpers.
 * @source
 */

/**
 * Where a corpus title was read from.
 * @category Utils
 * @group Types
 * @source
 */
export type CorpusSource = "queryCache" | "searchResults";

/**
 * Which cached stores to build the corpus from. The plain-English aliases
 * (`"both"`, `"cache"`, `"results"`) are accepted alongside the store names so the
 * console call reads naturally.
 * @category Utils
 * @group Types
 * @source
 */
export type CorpusSourceOption = "all" | "both" | "cache" | "results" | CorpusSource;

/**
 * One cached product title plus the provenance needed to interpret a score.
 * @category Utils
 * @group Types
 * @source
 */
export interface CorpusEntry {
  title: string;
  supplier?: string;
  source: CorpusSource;
  /** The query that originally produced this cache entry (query cache only). */
  cachedQuery?: string;
  url?: string;
}

/**
 * Options for {@link fuzzTest} / {@link scoreCorpus}.
 * @category Utils
 * @group Types
 * @source
 */
export interface FuzzProbeOptions {
  /** Which caches to draw titles from: `"cache"`, `"results"`, or `"both"`. Default `"both"`. */
  source?: CorpusSourceOption;
  /** Rows to show/return per scorer. `0` or `Infinity` means all. Default 15. */
  limit?: number;
  /** Drop titles whose best score across the active scorers is under this. Default 0. */
  minScore?: number;
  /** One or more suppliers to narrow to; case-insensitive, partial names allowed. */
  suppliers?: string | string[];
  /** Subset of scorers to run. Default: all of {@link FUZZ_SCORER_NAMES}. */
  scorers?: FuzzScorerName[];
  /** Print console tables. Default true. */
  print?: boolean;
}

/**
 * A corpus entry annotated with a single score.
 * @category Utils
 * @group Types
 * @source
 */
export type ScoredEntry = CorpusEntry & { score: number };

/**
 * Result of scoring a corpus with every active scorer.
 * @category Utils
 * @group Types
 * @source
 */
export interface FuzzProbeResult {
  query: string;
  corpusSize: number;
  scorers: FuzzScorerName[];
  /** Top-`limit` entries per scorer, ranked descending. */
  byScorer: Record<string, ScoredEntry[]>;
  /** One row per surviving title, with every scorer's score — scorer disagreement at a glance. */
  byTitle: Array<CorpusEntry & { scores: Record<string, number> }>;
  /** Titles where the scorers disagree most (max − min), descending. */
  spread: Array<{ title: string; min: number; max: number; spread: number; avg: number }>;
}

/**
 * Options for {@link astTest} / {@link evaluateCorpusAst}.
 * @category Utils
 * @group Types
 * @source
 */
export interface AstProbeOptions {
  /** Which caches to draw titles from: `"cache"`, `"results"`, or `"both"`. Default `"both"`. */
  source?: CorpusSourceOption;
  /** Rows to show per table. `0` or `Infinity` means all. Default 15. */
  limit?: number;
  /** One or more suppliers to narrow to; case-insensitive, partial names allowed. */
  suppliers?: string | string[];
  /** Scorer used to rank survivors. Does not affect which titles survive. Default `token_set_ratio`. */
  scorer?: FuzzScorerName;
  /** Relevance floor passed to `scoreAstMatch`. Default 50 (SupplierBase's `minMatchPercentage`). */
  threshold?: number;
  /** Per-word fuzzy presence in the leaf gate. Default true (matches fuzzing-enabled production). */
  fuzzyWords?: boolean;
  /** Also score with `fuzzyWords` inverted and diff the survivor sets. Default true. */
  compareFuzzyWords?: boolean;
  /** Print console tables. Default true. */
  print?: boolean;
}

/**
 * A corpus entry that failed the AST predicate, with the leaves responsible.
 * @category Utils
 * @group Types
 * @source
 */
export type DroppedEntry = CorpusEntry & { failedTerms: string[] };

/**
 * Result of evaluating a corpus against a parsed search query.
 * @category Utils
 * @group Types
 * @source
 */
export interface AstProbeResult {
  query: string;
  isAdvanced: boolean;
  ast: SearchAst;
  /** One-line rendering of {@link ast}, e.g. `(sodium AND NOT borohydride)`. */
  astText: string;
  corpusSize: number;
  scorer: FuzzScorerName;
  threshold: number;
  fuzzyWords: boolean;
  /** Titles satisfying the predicate, ranked by score descending. */
  matched: ScoredEntry[];
  /** Titles the predicate rejected, each with the phrase(s) that weren't present. */
  dropped: DroppedEntry[];
  /** Titles whose survival flips with `fuzzyWords`. Empty when `compareFuzzyWords` is false. */
  fuzzyWordsDelta: Array<CorpusEntry & { onlyWith: "fuzzyWords" | "exact" }>;
}

/** Ranking scorer used by the AST probe when the caller doesn't pick one. */
const DEFAULT_AST_SCORER: FuzzScorerName = "token_set_ratio";

/** Mirrors `SupplierBase.minMatchPercentage`, the production leaf-score floor. */
const DEFAULT_THRESHOLD = 50;

/** Default rows per printed table. */
const DEFAULT_LIMIT = 15;

/**
 * Reads a string property off an untyped cache record without asserting its shape.
 * @param item - The candidate record, straight out of IndexedDB.
 * @param key - The property to read.
 * @returns The value when present and a string, otherwise `undefined`.
 */
function readStringField(item: unknown, key: string): string | undefined {
  if (typeof item !== "object" || item === null || !(key in item)) {
    return undefined;
  }
  const value: unknown = Reflect.get(item, key);
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Builds a deduplicated corpus of product titles from the local IndexedDB caches. No
 * network requests are made — this reads `supplier_query_cache` (the raw per-supplier
 * result sets, which carry the originating query) and the persisted `search_results`
 * row (the products currently in the results table).
 * @category Utils
 * @param source - Which stores to read: `"cache"` (supplier query cache), `"results"`
 *   (the current search results), or `"both"`. Defaults to `"both"`.
 * @returns The unique cached titles, each tagged with its supplier and origin store.
 * @example
 * ```typescript
 * const corpus = await collectCachedTitles();
 * corpus.length;  // => 1842
 * corpus[0];      // => { title: "Sodium Chloride ACS", supplier: "Loudwolf", source: "queryCache", cachedQuery: "sodium chloride" }
 * ```
 * @source
 */
export async function collectCachedTitles(
  source: CorpusSourceOption = "all",
): Promise<CorpusEntry[]> {
  const entries: CorpusEntry[] = [];
  const wantsCache = source === "all" || source === "both" || source === "cache";
  const wantsResults = source === "all" || source === "both" || source === "results";

  if (wantsCache || source === "queryCache") {
    const cached = await getAllSupplierQueryCacheEntries();
    for (const entry of cached) {
      // The store is typed `unknown[]` but holds whatever was written, so a legacy
      // or partially-written row can be a non-array. Skip it rather than throwing.
      if (!Array.isArray(entry.data)) {
        continue;
      }
      for (const item of entry.data) {
        const title = readStringField(item, "title");
        if (title === undefined) {
          continue;
        }
        entries.push({
          title,
          supplier: readStringField(item, "supplier") ?? entry.__cacheMetadata.supplier,
          source: "queryCache",
          cachedQuery: entry.__cacheMetadata.query,
          url: readStringField(item, "url"),
        });
      }
    }
  }

  if (wantsResults || source === "searchResults") {
    for (const product of await getSearchResults()) {
      if (product.title === "") {
        continue;
      }
      entries.push({
        title: product.title,
        supplier: product.supplier,
        source: "searchResults",
        url: product.url,
      });
    }
  }

  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.supplier ?? ""}::${entry.title.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Normalizes the `limit` option, treating `0` and a missing/negative value's
 * counterpart sensibly: `0` and `Infinity` both mean "show everything".
 * @param limit - The caller's requested row cap.
 * @returns A concrete slice length.
 */
function resolveLimit(limit?: number): number {
  if (limit === undefined) {
    return DEFAULT_LIMIT;
  }
  return limit <= 0 || !Number.isFinite(limit) ? Number.MAX_SAFE_INTEGER : Math.trunc(limit);
}

/**
 * Lists the distinct supplier names present in a corpus, sorted with the most
 * titles first. Use it to discover the exact spellings the `suppliers` filter expects.
 * @param corpus - The entries to summarize, from {@link collectCachedTitles}.
 * @returns Each supplier with its title count, descending.
 * @example
 * ```typescript
 * listSuppliers(await collectCachedTitles());
 * // => [{ supplier: "Loudwolf", titles: 412 }, { supplier: "Onyxmet", titles: 118 }]
 * ```
 * @category Utils
 * @source
 */
export function listSuppliers(corpus: CorpusEntry[]): Array<{ supplier: string; titles: number }> {
  const counts = new Map<string, number>();
  for (const entry of corpus) {
    const name = entry.supplier ?? "(unknown)";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([supplier, titles]) => ({ supplier, titles }))
    .sort((a, b) => b.titles - a.titles);
}

/**
 * Narrows a corpus to one or more suppliers. Matching is case-insensitive and
 * accepts a partial name, so `"loud"` finds `"Loudwolf"` without the caller having
 * to know the exact spelling. Warns (rather than silently returning nothing) when a
 * requested supplier matches no cached titles.
 * @param corpus - The entries to filter.
 * @param suppliers - One name or a list of them; when omitted the corpus passes through.
 * @returns The matching subset.
 */
function filterBySuppliers(corpus: CorpusEntry[], suppliers?: string | string[]): CorpusEntry[] {
  if (suppliers === undefined) {
    return corpus;
  }

  // Keep the caller's original spelling for the warning, match on the lowered form.
  const needles = (Array.isArray(suppliers) ? suppliers : [suppliers])
    .map((name) => ({ requested: name.trim(), lowered: name.trim().toLowerCase() }))
    .filter((needle) => needle.lowered !== "");
  if (needles.length === 0) {
    return corpus;
  }

  const matchesNeedle = (entry: CorpusEntry, lowered: string): boolean =>
    entry.supplier?.toLowerCase().includes(lowered) ?? false;

  const unmatched = needles.filter((n) => !corpus.some((entry) => matchesNeedle(entry, n.lowered)));
  if (unmatched.length > 0) {
    console.warn(
      `[fuzzScorerLab] no cached titles for supplier(s): ${unmatched.map((n) => n.requested).join(", ")}.` +
        ` Available: ${listSuppliers(corpus)
          .map((s) => `${s.supplier} (${s.titles})`)
          .join(", ")}`,
    );
  }

  return corpus.filter((entry) => needles.some((n) => matchesNeedle(entry, n.lowered)));
}

/**
 * Scores every corpus title with every active fuzz scorer, so the scorers can be
 * compared side by side against real product titles. Pure — performs no IO and prints
 * nothing; {@link fuzzTest} is the console-facing wrapper.
 * @category Utils
 * @param query - The search string to score titles against.
 * @param corpus - The titles to score, from {@link collectCachedTitles}.
 * @param options - Scorer subset, supplier filter, `minScore` cutoff, and row `limit`.
 * @returns Per-scorer rankings, a merged title-by-scorer matrix, and the titles the
 *   scorers disagree on most.
 * @example
 * ```typescript
 * const result = scoreCorpus("sodium chloride", corpus, { limit: 2 });
 * result.byScorer.ratio;        // => [{ title: "Sodium Chloride", score: 100, ... }, ...]
 * result.spread[0];             // => { title: "NaCl 500g", min: 8, max: 90, spread: 82, avg: 41 }
 * ```
 * @source
 */
export function scoreCorpus(
  query: string,
  corpus: CorpusEntry[],
  options: FuzzProbeOptions = {},
): FuzzProbeResult {
  const scorers = options.scorers ?? [...FUZZ_SCORER_NAMES];
  const limit = resolveLimit(options.limit);
  const minScore = options.minScore ?? 0;
  const filtered = filterBySuppliers(corpus, options.suppliers);

  const byTitle: FuzzProbeResult["byTitle"] = [];
  for (const entry of filtered) {
    const scores: Record<string, number> = {};
    for (const name of scorers) {
      scores[name] = FUZZ_SCORERS[name](query, entry.title);
    }
    const values = Object.values(scores);
    if (values.length > 0 && Math.max(...values) < minScore) {
      continue;
    }
    byTitle.push({ ...entry, scores });
  }

  const byScorer: Record<string, ScoredEntry[]> = {};
  for (const name of scorers) {
    byScorer[name] = byTitle
      .map(({ scores, ...entry }) => ({ ...entry, score: scores[name] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  const spread = byTitle
    .map((row) => {
      const values = Object.values(row.scores);
      const min = Math.min(...values);
      const max = Math.max(...values);
      return {
        title: row.title,
        min,
        max,
        spread: max - min,
        avg: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      };
    })
    .sort((a, b) => b.spread - a.spread);

  return { query, corpusSize: filtered.length, scorers, byScorer, byTitle, spread };
}

/**
 * Renders a parsed search AST as a readable one-line expression, so a printed probe
 * shows how the query was actually parsed rather than just echoing the raw input.
 * @category Utils
 * @param ast - The node to render.
 * @returns A parenthesized boolean expression.
 * @example
 * ```typescript
 * renderAst({ type: "and",
 *   left: { type: "term", value: "sodium", phrase: false },
 *   right: { type: "not", operand: { type: "term", value: "borohydride", phrase: false } } });
 * // => '(sodium AND NOT borohydride)'
 * ```
 * @source
 */
export function renderAst(ast: SearchAst): string {
  switch (ast.type) {
    case "term":
      return ast.phrase ? `"${ast.value}"` : ast.value;
    case "and":
      return `(${renderAst(ast.left)} AND ${renderAst(ast.right)})`;
    case "or":
      return `(${renderAst(ast.left)} OR ${renderAst(ast.right)})`;
    case "not":
      return `NOT ${renderAst(ast.operand)}`;
    default:
      return "<unknown>";
  }
}

/**
 * Tests whether every word of a phrase is present in a title, replicating the leaf
 * gate in `evaluateLeaf` (substring match, or a high-confidence `partial_ratio` hit
 * when `fuzzyWords` is on). Used only to explain drops — scoring stays in `scoreAstMatch`.
 * @param title - The product title to test.
 * @param value - The phrase to look for.
 * @param fuzzyWords - Whether per-word fuzzy presence counts.
 * @returns True when every word of `value` is present in `title`.
 */
function isPhrasePresent(title: string, value: string, fuzzyWords: boolean): boolean {
  const lowerTitle = title.toLowerCase();
  const words = value.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every(
    (word) =>
      lowerTitle.includes(word) ||
      (fuzzyWords && FUZZ_SCORERS.partial_ratio(word, lowerTitle) >= 88),
  );
}

/**
 * Whether a title satisfies an AST's predicate, using the same presence gate as
 * {@link isPhrasePresent}. Mirrors `scoreAstMatch`'s null/non-null decision without
 * computing scores, so {@link explainDrop} can tell a satisfied `NOT` from a missing term.
 * @param title - The title to test.
 * @param ast - The subtree to evaluate.
 * @param fuzzyWords - Whether per-word fuzzy presence counts.
 * @returns True when the predicate holds.
 */
function matchesAst(title: string, ast: SearchAst, fuzzyWords: boolean): boolean {
  switch (ast.type) {
    case "term":
      return isPhrasePresent(title, ast.value, fuzzyWords);
    case "and":
      return matchesAst(title, ast.left, fuzzyWords) && matchesAst(title, ast.right, fuzzyWords);
    case "or":
      return matchesAst(title, ast.left, fuzzyWords) || matchesAst(title, ast.right, fuzzyWords);
    case "not":
      return !matchesAst(title, ast.operand, fuzzyWords);
    default:
      return false;
  }
}

/**
 * Explains why a title failed an AST predicate: missing phrases are listed verbatim,
 * and a `NOT` branch that excluded the title is reported as `NOT <phrase>`. Every drop
 * gets at least one reason, so the dropped table is never blank.
 * @category Utils
 * @param title - The rejected title.
 * @param ast - The parsed query tree.
 * @param fuzzyWords - Whether per-word fuzzy presence counts.
 * @returns The phrases responsible for the drop.
 * @example
 * ```typescript
 * const { ast } = parseSearchQuery("sodium AND NOT borohydride");
 * explainDrop("Potassium Chloride", ast, true);     // => ["sodium"]
 * explainDrop("Sodium Borohydride 98%", ast, true); // => ["NOT borohydride"]
 * ```
 * @source
 */
export function explainDrop(title: string, ast: SearchAst, fuzzyWords: boolean): string[] {
  switch (ast.type) {
    case "term":
      return isPhrasePresent(title, ast.value, fuzzyWords) ? [] : [ast.value];
    case "and":
      return [
        ...explainDrop(title, ast.left, fuzzyWords),
        ...explainDrop(title, ast.right, fuzzyWords),
      ];
    case "or": {
      const left = explainDrop(title, ast.left, fuzzyWords);
      const right = explainDrop(title, ast.right, fuzzyWords);
      // An OR only fails when both branches fail; if either matched, nothing is missing.
      return left.length > 0 && right.length > 0 ? [...left, ...right] : [];
    }
    case "not":
      // The NOT held (operand absent), so it isn't the reason; otherwise it is.
      return matchesAst(title, ast.operand, fuzzyWords) ? [`NOT ${renderAst(ast.operand)}`] : [];
    default:
      return [];
  }
}

/**
 * Evaluates a corpus against an advanced (boolean) search query using the same
 * `parseSearchQuery` → `scoreAstMatch` path production suppliers take in
 * `SupplierBase.fuzzyFilterAst`. Pure — performs no IO and prints nothing.
 *
 * Note the leaf gate is word *presence*, not similarity, so the chosen `scorer`
 * only ranks survivors; `fuzzyWords` and `threshold` are what change which titles
 * survive. `compareFuzzyWords` surfaces exactly that difference.
 * @category Utils
 * @param query - The raw search string, which may use `AND`/`OR`/`NOT`/parentheses.
 * @param corpus - The titles to evaluate, from {@link collectCachedTitles}.
 * @param options - Scorer, threshold, `fuzzyWords`, supplier filter, and row `limit`.
 * @returns The parsed AST, the ranked survivors, the drops with their failed terms,
 *   and the titles whose survival depends on `fuzzyWords`.
 * @example
 * ```typescript
 * const result = evaluateCorpusAst("sodium AND NOT borohydride", corpus);
 * result.astText;              // => '(sodium AND NOT borohydride)'
 * result.matched[0];           // => { title: "Sodium Chloride", score: 86, ... }
 * result.dropped[0].failedTerms; // => ["sodium"]
 * ```
 * @source
 */
export function evaluateCorpusAst(
  query: string,
  corpus: CorpusEntry[],
  options: AstProbeOptions = {},
): AstProbeResult {
  const scorerName = options.scorer ?? DEFAULT_AST_SCORER;
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const fuzzyWords = options.fuzzyWords ?? true;
  const filtered = filterBySuppliers(corpus, options.suppliers);
  const parsed = parseSearchQuery(query);
  const evalOptions = { scorer: FUZZ_SCORERS[scorerName], threshold, fuzzyWords };

  const compare = options.compareFuzzyWords !== false;
  const inverted = { ...evalOptions, fuzzyWords: !fuzzyWords };

  const matched: ScoredEntry[] = [];
  const dropped: DroppedEntry[] = [];
  const fuzzyWordsDelta: AstProbeResult["fuzzyWordsDelta"] = [];
  for (const entry of filtered) {
    const score = scoreAstMatch(entry.title, parsed.ast, evalOptions);
    if (score === null) {
      dropped.push({ ...entry, failedTerms: explainDrop(entry.title, parsed.ast, fuzzyWords) });
    } else {
      matched.push({ ...entry, score });
    }

    if (!compare) {
      continue;
    }
    const survivesInverted = scoreAstMatch(entry.title, parsed.ast, inverted) !== null;
    if ((score !== null) === survivesInverted) {
      continue;
    }
    // Name the fuzzyWords setting that kept it, whichever pass that was.
    const keptByFuzzy = score !== null ? fuzzyWords : !fuzzyWords;
    fuzzyWordsDelta.push({ ...entry, onlyWith: keptByFuzzy ? "fuzzyWords" : "exact" });
  }
  matched.sort((a, b) => b.score - a.score);

  return {
    query,
    isAdvanced: parsed.isAdvanced,
    ast: parsed.ast,
    astText: renderAst(parsed.ast),
    corpusSize: filtered.length,
    scorer: scorerName,
    threshold,
    fuzzyWords,
    matched,
    dropped,
    fuzzyWordsDelta,
  };
}

/**
 * Prints a {@link FuzzProbeResult} as console tables: one ranked table per scorer,
 * then the merged title-by-scorer matrix, then the biggest scorer disagreements.
 * @category Utils
 * @param result - The scored result to print.
 * @param limit - Rows to show in the merged and spread tables.
 * @returns Nothing; writes to the console.
 * @example
 * ```typescript
 * printFuzzProbe(scoreCorpus("acetone", corpus), 10);
 * ```
 * @source
 */
export function printFuzzProbe(result: FuzzProbeResult, limit?: number): void {
  const rows = resolveLimit(limit);
  console.info(
    `[fuzzTest] query="${result.query}" — ${result.corpusSize} cached titles, ${result.scorers.length} scorers`,
  );

  for (const name of result.scorers) {
    console.groupCollapsed(`${name} — top ${result.byScorer[name].length}`);
    console.table(
      result.byScorer[name].map((row) => ({
        score: row.score,
        title: row.title,
        supplier: row.supplier,
        source: row.source,
      })),
    );
    console.groupEnd();
  }

  console.groupCollapsed(`All titles × scorers (top ${rows} by average)`);
  console.table(
    result.byTitle
      .map((row) => ({ title: row.title, supplier: row.supplier, ...row.scores }))
      .slice(0, rows),
  );
  console.groupEnd();

  console.groupCollapsed(`Biggest scorer disagreements (top ${rows})`);
  console.table(result.spread.slice(0, rows));
  console.groupEnd();
}

/**
 * Prints an {@link AstProbeResult} as console tables: the parsed AST, the ranked
 * survivors, the drops with their failed terms, and any `fuzzyWords` flips.
 * @category Utils
 * @param result - The evaluated result to print.
 * @param limit - Rows to show per table.
 * @returns Nothing; writes to the console.
 * @example
 * ```typescript
 * printAstProbe(evaluateCorpusAst("acid OR base", corpus), 10);
 * ```
 * @source
 */
export function printAstProbe(result: AstProbeResult, limit?: number): void {
  const rows = resolveLimit(limit);
  console.info(
    [
      `[astTest] query="${result.query}"`,
      `  parsed:    ${result.astText}${result.isAdvanced ? "" : "  (plain query — single term, not advanced syntax)"}`,
      `  options:   scorer=${result.scorer} threshold=${result.threshold} fuzzyWords=${result.fuzzyWords}`,
      `  corpus:    ${result.corpusSize} titles → ${result.matched.length} matched, ${result.dropped.length} dropped`,
      `  note:      the scorer only ranks survivors; fuzzyWords/threshold decide who survives`,
    ].join("\n"),
  );

  // A NOT branch scores exactly `threshold`, and AND takes the min — so an
  // `X AND NOT Y` query pins every survivor to the floor and the ranking is
  // meaningless. Worth saying out loud rather than letting it look like a tie.
  const distinctScores = new Set(result.matched.map((row) => row.score));
  if (result.matched.length > 1 && distinctScores.size === 1) {
    console.warn(
      `[astTest] every survivor scored ${[...distinctScores][0]} — ranking is degenerate.` +
        ` A NOT branch contributes exactly the threshold and AND takes the min, so` +
        ` "X AND NOT Y" flattens all scores to the floor.`,
    );
  }

  console.groupCollapsed(
    `Matched — top ${Math.min(rows, result.matched.length)} of ${result.matched.length}`,
  );
  console.table(
    result.matched.slice(0, rows).map((row) => ({
      score: row.score,
      title: row.title,
      supplier: row.supplier,
      source: row.source,
    })),
  );
  console.groupEnd();

  console.groupCollapsed(
    `Dropped — top ${Math.min(rows, result.dropped.length)} of ${result.dropped.length}`,
  );
  console.table(
    result.dropped.slice(0, rows).map((row) => ({
      title: row.title,
      supplier: row.supplier,
      failedTerms: row.failedTerms.join(", "),
    })),
  );
  console.groupEnd();

  if (result.fuzzyWordsDelta.length > 0) {
    console.groupCollapsed(`fuzzyWords flips — ${result.fuzzyWordsDelta.length} titles`);
    console.table(
      result.fuzzyWordsDelta.slice(0, rows).map((row) => ({
        title: row.title,
        supplier: row.supplier,
        onlyWith: row.onlyWith,
      })),
    );
    console.groupEnd();
  }
}

/**
 * Runs a query against every cached product title with all nine fuzz scorers and
 * prints them side by side — the offline equivalent of `SupplierBase.fuzzyFilter`'s
 * dev-only comparison table, but over the whole local cache and with no search.
 * @category Utils
 * @param query - The search string to score cached titles against.
 * @param options - Corpus source, supplier filter, scorer subset, `minScore`, `rows`,
 *   and whether to print.
 * @returns The full scored result, also printed unless `print: false`.
 * @example
 * ```typescript
 * // In the console:
 * const result = await chempal.fuzzTest("sodium borohydride");
 * // ┌─────────┬───────┬──────────────────────────────┬────────────┐
 * // │ (index) │ score │ title                        │ supplier   │
 * // ├─────────┼───────┼──────────────────────────────┼────────────┤
 * // │ 0       │ 100   │ 'Sodium Borohydride 98%'     │ 'Loudwolf' │
 * // └─────────┴───────┴──────────────────────────────┴────────────┘
 * result.spread[0]; // the title the scorers disagree on most
 *
 * await chempal.fuzzTest("acetone", { supplier: "Loudwolf", rows: 25 });
 * ```
 * @source
 */
export async function fuzzTest(
  query: string,
  options: FuzzProbeOptions = {},
): Promise<FuzzProbeResult> {
  const corpus = await collectCachedTitles(options.source);
  const result = scoreCorpus(query, corpus, options);
  if (options.print !== false) {
    printFuzzProbe(result, options.limit);
  }
  return result;
}

/**
 * Runs an advanced (boolean) query against every cached product title through the
 * real `parseSearchQuery` → `scoreAstMatch` path, showing which titles the predicate
 * keeps, which it drops and why, and which drops hinge on `fuzzyWords`.
 * @category Utils
 * @param query - The search string; may use `AND`/`OR`/`NOT` and parentheses.
 * @param options - `source` (`"cache"` / `"results"` / `"both"`), `suppliers`, `limit`
 *   (`0` = all), ranking `scorer`, `threshold`, `fuzzyWords`, and `compareFuzzyWords`.
 * @returns The full evaluated result, also printed unless `print: false`.
 * @example
 * ```typescript
 * // In the console:
 * const result = await chempal.astTest("sodium AND NOT borohydride");
 * result.astText;                 // => '(sodium AND NOT borohydride)'
 * result.matched.length;          // => 37
 * result.dropped[0].failedTerms;  // => ['sodium']
 *
 * await chempal.astTest("acid OR base", { fuzzyWords: false, threshold: 70 });
 * await chempal.astTest("sodium", { suppliers: "loud", source: "cache", limit: 0 });
 * ```
 * @source
 */
export async function astTest(
  query: string,
  options: AstProbeOptions = {},
): Promise<AstProbeResult> {
  const corpus = await collectCachedTitles(options.source);
  const result = evaluateCorpusAst(query, corpus, options);
  if (options.print !== false) {
    printAstProbe(result, options.limit);
  }
  return result;
}
