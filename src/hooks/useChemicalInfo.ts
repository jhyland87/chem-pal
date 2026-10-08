import { NIST_STRUCTURE_URL } from '@/constants/hazards';
import { lookupOshaChemical, type OshaChemical } from '@/helpers/oshaChemicalDb';
import {
  getCidByName,
  getCidsByCas,
  getCompoundDescription,
  getCompoundProperties,
  getGhsClassification,
  getSolubility,
  getSynonymsByCid,
  pubchemCompoundUrl,
  pubchemStructureImageUrl,
  type PubChemDescription,
  type PubChemGhs,
  type PubChemProperties,
} from '@/helpers/pubchem';
import { resolveEnglishChemical } from '@/helpers/wikidata';
import { isCAS } from '@/utils/typeGuards/common';
import { useEffect, useState } from 'react';

/**
 * Everything known about one searched chemical, merged from OSHA OBIS and PubChem. Each source
 * is optional; a lookup that fails simply leaves its fields undefined.
 * @category Hooks
 * @group Chemical Info
 */
export interface ChemicalInfo {
  /** The term that was looked up. */
  term: string;
  /** OSHA OBIS record, when the chemical is in that dataset. */
  osha?: OshaChemical;
  /** PubChem compound id, when resolved. */
  cid?: PubChemCID;
  /** PubChem compound page. */
  pubchemUrl?: string;
  /** Wikipedia article (or search) for the chemical. */
  wikipediaUrl: string;
  /** NIST WebBook page, when a CAS number is known. */
  nistUrl?: string;
  properties?: PubChemProperties;
  synonyms: string[];
  description?: PubChemDescription;
  ghs?: PubChemGhs;
  solubility?: string[];
  /** CAS number, from the query, OBIS, or PubChem synonyms. */
  cas?: string;
  /** Structure image URLs to try in order (NIST, then PubChem). */
  imageUrls: string[];
}

/**
 * Builds a Wikipedia search URL for a chemical name. Wikipedia jumps straight to the article on
 * an exact title or redirect match, and otherwise shows search results.
 * @category Hooks
 * @group Chemical Info
 * @param name - A chemical name.
 * @returns The Wikipedia URL.
 * @example
 * ```ts
 * wikipediaUrl('sodium hydroxide');
 * // "https://en.wikipedia.org/wiki/Special:Search?search=sodium%20hydroxide"
 * ```
 * @source
 */
export function wikipediaUrl(name: string): string {
  return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(name)}`;
}

/**
 * Builds the NIST WebBook compound-page URL for a CAS number.
 * @category Hooks
 * @group Chemical Info
 * @param cas - A CAS registry number such as `67-64-1`.
 * @returns The WebBook page URL.
 * @example
 * ```ts
 * nistWebbookUrl('67-64-1');
 * // "https://webbook.nist.gov/cgi/cbook.cgi?ID=C67641"
 * ```
 * @source
 */
export function nistWebbookUrl(cas: string): string {
  return `https://webbook.nist.gov/cgi/cbook.cgi?ID=C${cas.replace(/-/g, '')}`;
}

/**
 * Builds the NIST WebBook structure-image URL for a CAS number.
 * @category Hooks
 * @group Chemical Info
 * @param cas - A CAS registry number such as `12024-21-4`.
 * @returns The image URL (CAS hyphens removed, per NIST's `C<digits>` id format).
 * @example
 * ```ts
 * nistStructureImageUrl('12024-21-4');
 * // "https://webbook.nist.gov/cgi/cbook.cgi?Struct=C12024214&Type=Color"
 * ```
 * @source
 */
export function nistStructureImageUrl(cas: string): string {
  return `${NIST_STRUCTURE_URL}?Struct=C${cas.replace(/-/g, '')}&Type=Color`;
}

/**
 * Resolves a PubChem CID from a CAS number or name, falling back to the OBIS CAS.
 * @param term - The searched term.
 * @param osha - The OBIS record, if any.
 * @returns The CID, or undefined.
 * @source
 */
async function resolveCid(term: string, osha?: OshaChemical): Promise<PubChemCID | undefined> {
  if (isCAS(term)) return (await getCidsByCas(term))?.[0];
  const byName = await getCidByName(term);
  if (byName !== undefined || osha?.cas === undefined || !isCAS(osha.cas)) return byName;
  return (await getCidsByCas(osha.cas))?.[0];
}

/**
 * Gathers and merges chemical data for a term from OSHA OBIS and PubChem. A non-English name is
 * first resolved to its English name and CAS number through Wikidata.
 * @param term - A chemical name or CAS number.
 * @returns The merged info; always resolves.
 * @source
 */
async function fetchChemicalInfo(term: string): Promise<ChemicalInfo> {
  // A name in another language (e.g. Dutch "zoutzuur") matches nothing in OBIS or PubChem, so
  // look the term up by its CAS number (or English name) instead; the dialog still shows `term`.
  const english = isCAS(term) ? undefined : await resolveEnglishChemical(term);
  const lookupTerm = english?.cas ?? english?.name ?? term;

  const osha = await lookupOshaChemical(lookupTerm);
  const cid = await resolveCid(lookupTerm, osha);

  const [properties, synonyms, description, ghs, solubility] =
    cid === undefined
      ? [undefined, undefined, undefined, undefined, undefined]
      : await Promise.all([
          getCompoundProperties(cid),
          getSynonymsByCid(cid),
          getCompoundDescription(cid),
          getGhsClassification(cid),
          getSolubility(cid),
        ]);

  const allSynonyms = synonyms ?? [];
  const cas = isCAS(lookupTerm)
    ? lookupTerm
    : (osha?.cas ?? allSynonyms.find((name) => isCAS(name)));
  const imageUrls = [
    ...(cas === undefined ? [] : [nistStructureImageUrl(cas)]),
    ...(cid === undefined ? [] : [pubchemStructureImageUrl(cid)]),
  ];

  return {
    term,
    osha,
    cid,
    nistUrl: cas === undefined ? undefined : nistWebbookUrl(cas),
    wikipediaUrl: wikipediaUrl(properties?.title ?? osha?.name ?? english?.name ?? term),
    pubchemUrl: cid === undefined ? undefined : pubchemCompoundUrl(cid),
    properties,
    synonyms: allSynonyms,
    description,
    ghs,
    solubility,
    cas,
    imageUrls,
  };
}

/**
 * Loads merged chemical details for a term while the dialog is open.
 * @category Hooks
 * @group Chemical Info
 * @param term - The term to look up, or undefined when no dialog is open.
 * @returns The info (once loaded) and a loading flag.
 * @example
 * ```tsx
 * const { info, loading } = useChemicalInfo('67-64-1');
 * ```
 * @source
 */
export function useChemicalInfo(term: string | undefined): {
  info?: ChemicalInfo;
  loading: boolean;
} {
  const [info, setInfo] = useState<ChemicalInfo | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (term === undefined) return;
    let cancelled = false;
    setInfo(undefined);
    setLoading(true);
    const load = async () => {
      const result = await fetchChemicalInfo(term);
      if (cancelled) return;
      setInfo(result);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [term]);

  return { info, loading };
}
