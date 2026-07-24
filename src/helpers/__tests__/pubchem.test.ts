import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from '@/__fixtures__/helpers/chrome/storageMock';
import {
  getCidByFormula,
  getCidByName,
  getCidsByCas,
  getCompoundDescription,
  getCompoundProperties,
  getRankedNamesByName,
  getSynonymsByCid,
  isSimpleName,
  pubchemCasSearchUrl,
  pubchemCompoundUrl,
  pubchemStructureImageUrl,
  resolveIdentifierNames,
  suggestAlternativeSearch,
} from '@/helpers/pubchem';
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
import { ACETONE, ASPIRIN } from './fixtures/chemicals';

/** Builds a minimal ok `Response` whose `json()` resolves to `body`. */
function jsonOk(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}

/** Builds a minimal non-ok `Response` (e.g. a 404 for an unknown identifier). */
function notOk(): Response {
  return { ok: false, json: () => Promise.resolve({}) } as unknown as Response;
}

function mockSynonymsFetch(synonyms?: string[]): void {
  (global.fetch as Mock).mockImplementation(() =>
    Promise.resolve({
      ok: synonyms !== undefined,
      json: () =>
        Promise.resolve(
          synonyms === undefined
            ? {}
            : { InformationList: { Information: [{ Synonym: synonyms }] } },
        ),
    } as unknown as Response),
  );
}

