import { LRUCache } from "lru-cache";

/**
 * Configuration options for the Cactus client cache.
 */
interface CactusCacheOptions {
  /** Maximum number of items to store in the cache */
  max?: number;
  /** Time to live for cached items in milliseconds */
  ttl?: number;
  /** Whether to enable caching (default: true) */
  enabled?: boolean;
}

/**
 * The endpoints available in the Cactus API.
 *
 * @see https://cactus.nci.nih.gov/chemical/structure
 */
type CactusEndpoint =
  | "inchi"
  | "stdinchikey"
  | "stdinchi"
  | "smiles"
  | "ficts"
  | "ficus"
  | "uuuuu"
  | "hashisy"
  | "file?format=sdf"
  | "names"
  | "iupac_name"
  | "cas"
  | "chemspider_id"
  | "image"
  | "twirl"
  | "mw"
  | "formula"
  | "h_bond_donor_count"
  | "h_bond_acceptor_count"
  | "h_bond_center_count"
  | "rule_of_5_violation_count"
  | "rotor_count"
  | "effective_rotor_count"
  | "ring_count"
  | "ringsys_count"
  | "inchikey";

function assertIsStringResponse(response: unknown): asserts response is string {
  if (typeof response !== "string") {
    throw new Error(`Invalid response: ${response}`, { cause: response });
  }
}

/**
 * A client for the Cactus Chemical Identifier Resolver API.
 *
 * This class provides methods to retrieve various chemical information including
 * names, structures, properties, and identifiers from the NCI Cactus service.
 *
 * API Documentation: https://cactus.nci.nih.gov/chemical/structure_documentation
 *
 * This service works as a resolver for different chemical structure identifiers and allows one to convert a given
 * structure identifier into another representation or structure identifier. You can either use the [web form of
 * the resolver](https://cactus.nci.nih.gov/chemical/structure) or the following simple URL API scheme:
 *
 * ```
 * http:///chemical/structure/"structure identifier"/"representation"
 * ```
 *
 * The service returns the requested new structure representation with a corresponding MIME-Type specification (in
 * most cases MIME-Type: "text/plain"). If a requested URL is not resolvable for the service an HTML 404 status message
 * is returned. In the (unlikely) case of an error, an HTML 500 status message is generated.
 *
 * @example
 * ```typescript
 * const cactus = new Cactus("aspirin");
 * const names = await cactus.getNames();
 * console.log(names); // ["aspirin", "acetylsalicylic acid", ...]
 * ```
 */
export default class Cactus {
  /** Chemical name */
  private name: string;

  /** Whether to enable caching */
  private cacheEnabled: boolean = true;

  /** Base URL */
  private readonly baseUrl: string = "https://cactus.nci.nih.gov/chemical/structure";

  /** Whether to return responses in XML format */
  private formatXML: boolean = false;

  /** Cache */
  private cache?: LRUCache<string, string>;

  /** Static cache shared across all Cactus instances */
  private static globalCache: LRUCache<string, string> = new LRUCache({
    max: 1000,
    ttl: 1000 * 60 * 60, // 1 hour
  });

  /**
   * Creates a new Cactus instance for the specified chemical.
   *
   * @param name - The chemical name, formula, or identifier to query
   * @param formatXML - Whether to return responses in XML format
   * @param cacheOptions - Optional cache configuration
   * @throws Error When no chemical name is provided
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const ethanol = new Cactus("C2H5OH", false, { max: 500, ttl: 1800000 });
   * const caffeine = new Cactus("58-08-2", false, { enabled: false }); // Disable caching
   * ```
   */
  constructor(name: string, formatXML: boolean = false, cacheOptions: CactusCacheOptions = {}) {
    if (!name) {
      throw new Error("Chemical name is required");
    }
    this.name = name;
    this.formatXML = formatXML;
    this.cacheEnabled = cacheOptions.enabled !== false; // Default to true

    if (this.cacheEnabled) {
      this.cache = new LRUCache({
        max: cacheOptions.max ?? 100,
        ttl: cacheOptions.ttl ?? 1000 * 60 * 30, // 30 minutes default
      });
    }
  }

