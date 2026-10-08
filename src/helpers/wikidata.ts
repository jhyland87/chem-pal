import { wikidata as wikidataConfig } from '@/../config.json';
import { withTtlCache } from '@/helpers/requestCache';
import { isCAS, isPopulatedObject } from '@/utils/typeGuards/common';

/**
 * @group Helpers
 * @groupDescription Resolves a chemical (by CAS number or English name) to its labels in another
 * language through Wikidata, so suppliers that only index local-language product names can still
 * be searched.
 * @source
 */

/**
 * Wikidata's MediaWiki API endpoint.
 * @see https://www.wikidata.org/w/api.php
 * @source
 */
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

/**
 * Wikidata property holding a compound's CAS Registry Number. Restricting a search to items
 * with this property keeps it to chemical substances.
 * @source
 */
const CAS_PROPERTY = 'P231';

/**
 * How long a lookup stays cached, in ms.
 * @source
 */
const TTL_MS = wikidataConfig.ttlDays * 24 * 60 * 60 * 1000;

/**
 * Calls the Wikidata API and returns the parsed JSON body.
 * @param params - Query-string parameters (`format=json` is added)
 * @returns The parsed response, or undefined on a network/HTTP failure
 * @example
 * ```typescript
 * await queryWikidata({ action: "wbgetentities", ids: "Q2409", props: "labels" });
 * // Returns: { entities: { Q2409: { labels: { ... } } } }
 * ```
 * @source
 */
async function queryWikidata(params: Record<string, string>): Promise<unknown> {
  try {
    const url = new URL(WIKIDATA_API);
    for (const [key, value] of Object.entries({ ...params, format: 'json' })) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url);
    if (!response.ok) {
      return undefined;
    }
    return await response.json();
  } catch (error) {
    console.error('Error querying Wikidata:', error);
    return undefined;
  }
}

/**
 * Extracts the first search hit's entity id (e.g. `Q2409`) from a `list=search` response.
 * @param data - The parsed `list=search` response
 * @returns The first hit's id, or undefined when there is none
 * @example
 * ```typescript
 * extractFirstEntityId({ query: { search: [{ title: "Q2409" }] } }); // Returns: "Q2409"
 * extractFirstEntityId({ query: { search: [] } }); // Returns: undefined
 * ```
 * @source
 */
function extractFirstEntityId(data: unknown): string | undefined {
  if (!isPopulatedObject(data) || !isPopulatedObject(data.query)) {
    return undefined;
  }
  const hits = data.query.search;
  if (!Array.isArray(hits) || !isPopulatedObject(hits[0])) {
    return undefined;
  }
  const title = hits[0].title;
  return typeof title === 'string' && /^Q\d+$/.test(title) ? title : undefined;
}

/**
 * Reads the label and aliases of one language out of a Wikidata entity.
 * @param entity - A Wikidata entity object
 * @param lang - Language code, e.g. `nl`
 * @returns The label first, then the aliases (empty when the entity has none in `lang`)
 * @example
 * ```typescript
 * entityNames({ labels: { nl: { value: "zoutzuur" } }, aliases: {} }, "nl"); // Returns: ["zoutzuur"]
 * ```
 * @source
 */
function entityNames(entity: unknown, lang: string): string[] {
  if (!isPopulatedObject(entity)) {
    return [];
  }
  const names: string[] = [];
  const labels = entity.labels;
  if (isPopulatedObject(labels) && isPopulatedObject(labels[lang])) {
    const value = labels[lang].value;
    if (typeof value === 'string') {
      names.push(value);
    }
  }
  const aliases = entity.aliases;
  if (isPopulatedObject(aliases) && Array.isArray(aliases[lang])) {
    for (const alias of aliases[lang]) {
      if (isPopulatedObject(alias) && typeof alias.value === 'string') {
        names.push(alias.value);
      }
    }
  }
  return names;
}

/**
 * Network implementation for {@link getLocalizedNames}; see it for details.
 * @param term - A CAS number or English chemical name
 * @param lang - Target language code
 * @returns The localized names (empty when there is no confident match), or undefined on failure
 * @source
 */
