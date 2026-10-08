// ProductBuilder must be imported before SupplierBase/SupplierLabStuff (module-init cycle).
import { ProductBuilder } from '@/utils/ProductBuilder';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierLabStuff } from '../SupplierLabStuff';

const mockLocalizedNames = vi.hoisted(() => vi.fn());
vi.mock('@/helpers/wikidata', () => ({ getLocalizedNames: mockLocalizedNames }));

const fixture = (name: string): string =>
  readFileSync(resolve(__dirname, '../__fixtures__/labstuff', name), 'utf8');

const BENZANILIDE_HTML = fixture('search-benzanilide.html');
const ACETON_HTML = fixture('search-aceton.html');
const ZOUTZUUR_PAGE_HTML = fixture('category-d162_02-P5274.html');

interface Row {
  id: string;
  title: string;
  price: number;
  stock?: number;
  category: string;
  manufacturer?: string;
}

interface ProductPage {
  price?: number;
  description?: string;
  text: string;
  sku?: string;
  options: Array<{ id: string; label: string; surcharge: number; sku?: string }>;
}

interface LabStuffInternals {
  parseSearchRows(html: string): Row[];
  isChemicalCategory(category: string): boolean;
  pickDepartment(value: unknown): { dept: number; page?: string } | undefined;
  parsePageMap(text: string): Record<string, unknown> | undefined;
  getProductUrl(id: string, title: string): Promise<string>;
  buildSearchTerms(query: string): Promise<string[]>;
  parseProductPage(html: string, id: string): ProductPage | undefined;
  getProductData(product: ProductBuilder<Product>): Promise<ProductBuilder<Product> | void>;
  queryProducts(query: string, limit?: number): Promise<ProductBuilder<Product>[] | void>;
}

/** Builds a supplier whose page-map requests are served from the fixtures. */
function makeSupplier(query = 'benzanilide') {
  const supplier = new SupplierLabStuff(query, 5, new AbortController());
  const files: Record<string, string> = {
    'prmap_2.js': fixture('prmap_2.js'),
    'pgmap_0.js': fixture('pgmap_0.js'),
  };
  vi.spyOn(supplier as never, 'httpGet').mockImplementation((async ({ path }: { path: string }) => {
    const body = files[path.split('/').pop() ?? ''];
    return body === undefined ? undefined : { ok: true, text: async () => body };
  }) as never);
  return { supplier, internals: supplier as unknown as LabStuffInternals };
}

beforeEach(() => {
  mockLocalizedNames.mockReset();
  mockLocalizedNames.mockResolvedValue([]);
});

describe('SupplierLabStuff.parseSearchRows', () => {
  it('joins title, VAT-inclusive price, stock and category for a single hit', () => {
    const { internals } = makeSupplier();
    expect(internals.parseSearchRows(BENZANILIDE_HTML)).toEqual([
      {
        id: 'P5876',
        title: 'Benzanilide, 50 gram',
        price: 28.86,
        stock: 100,
        category: 'Chemicalien|Chemicalien A-B|',
        manufacturer: undefined,
      },
    ]);
  });

  it('parses every product of a mixed-category response', () => {
    const { internals } = makeSupplier('aceton');
    const rows = internals.parseSearchRows(ACETON_HTML);
    expect(rows).toHaveLength(12);
    expect(rows.find((row) => row.id === 'P1571')?.manufacturer).toBe('Orphifarma');
  });

  it('keeps only chemical-category rows after filtering', () => {
    const { internals } = makeSupplier('aceton');
    const kept = internals
      .parseSearchRows(ACETON_HTML)
      .filter((row) => internals.isChemicalCategory(row.category));
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(12);
    expect(kept.every((row) => row.category.startsWith('Chemicalien|'))).toBe(true);
  });
});

describe('SupplierLabStuff.isChemicalCategory', () => {
  it.each([
    ['Chemicalien|Chemicalien A-B|', true],
    ['Chemicalien|Microcopie Chemicalien|', true],
    ['Flessen, Potten|', false],
    ['Zeep, Kaarsen en Cosmetica|Cosmetica|Cosmetische grondstoffen|', false],
    ['', false],
  ])('%j -> %s', (category, expected) => {
    const { internals } = makeSupplier();
    expect(internals.isChemicalCategory(category)).toBe(expected);
  });
});

