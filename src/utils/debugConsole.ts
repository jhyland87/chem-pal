import { backgroundFetch as backgroundFetchHelper } from "@/helpers/backgroundFetch";
import type { BackgroundFetchInit } from "@/helpers/backgroundFetch";
import { findCAS, getCASByName, getIUPACName, getNamesByCAS, isCAS } from "@/helpers/cas";
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
import { Cactus } from "@/utils/Cactus";

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
 * Prints the available debug helpers and a few example calls to the console.
 * @source
 */
function help(): void {
  console.info(
    [
      "ChemPal debug helpers (window.chempal):",
      "",
      "  SMILES:   resolveSmiles, resolveQueryForSearch, looksLikeSmiles,",
      "            parseStructurePrefix, isProbablyValidSmiles, extractSmiles",
      "  PubChem:  suggestAlternativeSearch, getRankedNamesByName, isSimpleName,",
      "            getCompoundNameFromAlias, executeSDQSearch",
      "  CAS:      getCASByName, getNamesByCAS, getIUPACName, findCAS, isCAS",
      "  Cactus:   new chempal.Cactus('aspirin')",
      "  Network:  backgroundFetch",
      "",
      "Examples:",
      "  await chempal.resolveSmiles('CCO')",
      "  await chempal.suggestAlternativeSearch('aspirin', ['aspirin'])",
      "  await new chempal.Cactus('CC(=O)Oc1ccccc1C(O)=O').getSimpleNames()",
      "  await chempal.backgroundFetch('https://chemsavers.com/')",
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
