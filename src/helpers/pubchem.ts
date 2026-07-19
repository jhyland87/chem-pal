import { isCAS } from "@/utils/typeGuards/common";
import { withTtlCache } from "@/helpers/requestCache";
import { isPubChemCID } from "@/utils/typeGuards/common";

/**
 * SDQ (Structure Data Query) agent from PubChem API
 * @see https://pubchem.ncbi.nlm.nih.gov/sdq/sdqagent.cgi
 * @see https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest#section=Operation
 *
 * SDQ types are declared globally in types/pubchem.d.ts
 * @source
 */

/**
 * Base URL for PubChem's PUG-REST API.
 * @see https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 * @source
 */
const PUG_REST_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";

/**
 * Compound property fields requested from PUG-REST's `/property` operation. Uses the current
 * `SMILES` field (PubChem retired `CanonicalSMILES` in 2025).
 * @source
 */
const COMPOUND_PROPERTY_FIELDS =
  "MolecularFormula,MolecularWeight,IUPACName,SMILES,InChI,InChIKey,Title";

/**
 * A subset of PubChem compound properties, normalized to friendly camelCase field names.
 * Every field is optional because PUG-REST omits properties it cannot compute for a compound.
 * @category Science Helpers
 * @source
 */
export interface PubChemProperties {
  /** The compound's CID. */
  cid?: PubChemCID;
  /** Molecular formula, e.g. `"C3H6O"`. */
  molecularFormula?: string;
  /** Molecular weight in g/mol. PubChem returns this as a string, e.g. `"58.08"`. */
  molecularWeight?: string;
  /** IUPAC systematic name. */
  iupacName?: string;
  /** Canonical SMILES string. */
  smiles?: string;
  /** InChI string. */
  inchi?: string;
  /** InChIKey (hashed InChI). */
  inchiKey?: string;
  /** PubChem's preferred title/name for the compound. */
  title?: string;
}

/**
 * A compound's textual description from PUG-REST's `/description` operation.
 * @category Science Helpers
 * @source
 */
export interface PubChemDescription {
  /** The compound title, if provided. */
  title?: string;
  /** The description text. */
  description?: string;
  /** Human-readable name of the description's source. */
  source?: string;
  /** URL of the description's source. */
  url?: string;
}

/**
 * Extracts the CID list from a PUG-REST `IdentifierList` response, narrowing the parsed JSON
 * without type assertions.
 * @param data - The parsed JSON response body
 * @returns The array of CID numbers, or undefined if the shape is unexpected/empty
 * @source
 */
function extractCids(data: unknown): number[] | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const identifierList = Reflect.get(data, "IdentifierList");
  if (typeof identifierList !== "object" || identifierList === null) return undefined;
  const cid = Reflect.get(identifierList, "CID");
  if (!Array.isArray(cid)) return undefined;
  const nums = cid.filter((entry): entry is number => typeof entry === "number");
  return nums.length > 0 ? nums : undefined;
}

/**
 * Extracts the first compound-property record from a PUG-REST `PropertyTable` response and maps it
 * to a {@link PubChemProperties}, narrowing every field without type assertions.
 * @param data - The parsed JSON response body
 * @returns The normalized properties, or undefined if the shape is unexpected/empty
 * @source
 */
function extractProperties(data: unknown): PubChemProperties | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const table = Reflect.get(data, "PropertyTable");
  if (typeof table !== "object" || table === null) return undefined;
  const properties = Reflect.get(table, "Properties");
  if (!Array.isArray(properties) || properties.length === 0) return undefined;
  const first = properties[0];
  if (typeof first !== "object" || first === null) return undefined;

  const readString = (key: string): string | undefined => {
    const value = Reflect.get(first, key);
    return typeof value === "string" ? value : undefined;
  };

  const cidValue = Reflect.get(first, "CID");
  const weight = Reflect.get(first, "MolecularWeight");

  return {
    cid: isPubChemCID(cidValue) ? cidValue : undefined,
    molecularFormula: readString("MolecularFormula"),
    // PubChem usually returns MolecularWeight as a string, but tolerate a numeric payload too.
    molecularWeight:
      typeof weight === "string" ? weight : typeof weight === "number" ? String(weight) : undefined,
    iupacName: readString("IUPACName"),
    smiles: readString("SMILES"),
    inchi: readString("InChI"),
    inchiKey: readString("InChIKey"),
    title: readString("Title"),
  };
}

