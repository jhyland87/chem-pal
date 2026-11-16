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
import { resolveEnglishChemical, type EnglishChemical } from '@/helpers/wikidata';
import { isCAS } from '@/utils/typeGuards/common';
import { useEffect, useReducer } from 'react';

/**
 * Everything known about one searched chemical, merged from OSHA OBIS and PubChem. Each source
 * is optional; a lookup that fails or hasn't finished yet leaves its fields undefined.
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
 * Where one source's lookup stands.
 * @category Hooks
 * @group Chemical Info
 */
export type SourceStatus = 'loading' | 'loaded' | 'failed';

/**
 * Status and value of one source's lookup.
 * @category Hooks
 * @group Chemical Info
 */
export interface SourceState<Value> {
  status: SourceStatus;
  value?: Value;
}

/**
 * Per-source lookup state for one term. Each source settles on its own, so the dialog can show
 * whatever has arrived.
 * @category Hooks
 * @group Chemical Info
 */
export interface ChemicalInfoSources {
  /** Wikidata English name/CAS for a non-English term. */
  english: SourceState<EnglishChemical>;
  osha: SourceState<OshaChemical>;
  cid: SourceState<PubChemCID>;
  properties: SourceState<PubChemProperties>;
  synonyms: SourceState<string[]>;
  description: SourceState<PubChemDescription>;
  ghs: SourceState<PubChemGhs>;
  solubility: SourceState<string[]>;
}

/**
 * A source key in {@link ChemicalInfoSources}.
 * @category Hooks
 * @group Chemical Info
 */
export type ChemicalInfoSourceKey = keyof ChemicalInfoSources;

/**
 * A reducer action setting one source's state.
 * @source
 */
type SourceAction = {
  [Key in ChemicalInfoSourceKey]: { key: Key; state: ChemicalInfoSources[Key] };
}[ChemicalInfoSourceKey];

/**
 * Builds the initial per-source state, with every source loading.
 * @category Hooks
 * @group Chemical Info
 * @returns The state.
 * @example
 * ```ts
 * initialSources().osha; // { status: "loading" }
 * ```
 * @source
 */
export function initialSources(): ChemicalInfoSources {
  return {
    english: { status: 'loading' },
    osha: { status: 'loading' },
    cid: { status: 'loading' },
    properties: { status: 'loading' },
    synonyms: { status: 'loading' },
    description: { status: 'loading' },
    ghs: { status: 'loading' },
    solubility: { status: 'loading' },
  };
}

/**
 * Hook state: the term the sources belong to, and the sources.
 * @source
 */
interface LoadState {
  term?: string;
  sources: ChemicalInfoSources;
}

/**
 * Applies a source update, or starts a load for a term. Restarting the same term keeps the values
 * already shown (marking them loading again), so reopening the dialog doesn't flash empty.
 * @param state - The current state.
 * @param action - A source update, or `{ start: term }`.
 * @returns The new state.
 * @source
 */
function loadReducer(state: LoadState, action: SourceAction | { start: string }): LoadState {
  if ('start' in action) {
    if (state.term !== action.start) return { term: action.start, sources: initialSources() };
    const { english, osha, cid, properties, synonyms, description, ghs, solubility } =
      state.sources;
    return {
      term: action.start,
      sources: {
        english: reloading(english),
        osha: reloading(osha),
        cid: reloading(cid),
        properties: reloading(properties),
        synonyms: reloading(synonyms),
        description: reloading(description),
        ghs: reloading(ghs),
        solubility: reloading(solubility),
      },
    };
  }
  return { ...state, sources: { ...state.sources, [action.key]: action.state } };
}

/**
 * Marks a source as loading again while keeping its last value.
 * @param source - The source state.
 * @returns The same value with status `loading`.
 * @source
 */
function reloading<Value>(source: SourceState<Value>): SourceState<Value> {
  return { ...source, status: 'loading' };
}

/**
 * Merges whatever the sources have returned so far into a {@link ChemicalInfo}. Recomputed on each
 * update, so the title, links and structure image fill in as data arrives.
 * @category Hooks
 * @group Chemical Info
 * @param term - The term that was looked up.
 * @param sources - The per-source state.
 * @returns The merged info.
 * @example
 * ```ts
 * deriveChemicalInfo('67-64-1', initialSources());
 * // { term: "67-64-1", cas: "67-64-1", synonyms: [], imageUrls: [<NIST image>], ... }
 * ```
 * @source
 */
export function deriveChemicalInfo(term: string, sources: ChemicalInfoSources): ChemicalInfo {
  const english = sources.english.value;
  const osha = sources.osha.value;
  const cid = sources.cid.value;
  const properties = sources.properties.value;
  const synonyms = sources.synonyms.value ?? [];
  const lookupTerm = english?.cas ?? english?.name ?? term;
  const cas = isCAS(lookupTerm) ? lookupTerm : (osha?.cas ?? synonyms.find((name) => isCAS(name)));
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
    synonyms,
    description: sources.description.value,
    ghs: sources.ghs.value,
    solubility: sources.solubility.value,
    cas,
    imageUrls,
  };
}

