import { chemicalDb } from '@/../config.json';
import { getChemicalDb, putChemicalDb } from '@/utils/idbCache';
import { isCAS } from '@/utils/typeGuards/common';

/**
 * A slimmed OSHA OBIS chemical record. Only the fields the chemical-info dialog shows are kept;
 * the ~100 sampling-method / detector-tube fields in the source XML are dropped. Every value is
 * optional because OBIS leaves many fields blank.
 * @category Science Helpers
 * @group Chemical Info
 */
export interface OshaChemical {
  /** Display name, with OBIS's trailing `†`/`‡` markers removed. */
  name: string;
  /** CAS registry number. */
  cas?: string;
  /** Formula, using Unicode subscripts as OBIS publishes it. */
  formula?: string;
  /** Alternate names. */
  synonyms: string[];
  physicalDescription?: string;
  molecularWeight?: string;
  boilingPoint?: string;
  freezingPoint?: string;
  flashPoint?: string;
  vaporPressure?: string;
  specificGravity?: string;
  relativeGasDensity?: string;
  ionizationPotential?: string;
  lowerExplosiveLimit?: string;
  upperExplosiveLimit?: string;
  /** NFPA 704 health rating (0-4). */
  nfpaHealth?: string;
  /** NFPA 704 flammability rating (0-4). */
  nfpaFire?: string;
  /** NFPA 704 instability rating (0-4). */
  nfpaReactivity?: string;
  /** NFPA 704 special notice, e.g. `W` or `OX`. */
  nfpaSpecial?: string;
  pelTwa?: string;
  pelStel?: string;
  pelCeiling?: string;
  relTwa?: string;
  relStel?: string;
  relCeiling?: string;
  tlvTwa?: string;
  tlvStel?: string;
  tlvCeiling?: string;
  idlh?: string;
  carcinogen?: string;
  /** Link to the NIOSH Pocket Guide entry. */
  nioshPocketGuideUrl?: string;
  /** Link to the NOAA CAMEO Chemicals datasheet. */
  cameoUrl?: string;
}

/**
 * The single `chemical_db` IndexedDB row.
 * @category Science Helpers
 * @group Chemical Info
 */
export interface ChemicalDbRecord {
  /** Row key; always `"current"`. */
  id: string;
  /** Epoch milliseconds the dataset was downloaded. */
  fetchedAt: number;
  /** Slimmed chemical records. */
  chemicals: OshaChemical[];
}

/**
 * Maps each {@link OshaChemical} field (except `name`/`synonyms`) to its OBIS XML element.
 * @source
 */
const FIELD_MAP: ReadonlyArray<readonly [keyof OshaChemical, string]> = [
  ['cas', 'CASNumber'],
  ['formula', 'Formula'],
  ['physicalDescription', 'PhysicalDescription'],
  ['molecularWeight', 'MolecularWeight'],
  ['boilingPoint', 'BoilingPoint'],
  ['freezingPoint', 'FreezingPoint'],
  ['flashPoint', 'FlashPoint'],
  ['vaporPressure', 'VaporPressure'],
  ['specificGravity', 'SpecificGravity'],
  ['relativeGasDensity', 'RelativeGasDensity'],
  ['ionizationPotential', 'IonizationPotential'],
  ['lowerExplosiveLimit', 'LowerExplosiveLimit'],
  ['upperExplosiveLimit', 'UpperExplosiveLimit'],
  ['nfpaHealth', 'NFPAHealthRating'],
  ['nfpaFire', 'NFPAFireRating'],
  ['nfpaReactivity', 'NFPAReactivityRating'],
  ['nfpaSpecial', 'NFPASpecialInstruction'],
  ['pelTwa', 'PELTWAppm'],
  ['pelStel', 'PELSTELppm'],
  ['pelCeiling', 'PELCppm'],
  ['relTwa', 'RELTWAppm'],
  ['relStel', 'RELSTELppm'],
  ['relCeiling', 'RELCppm'],
  ['tlvTwa', 'TLVTWAppm'],
  ['tlvStel', 'TLVSTELppm'],
  ['tlvCeiling', 'TLVCppm'],
  ['idlh', 'IDLHppm'],
  ['carcinogen', 'Carcinogen'],
  ['nioshPocketGuideUrl', 'NIOSHpgURL'],
  ['cameoUrl', 'ERCameoURL'],
];

/**
 * Normalizes a chemical name for matching: lowercase, OBIS dagger markers removed, and runs of
 * whitespace collapsed.
 * @category Science Helpers
 * @group Chemical Info
 * @param name - A chemical name or synonym.
 * @returns The normalized key.
 * @example
 * ```ts
 * normalizeChemicalName('ACETONE†'); // "acetone"
 * normalizeChemicalName('  Sodium   Hydroxide '); // "sodium hydroxide"
 * ```
 * @source
 */
