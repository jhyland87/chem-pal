import type { BackgroundFetchInit } from "@/helpers/backgroundFetch";
import { backgroundFetch as backgroundFetchHelper } from "@/helpers/backgroundFetch";
import { findCAS, getCASByName, getIUPACName, getNamesByCAS, isCAS } from "@/helpers/cas";
import {
  getProductPriceHistory as getProductPriceHistorySeries,
  variantSeriesKey,
} from "@/helpers/priceHistory";
import {
  executeSDQSearch,
  getCompoundNameFromAlias,
  getRankedNamesByName,
  isSimpleName,
  suggestAlternativeSearch,
} from "@/helpers/pubchem";
import {
  extractSmiles,
  isProbablyValidSmiles,
  looksLikeSmiles,
  parseStructurePrefix,
  resolveQueryForSearch,
  resolveSmiles,
} from "@/helpers/smiles";
import { formatBytes } from "@/helpers/utils";
import { Cactus } from "@/utils/Cactus";
import { astTest, collectCachedTitles, fuzzTest, listSuppliers } from "@/utils/fuzzScorerLab";
import {
  getAllPriceSeries,
  getAllSupplierProductDataCacheEntries,
  getAllSupplierQueryCacheEntries,
  getExcludedProducts,
  getIdbStorageBreakdown,
  getPriceSeries,
  getSearchHistory,
  getSearchResults,
  putPriceSeries,
} from "@/utils/idbCache";

/**
 * Inspection-friendly view of a proxied response, returned by {@link backgroundFetch}.
 * @source
 */
interface BackgroundFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  response: Response;
}

/**
 * Triggers a {@link backgroundFetchHelper} request through the extension service worker and returns
 * an inspection-friendly result for manual console testing. The body is read eagerly from a clone,
 * so the returned `body` string can be logged directly while `response` stays unconsumed for further
 * `.json()`/`.text()` calls.
 * @param url - The absolute URL to request via the background service worker.
 * @param init - Optional serializable request options (method, headers, body, etc.).
 * @returns The response `ok`/`status`/`statusText`, flattened `headers`, the already-read `body`
 *   string, and the untouched `response`.
 * @example
 * ```typescript
 * // In the console:
 * const res = await chempal.backgroundFetch("https://chemsavers.com/");
 * res.status; // => 200
 * res.body;   // => "<!doctype html>…"
 * ```
 * @source
 */
async function backgroundFetch(
  url: string,
  init?: BackgroundFetchInit,
): Promise<BackgroundFetchResult> {
  const response = await backgroundFetchHelper(url, init);
  const body = await response.clone().text();
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers,
    body,
    response,
  };
}

/**
 * Finds a product in the current search results by its identity. Matches the
 * given value against a product's `id`, stamped `cacheKey`, `uuid`, or positional
 * `_id` (all compared as strings), so any of those printed in the table can be
 * pasted straight in. Reads the `searchResults` IndexedDB store, so it reflects
 * whatever the results table currently shows.
 * @param id - The product id / cacheKey / uuid / _id to look up.
 * @returns The matching {@link Product}, or `undefined` when none matches.
 * @example
 * ```typescript
 * // In the console:
 * await chempal.getProductById("A668410");
 * await chempal.getProductById(3); // positional _id
 * ```
 * @source
 */
async function getProductById(id: string | number): Promise<Product | undefined> {
  const results = await getSearchResults();
  const target = String(id);
  return results.find(
    (product) =>
      String(product.id) === target ||
      String(product.cacheKey) === target ||
      String(product.uuid) === target ||
      String(product._id) === target,
  );
}

/**
 * Returns the recorded USD price-history series for whatever the id points at in
 * the current results:
 * - a **product** id / cacheKey / uuid / _id → its base series plus one per variant;
 * - a **variant** id / sku / title → just that one variant's series (as a 1-item array).
 *
 * Each series lists its `points` (`{ t, usd }`, ascending by time). Returns
 * `undefined` when nothing matches; `[]` when the match has no history recorded yet.
 * @param id - A product or variant identifier from the results table.
 * @returns The matching price-history series, or `undefined` when not found.
 * @example
 * ```typescript
 * // In the console:
 * await chempal.getProductPriceHistory("96a50af4-3e03-97d4-fb1c-bb8c46f180bf"); // whole product
 * await chempal.getProductPriceHistory("d5de5c76-3f2c-4d6c-9e37-ce840aae4490"); // one variant
 * ```
 * @source
 */