/**
 * Resolves a PubChem CID from a CAS number or name, falling back to the OBIS CAS. The OBIS
 * lookup runs in parallel and is only awaited when the direct lookup finds nothing.
 * @param lookupTerm - The (English) term to look up.
 * @param osha - The pending OBIS lookup.
 * @returns The CID, or undefined.
 * @source
 */
async function resolveCid(
  lookupTerm: string,
  osha: Promise<OshaChemical | undefined>,
): Promise<PubChemCID | undefined> {
  if (isCAS(lookupTerm)) return (await getCidsByCas(lookupTerm))?.[0];
  const byName = await getCidByName(lookupTerm);
  if (byName !== undefined) return byName;
  const oshaCas = await osha.catch(() => undefined);
  if (oshaCas?.cas === undefined || !isCAS(oshaCas.cas)) return undefined;
  return (await getCidsByCas(oshaCas.cas))?.[0];
}

/**
 * Runs every lookup for a term, reporting each source as soon as it settles. A non-English name is
 * first resolved to its English name and CAS number through Wikidata; OSHA OBIS and PubChem then
 * run in parallel, and each PubChem detail request reports on its own.
 * @param term - A chemical name or CAS number.
 * @param report - Receives each source update.
 * @returns Resolves once every source has settled; never rejects.
 * @source
 */
async function loadChemicalInfo(term: string, report: (action: SourceAction) => void) {
  /**
   * Awaits one lookup and reports it as loaded, or failed when it rejects.
   * @param pending - The lookup.
   * @param toAction - Wraps the settled state in an action for its source.
   * @returns The value, or undefined on failure.
   */
  const track = async <Value>(
    pending: Promise<Value | undefined>,
    toAction: (state: SourceState<Value>) => SourceAction,
  ): Promise<Value | undefined> => {
    try {
      const value = await pending;
      report(toAction({ status: 'loaded', value }));
      return value;
    } catch {
      report(toAction({ status: 'failed' }));
      return undefined;
    }
  };

  // A name in another language (e.g. Dutch "zoutzuur") matches nothing in OBIS or PubChem, so
  // look the term up by its CAS number (or English name) instead; the dialog still shows `term`.
  const english = await track(
    isCAS(term) ? Promise.resolve(undefined) : resolveEnglishChemical(term),
    (state) => ({ key: 'english', state }),
  );
  const lookupTerm = english?.cas ?? english?.name ?? term;

  const oshaLookup = lookupOshaChemical(lookupTerm);
  const oshaDone = track(oshaLookup, (state) => ({ key: 'osha', state }));
  const cid = await track(resolveCid(lookupTerm, oshaLookup), (state) => ({ key: 'cid', state }));

  /**
   * Starts one PubChem detail lookup for the CID, or settles it empty when there is no CID.
   * @param fetcher - The PubChem helper.
   * @returns The lookup.
   */
  const detail = <Value>(fetcher: (id: PubChemCID) => Promise<Value | undefined>) =>
    cid === undefined ? Promise.resolve(undefined) : fetcher(cid);

  await Promise.all([
    oshaDone,
    track(detail(getCompoundProperties), (state) => ({ key: 'properties', state })),
    track(detail(getSynonymsByCid), (state) => ({ key: 'synonyms', state })),
    track(detail(getCompoundDescription), (state) => ({ key: 'description', state })),
    track(detail(getGhsClassification), (state) => ({ key: 'ghs', state })),
    track(detail(getSolubility), (state) => ({ key: 'solubility', state })),
  ]);
}

/**
 * Loads merged chemical details for a term while the dialog is open. Each source updates the
 * result as soon as it answers, so one slow or unavailable source doesn't hold up the others.
 * @category Hooks
 * @group Chemical Info
 * @param term - The term to look up, or undefined when no dialog is open.
 * @returns The info merged so far (undefined while closed), each source's status, and whether
 * any source is still loading.
 * @example
 * ```tsx
 * const { info, sources, loading } = useChemicalInfo('67-64-1');
 * sources.osha.status; // "loading" | "loaded" | "failed"
 * ```
 * @source
 */
export function useChemicalInfo(term: string | undefined): {
  info?: ChemicalInfo;
  sources: ChemicalInfoSources;
  loading: boolean;
} {
  const [state, dispatch] = useReducer(loadReducer, { sources: initialSources() });

  useEffect(() => {
    if (term === undefined) return;
    let cancelled = false;
    dispatch({ start: term });
    void loadChemicalInfo(term, (action) => {
      if (!cancelled) dispatch(action);
    });
    return () => {
      cancelled = true;
    };
  }, [term]);

  // Until the effect starts this term's load, don't show another term's data.
  const sources = state.term === term ? state.sources : initialSources();
  if (term === undefined) return { info: undefined, sources, loading: false };
  const loading = Object.values(sources).some(
    (source: SourceState<unknown>) => source.status === 'loading',
  );
  return { info: deriveChemicalInfo(term, sources), sources, loading };
}
