/**
 * Response structure for compound search results from PubChem API
 */
interface CompoundResponse {
  /** Status information about the API response */
  status: {
    /** HTTP status code */
    code: number;
  };
  /** Total number of results found */
  total: number;
  /** Dictionary containing search terms and results */
  dictionary_terms: {
    /** Array of compound names matching the search query */
    compound: string[];
  };
}

/**
 * Response structure for CID (Compound ID) lookup from PubChem API
 */
interface CIDResponse {
  /** Container for concepts and their associated CIDs */
  ConceptsAndCIDs: {
    /** Array of Compound IDs */
    CID: number[];
  };
}

interface SDQQuery {
  cid?: number;
  name?: string;
  cmpdname?: string;
  smiles?: string;
  inchi?: string;
  inchikey?: string;
  formula?: string;
  cmpdsynonym?: string;
}

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
 * Type guard to assert that data is a valid CIDResponse
 * @param data - The data to validate
 */
function assertIsCIDResponse(data: unknown): asserts data is CIDResponse {
  if (typeof data !== "object" || data === null) {
    throw new Error("data is not an object");
  }
  if (
    !("ConceptsAndCIDs" in data) ||
    typeof data.ConceptsAndCIDs !== "object" ||
    data.ConceptsAndCIDs === null
  ) {
    throw new Error("data.ConceptsAndCIDs is not an object");
  }
  if (
    !("CID" in data.ConceptsAndCIDs) ||
    !Array.isArray(data.ConceptsAndCIDs.CID) ||
    data.ConceptsAndCIDs.CID.length === 0
  ) {
    throw new Error("data.ConceptsAndCIDs.CID is not an array");
  }
  if (data.ConceptsAndCIDs.CID.length === 0) {
    throw new Error("data.ConceptsAndCIDs.CID is empty");
  }
  if (typeof data.ConceptsAndCIDs.CID[0] !== "number") {
    throw new Error("data.ConceptsAndCIDs.CID[0] is not a number");
  }
}

/**
 * Type guard to assert that data is a valid CompoundResponse
 * @param data - The data to validate
 */