async function getProductPriceHistory(
  id: string | number,
): Promise<PriceHistoryEntry[] | undefined> {
  const results = await getSearchResults();
  const target = String(id);

  // Product-level match → the whole product's series (base + variants).
  const product = results.find(
    (p) =>
      String(p.id) === target ||
      String(p.cacheKey) === target ||
      String(p.uuid) === target ||
      String(p._id) === target,
  );
  if (product) {
    const byId = await getProductPriceHistorySeries(product);
    return [...byId.values()];
  }

  // Variant-level match → just that variant's series.
  for (const p of results) {
    const variant = (p.variants ?? []).find(
      (v) => String(v.id) === target || String(v.sku) === target || v.title === target,
    );
    if (variant) {
      const key = variantSeriesKey(p, variant);
      const series = key ? await getPriceSeries(key) : undefined;
      return series ? [series] : [];
    }
  }

  console.warn(`No product or variant in the current results matches id "${id}"`);
  return undefined;
}

/**
 * Dev-only: nudges one existing point of every stored price-history series by a
 * random ±1–8% (random direction), editing it in place so the detail panel's
 * trend and sparkline change. `stepsBack` selects which point, counting back from
 * the latest: `0` (default) the latest price, `1` the one before it, `2` two
 * before, and so on. Series without enough points for the requested offset are
 * skipped. Writes through the app's own storage layer (the `price_history`
 * store), so it keeps working if the IndexedDB store name/shape changes; each
 * value stays positive and is forced to move by at least $0.01 so the change shows.
 * @param stepsBack - How many points back from the latest to nudge (`0` = latest). Default `0`.
 * @returns The number of series that were nudged.
 * @example
 * ```typescript
 * // In the console:
 * await chempal.nudgePriceHistory(); // nudge the latest price of every series
 * await chempal.nudgePriceHistory(2); // nudge the price two entries behind the latest
 * ```
 * @source
 */
async function nudgePriceHistory(stepsBack: number = 0): Promise<number> {
  const SWING_MIN = 0.01;
  const SWING_MAX = 0.08;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const steps = Math.max(0, Math.trunc(stepsBack));

  const all = await getAllPriceSeries();
  if (all.length === 0) {
    console.warn("price_history is empty — run a search with price tracking enabled first.");
    return 0;
  }

  let changed = 0;
  let skipped = 0;
  for (const entry of all) {
    const points = entry.points;
    const index = (points?.length ?? 0) - 1 - steps;
    if (index < 0) {
      skipped++;
      continue;
    }
    const point = points[index];
    const dir = Math.random() < 0.5 ? -1 : 1;
    const pct = SWING_MIN + Math.random() * (SWING_MAX - SWING_MIN);
    let usd = round2(point.usd * (1 + dir * pct));
    if (usd <= 0) usd = round2(point.usd * (1 + pct)); // keep positive
    if (usd === point.usd) usd = round2(point.usd + dir * 0.01); // force a visible change
    entry.points = points.map((p, i) => (i === index ? { ...p, usd } : p));
    entry.updatedAt = Math.max(Date.now(), points[points.length - 1].t);
    await putPriceSeries(entry);
    changed++;
  }

  const skippedNote = skipped > 0 ? ` (${skipped} skipped — fewer than ${steps + 1} points)` : "";
  console.log(
    `✅ Nudged ${changed} price series at ${steps} back from latest${skippedNote}. Re-open a product's detail panel to see it.`,
  );
  return changed;
}

/**
 * Structured storage report returned by {@link storageBreakdown}, mirroring what
 * the settings panel shows but broken out per store.
 * @source
 */
interface StorageBreakdownReport {
  byStore: Record<
    string,
    { records: number; jsonBytes: number; estimatedBytes: number; share: number }
  >;
  totalJsonBytes: number;
  estimatedUsageBytes?: number;
  quotaBytes?: number;
  usedPercent?: number;
  scale: number;
}

