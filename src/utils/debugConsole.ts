import type { BackgroundFetchInit } from "@/helpers/backgroundFetch";
import { backgroundFetch as backgroundFetchHelper } from "@/helpers/backgroundFetch";
import { findCAS, getCASByName, getIUPACName, getNamesByCAS } from "@/helpers/cas";
import { isCAS } from "@/utils/typeGuards/common";
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
import type { ReleaseSection } from "@/helpers/updates";
import { getInstallSource, parseReleaseNotes } from "@/helpers/updates";
import semver from "semver";
import { formatBytes } from "@/helpers/utils";
import { CACHE } from "@/constants/common";
import { Cactus } from "@/utils/Cactus";
import { cstorage } from "@/utils/storage";
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
 * Prints deliberate debug-console output.
 *
 * `esbuild.pure` in vite.config.ts lists `console.log`/`info`/`debug`/`trace` so
 * incidental logging doesn't ship, and because Vite pins `NODE_ENV=production`
 * for every `vite build` that applies to dev builds too. A function whose body is
 * only such a call gets emptied outright — which is why `help()` compiled down to
 * `function _e(){}`. Aliasing the method first means the call site isn't the
 * `console.info(…)` shape the pure-list matches, so this module's own output
 * survives while ordinary logging elsewhere is still stripped.
 * @param message - The line (or first argument) to print.
 * @param args - Any additional values to log alongside it.
 * @returns Nothing; writes to the console.
 * @example
 * ```ts
 * printDebug("✅ Done"); // survives the production pure-list
 * ```
 * @source
 */
function printDebug(message: unknown, ...args: unknown[]): void {
  const write = console.info.bind(console);
  write(message, ...args);
}

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
  printDebug(
    `✅ Nudged ${changed} price series at ${steps} back from latest${skippedNote}. Re-open a product's detail panel to see it.`,
  );
  return changed;
}

/** Stand-in notes used when CHANGELOG.md has nothing under `## [Unreleased]`. */
const SAMPLE_RELEASE_NOTES: ReleaseSection[] = [
  { title: "Added", items: ["A shiny new thing", "Another new thing"] },
  { title: "Changed", items: ["Something works differently now"] },
  { title: "Fixed", items: ["That annoying bug"] },
];

/**
 * The notes the next release will actually ship with: the `## [Unreleased]`
 * section of CHANGELOG.md, baked in at build time as
 * `__CHANGELOG_UNRELEASED__` and parsed with the same
 * {@link parseReleaseNotes} the real prompt uses — so this preview renders
 * identically to what users will get.
 *
 * Falls back to {@link SAMPLE_RELEASE_NOTES} when the section is empty (e.g.
 * right after a release), so the prompt is still worth looking at.
 * @returns Parsed sections for the upcoming release.
 * @example
 * ```ts
 * upcomingReleaseNotes(); // [{ title: "Added", items: ["Update prompt: …"] }]
 * ```
 * @source
 */
function upcomingReleaseNotes(): ReleaseSection[] {
  const parsed = parseReleaseNotes(__CHANGELOG_UNRELEASED__);
  if (parsed.length > 0) return parsed;
  printDebug("CHANGELOG.md has no [Unreleased] entries — showing sample notes instead.");
  return SAMPLE_RELEASE_NOTES;
}

/**
 * A plausible next version: the running build's minor bump, so the prompt reads
 * like a real release rather than a placeholder. Always greater than the current
 * version, which is what makes the prompt fire.
 * @returns The next minor version, or `"99.0.0"` if it can't be derived.
 * @example
 * ```ts
 * nextVersion(); // "1.3.0" while running 1.2.0
 * ```
 * @source
 */
function nextVersion(): string {
  return semver.inc(__APP_VERSION__, "minor") ?? "99.0.0";
}

/**
 * Options accepted by {@link simulateUpdate}.
 * @source
 */
interface SimulateUpdateOptions {
  /** Release notes to show. Pass `false` for a release with no notes. */
  notes?: ReleaseSection[] | false;
  /** Release page the "View release" action opens. */
  releaseUrl?: string;
}

/**
 * Dev-only: makes the app believe a newer version exists, so the update prompt
 * can be exercised without publishing a release or downgrading `package.json`.
 *
 * Seeds the `update_check` record the way a successful GitHub poll would, with
 * `lastCheckedAt` set to now so the 24h throttle suppresses any real network
 * call. Any previous dismissal is cleared, so the prompt reappears even if you
 * dismissed this version a moment ago.
 *
 * By default this previews the **next release**: the version is the running
 * build's minor bump and the notes are CHANGELOG.md's `## [Unreleased]` section,
 * so the prompt shows exactly what users will see when that release ships.
 *
 * This drives the **manual-install** path ("View release"). Use
 * {@link simulateWebstoreUpdate} for the Web Store path ("Reload now").
 * @param version - The version to advertise. Defaults to the next minor.
 * @param options - Optional notes / release URL overrides (see {@link SimulateUpdateOptions}).
 * @returns Nothing; writes to `chrome.storage.local`.
 * @example
 * ```typescript
 * // In the console:
 * await chempal.simulateUpdate();            // next version + real [Unreleased] notes
 * await chempal.simulateUpdate("2.0.0");     // pin the version, same notes
 * await chempal.simulateUpdate("1.3.0", { notes: false }); // no-notes fallback
 * ```
 * @source
 */
