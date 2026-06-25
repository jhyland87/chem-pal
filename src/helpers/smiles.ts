import { isCAS } from "@/helpers/cas";
import { executeSDQSearch } from "@/helpers/pubchem";
import { Cactus } from "@/utils/Cactus";

/**
 * @group Helpers
 * @groupDescription SMILES structure detection and resolution utilities. These turn a SMILES
 * (or `smiles:`/`inchikey:` prefixed) query into a searchable chemical name/CAS by resolving it
 * through the NCI Cactus service, with a PubChem SDQ fallback. SMILES notation is not canonical
 * (ethanol can be written `CCO`, `OCC`, or `C(C)O`), so it cannot be matched directly — it must
 * be resolved to a stable identifier first.
 * @source
 */

/** Characters that strongly signal a token is SMILES rather than a name (bonds, branches, brackets). */
const STRONG_SMILES_CHARS = /[=#[\]()@.+\\/]/;

/** A ring-closure digit (a digit immediately following an atom letter), e.g. the `1`s in `c1ccccc1`. */
const RING_CLOSURE = /[A-Za-z]\d/;

/** A token composed entirely of SMILES organic-subset atoms (e.g. `CCO`, `ClCCl`, `c1` aromatics). */
const PURE_ORGANIC_ATOMS = /^(Cl|Br|B|C|N|O|P|S|F|I|b|c|n|o|p|s)+$/;

/** Legal SMILES characters — used for a cheap structural sanity check (not a full parser). */
const SMILES_CHAR_SET = /^[A-Za-z0-9@+\-[\]()=#$:/\\.%*]+$/;

/** Upper bound on SMILES length we attempt to resolve, to avoid pathological URLs/inputs. */
const MAX_SMILES_LENGTH = 500;

/**
 * The result of resolving a structure (SMILES or InChIKey) to searchable identifiers.
 * @source
 */
export interface ResolvedStructure {
  /** Best human-readable name to feed the supplier search, if one was found. */
  name?: string;
  /** Valid CAS number(s) resolved from the structure, shortest/best first. */
  cas?: string[];
  /** Canonical standard InChIKey — the structure fingerprint, useful for later verification. */
  inchikey?: string;
  /** Which resolver produced the usable identifier. */
  source?: "cactus-name" | "cactus-cas" | "pubchem-inchikey";
}

/** The mode parsed from an optional query prefix. */
type StructureMode = "smiles" | "inchikey" | "auto";

/**
 * Strips an explicit `smiles:` or `inchikey:` prefix from a query, letting the user force
 * structure resolution for otherwise-ambiguous input (e.g. `smiles:CO` instead of carbon monoxide).
 * @category Helpers
 * @param query - The raw search query, possibly prefixed
 * @returns The detected mode and the bare value with the prefix removed
 * @example
 * ```typescript
 * parseStructurePrefix("smiles:CCO") // { mode: "smiles", value: "CCO" }
 * parseStructurePrefix("inchikey:LFQSCWFLJHTTHZ-UHFFFAOYSA-N")
 * //                    => { mode: "inchikey", value: "LFQSCWFLJHTTHZ-UHFFFAOYSA-N" }
 * parseStructurePrefix("ethanol") // { mode: "auto", value: "ethanol" }
 * ```
 * @source
 */
export function parseStructurePrefix(query: string): { mode: StructureMode; value: string } {
  const match = /^(smiles|inchikey)\s*:\s*(.+)$/i.exec(query.trim());
  if (match) {
    return { mode: match[1].toLowerCase() as "smiles" | "inchikey", value: match[2].trim() };
  }
  return { mode: "auto", value: query.trim() };
}

/**
 * Lightweight validity check for a SMILES string — verifies the characters are legal and that
 * parentheses/brackets are balanced. This is a cheap guard before a network call, not a real
 * SMILES parser; chemically-invalid but syntactically-plausible strings still pass.
 * @category Helpers
 * @param smiles - The candidate SMILES string
 * @returns True if the string is plausibly a SMILES, false otherwise
 * @example
 * ```typescript
 * isProbablyValidSmiles("CC(=O)O") // true
 * isProbablyValidSmiles("CC(=O")   // false (unbalanced parenthesis)
 * isProbablyValidSmiles("hello!")  // false (illegal character)
 * ```
 * @source
 */
export function isProbablyValidSmiles(smiles: string): boolean {
  const value = smiles.trim();
  if (!value || value.length > MAX_SMILES_LENGTH) return false;
  if (!SMILES_CHAR_SET.test(value)) return false;

  let parens = 0;
  let brackets = 0;
  for (const char of value) {
    if (char === "(") parens++;
    else if (char === ")") parens--;
    else if (char === "[") brackets++;
    else if (char === "]") brackets--;
    if (parens < 0 || brackets < 0) return false;
  }
  return parens === 0 && brackets === 0;
}

/**
 * Heuristically decides whether a raw query looks like a SMILES structure rather than a chemical
 * name or CAS number. Deliberately conservative: it only flags strong structural signals (bond/
 * branch/bracket characters, ring-closure digits) or pure organic-atom tokens of 3+ characters, so
 * ambiguous short tokens like `CO` and ordinary names stay on the normal name-search path.
 * @category Helpers
 * @param query - The raw search query
 * @returns True if the query should be treated as SMILES
 * @example
 * ```typescript
 * looksLikeSmiles("CCO")       // true  (pure organic atoms, 3+ chars)
 * looksLikeSmiles("CC(=O)O")   // true  (branch + double bond)
 * looksLikeSmiles("c1ccccc1")  // true  (ring-closure digits)
 * looksLikeSmiles("CO")        // false (ambiguous: could be carbon monoxide)
 * looksLikeSmiles("ethanol")   // false (name)
 * looksLikeSmiles("64-17-5")   // false (CAS)
 * ```
 * @source
 */
export function looksLikeSmiles(query: string): boolean {
  const value = query.trim();
  if (!value || /\s/.test(value)) return false;
  if (isCAS(value)) return false;
  if (!isProbablyValidSmiles(value)) return false;
  if (STRONG_SMILES_CHARS.test(value) || RING_CLOSURE.test(value)) return true;
  return PURE_ORGANIC_ATOMS.test(value) && value.length >= 3;
}

/**
 * Looks up a compound name from an InChIKey via the PubChem SDQ agent.
 * @param inchikey - The InChIKey to resolve
 * @returns The PubChem compound name, or undefined if not found
 * @source
 */
async function nameFromInchikey(inchikey: string): Promise<string | undefined> {
  const rows = await executeSDQSearch({
    where: { inchikey },
    select: ["cmpdname"],
    limit: 1,
  });
  return rows?.[0]?.cmpdname || undefined;
}

/**
 * Normalizes a raw Cactus InChIKey response, stripping any `InChIKey=` prefix and whitespace.
 * @param raw - The raw InChIKey string from Cactus (may be empty or prefixed)
 * @returns The bare InChIKey, or undefined if empty
 * @source
 */
function normalizeInchikey(raw: string | undefined): string | undefined {
  const value = raw?.replace(/^InChIKey=/i, "").trim();
  return value || undefined;
}

/**
 * Resolves a SMILES string to searchable identifiers (name, CAS, InChIKey) by querying NCI Cactus
 * (which canonicalizes the structure server-side), falling back to a PubChem SDQ InChIKey lookup
 * when Cactus yields no usable name or CAS. Returns undefined when no resolver recognizes the
 * structure or the input is not a plausible SMILES.
 * @category Helpers
 * @param smiles - The SMILES string to resolve
 * @returns The resolved identifiers, or undefined if nothing resolved
 * @example
 * ```typescript
 * await resolveSmiles("CCO")
 * // { name: "ethanol", cas: ["64-17-5"], inchikey: "LFQSCWFLJHTTHZ-UHFFFAOYSA-N", source: "cactus-name" }
 * await resolveSmiles("not a structure") // undefined
 * ```
 * @source
 */
export async function resolveSmiles(smiles: string): Promise<ResolvedStructure | undefined> {
  const value = smiles.trim();
  if (!isProbablyValidSmiles(value)) return undefined;

  try {
    const cactus = new Cactus(value);
    const [simpleNames, rawCas, rawInchikey] = await Promise.all([
      cactus.getSimpleNames(),
      cactus.getCAS().catch(() => undefined),
      cactus.getStdinchiKey().catch(() => undefined),
    ]);

    const name = simpleNames?.[0];
    const cas = (rawCas ?? []).map((entry) => entry.trim()).filter((entry) => isCAS(entry));
    const inchikey = normalizeInchikey(rawInchikey);

    if (name) {
      return { name, cas: cas.length > 0 ? cas : undefined, inchikey, source: "cactus-name" };
    }
    if (cas.length > 0) {
      return { cas, inchikey, source: "cactus-cas" };
    }
    if (inchikey) {
      const pubchemName = await nameFromInchikey(inchikey);
      if (pubchemName) {
        return { name: pubchemName, inchikey, source: "pubchem-inchikey" };
      }
    }
    return undefined;
  } catch (error) {
    console.error("Error resolving SMILES:", error);
    return undefined;
  }
}

/**
 * Top-level entry that turns any search query into a term the existing supplier search can consume.
 * If the query is a structure (via `smiles:`/`inchikey:` prefix or the {@link looksLikeSmiles}
 * heuristic) it is resolved to the best searchable identifier (name preferred, CAS fallback) and
 * returned alongside the resolved structure metadata. Non-structure queries pass through unchanged.
 * Built for the future search wiring; currently invoked manually for testing.
 * @category Helpers
 * @param query - The raw search query
 * @returns `searchTerm` (always safe to pass to the supplier search) and optional `structure`
 * @example
 * ```typescript
 * await resolveQueryForSearch("CCO")
 * // { searchTerm: "ethanol", structure: { name: "ethanol", cas: ["64-17-5"], ... } }
 * await resolveQueryForSearch("sulfuric acid") // { searchTerm: "sulfuric acid" }
 * ```
 * @source
 */
export async function resolveQueryForSearch(
  query: string,
): Promise<{ searchTerm: string; structure?: ResolvedStructure }> {
  const { mode, value } = parseStructurePrefix(query);

  if (mode === "inchikey") {
    const name = await nameFromInchikey(value);
    return name
      ? { searchTerm: name, structure: { name, inchikey: value, source: "pubchem-inchikey" } }
      : { searchTerm: value };
  }

  const treatAsSmiles = mode === "smiles" || (mode === "auto" && looksLikeSmiles(value));
  if (!treatAsSmiles) {
    return { searchTerm: value };
  }

  const structure = await resolveSmiles(value);
  if (!structure) {
    return { searchTerm: value };
  }
  return { searchTerm: structure.name ?? structure.cas?.[0] ?? value, structure };
}
