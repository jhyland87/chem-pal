/**
 * SDQ (Structure Data Query) agent from PubChem API
 * @see https://pubchem.ncbi.nlm.nih.gov/sdq/sdqagent.cgi
 * @see https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest#section=Operation
 */

/**
 * Response structure for SDQ (Structure Data Query) agent results from PubChem API
 */
interface SDQResponse {
  /** Array of SDQ output sets containing compound data */
  SDQOutputSet: SDQOutputSet[];
}

// List of valid collections for SDQ search
type SDQCollection =
  | "compound"
  | "substance"
  | "pubmed"
  | "patent"
  | "springernature"
  | "thiemechemistry"
  | "wiley"
  | "assay"
  | "pathway"
  | "disease"
  | "targetprotein"
  | "targetgene"
  | "targettaxonomy"
  | "clinicaltrials";

/**
 * Individual SDQ output set containing compound information
 */
interface SDQOutputSet {
  /** Status information about the query */
  status: { code: number };
  /** Number of input compounds */
  inputCount: number;
  /** Total number of compounds in the result set */
  totalCount: number;
  /** Name of the collection being queried */
  collection: SDQCollection;
  /** Type of the query */
  type: string;
  /** Array of compound data rows */
  rows: SDQResultItem[];
}

/**
 * Individual compound data row from SDQ query results
 */
interface SDQResultItem {
  /** Compound ID */
  cid: number;
  /** Molecular weight */
  mw: number;
  /** Polar surface area */
  polararea: number;
  /** Molecular complexity */
  complexity: number;
  /** LogP value (octanol-water partition coefficient) */
  xlogp: number;
  /** Number of heavy atoms */
  heavycnt: number;
  /** Number of hydrogen bond donors */
  hbonddonor: number;
  /** Number of hydrogen bond acceptors */
  hbondacc: number;
  /** Number of rotatable bonds */
  rotbonds: number;
  /** Annotation hit count */
  annothitcnt: number;
  /** Molecular charge */
  charge: number;
  /** Number of covalent units */
  covalentunitcnt: number;
  /** Number of isotope atoms */
  isotopeatomcnt: number;
  /** Total atom stereocenter count */
  totalatomstereocnt: number;
  /** Defined atom stereocenter count */
  definedatomstereocnt: number;
  /** Undefined atom stereocenter count */
  undefinedatomstereocnt: number;
  /** Total bond stereocenter count */
  totalbondstereocnt: number;
  /** Defined bond stereocenter count */
  definedbondstereocnt: number;
  /** Undefined bond stereocenter count */
  undefinedbondstereocnt: number;
  /** PCL ID count */
  pclidcnt: number;
  /** GP ID count */
  gpidcnt: number;
  /** GP family count */
  gpfamilycnt: number;
  /** AID (Assay ID) information */
  aids: string;
  /** Compound name */
  cmpdname: string;
  /** Compound synonyms */
  cmpdsynonym: string;
  /** InChI (International Chemical Identifier) */
  inchi: string;
  /** InChI Key */
  inchikey: string;
  /** SMILES (Simplified Molecular Input Line Entry System) notation */
  smiles: string;
  /** IUPAC name */
  iupacname: string;
  /** Molecular formula */
  mf: string;
  /** Source name for SID */
  sidsrcname: string;
  /** Annotation information */
  annotation: string;
  /** Compound creation date */
  cidcdate: Date;
  /** Deposition category */
  depcatg: string;
  /** MeSH headings */
  meshheadings: string;
  /** Annotation hits */
  annothits: string;
  /** Exact mass */
  exactmass: string;
  /** Monoisotopic mass */
  monoisotopicmass: string;
}

// The where should be an object that contains the same keys and data types as the Output row, but
// not all parameters are valid
type SDQWhere = Partial<SDQResultItem>;

// Select can be a list of keys, a single key, or "*"
type SDQSelect = keyof SDQResultItem | keyof SDQResultItem[] | "*";

// Query parameters
interface SDQAgentQuery {
  select?: SDQSelect[] | string | "*";
  where: SDQWhere;
  limit?: number;
}

/**
 * Type guard to assert that data is a valid SDQResponse
 * @param data - The data to validate
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