async function simulateUpdate(
  version: string = nextVersion(),
  options: SimulateUpdateOptions = {},
): Promise<void> {
  const notes = options.notes === false ? [] : (options.notes ?? upcomingReleaseNotes());
  const releaseUrl =
    options.releaseUrl ?? `https://github.com/${__GITHUB_OWNER__}/${__GITHUB_REPO__}/releases`;

  await cstorage.local.set({
    [CACHE.UPDATE_CHECK]: {
      // Inside the throttle window, so the mount effect serves this instead of
      // hitting the GitHub API.
      lastCheckedAt: Date.now(),
      latestVersion: version,
      releaseUrl,
      // Must match latestVersion or the cached notes are treated as stale.
      notesVersion: version,
      notes,
    },
  });

  if (getInstallSource() === "webstore") {
    console.warn(
      "This build looks like a Web Store install, so the manual-install path won't run.\n" +
        "Use chempal.simulateWebstoreUpdate() instead.",
    );
    return;
  }

  printDebug(
    `✅ Pretending ${version} is available (running ${__APP_VERSION__}), ` +
      `${notes.length > 0 ? `${notes.length} note section(s)` : "no notes"}.\n` +
      "↻ Reload the page to see the prompt.",
  );
}

/**
 * Dev-only: simulates Chrome having staged a Web Store update, exercising the
 * "Reload now" path that `chrome.runtime.onUpdateAvailable` normally triggers.
 *
 * That path is gated on the extension looking Web Store-installed, which an
 * unpacked build is not — so this warns (rather than silently doing nothing)
 * when the runtime manifest has no `update_url`, and tells you how to fake one.
 * @param version - The staged version to advertise. Defaults to `"99.0.0"`.
 * @returns Nothing; writes to `chrome.storage.local`.
 * @example
 * ```typescript
 * // In the console:
 * await chempal.simulateWebstoreUpdate();
 * await chempal.simulateWebstoreUpdate("1.3.0");
 * ```
 * @source
 */
async function simulateWebstoreUpdate(version: string = "99.0.0"): Promise<void> {
  await cstorage.local.set({
    [CACHE.UPDATE_PENDING]: { version, detectedAt: Date.now() },
  });

  if (getInstallSource() !== "webstore") {
    console.warn(
      [
        "⚠️  Staged update recorded, but this build reports install source \"manual\",",
        "    so the Web Store path won't run and nothing will show.",
        "",
        "    To fake a Web Store install, add this to build/manifest.json and reload",
        "    the extension (a rebuild overwrites it, so it cleans itself up):",
        "",
        '      "update_url": "https://clients2.google.com/service/update2/crx"',
        "",
        "    Edit build/manifest.json, NOT public/manifest.json — a stray update_url",
        "    in the source manifest would ship.",
      ].join("\n"),
    );
    return;
  }

  printDebug(
    `✅ Pretending Chrome staged ${version} (running ${__APP_VERSION__}).\n` +
      "↻ Reload the page to see the “Reload now” prompt.",
  );
}

/**
 * Dev-only: clears everything {@link simulateUpdate} and
 * {@link simulateWebstoreUpdate} write, including any recorded dismissal, so the
 * next open behaves like a fresh install.
 * @returns Nothing; removes the update keys from `chrome.storage.local`.
 * @example
 * ```typescript
 * // In the console:
 * await chempal.resetUpdatePrompt();
 * ```
 * @source
 */
async function resetUpdatePrompt(): Promise<void> {
  await cstorage.local.remove([CACHE.UPDATE_CHECK, CACHE.UPDATE_PENDING]);
  printDebug("✅ Cleared update_check and update_pending.\n↻ Reload the page.");
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
  printDebug(
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
  printDebug(
    [
      "ChemPal debug helpers (window.chempal):",
      "  Always on in dev builds; in a normal build, unlock advanced mode.",
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
      "  Updates:    simulateUpdate(version?, opts?) — preview the next release:",
      "                defaults to the next minor + CHANGELOG.md [Unreleased] notes",
      "                opts: { notes: ReleaseSection[] | false, releaseUrl: string }",
      "              simulateWebstoreUpdate(version='99.0.0') — fake a staged CWS update",
      "              resetUpdatePrompt() — clear the simulation and any dismissal",
      "              (all three need a page reload to take effect)",
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
      "  await chempal.simulateUpdate() // then reload → prompt with the next release's notes",
      "  await chempal.simulateUpdate('1.3.0', { notes: false }) // no-notes fallback",
      "  await chempal.resetUpdatePrompt() // back to a clean slate",
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
  // Update-prompt simulation (mutates chrome.storage.local)
  simulateUpdate,
  simulateWebstoreUpdate,
  resetUpdatePrompt,
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
 * behind `IS_DEV_BUILD` so it is tree-shaken out of production bundles.
 * @category Utils
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
  printDebug("%cChemPal debug helpers ready — run chempal.help()", "color:#6cf;font-weight:bold");
}

/**
 * Removes the helper API from `window`, so leaving advanced mode takes the
 * console surface with it. Safe to call when nothing is attached.
 * @returns Nothing; mutates the global `window`
 * @example
 * ```typescript
 * removeDebugApi();
 * // In the console: window.chempal // => undefined
 * ```
 * @source
 */
export function removeDebugApi(): void {
  if (!window.chempal) return;
  delete window.chempal;
  printDebug("ChemPal debug helpers removed");
}
