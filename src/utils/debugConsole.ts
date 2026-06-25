import { findCAS, getCASByName, getIUPACName, getNamesByCAS, isCAS } from "@/helpers/cas";
import {
  executeSDQSearch,
  getCompoundNameFromAlias,
  getRankedNamesByName,
  isSimpleName,
  suggestAlternativeSearch,
} from "@/helpers/pubchem";
import {
  isProbablyValidSmiles,
  looksLikeSmiles,
  parseStructurePrefix,
  resolveQueryForSearch,
  resolveSmiles,
} from "@/helpers/smiles";
import { Cactus } from "@/utils/Cactus";

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
      "            parseStructurePrefix, isProbablyValidSmiles",
      "  PubChem:  suggestAlternativeSearch, getRankedNamesByName, isSimpleName,",
      "            getCompoundNameFromAlias, executeSDQSearch",
      "  CAS:      getCASByName, getNamesByCAS, getIUPACName, findCAS, isCAS",
      "  Cactus:   new chempal.Cactus('aspirin')",
      "",
      "Examples:",
      "  await chempal.resolveSmiles('CCO')",
      "  await chempal.suggestAlternativeSearch('aspirin', ['aspirin'])",
      "  await new chempal.Cactus('CC(=O)Oc1ccccc1C(O)=O').getSimpleNames()",
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