describe('SupplierLabStuff.pickDepartment', () => {
  it.each([
    [122, { dept: 122, page: undefined }],
    ['215_03', { dept: 215, page: '03' }],
    [[153, '118_01'], { dept: 153, page: undefined }],
    [[153, '215_01'], { dept: 215, page: '01' }],
    ['-36_02', undefined],
    [undefined, undefined],
    [{}, undefined],
  ])('%j', (value, expected) => {
    const { internals } = makeSupplier();
    expect(internals.pickDepartment(value)).toEqual(expected);
  });
});

describe('SupplierLabStuff.parsePageMap', () => {
  it('parses a JS object literal with bare numeric keys', () => {
    const { internals } = makeSupplier();
    expect(internals.parsePageMap('{4001:122,4014:"122_01",4032:[153,"118_01"]}')).toEqual({
      '4001': 122,
      '4014': '122_01',
      '4032': [153, '118_01'],
    });
  });

  it.each(['', 'not json', '[1,2]'])('returns undefined for %j', (text) => {
    const { internals } = makeSupplier();
    expect(internals.parsePageMap(text)).toBeUndefined();
  });
});

describe('SupplierLabStuff.getProductUrl', () => {
  it('rebuilds the page the site links to (department, slug, page, anchor)', async () => {
    const { internals } = makeSupplier();
    expect(await internals.getProductUrl('P5876', 'Benzanilide, 50 gram')).toBe(
      'https://www.labstuff.nl/contents/nl/d215_Chemicalien-A-B_03.html#p5876',
    );
  });

  it('falls back to a site search when the product is not in the map', async () => {
    const { internals } = makeSupplier();
    expect(await internals.getProductUrl('P1', 'Zoutzuur')).toBe(
      'https://www.labstuff.nl/contents/nl/search.php?searchphrase=Zoutzuur',
    );
  });

  it('falls back when the lookup file is unavailable', async () => {
    const { supplier, internals } = makeSupplier();
    vi.spyOn(supplier as never, 'httpGet').mockResolvedValue(undefined as never);
    expect(await internals.getProductUrl('P5876', 'Benzanilide, 50 gram')).toContain('search.php');
  });
});

describe('SupplierLabStuff.buildSearchTerms', () => {
  it.each([
    ['7647-01-0', ['zoutzuur'], ['zoutzuur', '7647-01-0']],
    ['hydrochloric acid', ['zoutzuur'], ['zoutzuur', 'hydrochloric acid']],
    ['benzanilide', ['Benzanilide'], ['Benzanilide']],
    ['unknownium', [], ['unknownium']],
  ])('%s with Dutch %j -> %j', async (query, dutch, expected) => {
    mockLocalizedNames.mockResolvedValue(dutch);
    const { internals } = makeSupplier(query);
    expect(await internals.buildSearchTerms(query)).toEqual(expected);
  });
});

describe('SupplierLabStuff.queryProducts', () => {
  it('returns a priced, linked, in-stock product from one search request', async () => {
    const { supplier, internals } = makeSupplier();
    const get = vi
      .spyOn(supplier as never, 'httpGetHtml')
      .mockResolvedValue(BENZANILIDE_HTML as never);

    const builders = await internals.queryProducts('benzanilide', 5);

    expect(get).toHaveBeenCalledTimes(1);
    expect(builders).toHaveLength(1);
    const product = builders?.[0].dump();
    expect(product).toMatchObject({
      id: 'P5876',
      title: 'Benzanilide, 50 gram',
      price: 28.86,
      currencyCode: 'EUR',
      quantity: 50,
      uom: 'g',
      url: 'https://www.labstuff.nl/contents/nl/d215_Chemicalien-A-B_03.html#p5876',
      availability: 'in_stock',
    });
  });

  it('merges the Dutch-name and CAS searches by product id', async () => {
    mockLocalizedNames.mockResolvedValue(['Benzanilide']);
    const { supplier, internals } = makeSupplier('93-98-1');
    const get = vi
      .spyOn(supplier as never, 'httpGetHtml')
      .mockResolvedValue(BENZANILIDE_HTML as never);

    const builders = await internals.queryProducts('93-98-1', 5);

    expect(get).toHaveBeenCalledTimes(2);
    expect(builders).toHaveLength(1);
  });

  it('returns undefined when no search request succeeds', async () => {
    const { supplier, internals } = makeSupplier();
    vi.spyOn(supplier as never, 'httpGetHtml').mockResolvedValue(undefined as never);
    expect(await internals.queryProducts('benzanilide', 5)).toBeUndefined();
  });
});