  /**
   * Sets the format of the response to XML.
   *
   * @param formatXML - Whether to return responses in XML format
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * aspirin.setFormatXML(true);
   * const names = await aspirin.getNames();
   * // Returns: XML response
   * ```
   */
  public setFormatXML(formatXML: boolean): void {
    this.formatXML = formatXML;
  }

  /**
   * Clears the instance cache.
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * await aspirin.getNames(); // This will be cached
   * aspirin.clearCache(); // Clear the cache
   * await aspirin.getNames(); // This will make a new request
   * ```
   */
  public clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Clears the global cache shared across all Cactus instances.
   *
   * @example
   * ```typescript
   * const aspirin1 = new Cactus("aspirin");
   * const aspirin2 = new Cactus("aspirin");
   * await aspirin1.getNames(); // Cached globally
   * await aspirin2.getNames(); // Uses cached result
   * Cactus.clearGlobalCache(); // Clear global cache
   * await aspirin2.getNames(); // Makes new request
   * ```
   */
  public static clearGlobalCache(): void {
    Cactus.globalCache.clear();
  }

  /**
   * Gets cache statistics for debugging purposes.
   *
   * @returns Object containing cache statistics
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * await aspirin.getNames();
   * const stats = aspirin.getCacheStats();
   * console.log(stats); // { size: 1 }
   * ```
   */
  public getCacheStats(): { size: number } {
    if (!this.cache) {
      return {
        size: 0,
      };
    }

    return {
      size: this.cache.size,
    };
  }

  /**
   * Queries the specified endpoint and returns the response text.
   * Uses caching to avoid duplicate requests for the same URL.
   *
   * @param endpoint - The endpoint to query
   * @returns Promise resolving to the response text or undefined if the request fails
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const names = await aspirin.queryEndpoint("names");
   * // Returns: "2-acetyloxybenzoic acid\n2-Acetoxybenzoic acid\n50-78-2\n11126-35-5\n11126-37-7\n..."
   * aspirin.setFormatXML(true);
   * const names = await aspirin.queryEndpoint("names");
   * // Returns:
   * <request string="aspirin" representation="names">
   *  <data id="1" resolver="name_by_cir" string_class="chemical name (CIR)" notation="Aspirin">
   *    <item id="1" classification="pubchem_iupac_name">2-acetyloxybenzoic acid</item>
   *    <item id="2" classification="pubchem_iupac_openeye_name">2-Acetoxybenzoic acid</item>
   *    <item id="3" classification="pubchem_generic_registry_name">50-78-2</item>
   *    <item id="7" classification="pubchem_generic_registry_name">26914-13-6</item>
   *    <item id="8" classification="pubchem_generic_registry_name">98201-60-6</item>
   *    <item id="9" classification="pubchem_substance_synonym">NCGC00090977-04</item>
   *    <item id="10" classification="pubchem_substance_synonym">KBioSS_002272</item>
   *    <item id="11" classification="pubchem_substance_synonym">SBB015069</item>
   *     ...
   *  </data>
   * </request>
   * ```
   */
  private async queryEndpoint(endpoint: CactusEndpoint): Promise<string | Blob> {
    let url = `${this.baseUrl}/${this.name}/${endpoint}`;
    if (this.formatXML) url += `/xml`;

    // Check cache first
    if (this.cacheEnabled) {
      const cachedResult = this.cache?.get(url) ?? Cactus.globalCache.get(url);
      if (cachedResult !== undefined) {
        return cachedResult;
      }
    }

    const response = await fetch(url);

    const resp = response.clone();
    const headers = resp.headers;
    const contentType = headers.get("content-type") || "text/plain";

    if (response.status !== 200) return "";

    let result: string | Blob | undefined;

    if (contentType.startsWith("image/")) {
      result = await response.blob();
    } else if (contentType.startsWith("text/plain") || contentType.startsWith("text/xml")) {
      result = await response.text();
    }

    // Cache the result
    if (this.cacheEnabled && result !== undefined) {
      this.cache?.set(url, result as string);
      Cactus.globalCache.set(url, result as string);
    }

    return result ?? "";
  }

