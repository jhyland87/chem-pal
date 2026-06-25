import { isCAS } from "@/helpers/cas";
import { isSimpleName } from "@/helpers/pubchem";

/**
 * Shared sample compounds for exercising the name / CAS / SMILES resolvers in tests (and handy
 * from the debug console). Each fixture mirrors what the upstream services actually return —
 * `rankedAliases` keeps PubChem's original casing and popularity order, and includes the CAS
 * inline, just like the real `/synonyms` response.
 */

/** A sample compound with the identifiers used across the resolver tests. */
export interface ChemicalFixture {
  /** The common name PubChem ranks first. */
  name: string;
  /** Other names in PubChem popularity order (original casing, CAS inline). */
  rankedAliases: Set<string>;
  /** The primary CAS number. */
  cas: string;
  /** A canonical SMILES for the compound. */
  smiles: string;
  /** The standard InChIKey, when needed for structure-resolution tests. */
  inchikey?: string;
  /** The full popularity-ranked synonym list, exactly as PubChem's `/synonyms` endpoint returns it. */
  rankedSynonyms(): string[];
  /** The least common name in the ranked aliases (last in popularity order). */
  leastCommonName(): string;
  /** Aliases too technical to ever suggest — they fail {@link isSimpleName} and are not a CAS. */
  complicatedNames(): string[];
  /** Returns the common name, so a fixture interpolates nicely in template strings. */
  toString(): string;
}

/** Shape accepted by {@link chemical}; `rankedAliases` is a plain array for convenience. */
interface ChemicalFixtureInput {
  name: string;
  rankedAliases: string[];
  cas: string;
  smiles: string;
  inchikey?: string;
}

/**
 * Builds a {@link ChemicalFixture} from plain data, wrapping the aliases in a `Set` and attaching
 * the accessor helpers.
 * @param data - The compound's name, ranked aliases, CAS, SMILES, and optional InChIKey
 * @returns The fixture object
 * @example
 * ```typescript
 * const water = chemical({ name: "water", rankedAliases: ["7732-18-5"], cas: "7732-18-5", smiles: "O" });
 * `${water}`.toUpperCase(); // "WATER"
 * ```
 * @source
 */
function chemical(data: ChemicalFixtureInput): ChemicalFixture {
  return {
    name: data.name,
    rankedAliases: new Set(data.rankedAliases),
    cas: data.cas,
    smiles: data.smiles,
    inchikey: data.inchikey,
    rankedSynonyms() {
      return [this.name, ...this.rankedAliases];
    },
    leastCommonName() {
      return [...this.rankedAliases].at(-1) ?? this.name;
    },
    complicatedNames() {
      return [...this.rankedAliases].filter((alias) => !isCAS(alias) && !isSimpleName(alias));
    },
    toString() {
      return this.name;
    },
  };
}

export const ASPIRIN = chemical({
  name: "aspirin",
  rankedAliases: [
    "ACETYLSALICYLIC ACID",
    "50-78-2",
    "2-Acetoxybenzoic acid",
    "2-(Acetyloxy)benzoic acid",
    "o-acetylsalicylic acid",
    "Ecotrin",
  ],
  cas: "50-78-2",
  smiles: "CC(=O)Oc1ccccc1C(O)=O",
  inchikey: "BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
});

export const ACETONE = chemical({
  name: "acetone",
  rankedAliases: [
    "2-propanone",
    "67-64-1",
    "propanone",
    "propan-2-one",
    "Dimethyl ketone",
    "Pyroacetic ether",
  ],
  cas: "67-64-1",
  smiles: "CC(=O)C",
  inchikey: "CSCPPACGZOOCGX-UHFFFAOYSA-N",
});

export const ETHANOL = chemical({
  name: "ethanol",
  rankedAliases: [
    "ethyl alcohol",
    "64-17-5",
    "alcohol",
    "Ethanol 200 proof",
    "ethyl hydroxide",
    "methylcarbinol",
  ],
  cas: "64-17-5",
  smiles: "CCO",
  inchikey: "LFQSCWFLJHTTHZ-UHFFFAOYSA-N",
});