/**
 * Extracts a compound description from a PUG-REST `InformationList` response. PubChem often splits
 * the description text and its source across separate entries, so fields are merged across all
 * entries. Narrows every field without type assertions.
 * @param data - The parsed JSON response body
 * @returns The merged description, or undefined when no description text is present
 * @source
 */
function extractDescription(data: unknown): PubChemDescription | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const list = Reflect.get(data, "InformationList");
  if (typeof list !== "object" || list === null) return undefined;
  const information = Reflect.get(list, "Information");
  if (!Array.isArray(information)) return undefined;

  const readString = (entry: object, key: string): string | undefined => {
    const value = Reflect.get(entry, key);
    return typeof value === "string" ? value : undefined;
  };

  let title: string | undefined;
  let description: string | undefined;
  let source: string | undefined;
  let url: string | undefined;
  for (const entry of information) {
    if (typeof entry !== "object" || entry === null) continue;
    title ??= readString(entry, "Title");
    description ??= readString(entry, "Description");
    source ??= readString(entry, "DescriptionSourceName");
    url ??= readString(entry, "DescriptionURL");
  }

  if (!description) return undefined;
  return { title, description, source, url };
}

/**
 * Network implementation for {@link getCidsByCas}; see it for details.
 * @param cas - The CAS registry number to look up
 * @returns The matching CIDs, or undefined if none
 * @source
 */
async function getCidsByCasUncached(cas: CAS<string>): Promise<PubChemCID[] | undefined> {
  try {
    const response = await fetch(
      `${PUG_REST_BASE}/compound/xref/rn/${encodeURIComponent(cas)}/cids/JSON`,
    );
    if (!response.ok) return undefined;
    const data = await response.json();
    const cids = extractCids(data);
    if (!cids) return undefined;
    const valid = cids.filter(isPubChemCID);
    return valid.length > 0 ? valid : undefined;
  } catch (error) {
    console.error("Error fetching PubChem CIDs by CAS:", error);
    return undefined;
  }
}

/**
 * Retrieves the PubChem CIDs registered for a CAS number via PUG-REST's xref/registry-number
 * lookup. A single CAS number can map to multiple CIDs (e.g. different salt or hydrate forms).
 * Results are cached for three days; unknown CAS numbers resolve to undefined.
 * @category Science Helpers
 * @param cas - The CAS registry number to look up
 * @returns The matching CIDs, or undefined if PubChem has no cross-reference
 * @example
 * ```typescript
 * await getCidsByCas("15681-89-7");
 * // Returns: [4311764, 22959485, 23673181]
 * await getCidsByCas("0000-00-0");
 * // Returns: undefined
 * ```
 * @source
 */
export const getCidsByCas: (cas: CAS<string>) => Promise<PubChemCID[] | undefined> = withTtlCache(
  getCidsByCasUncached,
  { namespace: "cidsByCas" },
);

/**
 * Network implementation for {@link getCidByName}; see it for details.
 * @param name - The chemical name to look up
 * @returns The first matching CID, or undefined
 * @source
 */
async function getCidByNameUncached(name: string): Promise<PubChemCID | undefined> {
  try {
    const response = await fetch(
      `${PUG_REST_BASE}/compound/name/${encodeURIComponent(name)}/cids/JSON`,
    );
    if (!response.ok) return undefined;
    const data = await response.json();
    const first = extractCids(data)?.[0];
    return isPubChemCID(first) ? first : undefined;
  } catch (error) {
    console.error("Error fetching PubChem CID by name:", error);
    return undefined;
  }
}

/**
 * Resolves a chemical name to its best-matching PubChem CID via PUG-REST. Returns the first
 * (highest-ranked) CID PubChem reports. Results are cached for three days.
 * @category Science Helpers
 * @param name - The chemical name to look up
 * @returns The best-matching CID, or undefined if PubChem has no match
 * @example
 * ```typescript
 * await getCidByName("aspirin");
 * // Returns: 2244
 * ```
 * @source
 */
