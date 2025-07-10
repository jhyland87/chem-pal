/**
 * Response structure for SDQ (Structure Data Query) agent results from PubChem API
 */
export interface SDQResponse {
  /** Array of SDQ output sets containing compound data */
  SDQOutputSet: SDQOutputSet[];
}

/**
 * Individual SDQ output set containing compound information
 */
export interface SDQOutputSet {
  /** Status information about the query */
  status: { code: number };
  /** Number of input compounds */
  inputCount: number;
  /** Total number of compounds in the result set */
  totalCount: number;
  /** Name of the collection being queried */
  collection: string;
  /** Type of the query */
  type: string;
  /** Array of compound data rows */
  rows: SDQOutputRow[];
}

/**
 * Individual compound data row from SDQ query results
 */
export interface SDQOutputRow {
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

/**
 * Type guard to assert that data is a valid SDQResponse
 * @param data - The data to validate
 */
function assertIsSdqAgentResponse(data: unknown): asserts data is SDQResponse {
  if (typeof data !== "object" || data === null) {
    throw new Error("data is not an object");
  }
  if (!("SDQOutputSet" in data) || typeof data.SDQOutputSet !== "object") {
    throw new Error("data.SDQOutputSet is not an object");
  }
}

/**
 * Query the SDQ agent for a compound name from a synonym.
 * @param cmpdsynonym - The synonym to query the SDQ agent for.
 * @returns The compound name from the SDQ agent.
 */
export async function querySdqAgent(cmpdsynonym: string): Promise<string | undefined> {
  try {
    const sdqAgentQuery = {
      select: "*",
      collection: "compound",
      order: ["cid,asc"],
      start: 1,
      limit: 10,
      where: { ands: [{ cmpdsynonym }] },
      width: 1000000,
      listids: 0,
    };
    const queryURL = JSON.stringify(sdqAgentQuery).replace(/"/g, "%22").replace(/ /g, "%20");

    const response = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/sdq/sdqagent.cgi?infmt=json&outfmt=json&query=${queryURL}`,
    );
    const data = await response.json();
    assertIsSdqAgentResponse(data);
    return data.SDQOutputSet[0].rows[0].cmpdname;
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
  return await querySdqAgent(cmpdsynonym);
}