async function getLocalizedNamesUncached(
  term: string,
  lang: string,
): Promise<string[] | undefined> {
  const cleaned = term.trim();
  const byCas = isCAS(cleaned);
  const search = await queryWikidata({
    action: 'query',
    list: 'search',
    srsearch: byCas
      ? `haswbstatement:${CAS_PROPERTY}=${cleaned}`
      : `${cleaned} haswbstatement:${CAS_PROPERTY}`,
    srlimit: '1',
    srnamespace: '0',
  });
  if (search === undefined) {
    return undefined;
  }
  const id = extractFirstEntityId(search);
  if (id === undefined) {
    return [];
  }

  const languages = byCas ? lang : `en|${lang}`;
  const entities = await queryWikidata({
    action: 'wbgetentities',
    ids: id,
    props: 'labels|aliases',
    languages,
  });
  if (!isPopulatedObject(entities) || !isPopulatedObject(entities.entities)) {
    return undefined;
  }
  const entity = entities.entities[id];

  // A name search can land on the wrong compound, so require the English label or an alias
  // to equal the term before trusting the hit. A CAS match is exact already.
  if (!byCas) {
    const english = entityNames(entity, 'en').map((name) => name.toLowerCase());
    if (!english.includes(cleaned.toLowerCase())) {
      return [];
    }
  }

  const unique = new Map<string, string>();
  for (const name of entityNames(entity, lang)) {
    unique.set(name.toLowerCase(), name);
  }
  return [...unique.values()].slice(0, 1 + wikidataConfig.maxAliases);
}

/**
 * Resolves a CAS number or English chemical name to its Wikidata label and aliases in
 * another language. Cached for `wikidata.ttlDays` (config.json); a definitive "no match"
 * is cached as an empty array, a failed request (undefined) is not.
 * @category Helpers
 * @param term - A CAS number (`7647-01-0`) or an English chemical name (`hydrochloric acid`)
 * @param lang - Target language code, e.g. `nl`
 * @returns The label first, then up to `wikidata.maxAliases` aliases; an empty array when
 * Wikidata has no confident match; undefined if the lookup failed
 * @example
 * ```typescript
 * await getLocalizedNames("7647-01-0", "nl");
 * // Returns: ["zoutzuur"]
 * await getLocalizedNames("sodium chloride", "nl");
 * // Returns: ["natriumchloride"]
 * await getLocalizedNames("not a chemical", "nl");
 * // Returns: []
 * ```
 * @source
 */
export const getLocalizedNames: (term: string, lang: string) => Promise<string[] | undefined> =
  withTtlCache(getLocalizedNamesUncached, { namespace: 'wikidataNames', ttlMs: TTL_MS });

/**
 * A chemical resolved to its English name and CAS number. Both are absent for "no match".
 * @category Helpers
 * @group Types
 */
export interface EnglishChemical {
  /** The English label, e.g. `hydrochloric acid`. */
  name?: string;
  /** CAS Registry Number, e.g. `7647-01-0`. */
  cas?: string;
}

/**
 * Picks the search hit whose label (or, failing that, an alias) equals the term in English or
 * one of the configured source languages. Search ranking alone is unreliable: `azijnzuur`
 * ranks indole-3-acetic acid above acetic acid.
 * @param entities - The `wbgetentities` `entities` map
 * @param ids - Candidate ids, in search-rank order
 * @param term - The (lowercased) term being resolved
 * @returns The chosen entity id and its English label, or undefined when none matches
 * @example
 * ```typescript
 * pickMatchingEntity(entities, ["Q411208", "Q47512"], "azijnzuur");
 * // Returns: { id: "Q47512", name: "acetic acid" }
 * ```
 * @source
 */
function pickMatchingEntity(
  entities: Record<string, unknown>,
  ids: string[],
  term: string,
): { id: string; name: string } | undefined {
  const languages = ['en', ...wikidataConfig.sourceLanguages];
  const labelsOf = (id: string) =>
    languages.flatMap((lang) => entityNames(entities[id], lang).slice(0, 1));
  const aliasesOf = (id: string) =>
    languages.flatMap((lang) => entityNames(entities[id], lang).slice(1));
  const matches = (names: string[]) => names.some((name) => name.toLowerCase() === term);

  const id =
    ids.find((candidate) => matches(labelsOf(candidate))) ??
    ids.find((candidate) => matches(aliasesOf(candidate)));
  const name = id === undefined ? undefined : entityNames(entities[id], 'en')[0];
  return id === undefined || name === undefined ? undefined : { id, name };
}

