import {
  extractSmiles,
  isProbablyValidSmiles,
  looksLikeSmiles,
  parseStructurePrefix,
  resolveQueryForSearch,
  resolveSmiles,
} from '@/helpers/smiles';
import { Cactus } from '@/utils/Cactus';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
  type Mock,
} from 'vitest';
import { ETHANOL } from './fixtures/chemicals';

/** Real-world SMILES corpus (one per line) used to exercise validation and extraction. */
const SMILES_CORPUS = readFileSync(resolve(__dirname, './__fixtures__/smiles-examples.txt'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

/** A character that distinguishes a structure from a plain word — mirrors the extractor's guard. */
const HAS_STRONG_CHAR = /[=#$[\]()0-9/\\]/;

/**
 * Builds a fake fetch that answers Cactus endpoint requests and PubChem SDQ requests.
 * Cactus URLs are decoded so they can be matched against the raw SMILES + endpoint segment.
 */
function mockChemFetch(
  cactus: Record<string, Partial<Record<'names' | 'cas' | 'stdinchikey', string>>>,
  pubchemName?: string,
): void {
  (global.fetch as Mock).mockImplementation((url: string) => {
    if (url.includes('sdqagent.cgi')) {
      const rows = pubchemName ? [{ cmpdname: pubchemName }] : [];
      return Promise.resolve({
        json: () =>
          Promise.resolve({
            SDQOutputSet: [{ status: { code: 0 }, totalCount: rows.length, rows }],
          }),
      } as unknown as Response);
    }

    const decoded = decodeURIComponent(url);
    let result = '';
    for (const [smiles, endpoints] of Object.entries(cactus)) {
      const base = `/structure/${smiles}/`;
      if (!decoded.includes(base)) continue;
      if (decoded.endsWith('/names')) result = endpoints.names ?? '';
      else if (decoded.endsWith('/cas')) result = endpoints.cas ?? '';
      else if (decoded.endsWith('/stdinchikey')) result = endpoints.stdinchikey ?? '';
    }
    return Promise.resolve({
      status: 200,
      clone: () => ({ headers: { get: () => 'text/plain' } }),
      headers: { get: () => 'text/plain' },
      text: () => Promise.resolve(result),
    } as unknown as Response);
  });
}

describe('SMILES Helpers', () => {
  describe('looksLikeSmiles', () => {
    test.each([
      ['CCO', true],
      ['CC(=O)O', true],
      ['c1ccccc1', true],
      ['[Na+].[Cl-]', true],
      ['O=C=O', true],
      ['ethanol', false],
      ['sulfuric acid', false],
      ['64-17-5', false],
      ['CO', false],
      ['', false],
    ])('should return %s for query: %s', (input, output) =>
      expect(looksLikeSmiles(input)).toBe(output),
    );
  });

  describe('parseStructurePrefix', () => {
    test.each([
      ['smiles:CCO', { mode: 'smiles', value: 'CCO' }],
      ['SMILES: CCO ', { mode: 'smiles', value: 'CCO' }],
      [
        'inchikey:LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
        { mode: 'inchikey', value: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N' },
      ],
      ['ethanol', { mode: 'auto', value: 'ethanol' }],
    ])('should parse %s', (input, output) => expect(parseStructurePrefix(input)).toEqual(output));
  });

  describe('isProbablyValidSmiles', () => {
    test.each([
      ['CC(=O)O', true],
      ['[Na+].[Cl-]', true],
      ['[Na+]', true], // bracketed single atom is allowed
      ['Cl', true], // two-character single atom is allowed
      ['P', false], // single character is not assumed to be a structure
      ['*', false],
      ['CC(=O', false],
      ['C[C', false],
      ['hello!', false],
      ['', false],
    ])('should return %s for: %s', (input, output) =>
      expect(isProbablyValidSmiles(input)).toBe(output),
    );
  });

  describe('extractSmiles', () => {
    test.each([
      ['The product CC(=O)O forms first.', ['CC(=O)O']],
      [
        'Compare CC(=O)O and CN1C=NC2=C1C(=O)N(C)C(=O)N2C here.',
        ['CC(=O)O', 'CN1C=NC2=C1C(=O)N(C)C(=O)N2C'],
      ],
      ['Salt [Na+].[Cl-] dissolves readily.', ['[Na+].[Cl-]']],
      ['no structures in this sentence', []], // pure prose, no strong chars
      ['it contains P and N atoms', []], // bare single characters are ignored
    ])('should extract %j -> %j', (input, output) => expect(extractSmiles(input)).toEqual(output));

    it('extracts a structure surrounded by punctuation', () => {
      expect(extractSmiles('Result: CC(=O)O, stored.')).toEqual(['CC(=O)O']);
    });
  });

  describe('SMILES corpus (smiles-examples.txt)', () => {
    it('validates every line in the corpus', () => {
      const failures = SMILES_CORPUS.filter((smiles) => !isProbablyValidSmiles(smiles));
      expect(failures).toEqual([]);
    });

    it('extracts each structure verbatim from surrounding prose', () => {
      const templates = [
        (s: string) => `The compound has structure ${s} according to the database.`,
        (s: string) => `Structure: ${s}`,
        (s: string) => `We resolved the query and got ${s} as the canonical form.`,
        (s: string) => `The SMILES is ${s}, which matches.`,
        (s: string) => `Parsed ${s} successfully and stored it.`,
        (s: string) => `Result -> ${s}`,
        (s: string) => `entry: ${s} ; next field`,
      ];
      const failures: string[] = [];
      SMILES_CORPUS.forEach((smiles, index) => {
        // Pure atom-chains carry no strong char, so the extractor skips them by design.
        if (!HAS_STRONG_CHAR.test(smiles)) return;
        const paragraph = templates[index % templates.length](smiles);
        if (!extractSmiles(paragraph).includes(smiles)) {
          failures.push(`line ${index + 1}: ${smiles}`);
        }
      });
      expect(failures).toEqual([]);
    });

    it('extracts multiple structures embedded in one paragraph', () => {
      const [a, b, c] = [SMILES_CORPUS[18], SMILES_CORPUS[30], SMILES_CORPUS[98]];
      expect(extractSmiles(`First ${a} then ${b}, finally ${c} done.`)).toEqual([a, b, c]);
    });
  });

  describe('resolveSmiles', () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });

    beforeEach(() => {
      Cactus.clearGlobalCache();
    });

    afterEach(() => {
      (global.fetch as Mock).mockReset();
    });

    it('resolves a SMILES to a name, CAS, and InChIKey via Cactus', async () => {
      mockChemFetch({
        [ETHANOL.smiles]: {
          names: `${ETHANOL.name}\nethyl alcohol`,
          cas: ETHANOL.cas,
          stdinchikey: `InChIKey=${ETHANOL.inchikey}`,
        },
      });
      const result = await resolveSmiles(ETHANOL.smiles);
      expect(result).toEqual({
        name: ETHANOL.name,
        cas: [ETHANOL.cas],
        inchikey: ETHANOL.inchikey,
        source: 'cactus-name',
      });
    });

    it('falls back to PubChem when Cactus yields only an InChIKey', async () => {
      mockChemFetch(
        {
          'C1=CC=CC=C1': {
            names: '',
            cas: '',
            stdinchikey: 'UHOVQNZJYSORNB-UHFFFAOYSA-N',
          },
        },
        'benzene',
      );
      const result = await resolveSmiles('C1=CC=CC=C1');
      expect(result).toEqual({
        name: 'benzene',
        inchikey: 'UHOVQNZJYSORNB-UHFFFAOYSA-N',
        source: 'pubchem-inchikey',
      });
    });

    it('returns undefined for an invalid SMILES without hitting the network', async () => {
      const result = await resolveSmiles('CC(=O');
      expect(result).toBeUndefined();
      expect(global.fetch as Mock).not.toHaveBeenCalled();
    });

    it('returns undefined when nothing resolves', async () => {
      mockChemFetch({ Xx: {} });
      const result = await resolveSmiles('Xx');
      expect(result).toBeUndefined();
    });
  });

  describe('resolveQueryForSearch', () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });

    beforeEach(() => {
      Cactus.clearGlobalCache();
    });

    afterEach(() => {
      (global.fetch as Mock).mockReset();
    });

    it('resolves a SMILES query to a searchable name', async () => {
      mockChemFetch({
        CCO: { names: 'ethanol', cas: '64-17-5', stdinchikey: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N' },
      });
      const result = await resolveQueryForSearch('CCO');
      expect(result.searchTerm).toBe('ethanol');
      expect(result.structure?.source).toBe('cactus-name');
    });

    it('passes non-structure queries through unchanged without a network call', async () => {
      const result = await resolveQueryForSearch('sulfuric acid');
      expect(result).toEqual({ searchTerm: 'sulfuric acid' });
      expect(global.fetch as Mock).not.toHaveBeenCalled();
    });

    it('honors the smiles: prefix for an otherwise-ambiguous token', async () => {
      mockChemFetch({
        CO: {
          names: 'carbon monoxide',
          cas: '630-08-0',
          stdinchikey: 'UGFAIRIUMAVXCW-UHFFFAOYSA-N',
        },
      });
      const result = await resolveQueryForSearch('smiles:CO');
      expect(result.searchTerm).toBe('carbon monoxide');
    });
  });
});