export const getCidByName: (name: string) => Promise<PubChemCID | undefined> = withTtlCache(
  getCidByNameUncached,
  { namespace: "cidByName" },
);

/**
 * Network implementation for {@link getCompoundProperties}; see it for details.
 * @param cid - The compound's CID
 * @returns The normalized properties, or undefined
 * @source
 */
async function getCompoundPropertiesUncached(
  cid: PubChemCID,
): Promise<PubChemProperties | undefined> {
  try {
    const response = await fetch(
      `${PUG_REST_BASE}/compound/cid/${cid}/property/${COMPOUND_PROPERTY_FIELDS}/JSON`,
    );
    if (!response.ok) return undefined;
    const data = await response.json();
    return extractProperties(data);
  } catch (error) {
    console.error("Error fetching PubChem compound properties:", error);
    return undefined;
  }
}

/**
 * Fetches core physical/chemical properties for a compound (formula, molecular weight, IUPAC name,
 * SMILES, InChI, InChIKey, title) via PUG-REST. These map directly onto ChemPal's product fields,
 * so this is the primary way to enrich a product once its CID is known. Cached for
 * three days.
 * @category Science Helpers
 * @param cid - The compound's CID
 * @returns The compound's properties, or undefined if the CID is unknown
 * @example
 * ```typescript
 * await getCompoundProperties(180);
 * // Returns: { cid: 180, molecularFormula: "C3H6O", molecularWeight: "58.08",
 * //           iupacName: "propan-2-one", smiles: "CC(C)=O", inchiKey: "CSCPPACGZOOCGX-UHFFFAOYSA-N", ... }
 * ```
 * @source
 */
export const getCompoundProperties: (cid: PubChemCID) => Promise<PubChemProperties | undefined> =
  withTtlCache(getCompoundPropertiesUncached, {
    namespace: "properties",
  });

/**
 * Network implementation for {@link getSynonymsByCid}; see it for details.
 * @param cid - The compound's CID
 * @returns The synonym list, or undefined
 * @source
 */
async function getSynonymsByCidUncached(cid: PubChemCID): Promise<string[] | undefined> {
  try {
    const response = await fetch(`${PUG_REST_BASE}/compound/cid/${cid}/synonyms/JSON`);
    if (!response.ok) return undefined;
    const data = await response.json();
    return extractSynonyms(data);
  } catch (error) {
    console.error("Error fetching PubChem synonyms by CID:", error);
    return undefined;
  }
}

/**
 * Fetches PubChem's popularity-ranked synonyms for a compound by CID via PUG-REST. Prefer this
 * over {@link getRankedNamesByName} when the CID is already known, as it avoids an ambiguous
 * name lookup. Cached for three days.
 * @category Science Helpers
 * @param cid - The compound's CID
 * @returns The ranked synonym list, or undefined if the CID is unknown
 * @example
 * ```typescript
 * await getSynonymsByCid(180);
 * // Returns: ["acetone", "propan-2-one", "67-64-1", "2-propanone", ...]
 * ```
 * @source
 */
export const getSynonymsByCid: (cid: PubChemCID) => Promise<string[] | undefined> = withTtlCache(
  getSynonymsByCidUncached,
  { namespace: "synonymsByCid" },
);

/**
 * Network implementation for {@link getCompoundDescription}; see it for details.
 * @param cid - The compound's CID
 * @returns The merged description, or undefined
 * @source
 */
async function getCompoundDescriptionUncached(
  cid: PubChemCID,
): Promise<PubChemDescription | undefined> {
  try {
    const response = await fetch(`${PUG_REST_BASE}/compound/cid/${cid}/description/JSON`);
    if (!response.ok) return undefined;
    const data = await response.json();
    return extractDescription(data);
  } catch (error) {
    console.error("Error fetching PubChem description:", error);
    return undefined;
  }
}