  /**
   * Retrieves all known names for the chemical.
   *
   * @returns Promise resolving to an array of chemical names
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const names = await aspirin.getNames();
   * // Returns: [
   * //   '2-acetyloxybenzoic acid',
   * //   '2-Acetoxybenzoic acid',
   * //   '50-78-2',
   * //   '11126-35-5',
   * //   '11126-37-7',
   * //   ...
   * // ]
   * ```
   */
  async getNames(): Promise<string[] | undefined> {
    const result = await this.queryEndpoint("names");
    assertIsStringResponse(result);
    const results = result.split("\n").filter((name) => !!name);
    if (results.length === 0) {
      return undefined;
    }
    return results;
  }

  /**
   * Filters the names from output of this.getNames() to those that are most likely to
   * be used in common chemical nomenclature. This is done by just filtering for names
   * that contain alpha characters only and spaces (no dashes, brackets, paretheses, etc.)
   *
   * @param limit - The maximum number of names to return (default: 4)
   * @returns Promise resolving to an array of chemical names
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("2-Acetoxybenzenecarboxylic acid");
   * const simpleNames = await aspirin.getSimpleNames();
   * // Returns: ["aspirin", "acetylsalicylic acid", "Acetylin", "Acetylsal"]
   * ```
   */
  async getSimpleNames(limit: number = 4): Promise<string[] | undefined> {
    const names = await this.getNames();
    if (!names || names.length === 0) {
      return undefined;
    }
    const simpleNames = names.filter((name) => /^([a-zA-Z\s]*)$/.test(name));
    return simpleNames.length > 0 ? simpleNames.slice(0, limit) : undefined;
  }