/**
 * Measures every IndexedDB store and prints a `console.table` of each store's
 * record count, serialized JSON size, estimated on-disk size, and share of the
 * total. The estimated size scales each store's JSON size by the origin's real
 * usage from `navigator.storage.estimate()` divided by the summed JSON size, so
 * it reflects IndexedDB's index/key/encoding overhead; it falls back to the raw
 * JSON size (`scale` = 1) when no estimate is available. Returns the same numbers
 * as a structured object for further inspection.
 * @returns A per-store report plus totals, the origin usage/quota, the percent of quota used, and the scale factor.
 * @example
 * ```typescript
 * // In the console:
 * await chempal.storageBreakdown();
 * // ┌─────────────────────────────┬─────────┬──────────┬───────────────┬─────────┐
 * // │ (index)                     │ records │ jsonSize │ estimatedSize │ share   │
 * // ├─────────────────────────────┼─────────┼──────────┼───────────────┼─────────┤
 * // │ supplier_product_data_cache │ 42      │ '1.2 MB' │ '1.6 MB'      │ '78.4%' │
 * // │ price_history               │ 7       │ '88 KB'  │ '120 KB'      │ '5.6%'  │
 * // └─────────────────────────────┴─────────┴──────────┴───────────────┴─────────┘
 * ```
 * @source
 */
async function storageBreakdown(): Promise<StorageBreakdownReport> {
  const breakdown = await getIdbStorageBreakdown();

  let usage: number | undefined;
  let quota: number | undefined;
  try {
    const estimate = await navigator.storage?.estimate?.();
    usage = estimate?.usage;
    quota = estimate?.quota;
  } catch (error) {
    console.warn("navigator.storage.estimate() failed:", error);
  }

  const total = breakdown.totalBytes;
  const scale = usage && total > 0 ? usage / total : 1;
  const usedPercent = usage !== undefined && quota ? (usage / quota) * 100 : undefined;

  const byStore: StorageBreakdownReport["byStore"] = {};
  const rows: Record<
    string,
    { records: number; jsonSize: string; estimatedSize: string; share: string }
  > = {};
  for (const [store, { count, bytes }] of Object.entries(breakdown.byStore)) {
    const estimatedBytes = Math.round(bytes * scale);
    const share = total > 0 ? bytes / total : 0;
    byStore[store] = { records: count, jsonBytes: bytes, estimatedBytes, share };
    rows[store] = {
      records: count,
      jsonSize: formatBytes(bytes),
      estimatedSize: formatBytes(estimatedBytes),
      share: `${(share * 100).toFixed(1)}%`,
    };
  }

  console.table(rows);
  console.log(
    [
      `Total JSON size:   ${formatBytes(total)}`,
      `Origin usage:      ${usage === undefined ? "unavailable" : formatBytes(usage)}`,
      `Origin quota:      ${quota === undefined ? "unavailable" : formatBytes(quota)}`,
      `Quota used:        ${usedPercent === undefined ? "unavailable" : `${usedPercent.toFixed(2)}% of quota`}`,
      `Scale factor:      ${scale.toFixed(3)}× (usage ÷ total JSON)`,
    ].join("\n"),
  );

  return {
    byStore,
    totalJsonBytes: total,
    estimatedUsageBytes: usage,
    quotaBytes: quota,
    usedPercent,
    scale,
  };
}

/**
 * Prints the available debug helpers and a few example calls to the console.
 * @source
 */