/**
 * Fetches a short human-readable description of a compound (with its source) by CID via PUG-REST.
 * Useful for surfacing a plain-language blurb in the product detail view. Cached for
 * three days.
 * @category Science Helpers
 * @param cid - The compound's CID
 * @returns The description and its source, or undefined if none is available
 * @example
 * ```typescript
 * await getCompoundDescription(180);
 * // Returns: { title: "Acetone", description: "Acetone is a manufactured chemical...",
 * //           source: "NCI Thesaurus", url: "https://..." }
 * ```
 * @source
 */
export const getCompoundDescription: (cid: PubChemCID) => Promise<PubChemDescription | undefined> =
  withTtlCache(getCompoundDescriptionUncached, {
    namespace: "descriptionByCid",
  });

/**
 * Builds the URL of a compound's PubChem summary page from its CID.
 * @category Science Helpers
 * @param cid - The compound's CID
 * @returns The PubChem compound page URL
 * @example
 * ```typescript
 * pubchemCompoundUrl(180);
 * // Returns: "https://pubchem.ncbi.nlm.nih.gov/compound/180"
 * ```
 * @source
 */
export function pubchemCompoundUrl(cid: PubChemCID): string {
  return `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;
}

/**
 * Builds a PubChem search URL for a CAS number. Use this when the exact CID is unknown — PubChem's
 * search lands the user on the matching compound (or a short result list) for the CAS number.
 * @category Science Helpers
 * @param cas - The CAS registry number
 * @returns The PubChem search URL for the CAS number
 * @example
 * ```typescript
 * pubchemCasSearchUrl("67-64-1");
 * // Returns: "https://pubchem.ncbi.nlm.nih.gov/#query=67-64-1"
 * ```
 * @source
 */
export function pubchemCasSearchUrl(cas: string): string {
  return `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(cas)}`;
}

/**
 * Builds the URL of a compound's 2D structure image (PNG) from its CID.
 * @category Science Helpers
 * @param cid - The compound's CID
 * @returns The PUG-REST PNG image URL
 * @example
 * ```typescript
 * pubchemStructureImageUrl(180);
 * // Returns: "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/180/PNG"
 * ```
 * @source
 */
export function pubchemStructureImageUrl(cid: PubChemCID): string {
  return `${PUG_REST_BASE}/compound/cid/${cid}/PNG`;
}

/**
 * Type guard to assert that data is a valid SDQResponse
 * @param data - The data to validate
 * @source
 */
function assertIsSDQResponse(data: unknown): asserts data is SDQResponse {
  if (typeof data !== "object" || data === null) {
    throw new Error("data is not an object");
  }
  if (!("SDQOutputSet" in data) || typeof data.SDQOutputSet !== "object") {
    throw new Error("data.SDQOutputSet is not an object");
  }
}

/**
 * Type guard to assert that data is a valid SDQQueryWhere
 * @param data - The data to validate
 * @source
 */
function assertIsSDQWhere(where: unknown): asserts where is SDQWhere {
  if (typeof where !== "object" || where === null) {
    throw new Error("where is not an object");
  }
}

/**
 * Network implementation for {@link executeSDQSearch}; see it for details.
 * @param query - The SDQ agent query (where clause, select fields, limit)
 * @returns The matching SDQ result rows, or undefined
 * @source
 */
async function executeSDQSearchUncached({
  where,
  select = "*",
  limit = 10,
}: SDQAgentQuery): Promise<SDQResultItem[] | undefined> {
  try {
    assertIsSDQWhere(where);

    if (select !== "*") {
      if (Array.isArray(select)) {
        select = select.join(",");
      } else {
        select = "*";
      }
    }

    const pubchemQuery = {
      select,
      limit,
      collection: "compound",
      order: ["cid,asc"],
      start: 1,
      where: { ands: [where] },
    };

    console.debug("pubchemQuery", pubchemQuery);
    const queryURLString = JSON.stringify(pubchemQuery);

    const response = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/sdq/sdqagent.cgi?infmt=json&outfmt=json&query=${queryURLString}`,
    );
    const data = await response.json();
    assertIsSDQResponse(data);
    const outputSets = data.SDQOutputSet;
    if (!outputSets || outputSets.length === 0) {
      return undefined;
    }

    if (outputSets[0].status.code !== 0) {
      console.warn(
        `SDQ agent returned a non-zero status code: ${outputSets[0].status.code}`,
        { where, select, limit },
        { response: data },
      );
      return undefined;
    }

    if (outputSets[0].totalCount === 0 || outputSets[0]?.rows?.length === 0) {
      console.debug(`SDQ agent returned no results`, { where, select, limit }, { response: data });
      return undefined;
    }

    return outputSets[0].rows;
  } catch (error) {
    console.error("Error querying SDQ agent:", error);
  }
}

