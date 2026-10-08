import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lookupOshaChemical: vi.fn(),
  resolveEnglishChemical: vi.fn(),
  getCidByName: vi.fn(),
  getCidsByCas: vi.fn(),
  getCompoundDescription: vi.fn(),
  getCompoundProperties: vi.fn(),
  getGhsClassification: vi.fn(),
  getSolubility: vi.fn(),
  getSynonymsByCid: vi.fn(),
}));

vi.mock('@/helpers/oshaChemicalDb', () => ({ lookupOshaChemical: mocks.lookupOshaChemical }));
vi.mock('@/helpers/wikidata', () => ({ resolveEnglishChemical: mocks.resolveEnglishChemical }));
vi.mock('@/helpers/pubchem', () => ({
  getCidByName: mocks.getCidByName,
  getCidsByCas: mocks.getCidsByCas,
  getCompoundDescription: mocks.getCompoundDescription,
  getCompoundProperties: mocks.getCompoundProperties,
  getGhsClassification: mocks.getGhsClassification,
  getSolubility: mocks.getSolubility,
  getSynonymsByCid: mocks.getSynonymsByCid,
  pubchemCompoundUrl: (cid: number) => `https://pubchem/compound/${cid}`,
  pubchemStructureImageUrl: (cid: number) => `https://pubchem/image/${cid}`,
}));

import {
  nistStructureImageUrl,
  nistWebbookUrl,
  useChemicalInfo,
  wikipediaUrl,
} from '../useChemicalInfo';

/** Renders the hook and waits for the load to finish. */
async function loadInfo(term: string | undefined) {
  const rendered = renderHook(({ value }) => useChemicalInfo(value), {
    initialProps: { value: term },
  });
  if (term !== undefined) {
    await waitFor(() => expect(rendered.result.current.loading).toBe(false));
  }
  return rendered;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.lookupOshaChemical.mockResolvedValue(undefined);
  mocks.resolveEnglishChemical.mockResolvedValue({});
  mocks.getCidByName.mockResolvedValue(undefined);
  mocks.getCidsByCas.mockResolvedValue(undefined);
  mocks.getCompoundDescription.mockResolvedValue(undefined);
  mocks.getCompoundProperties.mockResolvedValue(undefined);
  mocks.getGhsClassification.mockResolvedValue(undefined);
  mocks.getSolubility.mockResolvedValue(undefined);
  mocks.getSynonymsByCid.mockResolvedValue(undefined);
});

describe('URL helpers', () => {
  it.each([
    ['sodium hydroxide', 'https://en.wikipedia.org/wiki/Special:Search?search=sodium%20hydroxide'],
    ['a&b', 'https://en.wikipedia.org/wiki/Special:Search?search=a%26b'],
  ])('wikipediaUrl(%j)', (name, expected) => {
    expect(wikipediaUrl(name)).toBe(expected);
  });

  it.each([
    ['67-64-1', 'C67641'],
    ['12024-21-4', 'C12024214'],
  ])('NIST urls for %s use the %s id', (cas, id) => {
    expect(nistWebbookUrl(cas)).toBe(`https://webbook.nist.gov/cgi/cbook.cgi?ID=${id}`);
    expect(nistStructureImageUrl(cas)).toBe(
      `https://webbook.nist.gov/cgi/cbook.cgi?Struct=${id}&Type=Color`,
    );
  });
});