function help(): void {
  console.info(
    [
      "ChemPal debug helpers (window.chempal):",
      "",
      "  SMILES:     resolveSmiles, resolveQueryForSearch, looksLikeSmiles,",
      "              parseStructurePrefix, isProbablyValidSmiles, extractSmiles",
      "  PubChem:    suggestAlternativeSearch, getRankedNamesByName, isSimpleName,",
      "              getCompoundNameFromAlias, executeSDQSearch",
      "  CAS:        getCASByName, getNamesByCAS, getIUPACName, findCAS, isCAS",
      "  Cactus:     new chempal.Cactus('aspirin')",
      "  Network:    backgroundFetch",
      "  IndexedDB:  getProductById, getProductPriceHistory, getProductCache,",
      "              getQueryCache, getSearchResults, getSearchHistory,",
      "              getExcludedProducts, storageBreakdown",
      "  Fuzzy:      fuzzTest(query, opts?)  — all 9 scorers vs. every cached title",
      "              astTest(query, opts?)   — AND/OR/NOT predicate: matched vs. dropped",
      "              getCachedTitles(source?) — the corpus both probes run against",
      "              listSuppliers(corpus)   — supplier names + title counts",
      "              opts: { suppliers: 'loud' | ['Loudwolf','Onyxmet'],",
      "                      source: 'cache' | 'results' | 'both',",
      "                      limit: 25   (0 = show all) }",
      "  Testing:    nudgePriceHistory(stepsBack=0) (mutates price_history — nudges",
      "              one point per series by a random ±1–8%; 0=latest, 1=one back, …)",
      "",
      "Examples:",
      "  await chempal.resolveSmiles('CCO')",
      "  await chempal.suggestAlternativeSearch('aspirin', ['aspirin'])",
      "  await new chempal.Cactus('CC(=O)Oc1ccccc1C(O)=O').getSimpleNames()",
      "  await chempal.backgroundFetch('https://chemsavers.com/')",
      "  await chempal.getProductById('A668410')",
      "  await chempal.getQueryCache()",
      "  await chempal.storageBreakdown() // per-store record counts + sizes",
      "  await chempal.fuzzTest('sodium borohydride')",
      "  await chempal.fuzzTest('acetone', { suppliers: ['Loudwolf','Onyxmet'], limit: 25 })",
      "  await chempal.fuzzTest('acetone', { source: 'results', limit: 0 })",
      "  await chempal.astTest('sodium AND NOT borohydride')",
      "  await chempal.astTest('acid OR base', { fuzzyWords: false, threshold: 70 })",
      "  await chempal.nudgePriceHistory(2) // nudge the price 2 entries back",
    ].join("\n"),
  );
}

/**
 * The set of helpers exposed on `window.chempal` for manual console testing. The
 * `suggestAlternativeSearch` entry is wrapped so the `excluded` argument is optional and
 * accepts a plain array (e.g. `['aspirin']`) in addition to a `Set`.
 */
const chempal = {
  // SMILES resolution / detection
  resolveSmiles,
  resolveQueryForSearch,
  looksLikeSmiles,
  parseStructurePrefix,
  isProbablyValidSmiles,
  extractSmiles,
  // PubChem name suggestions
  suggestAlternativeSearch: (query: string, excluded: Iterable<string> = []) =>
    suggestAlternativeSearch(query, new Set([...excluded].map((value) => value.toLowerCase()))),
  getRankedNamesByName,
  isSimpleName,
  getCompoundNameFromAlias,
  executeSDQSearch,
  // CAS / Cactus resolvers
  getCASByName,
  getNamesByCAS,
  getIUPACName,
  findCAS,
  isCAS,
  Cactus,
  // Background service-worker fetch proxy
  backgroundFetch,
  // IndexedDB inspection (read-only)
  getProductById,
  getProductPriceHistory,
  getProductCache: getAllSupplierProductDataCacheEntries,
  getQueryCache: getAllSupplierQueryCacheEntries,
  getSearchResults,
  getSearchHistory,
  getExcludedProducts,
  storageBreakdown,
  // Fuzzy-filter probing against the local cache (read-only, no network)
  fuzzTest,
  astTest,
  getCachedTitles: collectCachedTitles,
  listSuppliers,
  // Testing / fixtures (mutates IndexedDB)
  nudgePriceHistory,
  help,
};

declare global {
  interface Window {
    /** Dev-only chemistry helpers for manual console testing; attached by {@link exposeDebugApi}. */
    chempal?: typeof chempal;
  }
}

/**
 * Attaches the chemistry helper API to `window.chempal` so the resolvers can be exercised from the
 * browser devtools console. Intended for dev/non-production builds only — the caller gates this
 * behind {@link IS_DEV_BUILD} so it is tree-shaken out of production bundles.
 * @returns Nothing; mutates the global `window`
 * @example
 * ```typescript
 * exposeDebugApi();
 * // In the console: await window.chempal.resolveSmiles("CCO")
 * ```
 * @source
 */
export function exposeDebugApi(): void {
  window.chempal = chempal;
  console.info("%cChemPal debug helpers ready — run chempal.help()", "color:#6cf;font-weight:bold");
}