/**
 * Query the SDQ agent for a compound name from a synonym. Results are cached for
 * three days.
 * @category Science Helpers
 * @param query - The SDQ agent query (where clause, select fields, limit)
 * @returns The compound name from the SDQ agent.
 * @example
 * ```typescript
 * const cmpd = await executeSDQSearch({
 *   where: { cmpdsynonym: "2-Acetoxybenzenecarboxylic acid" },
 *   select: ["cid", "cmpdname"],
 *   limit: 1,
 * });
 * console.log(cmpd);
 * // Outputs: Aspirin
 * ```
 * @source
 */
export const executeSDQSearch: (query: SDQAgentQuery) => Promise<SDQResultItem[] | undefined> =
  withTtlCache(executeSDQSearchUncached, { namespace: "sdqSearch" });

/**
 * Get the compound name from a synonym.
 * @category Science Helpers
 * @param cmpdsynonym - The synonym to get the compound name from.
 * @returns The compound name from the synonym.
 * @example
 * ```typescript
 * const cmpd = await getCompoundNameFromAlias("2-Acetoxybenzenecarboxylic acid");
 * console.log(cmpd);
 * // Outputs: Aspirin
 * ```
 * @source
 */
export async function getCompoundNameFromAlias(cmpdsynonym: string): Promise<string | undefined> {
  const searchResult = await executeSDQSearch({
    where: { cmpdsynonym },
    select: ["cid", "cmpdname", "iupacname"],
    limit: 1,
  });

  if (!searchResult) {
    return undefined;
  }

  return searchResult[0].cmpdname;
}

/**
 * How many of the top (most-popular) PubChem synonyms to consider when suggesting an alternative
 * name. Keeps suggestions to widely-recognized names and avoids the obscure long tail.
 * @source
 */
const POPULARITY_WINDOW = 3;

/**
 * Extracts the synonym list from a PUG-REST synonyms response, narrowing the parsed JSON.
 * @param data - The parsed JSON response body
 * @returns The array of synonym strings, or undefined if the shape is unexpected/empty
 * @source
 */
function extractSynonyms(data: unknown): string[] | undefined {
  if (typeof data !== "object" || data === null || !("InformationList" in data)) {
    return undefined;
  }
  const list = (data as { InformationList?: { Information?: { Synonym?: unknown }[] } })
    .InformationList?.Information?.[0]?.Synonym;
  if (!Array.isArray(list)) return undefined;
  const names = list.filter((entry): entry is string => typeof entry === "string");
  return names.length > 0 ? names : undefined;
}

/**
 * Network implementation for {@link getRankedNamesByName}; see it for details.
 * @param name - The chemical name to look up
 * @returns The ranked synonym list, or undefined
 * @source
 */
async function getRankedNamesByNameUncached(name: string): Promise<string[] | undefined> {
  try {
    const response = await fetch(
      `${PUG_REST_BASE}/compound/name/${encodeURIComponent(name)}/synonyms/JSON`,
    );
    if (!response.ok) return undefined;
    const data = await response.json();
    return extractSynonyms(data);
  } catch (error) {
    console.error("Error fetching PubChem synonyms:", error);
    return undefined;
  }
}

/**
 * Fetches PubChem's popularity-ranked synonyms for a chemical name via PUG-REST, caching results
 * for three days. The leading entries are the most commonly used names, and CAS numbers
 * appear inline among them. Returns undefined when PubChem has no match.
 * @category Science Helpers
 * @param name - The chemical name to look up
 * @returns The ranked synonym list, or undefined if not found
 * @example
 * ```typescript
 * await getRankedNamesByName("acetone");
 * // Returns: ["acetone", "2-propanone", "67-64-1", "propanone", ...]
 * ```
 * @source
 */