describe('PubChem Helpers', () => {
  // The PubChem network helpers are wrapped in a chrome.storage-backed cache, so every suite needs
  // a fresh storage mock. resetChromeStorageMock (clearAllMocks) preserves the fetch mock impl.
  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(() => {
    resetChromeStorageMock();
  });

  describe('isSimpleName', () => {
    test.each([
      ['acetone', true],
      ['aspirin', true],
      ['sulfuric acid', true],
      ['2-acetyloxybenzoic acid', false],
      ['propan-2-one', false],
      ['NSC 7896', false],
      ['a', false],
      ['this is an extremely long technical chemical name', false],
    ])('should return %s for: %s', (input, output) => expect(isSimpleName(input)).toBe(output));
  });

  describe('getCidByFormula', () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });
    afterEach(() => {
      (global.fetch as Mock).mockReset();
    });

    it('returns the first CID from a fastformula search', async () => {
      (global.fetch as Mock).mockResolvedValue(jsonOk({ IdentifierList: { CID: [24968] } }));
      expect(await getCidByFormula('Na6O18P6')).toBe(24968);
      expect((global.fetch as Mock).mock.calls[0][0]).toContain('/fastformula/Na6O18P6/');
    });

    it('returns undefined when the formula has no match', async () => {
      (global.fetch as Mock).mockResolvedValue(notOk());
      expect(await getCidByFormula('Zz9')).toBeUndefined();
    });

    it('normalizes subscript digits to ASCII before querying', async () => {
      (global.fetch as Mock).mockResolvedValue(jsonOk({ IdentifierList: { CID: [24968] } }));
      expect(await getCidByFormula('Na₆O₁₈P₆')).toBe(24968);
      expect((global.fetch as Mock).mock.calls[0][0]).toContain('/fastformula/Na6O18P6/');
    });
  });

  describe('resolveIdentifierNames', () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });
    afterEach(() => {
      (global.fetch as Mock).mockReset();
    });

    // Route each PubChem endpoint by URL so the parallel property/synonym fetches don't
    // depend on call order. Mirrors the real CID 24968 (sodium hexametaphosphate).
    const mockCompound = (title: string, synonyms: string[]) =>
      (global.fetch as Mock).mockImplementation((url: string) => {
        if (url.includes('/cids/')) {
          return Promise.resolve(jsonOk({ IdentifierList: { CID: [24968] } }));
        }
        if (url.includes('/property/')) {
          return Promise.resolve(
            jsonOk({ PropertyTable: { Properties: [{ CID: 24968, Title: title }] } }),
          );
        }
        if (url.includes('/synonyms/')) {
          return Promise.resolve(
            jsonOk({ InformationList: { Information: [{ Synonym: synonyms }] } }),
          );
        }
        return Promise.resolve(notOk());
      });

    // Title leads; a brand synonym is kept; a registry code (no lowercase) is dropped; a
    // parenthetical formula suffix is stripped (recovering the clean common name).
    const SYNONYMS = [
      'Hexasodium hexametaphosphate',
      'Calgon S',
      'EINECS 233-343-1',
      'N40N91DW96',
      'Sodium hexametaphosphate (Na6P6O18)',
    ];

    it('resolves a CAS to ranked, cleaned name candidates, echoing the CAS', async () => {
      mockCompound('Hexasodium hexametaphosphate', SYNONYMS);
      expect(await resolveIdentifierNames('10124-56-8', 'cas')).toEqual({
        names: ['Hexasodium hexametaphosphate', 'Calgon S', 'Sodium hexametaphosphate'],
        cas: ['10124-56-8'],
      });
    });

    it('resolves a formula to name candidates (no CAS)', async () => {
      mockCompound('Hexasodium hexametaphosphate', SYNONYMS);
      expect(await resolveIdentifierNames('Na6O18P6', 'formula')).toEqual({
        names: ['Hexasodium hexametaphosphate', 'Calgon S', 'Sodium hexametaphosphate'],
      });
    });

    it('falls back to just the Title when there are no usable synonyms', async () => {
      mockCompound('Hexasodium hexametaphosphate', ['EINECS 233-343-1', 'UNII-N40N91DW96']);
      expect(await resolveIdentifierNames('Na6O18P6', 'formula')).toEqual({
        names: ['Hexasodium hexametaphosphate'],
      });
    });

    it('returns undefined when the identifier does not resolve', async () => {
      (global.fetch as Mock).mockResolvedValue(notOk());
      expect(await resolveIdentifierNames('Zz9', 'formula')).toBeUndefined();
    });
  });

  describe('getRankedNamesByName', () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });

    afterEach(() => {
      (global.fetch as Mock).mockReset();
    });

    it('returns the ranked synonym list when found', async () => {
      mockSynonymsFetch(ACETONE.rankedSynonyms());
      const result = await getRankedNamesByName(ACETONE.name);
      expect(result).toEqual(ACETONE.rankedSynonyms());
    });

    it('returns undefined on a 404 (unknown name)', async () => {
      mockSynonymsFetch(undefined);
      const result = await getRankedNamesByName('zzqqxxnotathing');
      expect(result).toBeUndefined();
    });
  });

  describe('suggestAlternativeSearch', () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });

    beforeEach(() => {
      mockSynonymsFetch(ACETONE.rankedSynonyms());
    });

    afterEach(() => {
      (global.fetch as Mock).mockReset();
    });

    it('suggests the most popular simple name for a technical query', async () => {
      const result = await suggestAlternativeSearch('2-propanone', new Set(['2-propanone']));
      expect(result.name).toBe(ACETONE.name);
      expect(result.cas).toBe(ACETONE.cas);
    });

    it('does not suggest obscure deep-ranked synonyms; offers the CAS instead', async () => {
      // "acetone" (the popular name) already failed, so it is excluded. The deepest alias is a
      // perfectly simple name, yet it sits outside the popularity window and must NOT be
      // suggested — proving the window (not isSimpleName) is what filters it out.
      expect(isSimpleName(ACETONE.leastCommonName())).toBe(true);
      const result = await suggestAlternativeSearch(ACETONE.name, new Set([ACETONE.name]));
      expect(result.name).toBeUndefined();
      expect(result.cas).toBe(ACETONE.cas);
    });

    it('never re-suggests a name that previously yielded no results (no A→B→A loop)', async () => {
      const result = await suggestAlternativeSearch(
        '2-propanone',
        new Set(['2-propanone', ACETONE.name]),
      );
      expect(result.name).not.toBe(ACETONE.name);
    });

    it('lowercases an all-caps common name for display', async () => {
      // Aspirin's #2 synonym is the all-caps "ACETYLSALICYLIC ACID"; when "aspirin" itself is
      // excluded it should be suggested, but tidied to lowercase.
      mockSynonymsFetch(ASPIRIN.rankedSynonyms());
      const result = await suggestAlternativeSearch(ASPIRIN.name, new Set([ASPIRIN.name]));
      expect(result.name).toBe('acetylsalicylic acid');
      expect(result.cas).toBe(ASPIRIN.cas);
    });

    it('returns no name when only complicated names remain, but offers the CAS', async () => {
      // A response of nothing but the CAS and technical (non-simple) names.
      mockSynonymsFetch([ACETONE.cas, ...ACETONE.complicatedNames()]);
      const result = await suggestAlternativeSearch(ACETONE.name, new Set([ACETONE.name]));
      expect(result.name).toBeUndefined();
      expect(result.cas).toBe(ACETONE.cas);
    });

    it('returns an empty object when PubChem has no match', async () => {
      mockSynonymsFetch(undefined);
      const result = await suggestAlternativeSearch('zzqqxxnotathing', new Set());
      expect(result).toEqual({});
    });
  });

  describe('PUG-REST methods', () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });

    afterEach(() => {
      (global.fetch as Mock).mockReset();
    });

    describe('getCidsByCas', () => {
      it('requests the xref/rn endpoint and returns the CID list', async () => {
        (global.fetch as Mock).mockResolvedValue(
          jsonOk({ IdentifierList: { CID: [4311764, 22959485, 23673181] } }),
        );
        const result = await getCidsByCas('15681-89-7' as CAS<string>);
        expect(result).toEqual([4311764, 22959485, 23673181]);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/xref/rn/15681-89-7/cids/JSON',
        );
      });

      it('returns undefined for an unknown CAS (non-ok response)', async () => {
        (global.fetch as Mock).mockResolvedValue(notOk());
        const result = await getCidsByCas('50-00-0' as CAS<string>);
        expect(result).toBeUndefined();
      });

      it('returns undefined when the CID list is empty', async () => {
        (global.fetch as Mock).mockResolvedValue(jsonOk({ IdentifierList: { CID: [] } }));
        const result = await getCidsByCas('67-64-1' as CAS<string>);
        expect(result).toBeUndefined();
      });

      it('serves a repeat lookup from cache without a second fetch', async () => {
        (global.fetch as Mock).mockResolvedValueOnce(jsonOk({ IdentifierList: { CID: [180] } }));
        const first = await getCidsByCas('67-64-1' as CAS<string>);
        const second = await getCidsByCas('67-64-1' as CAS<string>);
        expect(first).toEqual([180]);
        expect(second).toEqual([180]);
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });

    describe('getCidByName', () => {
      it('requests the name/cids endpoint and returns the first CID', async () => {
        (global.fetch as Mock).mockResolvedValue(jsonOk({ IdentifierList: { CID: [2244, 999] } }));
        const result = await getCidByName('aspirin');
        expect(result).toBe(2244);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/cids/JSON',
        );
      });

      it('returns undefined for an unknown name', async () => {
        (global.fetch as Mock).mockResolvedValue(notOk());
        const result = await getCidByName('zzqqxxnotathing');
        expect(result).toBeUndefined();
      });
    });

    describe('getCompoundProperties', () => {
      it('requests the property endpoint and maps the first record', async () => {
        (global.fetch as Mock).mockResolvedValue(
          jsonOk({
            PropertyTable: {
              Properties: [
                {
                  CID: 180,
                  MolecularFormula: 'C3H6O',
                  MolecularWeight: '58.08',
                  IUPACName: 'propan-2-one',
                  SMILES: 'CC(C)=O',
                  InChI: 'InChI=1S/C3H6O/c1-3(2)4/h1-2H3',
                  InChIKey: 'CSCPPACGZOOCGX-UHFFFAOYSA-N',
                  Title: 'Acetone',
                },
              ],
            },
          }),
        );
        const result = await getCompoundProperties(180 as PubChemCID);
        expect(result).toEqual({
          cid: 180,
          molecularFormula: 'C3H6O',
          molecularWeight: '58.08',
          iupacName: 'propan-2-one',
          smiles: 'CC(C)=O',
          inchi: 'InChI=1S/C3H6O/c1-3(2)4/h1-2H3',
          inchiKey: 'CSCPPACGZOOCGX-UHFFFAOYSA-N',
          title: 'Acetone',
        });
        expect(global.fetch).toHaveBeenCalledWith(
          'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/180/property/MolecularFormula,MolecularWeight,IUPACName,SMILES,InChI,InChIKey,Title/JSON',
        );
      });

      it('normalizes a numeric MolecularWeight to a string', async () => {
        (global.fetch as Mock).mockResolvedValue(
          jsonOk({ PropertyTable: { Properties: [{ CID: 180, MolecularWeight: 58.08 }] } }),
        );
        const result = await getCompoundProperties(180 as PubChemCID);
        expect(result?.molecularWeight).toBe('58.08');
      });

      it('returns undefined for a non-ok response', async () => {
        (global.fetch as Mock).mockResolvedValue(notOk());
        const result = await getCompoundProperties(0 as PubChemCID);
        expect(result).toBeUndefined();
      });
    });

    describe('getSynonymsByCid', () => {
      it('requests the synonyms endpoint and returns the list', async () => {
        (global.fetch as Mock).mockResolvedValue(
          jsonOk({ InformationList: { Information: [{ Synonym: ['acetone', '67-64-1'] }] } }),
        );
        const result = await getSynonymsByCid(180 as PubChemCID);
        expect(result).toEqual(['acetone', '67-64-1']);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/180/synonyms/JSON',
        );
      });

      it('returns undefined for a non-ok response', async () => {
        (global.fetch as Mock).mockResolvedValue(notOk());
        const result = await getSynonymsByCid(0 as PubChemCID);
        expect(result).toBeUndefined();
      });
    });

    describe('getCompoundDescription', () => {
      it('merges description fields across entries', async () => {
        (global.fetch as Mock).mockResolvedValue(
          jsonOk({
            InformationList: {
              Information: [
                { CID: 180, Title: 'Acetone' },
                {
                  CID: 180,
                  Description: 'Acetone is a manufactured chemical.',
                  DescriptionSourceName: 'NCI Thesaurus',
                  DescriptionURL: 'https://example.org/acetone',
                },
              ],
            },
          }),
        );
        const result = await getCompoundDescription(180 as PubChemCID);
        expect(result).toEqual({
          title: 'Acetone',
          description: 'Acetone is a manufactured chemical.',
          source: 'NCI Thesaurus',
          url: 'https://example.org/acetone',
        });
        expect(global.fetch).toHaveBeenCalledWith(
          'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/180/description/JSON',
        );
      });

      it('returns undefined when no description text is present', async () => {
        (global.fetch as Mock).mockResolvedValue(
          jsonOk({ InformationList: { Information: [{ CID: 180, Title: 'Acetone' }] } }),
        );
        const result = await getCompoundDescription(180 as PubChemCID);
        expect(result).toBeUndefined();
      });
    });

    describe('URL builders', () => {
      it('builds a compound page URL', () => {
        expect(pubchemCompoundUrl(180 as PubChemCID)).toBe(
          'https://pubchem.ncbi.nlm.nih.gov/compound/180',
        );
      });

      it('builds a CAS search URL', () => {
        expect(pubchemCasSearchUrl('67-64-1')).toBe(
          'https://pubchem.ncbi.nlm.nih.gov/#query=67-64-1',
        );
      });

      it('builds a structure-image URL', () => {
        expect(pubchemStructureImageUrl(180 as PubChemCID)).toBe(
          'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/180/PNG',
        );
      });
    });
  });
});
