/**
 * PubChem SDQ (Structure Data Query) types
 * @see https://pubchem.ncbi.nlm.nih.gov/sdq/sdqagent.cgi
 * @see https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest#section=Operation
 */

/**
 * Valid collection names for SDQ search queries
 */
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
 * Response structure for SDQ agent results from PubChem API
 */
interface SDQResponse {
  /** Array of SDQ output sets containing compound data */
  SDQOutputSet: SDQOutputSet[];
}

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
  collection: SDQCollection | string;
  /** Type of the query */
  type: string;
  /** Array of compound data rows */
  rows: SDQResultItem[];
}

/**
 * Individual compound data row from SDQ query results.
 * Also known as SDQOutputRow in some contexts.
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

/**
 * Alias for SDQResultItem for backward compatibility
 */
type SDQOutputRow = SDQResultItem;

/**
 * Partial SDQResultItem used for query where clauses
 */
type SDQWhere = Partial<SDQResultItem>;

/**
 * Valid select expressions for SDQ queries
 */
type SDQSelect = keyof SDQResultItem | keyof SDQResultItem[] | "*";

/**
 * Query parameters for the SDQ agent
 */
interface SDQAgentQuery {
  select?: SDQSelect[] | string | "*";
  where: SDQWhere;
  limit?: number;
}

/**
 * Query parameters for SDQ lookups
 */
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
