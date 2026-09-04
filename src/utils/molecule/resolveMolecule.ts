/**
 * Resolves a free-text search query to a renderable molecular structure, by way of a
 * PubChem CID.
 * @module
 * @categoryDescription Utils
 * @showCategories
 */

import {
  getCidByFormula,
  getCidByName,
  getCidBySmiles,
  getCidsByCas,
  getStructureSdf,
  type StructureRecordType,
} from '@/helpers/pubchem';
import { detectTermType } from '@/utils/search-query/detectTermType';
import { extractAllPositiveTerms } from '@/utils/search-query/extractPositiveTerms';
import { parseSearchQuery } from '@/utils/search-query/parseSearchQuery';
import { parseSdf, type Molecule } from '@/utils/molecule/sdf';
import { isCAS } from '@/utils/typeGuards/common';

/**
 * A structure resolved from a search query, ready to hand to a renderer.
 * @category Utils
 * @group Types
 * @source
 */
export interface ResolvedMolecule {
  /** The PubChem CID the query resolved to. */
  cid: PubChemCID;
  /** The parsed atoms and bonds. */
  molecule: Molecule;
  /** Whether PubChem served a real 3D conformer or fell back to the flat 2D layout. */
  recordType: StructureRecordType;
}

/**
 * How many terms of an advanced query to try before giving up. Caps the request burst so
 * a wide `OR` query stays well inside PubChem's five-per-second guidance.
 * @source
 */
const MAX_CANDIDATE_TERMS = 3;

/**
 * Picks the terms worth looking up for a query.
 *
 * A plain query is used as typed. An advanced one (`acetone AND NOT sigma`) would never
 * match as a whole, so its positive terms are tried in order instead — negated terms are
 * excluded by {@link extractAllPositiveTerms}, so `NOT acetone` never draws acetone.
 * @param query - The raw search query
 * @returns Terms to try against PubChem, best first
 * @source
 */
function candidateTerms(query: string): string[] {
  const raw = query.trim();
  if (raw === '') return [];

  const parsed = parseSearchQuery(query);
  if (!parsed.isAdvanced) return [raw];

  return extractAllPositiveTerms(parsed.ast)
    .map((term) => term.trim())
    .filter((term) => term !== '')
    .slice(0, MAX_CANDIDATE_TERMS);
}

/**
 * Resolves a single search term to a PubChem CID, routing on what the term looks like.
 *
 * A CAS number is tried against the registry-number cross-reference first and falls back
 * to the plain name endpoint, since PubChem also indexes CAS numbers as synonyms and the
 * xref table misses some compounds.
 * @param term - A single search term, already trimmed
 * @returns The best-matching CID, or undefined if nothing matched
 * @source
 */
async function resolveCid(term: string): Promise<PubChemCID | undefined> {
  const termType = detectTermType(term);

  if (termType === 'cas' && isCAS(term)) {
    const cids = await getCidsByCas(term);
    return cids?.[0] ?? (await getCidByName(term));
  }
  if (termType === 'smiles') {
    return await getCidBySmiles(term);
  }
  if (termType === 'formula') {
    return await getCidByFormula(term);
  }
  return await getCidByName(term);
}

/**
 * Resolves a search query — a CAS number, chemical name, SMILES string or molecular
 * formula — to a parsed molecular structure fetched from PubChem.
 *
 * Every failure mode (no CID, no structure record, unparseable SDF) resolves to undefined
 * rather than throwing, so a caller can fall back to a generic loading animation.
 * @category Utils
 * @group Search
 * @param query - The raw search query
 * @returns The resolved structure, or undefined if the query names nothing renderable
 * @example
 * ```typescript
 * await resolveMolecule('aspirin');
 * // { cid: 2244, molecule: { atoms: […], bonds: […], isPlanar: false }, recordType: '3d' }
 * await resolveMolecule('sodium chloride');
 * // { cid: 5234, molecule: {…, isPlanar: true }, recordType: '2d' }
 * await resolveMolecule('acetone AND NOT sigma'); // resolves the acetone term
 * await resolveMolecule('qqqq'); // undefined
 * ```
 * @source
 */
export async function resolveMolecule(query: string): Promise<ResolvedMolecule | undefined> {
  for (const term of candidateTerms(query)) {
    const cid = await resolveCid(term);
    if (cid === undefined) continue;

    const record = await getStructureSdf(cid);
    if (record === undefined) continue;

    const molecule = parseSdf(record.sdf);
    if (molecule === undefined) continue;

    return { cid, molecule, recordType: record.recordType };
  }
  return undefined;
}