describe('SupplierBase extra query candidates (via LabStuff)', () => {
  it('adds the Dutch names as match candidates alongside the query', async () => {
    mockLocalizedNames.mockResolvedValue(['zoutzuur']);
    const { supplier, internals } = makeSupplier('hydrochloric acid');
    await internals.buildSearchTerms('hydrochloric acid');
    const candidates = (
      supplier as unknown as { effectiveQueryCandidates(): string[] }
    ).effectiveQueryCandidates();
    expect(candidates).toEqual(['hydrochloric acid', 'zoutzuur']);
  });
});

describe('SupplierLabStuff.parseProductPage', () => {
  it('reads the current price, sku, description and size options of a product', () => {
    const { internals } = makeSupplier('zoutzuur');
    const page = internals.parseProductPage(ZOUTZUUR_PAGE_HTML, 'P5274');
    expect(page).toMatchObject({
      price: 22.45,
      sku: '4328.1',
      description: expect.stringContaining('Wordt niet verstuurd'),
    });
    expect(page?.options).toHaveLength(9);
    expect(page?.options[0]).toEqual({
      id: 'P5274O1C4',
      label: '5%, 1 Liter',
      surcharge: 0,
      sku: '4328.1',
    });
    expect(page?.options[1]).toMatchObject({ label: '10%, 2.5 Liter', surcharge: 8.23 });
  });

  it('returns undefined when the product is not on the page', () => {
    const { internals } = makeSupplier('zoutzuur');
    expect(internals.parseProductPage(ZOUTZUUR_PAGE_HTML, 'P1')).toBeUndefined();
  });
});

describe('SupplierLabStuff.getProductData', () => {
  /** Runs the detail phase for a search-phase builder, serving the category page from the fixture. */
  async function detail(builder: ProductBuilder<Product>, html: string | undefined) {
    const { supplier, internals } = makeSupplier('zoutzuur');
    vi.spyOn(supplier as never, 'httpGetHtml').mockResolvedValue(html as never);
    vi.spyOn(supplier as never, 'getProductDataWithCache').mockImplementation(((
      product: ProductBuilder<Product>,
      fetcher: (b: ProductBuilder<Product>) => Promise<unknown>,
    ) => fetcher(product)) as never);
    return (await internals.getProductData(builder))?.dump();
  }

  const searchBuilder = () =>
    new ProductBuilder<Product>('https://www.labstuff.nl')
      .setBasicInfo(
        'Zoutzuur',
        'https://www.labstuff.nl/contents/nl/d162_02.html#p5274',
        'LabStuff',
      )
      .setID('P5274')
      .setPricing(22.02, 'EUR', '€');

  it('replaces the stale search price and turns the size options into variants', async () => {
    const product = await detail(searchBuilder(), ZOUTZUUR_PAGE_HTML);

    expect(product).toMatchObject({ price: 22.45, quantity: 1, uom: 'l', sku: '4328.1' });
    expect(product?.variants).toHaveLength(8);
    // The surcharge is ex-VAT, so 10%, 2.5 Liter is 22.45 + 8.23 * 1.21.
    expect(product?.variants?.[0]).toMatchObject({
      title: '10%, 2.5 Liter',
      price: 32.41,
      quantity: 2.5,
    });
  });

  it('keeps the search data and defaults to one each when the page is unavailable', async () => {
    const product = await detail(searchBuilder(), undefined);
    expect(product).toMatchObject({ price: 22.02, quantity: 1, uom: 'ea' });
  });
});