function assertIsCompoundResponseResponse(data: unknown): asserts data is CompoundResponse {
  if (typeof data !== "object" || data === null) {
    throw new Error("data is not an object");
  }
  if (!("status" in data) || typeof data.status !== "object") {
    throw new Error("data.status is not an object");
  }
  if (!("total" in data) || typeof data.total !== "number") {
    throw new Error("data.total is not a number");
  }
  if (
    !("dictionary_terms" in data) ||
    typeof data.dictionary_terms !== "object" ||
    data.dictionary_terms === null
  ) {
    throw new Error("data.dictionary_terms is not an object");
  }
  if (!("compound" in data.dictionary_terms) || !Array.isArray(data.dictionary_terms.compound)) {
    throw new Error("data.dictionary_terms.compound is not an array");
  }
  if (data.dictionary_terms.compound.length === 0) {
    throw new Error("data.dictionary_terms.compound is empty");
  }
  if (typeof data.dictionary_terms.compound[0] !== "string") {
    throw new Error("data.dictionary_terms.compound[0] is not a string");
  }
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
 * A utility class for interacting with the PubChem API to retrieve chemical compound information.
 *
 * This class provides methods to search for compounds, retrieve their CID (Compound ID),
 * and query detailed molecular properties using PubChem's SDQ (Structure Data Query) agent.
 *
 * @example
 * ```typescript
 * const pubchem = new Pubchem("2-Acetoxybenzenecarboxylic acid");
 * console.log("Result:", await pubchem.getSimpleName());
 * // Result: Aspirin
 * ```
 */
export default class Pubchem {
  /** Base URL for PubChem API endpoints */
  private readonly baseURL = "https://pubchem.ncbi.nlm.nih.gov";

  /**
   * Creates a new Pubchem instance for querying compound information
   * @param query - The chemical compound name or identifier to search for
   */
  constructor(private readonly query: string) {
    this.query = query;
  }

  /**
   * Retrieves the first matching compound name from PubChem's autocomplete API
   * @returns Promise resolving to the first matching compound name
   *
   * @example
   * ```typescript
   * const compound = await pubchem.getCompound();
   * console.log(compound); // "aspirin"
   * ```
   */
  async getCompound(): Promise<string | undefined> {
    try {
      const response = await fetch(
        `${this.baseURL}/rest/autocomplete/compound/${encodeURIComponent(this.query)}`,
      );
      const data = await response.json();
      assertIsCompoundResponseResponse(data);
      return data.dictionary_terms.compound[0];
    } catch (error) {
      console.error("Error fetching compound:", error);
    }
  }

  /**
   * Retrieves the CID (Compound ID) for the compound by first getting the compound name
   * and then looking up its CID
   * @returns Promise resolving to the Compound ID (CID)
   *
   * @example
   * ```typescript
   * const cid = await pubchem.getCID();
   * console.log(cid); // 2244
   * ```
   */
  async getCID(): Promise<number | undefined> {
    try {
      const compound = await this.getCompound();
      if (!compound) return undefined;
      const response = await fetch(
        `${this.baseURL}/rest/pug/concepts/name/JSON?name=${encodeURIComponent(compound)}`,
      );
      const data = await response.json();
      assertIsCIDResponse(data);
      return data.ConceptsAndCIDs.CID[0];
    } catch (error) {
      console.error("Error fetching CID:", error);
    }
  }

  /**
   * Queries PubChem's SDQ (Structure Data Query) agent to retrieve detailed molecular properties
   * @returns Promise resolving to the SDQ response containing detailed compound data
   *
   * @example
   * ```typescript
   * const sdqData = await pubchem.querySdqAgent();
   * console.log(sdqData.SDQOutputSet[0].rows[0].mw); // Molecular weight
   * ```
   */
  async querySdqAgent(sdqQuery: SDQQuery): Promise<SDQResponse | undefined> {
    try {
      const sdqAgentQuery = {
        select: "*",
        collection: "compound",
        order: ["cid,asc"],
        start: 1,
        limit: 10,
        where: { ands: [sdqQuery] },
        width: 1000000,
        listids: 0,
      };
      console.debug({ sdqAgentQuery });
      const queryURL = JSON.stringify(sdqAgentQuery).replace(/"/g, "%22").replace(/ /g, "%20");

      console.debug(
        `Querying URL: ${this.baseURL}/sdq/sdqagent.cgi?infmt=json&outfmt=json&query=${queryURL}`,
      );
      const response = await fetch(
        `${this.baseURL}/sdq/sdqagent.cgi?infmt=json&outfmt=json&query=${queryURL}`,
      );
      const data = await response.json();
      assertIsSdqAgentResponse(data);
      return data;
    } catch (error) {
      console.error("Error querying SDQ agent:", error);
    }
  }

  /**
   * Retrieves the simple compound name from the SDQ agent query results
   * @returns Promise resolving to the compound name
   *
   * @example
   * ```typescript
   * const name = await pubchem.getSimpleName();
   * console.log(name); // "2-acetyloxybenzoic acid"
   * ```
   */
  async getSimpleName(): Promise<string | undefined> {
    try {
      const cid = await this.getCID();
      if (!cid) return undefined;
      const data = await this.querySdqAgent({ cid });
      if (!data) return undefined;
      return data.SDQOutputSet[0].rows[0].cmpdname;
    } catch (error) {
      console.error("Error fetching simple name:", error);
    }
  }

  /**
   * Retrieves the compound name from the SDQ agent query results
   * @returns Promise resolving to the compound name
   *
   * @example
   * ```typescript
   * const name = await pubchem.getCompoundNameFromAlias("aspirin");
   * ```
   */
  async getCompoundNameFromAlias(cmpdsynonym: string): Promise<string | undefined> {
    try {
      const data = await this.querySdqAgent({ cmpdsynonym });
      if (!data) return undefined;
      return data.SDQOutputSet[0].rows[0].cmpdname;
    } catch (error) {
      console.error("Error fetching compound name from alias:", error);
    }
  }
}