export function normalizeChemicalName(name: string): string {
  return name.replace(/[†‡]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Reads one child element's text from an OBIS `<chemical>` node, stripping embedded HTML.
 * @param node - The `<chemical>` element.
 * @param tag - The child element name.
 * @returns The cleaned text, or undefined when blank.
 * @source
 */
function readField(node: Element, tag: string): string | undefined {
  const raw = node.getElementsByTagName(tag)[0]?.textContent ?? '';
  const text = raw
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text === '' ? undefined : text;
}

/**
 * Parses the OBIS `Chemical_DB.xml` document into slimmed records. Records without a name are
 * skipped. Requires `DOMParser` (available on extension pages, not in the service worker).
 * @category Science Helpers
 * @group Chemical Info
 * @param xml - The raw XML text.
 * @returns The slimmed chemical records.
 * @throws When the XML is malformed.
 * @example
 * ```ts
 * parseOshaXml('<chemical_db><chemical><Analyte>ACETONE</Analyte><CASNumber>67-64-1</CASNumber></chemical></chemical_db>');
 * // [{ name: "ACETONE", cas: "67-64-1", synonyms: [] }]
 * ```
 * @source
 */
export function parseOshaXml(xml: string): OshaChemical[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Malformed OSHA OBIS XML');
  }

  const chemicals: OshaChemical[] = [];
  for (const node of Array.from(doc.getElementsByTagName('chemical'))) {
    const analyte = readField(node, 'Analyte');
    if (analyte === undefined) continue;

    const chemical: OshaChemical = {
      name: analyte.replace(/[†‡]/g, '').trim(),
      synonyms: (readField(node, 'Synonyms') ?? '')
        .split(';')
        .map((synonym) => synonym.trim())
        .filter((synonym) => synonym !== ''),
    };
    for (const [field, tag] of FIELD_MAP) {
      const raw = readField(node, tag);
      if (raw === undefined) continue;
      // OBIS publishes links without a scheme.
      const value = tag.endsWith('URL') && !/^https?:\/\//.test(raw) ? `https://${raw}` : raw;
      Object.assign(chemical, { [field]: value });
    }
    chemicals.push(chemical);
  }
  return chemicals;
}

/**
 * Lookup indexes over the loaded dataset.
 * @source
 */
interface OshaIndex {
  byCas: Map<string, OshaChemical>;
  byName: Map<string, OshaChemical>;
  /** Normalized name → sorted-token key, for word-order-insensitive matches. */
  byTokens: Map<string, OshaChemical>;
}

let indexPromise: Promise<OshaIndex | undefined> | undefined;

/**
 * Builds the in-memory lookup indexes for a dataset.
 * @param chemicals - The chemical records.
 * @returns The indexes.
 * @source
 */
function buildIndex(chemicals: OshaChemical[]): OshaIndex {
  const index: OshaIndex = { byCas: new Map(), byName: new Map(), byTokens: new Map() };
  for (const chemical of chemicals) {
    if (chemical.cas !== undefined) index.byCas.set(chemical.cas, chemical);
    for (const name of [chemical.name, ...chemical.synonyms]) {
      const key = normalizeChemicalName(name);
      if (!index.byName.has(key)) index.byName.set(key, chemical);
      const tokenKey = key.split(' ').sort().join(' ');
      if (!index.byTokens.has(tokenKey)) index.byTokens.set(tokenKey, chemical);
    }
  }
  return index;
}

/**
 * Loads the OBIS dataset from IndexedDB, downloading and caching it when missing or older than
 * `chemicalDb.ttlDays`. The download is abandoned after `chemicalDb.fetchTimeoutMs`, and a stale copy is
 * still used when the refresh fails or times out. The result is memoized
 * for the page's lifetime.
 * @category Science Helpers
 * @group Chemical Info
 * @returns The lookup index, or undefined when no copy is cached and the download failed.
 * @example
 * ```ts
 * const index = await loadOshaIndex();
 * ```
 * @source
 */
function loadOshaIndex(): Promise<OshaIndex | undefined> {
  indexPromise ??= (async () => {
    const cached = await getChemicalDb();
    const ttlMs = chemicalDb.ttlDays * 24 * 60 * 60 * 1000;
    if (cached !== undefined && Date.now() - cached.fetchedAt < ttlMs) {
      return buildIndex(cached.chemicals);
    }
    try {
      // The signal also covers reading the body, so a stalled download can't hang the dialog.
      const response = await fetch(chemicalDb.url, {
        signal: AbortSignal.timeout(chemicalDb.fetchTimeoutMs),
      });
      if (!response.ok) throw new Error(`OSHA OBIS responded ${response.status}`);
      const chemicals = parseOshaXml(await response.text());
      await putChemicalDb(chemicals, Date.now());
      return buildIndex(chemicals);
    } catch (error) {
      console.error('Failed to download OSHA OBIS chemical DB:', error);
      return cached === undefined ? undefined : buildIndex(cached.chemicals);
    }
  })();
  // Don't memoize a failure; let the next open retry.
  void indexPromise.then((index) => {
    if (index === undefined) indexPromise = undefined;
  });
  return indexPromise;
}

/**
 * Looks a searched term up in the OSHA OBIS dataset by CAS number, exact name/synonym, or the
 * same words in any order (so "hydroxide sodium" still finds "sodium hydroxide").
 * @category Science Helpers
 * @group Chemical Info
 * @param term - A chemical name or CAS number.
 * @returns The matching record, or undefined when OBIS has none or is unavailable.
 * @example
 * ```ts
 * await lookupOshaChemical('67-64-1'); // { name: "ACETONE", nfpaHealth: "1", ... }
 * await lookupOshaChemical('hydroxide sodium'); // { name: "SODIUM HYDROXIDE", ... }
 * ```
 * @source
 */
export async function lookupOshaChemical(term: string): Promise<OshaChemical | undefined> {
  const index = await loadOshaIndex();
  if (index === undefined) return undefined;
  const trimmed = term.trim();
  if (isCAS(trimmed)) return index.byCas.get(trimmed);
  const key = normalizeChemicalName(trimmed);
  return index.byName.get(key) ?? index.byTokens.get(key.split(' ').sort().join(' '));
}

/**
 * Clears the memoized index so the next lookup reloads from storage. Test helper.
 * @category Science Helpers
 * @group Chemical Info
 * @example
 * ```ts
 * resetOshaIndex();
 * ```
 * @source
 */
export function resetOshaIndex(): void {
  indexPromise = undefined;
}
