import { isCAS } from "@/helpers/cas";

/**
 * SDQ (Structure Data Query) agent from PubChem API
 * @see https://pubchem.ncbi.nlm.nih.gov/sdq/sdqagent.cgi
 * @see https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest#section=Operation
 *
 * SDQ types are declared globally in types/pubchem.d.ts
 * @source
 */

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
 * Query the SDQ agent for a compound name from a synonym.
 * @param cmpdsynonym - The synonym to query the SDQ agent for.
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
export async function executeSDQSearch({
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
 * Get the compound name from a synonym.
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
 * Fetches PubChem's popularity-ranked synonyms for a chemical name via PUG-REST. The leading
 * entries are the most commonly used names, and CAS numbers appear inline among them. Returns
 * undefined when PubChem has no match (e.g. a 404 for an unknown or misspelled name).
 * @param name - The chemical name to look up
 * @returns The ranked synonym list, or undefined if not found
 * @example
 * ```typescript
 * await getRankedNamesByName("acetone");
 * // Returns: ["acetone", "2-propanone", "67-64-1", "propanone", ...]
 * ```
 * @source
 */
export async function getRankedNamesByName(name: string): Promise<string[] | undefined> {
  try {
    const response = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/synonyms/JSON`,
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
