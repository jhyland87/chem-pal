import {
  lookupOshaChemical,
  normalizeChemicalName,
  parseOshaXml,
  resetOshaIndex,
} from '@/helpers/oshaChemicalDb';
import { clearAllCaches } from '@/utils/idbCache';
import { chemicalDb } from '@/../config.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<chemical_db>
  <chemical>
    <Analyte>ACETONE†</Analyte><CASNumber>67-64-1</CASNumber><Formula>C₃H₆O</Formula>
    <Synonyms>2-propanone; dimethyl ketone</Synonyms><NFPAHealthRating>1</NFPAHealthRating>
    <NFPAFireRating>3</NFPAFireRating><NFPAReactivityRating>0</NFPAReactivityRating>
    <NFPASpecialInstruction/><PELNotes>See &lt;a href="x"&gt;table&lt;/a&gt;</PELNotes>
    <PELTWAppm>1000 ppm</PELTWAppm>
  </chemical>
  <chemical>
    <Analyte>SODIUM HYDROXIDE</Analyte><CASNumber>1310-73-2</CASNumber><Synonyms>caustic soda</Synonyms>
  </chemical>
  <chemical><CASNumber>0-0-0</CASNumber></chemical>
</chemical_db>`;

describe('normalizeChemicalName', () => {
  it.each([
    ['ACETONE†', 'acetone'],
    ['  Sodium   Hydroxide ', 'sodium hydroxide'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeChemicalName(input)).toBe(expected);
  });
});

describe('parseOshaXml', () => {
  it('slims records, strips daggers, splits synonyms and skips unnamed rows', () => {
    const chemicals = parseOshaXml(XML);
    expect(chemicals).toHaveLength(2);
    expect(chemicals[0]).toMatchObject({
      name: 'ACETONE',
      cas: '67-64-1',
      nfpaHealth: '1',
      nfpaFire: '3',
      nfpaReactivity: '0',
      pelTwa: '1000 ppm',
      synonyms: ['2-propanone', 'dimethyl ketone'],
    });
    expect(chemicals[0].nfpaSpecial).toBeUndefined();
  });

  it('throws on malformed XML', () => {
    expect(() => parseOshaXml('<chemical_db><chemical>')).toThrow();
  });
});

describe('lookupOshaChemical', () => {
  beforeEach(() => {
    resetOshaIndex();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(XML, { status: 200 })),
    );
  });

  it.each([
    ['67-64-1', 'ACETONE'],
    ['Acetone', 'ACETONE'],
    ['dimethyl ketone', 'ACETONE'],
    ['hydroxide sodium', 'SODIUM HYDROXIDE'],
    ['caustic soda', 'SODIUM HYDROXIDE'],
  ])('finds %s', async (term, name) => {
    expect((await lookupOshaChemical(term))?.name).toBe(name);
  });

  it('returns undefined for unknown terms', async () => {
    expect(await lookupOshaChemical('unobtainium')).toBeUndefined();
  });

  it('passes a timeout signal to the download', async () => {
    await clearAllCaches();
    resetOshaIndex();
    await lookupOshaChemical('acetone');
    const init = vi.mocked(fetch).mock.calls[0][1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  describe('when the download fails with nothing cached', () => {
    const timeout = vi.fn(async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    });

    beforeEach(async () => {
      await clearAllCaches();
      resetOshaIndex();
      timeout.mockClear();
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.stubGlobal('fetch', timeout);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('rejects, so callers can tell "unavailable" from "not found"', async () => {
      await expect(lookupOshaChemical('acetone')).rejects.toThrow('unavailable');
    });

    it('skips the download during the retry window, then tries again', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      await expect(lookupOshaChemical('acetone')).rejects.toThrow();
      await expect(lookupOshaChemical('acetone')).rejects.toThrow();
      expect(timeout).toHaveBeenCalledTimes(1);

      vi.setSystemTime(Date.now() + chemicalDb.failureRetryMinutes * 60 * 1000 + 1);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(XML, { status: 200 })),
      );
      expect((await lookupOshaChemical('acetone'))?.name).toBe('ACETONE');
    });
  });
});