  /**
   * Retrieves the SMILES notation for the chemical.
   *
   * @returns Promise resolving to the SMILES string
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const smiles = await aspirin.getSmiles();
   * // Returns: "CC(=O)Oc1ccccc1C(O)=O"
   * ```
   */
  async getSmiles(): Promise<string> {
    const result = await this.queryEndpoint("smiles");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the InChI identifier for the chemical.
   *
   * @returns Promise resolving to the InChI string
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const inchi = await aspirin.getInchi();
   * // Returns: "InChI=1/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)/f/h11H"
   * ```
   */
  async getInchi(): Promise<string> {
    const result = await this.queryEndpoint("inchi");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the InChI Key for the chemical.
   *
   * @returns Promise resolving to the InChI Key string
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const inchiKey = await aspirin.getInchiKey();
   * // Returns: "BSYNRYMUTXBXSQ-UHFFFAOYSA-N"
   * ```
   */
  async getInchiKey(): Promise<string> {
    const result = await this.queryEndpoint("inchikey");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the FICTS identifier for the chemical.
   *
   * @returns Promise resolving to the FICTS string
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const ficts = await aspirin.getFicts();
   * // Returns: "FICTS identifier string"
   * ```
   */
  async getFicts(): Promise<string> {
    const result = await this.queryEndpoint("ficts");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the FICUS identifier for the chemical.
   *
   * @returns Promise resolving to the FICUS string
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const ficus = await aspirin.getFicus();
   * // Returns: "FICUS identifier string"
   * ```
   */
  async getFicus(): Promise<string> {
    const result = await this.queryEndpoint("ficus");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the UUUUU identifier for the chemical.
   *
   * This "uuuuu identifier" is a hashcode representation of a chemical structure that considers the basic molecular
   * connectivity, disregarding features like counterions or stereochemistry.
   *
   * @returns Promise resolving to the UUUUU string
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const uuuuu = await aspirin.getUuuuu();
   * // Returns: "UUUUU identifier string"
   * ```
   */
  async getUuuuu(): Promise<string> {
    const result = await this.queryEndpoint("uuuuu");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the HASHISY identifier for the chemical.
   *
   * This "hashisy identifier" is a hashcode representation of a chemical structure that considers the basic molecular
   * connectivity, disregarding features like counterions or stereochemistry.
   *
   * @returns Promise resolving to the HASHISY string
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const hashisy = await aspirin.getHASHISY();
   * // Returns: "Cactvs HASHISY identifier string"
   * ```
   */
  async getHASHISY(): Promise<string> {
    const result = await this.queryEndpoint("hashisy");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves a chemical structure file in the specified format.
   *
   * @param format - The file format (e.g., "sdf", "jme", "mol", "pdb")
   * @param removeHydrogens - Whether to remove hydrogen atoms from the structure
   * @returns Promise resolving to the file content as a string
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const sdfFile = await aspirin.getFile("sdf");
   * const molFile = await aspirin.getFile("mol", true); // Remove hydrogens
   * ```
   */
  async getFile(format: string, removeHydrogens: boolean = false): Promise<string> {
    let url = `${this.baseUrl}/${this.name}/file?format=${format}`;

    if (removeHydrogens) {
      url += `&operator=remove_hydrogens`;
    }

    // Check cache first
    if (this.cacheEnabled) {
      const cachedResult = this.cache?.get(url) ?? Cactus.globalCache.get(url);
      if (cachedResult !== undefined) {
        return cachedResult;
      }
    }

    const response = await fetch(url);

    if (response.status !== 200) return "";

    const result = await response.text();

    // Cache the result
    if (this.cacheEnabled && result !== undefined) {
      this.cache?.set(url, result);
      Cactus.globalCache.set(url, result);
    }

    return result;
  }

  /**
   * Retrieves the chemical structure in SDF (Structure Data File) format.
   *
   * @returns Promise resolving to the SDF file content
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const sdf = await aspirin.getFileSDF();
   * // Returns SDF format structure data
   * ```
   */
  async getFileSDF(): Promise<string> {
    return this.getFile("sdf");
  }

  /**
   * Retrieves the chemical structure in JME (Java Molecular Editor) format.
   *
   * @returns Promise resolving to the JME format string
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const jme = await aspirin.getFileJME();
   * // Returns JME format structure data
   * ```
   */
  async getFileJME(): Promise<string> {
    return this.getFile("jme");
  }

  /**
   * Retrieves the IUPAC name for the chemical.
   *
   * @returns Promise resolving to the IUPAC name
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const iupacName = await aspirin.getIUPACName();
   * // Returns: "2-acetyloxybenzoic acid"
   * ```
   */
  async getIUPACName(): Promise<string | undefined> {
    const result = await this.queryEndpoint("iupac_name");
    assertIsStringResponse(result);
    return result === "" ? undefined : result;
  }

  /**
   * Retrieves the CAS registry number for the chemical.
   *
   * @returns Promise resolving to the CAS number
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const cas = await aspirin.getCAS();
   * // Returns: [
   * //   '50-78-2',
   * //   '11126-35-5',
   * //   '11126-37-7',
   * //   '2349-94-2',
   * //   '26914-13-6',
   * //   '98201-60-6'
   * // ]
   * ```
   */
  async getCAS(): Promise<string[]> {
    const result = await this.queryEndpoint("cas");
    assertIsStringResponse(result);
    return result.split("\n");
  }

  /**
   * Retrieves the ChemSpider ID for the chemical.
   *
   * @returns Promise resolving to the ChemSpider ID
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const chemspiderId = await aspirin.getChemspiderID();
   * // Returns: "2157"
   * ```
   */
  async getChemspiderID(): Promise<string> {
    const result = await this.queryEndpoint("chemspider_id");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the standardized InChI Key for the chemical.
   *
   * @returns Promise resolving to the standardized InChI Key
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const stdInchiKey = await aspirin.getStdinchiKey();
   * // Returns: "BSYNRYMUTXBXSQ-UHFFFAOYSA-N"
   * ```
   */
  async getStdinchiKey(): Promise<string> {
    const result = await this.queryEndpoint("stdinchikey");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the standardized InChI for the chemical.
   *
   * @returns Promise resolving to the standardized InChI
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const stdInchi = await aspirin.getStdinchi();
   * // Returns: "InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)"
   * ```
   */
  async getStdinchi(): Promise<string> {
    const result = await this.queryEndpoint("stdinchi");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves a chemical structure image.
   *
   * @returns Promise resolving to the image data
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const image = await aspirin.getImage();
   * // Returns image data (typically PNG format)
   * ```
   */
  async getImage(): Promise<Blob | undefined> {
    const result = await this.queryEndpoint("image");
    if (result && typeof result === "object" && result instanceof Blob) {
      return result;
    }
    return undefined;
  }

  /**
   * Retrieves the TWIRL identifier for the chemical.
   *
   * @returns Promise resolving to the TWIRL string
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const twirl = await aspirin.getTwirl();
   * // Returns the embedable HTML for a TwirlyMol (3D) model of the chemical
   * ```
   */
  async getTwirl(): Promise<string> {
    const result = await this.queryEndpoint("twirl");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the molecular weight of the chemical.
   *
   * @returns Promise resolving to the molecular weight as a string
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const mw = await aspirin.getMW();
   * // Returns: "180.1598"
   * ```
   */
  async getMW(): Promise<string> {
    const result = await this.queryEndpoint("mw");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the molecular formula of the chemical.
   *
   * @returns Promise resolving to the molecular formula
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const formula = await aspirin.getFormula();
   * // Returns: "C9H8O4"
   * ```
   */
  async getFormula(): Promise<string> {
    const result = await this.queryEndpoint("formula");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the number of hydrogen bond donors in the chemical.
   *
   * @returns Promise resolving to the hydrogen bond donor count
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const hbondDonors = await aspirin.getHbondDonorCount();
   * // Returns: "1"
   * ```
   */
  async getHbondDonorCount(): Promise<string> {
    const result = await this.queryEndpoint("h_bond_donor_count");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the number of hydrogen bond acceptors in the chemical.
   *
   * @returns Promise resolving to the hydrogen bond acceptor count
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const hbondAcceptors = await aspirin.getHbondAcceptorCount();
   * // Returns: "4"
   * ```
   */
  async getHbondAcceptorCount(): Promise<string> {
    const result = await this.queryEndpoint("h_bond_acceptor_count");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the number of hydrogen bond centers in the chemical.
   *
   * @returns Promise resolving to the hydrogen bond center count
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const hbondCenters = await aspirin.getHbondCenterCount();
   * // Returns: "4"
   * ```
   */
  async getHbondCenterCount(): Promise<string> {
    const result = await this.queryEndpoint("h_bond_center_count");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the number of Lipinski's Rule of Five violations.
   *
   * @returns Promise resolving to the Rule of Five violation count
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const ruleOf5Violations = await aspirin.getRuleOf5ViolationCount();
   * // Returns: "0" (aspirin follows all rules)
   * ```
   */
  async getRuleOf5ViolationCount(): Promise<string> {
    const result = await this.queryEndpoint("rule_of_5_violation_count");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the number of rotatable bonds in the chemical.
   *
   * @returns Promise resolving to the rotatable bond count
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const rotors = await aspirin.getRotorCount();
   * // Returns: "3"
   * ```
   */
  async getRotorCount(): Promise<string> {
    const result = await this.queryEndpoint("rotor_count");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the effective number of rotatable bonds in the chemical.
   *
   * @returns Promise resolving to the effective rotatable bond count
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const effectiveRotors = await aspirin.getEffectiveRotorCount();
   * // Returns: "3.0"
   * ```
   */
  async getEffectiveRotorCount(): Promise<string> {
    const result = await this.queryEndpoint("effective_rotor_count");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the number of rings in the chemical structure.
   *
   * @returns Promise resolving to the ring count
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const rings = await aspirin.getRingCount();
   * // Returns: "1" (benzene ring)
   * ```
   */
  async getRingCount(): Promise<string> {
    const result = await this.queryEndpoint("ring_count");
    assertIsStringResponse(result);
    return result;
  }

  /**
   * Retrieves the number of ring systems in the chemical structure.
   *
   * @returns Promise resolving to the ring system count
   *
   * @example
   * ```typescript
   * const aspirin = new Cactus("aspirin");
   * const ringSystems = await aspirin.getRingsysCount();
   * // Returns: "1" (single ring system)
   * ```
   */
  async getRingsysCount(): Promise<string> {
    const result = await this.queryEndpoint("ringsys_count");
    assertIsStringResponse(result);
    return result;
  }
}
