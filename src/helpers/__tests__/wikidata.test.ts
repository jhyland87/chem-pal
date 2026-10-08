import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from '@/__fixtures__/helpers/chrome/storageMock';
import { getLocalizedNames, resolveEnglishChemical } from '@/helpers/wikidata';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/** Builds a minimal ok `Response` whose `json()` resolves to `body`. */
function jsonOk(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}

const searchHits = (...ids: string[]) =>
  jsonOk({ query: { search: ids.map((title) => ({ title })) } });
const entities = (
  list: Record<string, { labels: Record<string, string>; aliases?: Record<string, string[]> }>,
) =>
  jsonOk({
    entities: Object.fromEntries(
      Object.entries(list).map(([id, { labels, aliases = {} }]) => [
        id,
        {
          labels: Object.fromEntries(Object.entries(labels).map(([l, value]) => [l, { value }])),
          aliases: Object.fromEntries(
            Object.entries(aliases).map(([l, vs]) => [l, vs.map((value) => ({ value }))]),
          ),
        },
      ]),
    ),
  });
const casClaim = (cas: string) =>
  jsonOk({ claims: { P231: [{ mainsnak: { datavalue: { value: cas } } }] } });
const searchHit = (id: string) => jsonOk({ query: { search: [{ title: id }] } });
const noHit = () => jsonOk({ query: { search: [] } });
const entity = (
  id: string,
  labels: Record<string, string>,
  aliases: Record<string, string[]> = {},
) =>
  jsonOk({
    entities: {
      [id]: {
        labels: Object.fromEntries(Object.entries(labels).map(([l, value]) => [l, { value }])),
        aliases: Object.fromEntries(
          Object.entries(aliases).map(([l, vs]) => [l, vs.map((value) => ({ value }))]),
        ),
      },
    },
  });

/** Replaces global `fetch` with a fresh mock for the test. */
function stubFetch() {
  const mock = vi.fn();
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeAll(() => {
  setupChromeStorageMock();
});

beforeEach(() => {
  resetChromeStorageMock();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getLocalizedNames', () => {
  it('resolves a CAS number to the Dutch label and aliases', async () => {
    const fetchSpy = stubFetch()
      .mockResolvedValueOnce(searchHit('Q2409'))
      .mockResolvedValueOnce(entity('Q2409', { nl: 'zoutzuur' }, { nl: ['chloorwaterstofzuur'] }));

    expect(await getLocalizedNames('7647-01-0', 'nl')).toEqual(['zoutzuur', 'chloorwaterstofzuur']);
    expect(String(fetchSpy.mock.calls[0][0])).toContain(
      encodeURIComponent('haswbstatement:P231=7647-01-0'),
    );
  });

  it('accepts a name hit whose English label matches the term', async () => {
    stubFetch()
      .mockResolvedValueOnce(searchHit('Q49546'))
      .mockResolvedValueOnce(entity('Q49546', { en: 'acetone', nl: 'aceton' }));

    expect(await getLocalizedNames('Acetone', 'nl')).toEqual(['aceton']);
  });

  it('rejects a name hit whose English label does not match', async () => {
    stubFetch()
      .mockResolvedValueOnce(searchHit('Q1'))
      .mockResolvedValueOnce(entity('Q1', { en: 'something else', nl: 'iets anders' }));

    expect(await getLocalizedNames('acetone', 'nl')).toEqual([]);
  });

  it('returns an empty array when Wikidata has no hit', async () => {
    stubFetch().mockResolvedValueOnce(noHit());
    expect(await getLocalizedNames('not-a-chemical', 'nl')).toEqual([]);
  });

  it('returns undefined when the request fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubFetch().mockRejectedValue(new Error('offline'));
    expect(await getLocalizedNames('ethanol', 'nl')).toBeUndefined();
    errorSpy.mockRestore();
  });

  it('serves a repeat lookup from the cache', async () => {
    const fetchSpy = stubFetch()
      .mockResolvedValueOnce(searchHit('Q2409'))
      .mockResolvedValueOnce(entity('Q2409', { nl: 'zoutzuur' }));

    await getLocalizedNames('7647-01-0', 'nl');
    await getLocalizedNames('7647-01-0', 'nl');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('resolveEnglishChemical', () => {
  it('resolves a Dutch name to its English name and CAS number', async () => {
    stubFetch()
      .mockResolvedValueOnce(searchHits('Q2409', 'Q211086'))
      .mockResolvedValueOnce(
        entities({
          Q2409: { labels: { en: 'hydrochloric acid', nl: 'zoutzuur' } },
          Q211086: {
            labels: { en: 'hydrogen chloride', nl: 'waterstofchloride' },
            aliases: { nl: ['Zoutzuur'] },
          },
        }),
      )
      .mockResolvedValueOnce(casClaim('7647-01-0'));

    expect(await resolveEnglishChemical('Zoutzuur')).toEqual({
      name: 'hydrochloric acid',
      cas: '7647-01-0',
    });
  });

  it('prefers an exact label over a better-ranked search hit', async () => {
    stubFetch()
      .mockResolvedValueOnce(searchHits('Q411208', 'Q47512'))
      .mockResolvedValueOnce(
        entities({
          Q411208: { labels: { en: 'indole-3-acetic acid', nl: 'indool-3-azijnzuur' } },
          Q47512: { labels: { en: 'acetic acid', nl: 'azijnzuur' } },
        }),
      )
      .mockResolvedValueOnce(casClaim('64-19-7'));

    expect(await resolveEnglishChemical('azijnzuur')).toEqual({
      name: 'acetic acid',
      cas: '64-19-7',
    });
  });

  it('falls back to an alias match when no label matches', async () => {
    stubFetch()
      .mockResolvedValueOnce(searchHits('Q47512'))
      .mockResolvedValueOnce(
        entities({
          Q47512: { labels: { en: 'acetic acid', nl: 'azijnzuur' }, aliases: { nl: ['ijsazijn'] } },
        }),
      )
      .mockResolvedValueOnce(casClaim('64-19-7'));

    expect((await resolveEnglishChemical('ijsazijn'))?.name).toBe('acetic acid');
  });

  it('returns an empty match when no hit equals the term', async () => {
    stubFetch()
      .mockResolvedValueOnce(searchHits('Q1'))
      .mockResolvedValueOnce(entities({ Q1: { labels: { en: 'something', nl: 'iets' } } }));

    expect(await resolveEnglishChemical('zoutzuur')).toEqual({});
  });

  it('returns undefined when the request fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubFetch().mockRejectedValue(new Error('offline'));
    expect(await resolveEnglishChemical('zoutzuur')).toBeUndefined();
    errorSpy.mockRestore();
  });
});