describe('useChemicalInfo', () => {
  it('does nothing while no term is set', async () => {
    const { result } = await loadInfo(undefined);

    expect(result.current).toEqual({ info: undefined, loading: false });
    expect(mocks.lookupOshaChemical).not.toHaveBeenCalled();
  });

  it('merges OSHA and PubChem data for a CAS number without a name lookup', async () => {
    const osha = { name: 'ACETONE', cas: '67-64-1', synonyms: [] };
    const properties = { title: 'Acetone' };
    const description = { description: 'A solvent' };
    const ghs = { signal: 'Danger' };
    mocks.lookupOshaChemical.mockResolvedValue(osha);
    mocks.getCidsByCas.mockResolvedValue([180]);
    mocks.getCompoundProperties.mockResolvedValue(properties);
    mocks.getSynonymsByCid.mockResolvedValue(['acetone', '67-64-1']);
    mocks.getCompoundDescription.mockResolvedValue(description);
    mocks.getGhsClassification.mockResolvedValue(ghs);
    mocks.getSolubility.mockResolvedValue(['miscible']);

    const { result } = await loadInfo('67-64-1');

    expect(mocks.resolveEnglishChemical).not.toHaveBeenCalled();
    expect(mocks.lookupOshaChemical).toHaveBeenCalledWith('67-64-1');
    expect(result.current.info).toEqual({
      term: '67-64-1',
      osha,
      cid: 180,
      pubchemUrl: 'https://pubchem/compound/180',
      wikipediaUrl: wikipediaUrl('Acetone'),
      nistUrl: nistWebbookUrl('67-64-1'),
      properties,
      synonyms: ['acetone', '67-64-1'],
      description,
      ghs,
      solubility: ['miscible'],
      cas: '67-64-1',
      imageUrls: [nistStructureImageUrl('67-64-1'), 'https://pubchem/image/180'],
    });
  });

  it('looks a non-English name up by its resolved CAS but keeps the original term', async () => {
    mocks.resolveEnglishChemical.mockResolvedValue({ name: 'hydrochloric acid', cas: '7647-01-0' });
    mocks.getCidsByCas.mockResolvedValue([313]);

    const { result } = await loadInfo('zoutzuur');

    expect(mocks.resolveEnglishChemical).toHaveBeenCalledWith('zoutzuur');
    expect(mocks.lookupOshaChemical).toHaveBeenCalledWith('7647-01-0');
    expect(mocks.getCidsByCas).toHaveBeenCalledWith('7647-01-0');
    expect(result.current.info).toMatchObject({
      term: 'zoutzuur',
      cid: 313,
      cas: '7647-01-0',
      wikipediaUrl: wikipediaUrl('hydrochloric acid'),
    });
  });

  it('falls back to the English name when Wikidata has no CAS', async () => {
    mocks.resolveEnglishChemical.mockResolvedValue({ name: 'acetone' });
    mocks.getCidByName.mockResolvedValue(180);

    await loadInfo('aceton');

    expect(mocks.lookupOshaChemical).toHaveBeenCalledWith('acetone');
    expect(mocks.getCidByName).toHaveBeenCalledWith('acetone');
  });

  it('uses the term as typed when Wikidata fails or has no match', async () => {
    mocks.resolveEnglishChemical.mockResolvedValue(undefined);

    await loadInfo('unobtainium');

    expect(mocks.lookupOshaChemical).toHaveBeenCalledWith('unobtainium');
    expect(mocks.getCidByName).toHaveBeenCalledWith('unobtainium');
  });

  it("falls back to the OSHA record's CAS when PubChem has no CID for the name", async () => {
    mocks.lookupOshaChemical.mockResolvedValue({ name: 'ACETONE', cas: '67-64-1', synonyms: [] });
    mocks.getCidsByCas.mockResolvedValue([180]);

    const { result } = await loadInfo('acetone');

    expect(mocks.getCidByName).toHaveBeenCalledWith('acetone');
    expect(mocks.getCidsByCas).toHaveBeenCalledWith('67-64-1');
    expect(result.current.info?.cid).toBe(180);
  });

  it.each([
    ['has no CAS', { name: 'X', synonyms: [] }],
    ['has an invalid CAS', { name: 'X', cas: 'not-a-cas', synonyms: [] }],
  ])('does not retry by CAS when the OSHA record %s', async (_label, osha) => {
    mocks.lookupOshaChemical.mockResolvedValue(osha);

    const { result } = await loadInfo('mystery');

    expect(mocks.getCidsByCas).not.toHaveBeenCalled();
    expect(result.current.info?.cid).toBeUndefined();
  });

  it('skips the PubChem detail calls and links when there is no CID', async () => {
    mocks.lookupOshaChemical.mockResolvedValue({ name: 'ACETONE', cas: '67-64-1', synonyms: [] });

    const { result } = await loadInfo('acetone');

    expect(mocks.getCompoundProperties).not.toHaveBeenCalled();
    expect(result.current.info).toMatchObject({
      cid: undefined,
      pubchemUrl: undefined,
      synonyms: [],
      cas: '67-64-1',
      nistUrl: nistWebbookUrl('67-64-1'),
      wikipediaUrl: wikipediaUrl('ACETONE'),
      imageUrls: [nistStructureImageUrl('67-64-1')],
    });
  });

  it('takes the CAS from PubChem synonyms when neither the term nor OSHA has one', async () => {
    mocks.getCidByName.mockResolvedValue(180);
    mocks.getSynonymsByCid.mockResolvedValue(['acetone', '67-64-1']);

    const { result } = await loadInfo('acetone');

    expect(result.current.info?.cas).toBe('67-64-1');
    expect(result.current.info?.nistUrl).toBe(nistWebbookUrl('67-64-1'));
  });

  it('offers no NIST link or image when no CAS is known', async () => {
    mocks.getCidByName.mockResolvedValue(180);

    const { result } = await loadInfo('mystery');

    expect(result.current.info).toMatchObject({
      cas: undefined,
      nistUrl: undefined,
      imageUrls: ['https://pubchem/image/180'],
      wikipediaUrl: wikipediaUrl('mystery'),
    });
  });

  it('reports loading while the lookup is in flight', async () => {
    let release: (value: unknown) => void = () => undefined;
    mocks.lookupOshaChemical.mockReturnValue(new Promise((resolve) => (release = resolve)));

    const { result } = renderHook(() => useChemicalInfo('acetone'));
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.info).toBeUndefined();

    await act(async () => release(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.info?.term).toBe('acetone');
  });

  it('ignores a stale result when the term changes mid-lookup', async () => {
    let releaseFirst: (value: unknown) => void = () => undefined;
    mocks.lookupOshaChemical.mockImplementation((term: string) =>
      term === 'first'
        ? new Promise((resolve) => (releaseFirst = resolve))
        : Promise.resolve(undefined),
    );

    const { result, rerender } = renderHook(({ value }) => useChemicalInfo(value), {
      initialProps: { value: 'first' as string | undefined },
    });
    rerender({ value: 'second' });
    await waitFor(() => expect(result.current.info?.term).toBe('second'));

    await act(async () => releaseFirst(undefined));
    expect(result.current.info?.term).toBe('second');
  });
});