/**
 * Reads the CAS number (property P231) of a Wikidata item.
 * @param id - The item id, e.g. `Q2409`
 * @returns The CAS number, or undefined when the item has none or the request failed
 * @example
 * ```typescript
 * await fetchCasOf("Q2409"); // Returns: "7647-01-0"
 * ```
 * @source
 */
async function fetchCasOf(id: string): Promise<string | undefined> {
  const data = await queryWikidata({
    action: 'wbgetclaims',
    entity: id,
    property: CAS_PROPERTY,
  });
  if (!isPopulatedObject(data) || !isPopulatedObject(data.claims)) {
    return undefined;
  }
  const claims = data.claims[CAS_PROPERTY];
  const snak =
    Array.isArray(claims) && isPopulatedObject(claims[0]) ? claims[0].mainsnak : undefined;
  const value =
    isPopulatedObject(snak) && isPopulatedObject(snak.datavalue) ? snak.datavalue.value : undefined;
  return isCAS(value) ? value : undefined;
}

/**
 * Network implementation for {@link resolveEnglishChemical}; see it for details.
 * @param term - A chemical name in English or a source language
 * @returns The match (empty object for none), or undefined on failure
 * @source
 */
async function resolveEnglishChemicalUncached(term: string): Promise<EnglishChemical | undefined> {
  const cleaned = term.trim();
  const search = await queryWikidata({
    action: 'query',
    list: 'search',
    srsearch: `${cleaned} haswbstatement:${CAS_PROPERTY}`,
    srlimit: String(wikidataConfig.englishSearchHits),
    srnamespace: '0',
  });
  if (search === undefined) {
    return undefined;
  }
  const hits =
    isPopulatedObject(search) && isPopulatedObject(search.query) ? search.query.search : [];
  const ids = (Array.isArray(hits) ? hits : [])
    .map((hit) => (isPopulatedObject(hit) ? hit.title : undefined))
    .filter((title): title is string => typeof title === 'string' && /^Q\d+$/.test(title));
  if (ids.length === 0) {
    return {};
  }

  const response = await queryWikidata({
    action: 'wbgetentities',
    ids: ids.join('|'),
    props: 'labels|aliases',
    languages: ['en', ...wikidataConfig.sourceLanguages].join('|'),
  });
  if (!isPopulatedObject(response) || !isPopulatedObject(response.entities)) {
    return undefined;
  }
  const match = pickMatchingEntity(response.entities, ids, cleaned.toLowerCase());
  if (match === undefined) {
    return {};
  }
  return { name: match.name, cas: await fetchCasOf(match.id) };
}

/**
 * Resolves a chemical name written in English or a configured source language (see
 * `wikidata.sourceLanguages` in config.json, e.g. Dutch `zoutzuur`) to its English name and CAS number. The term must
 * equal a Wikidata label or alias exactly, so an unrelated top search hit is never trusted.
 * Cached for `wikidata.ttlDays`; a definitive "no match" is cached as `{}`, a failed request
 * (undefined) is not.
 * @category Helpers
 * @param term - A chemical name, e.g. `zoutzuur` or `acetone`
 * @returns The English name and CAS, `{}` when nothing matches, or undefined if the lookup failed
 * @example
 * ```typescript
 * await resolveEnglishChemical("zoutzuur");
 * // Returns: { name: "hydrochloric acid", cas: "7647-01-0" }
 * await resolveEnglishChemical("not a chemical");
 * // Returns: {}
 * ```
 * @source
 */
export const resolveEnglishChemical: (term: string) => Promise<EnglishChemical | undefined> =
  withTtlCache(resolveEnglishChemicalUncached, {
    namespace: 'wikidataEnglish',
    ttlMs: TTL_MS,
    keyFromArgs: (term) => term.trim().toLowerCase(),
  });