export const getRankedNamesByName: (name: string) => Promise<string[] | undefined> = withTtlCache(
  getRankedNamesByNameUncached,
  { namespace: "rankedNames" },
);

/**
 * Tidies a chemical name for display in a suggestion. PubChem often returns common names in all
 * caps (e.g. "ACETYLSALICYLIC ACID"); these are lowercased to read naturally. Names that already
 * contain lowercase letters keep their casing, preserving meaningful capitalization (e.g. brand
 * names like "Tylenol"). Search matching is case-insensitive, so this only affects presentation.
 * @param name - The chemical name to format
 * @returns The display-friendly name
 * @example
 * ```typescript
 * formatSuggestedName("ACETYLSALICYLIC ACID") // "acetylsalicylic acid"
 * formatSuggestedName("Tylenol")              // "Tylenol"
 * ```
 * @source
 */
function formatSuggestedName(name: string): string {
  return /[a-z]/.test(name) ? name : name.toLowerCase();
}

/**
 * Determines whether a chemical name is "simple" enough to suggest to a user — an ordinary common
 * name made only of letters and spaces, not a long IUPAC- or registry-style technical identifier.
 * @category Science Helpers
 * @param name - The candidate chemical name
 * @returns True if the name is short and contains only letters and spaces
 * @example
 * ```typescript
 * isSimpleName("acetone")                 // true
 * isSimpleName("aspirin")                 // true
 * isSimpleName("2-acetyloxybenzoic acid") // false (contains digits)
 * ```
 * @source
 */
export function isSimpleName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 30) return false;
  return /^[A-Za-z][A-Za-z ]*$/.test(trimmed);
}

/**
 * Suggests a simpler alternative search term when a query yields no results. Pulls PubChem's
 * popularity-ranked synonyms for the query, keeps only simple common names (see {@link isSimpleName}),
 * and skips any term the user has already tried. Falls back to the compound's CAS number when no
 * suitable simple name remains. Either field may be undefined.
 * @category Science Helpers
 * @param query - The original (unsuccessful) search query
 * @param excluded - Lowercased terms to skip (e.g. previously searched, zero-result queries)
 * @returns The best simple alternative name and/or a CAS fallback
 * @example
 * ```typescript
 * await suggestAlternativeSearch("2-propanone", new Set(["2-propanone"]));
 * // Returns: { name: "acetone", cas: "67-64-1" }
 * ```
 * @source
 */
export async function suggestAlternativeSearch(
  query: string,
  excluded: ReadonlySet<string>,
): Promise<{ name?: string; cas?: string }> {
  const ranked = await getRankedNamesByName(query);
  if (!ranked) return {};

  const queryLc = query.toLowerCase();
  const isSkipped = (value: string): boolean =>
    value.toLowerCase() === queryLc || excluded.has(value.toLowerCase());

  // PubChem returns synonyms in descending popularity. Only suggest a name from the few most
  // common ones — deeper entries are obscure (e.g. "Dimethyl ketone" for acetone) and just as
  // unlikely to yield results, so we'd rather offer the CAS than a name nobody recognizes.
  const match = ranked
    .slice(0, POPULARITY_WINDOW)
    .find((entry) => isSimpleName(entry) && !isSkipped(entry));
  const name = match ? formatSuggestedName(match) : undefined;
  const cas = ranked.find((entry) => isCAS(entry) && !excluded.has(entry.toLowerCase()));
  return { name, cas };
}

/**
 * Gets the PubChem ID from the links in the document.
 * @category Science Helpers
 * @param doc - The document to search for PubChem links
 * @returns The PubChem ID, or undefined if not found
 * @example
 * ```typescript
 * const pubchemId = getPubchemIdFromDocument(document);
 * console.log(pubchemId);
 * // Outputs: 1234567890
 * ```
 */
export function getPubchemIdFromDocument(doc: Document): number | undefined {
  const link = doc.querySelector('a[href*="pubchem.ncbi.nlm.nih.gov/substance"]');
  if (!(link instanceof HTMLAnchorElement)) return undefined;
  const pubchemId = link.href.split("/").pop();
  if (!pubchemId || isNaN(Number(pubchemId))) return undefined;
  return Number(pubchemId);
}
