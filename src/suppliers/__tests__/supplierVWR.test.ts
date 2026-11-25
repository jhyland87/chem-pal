// ProductBuilder must be imported before SupplierBase/SupplierVWR to avoid a module-init cycle.
import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from '@/__fixtures__/helpers/chrome/storageMock';
import { PRODUCT_REFRESH_STATUS } from '@/constants/common';
import { HttpError } from '@/helpers/exceptions';
import { collectNativePrices } from '@/helpers/priceAlerts';
import { toProductRef } from '@/helpers/productRef';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import stockFixture from '../__fixtures__/vwr/getAnonymousStockAvailability.json';
import assetsFixture from '../__fixtures__/vwr/product-assetreferences.json';
import ordertableFixture from '../__fixtures__/vwr/product-ordertable.json';
import searchFixture from '../__fixtures__/vwr/product-search-sulfuric-acid.json';
import specificationFixture from '../__fixtures__/vwr/product-specification.json';
import substanceFixture from '../__fixtures__/vwr/product-substance.json';
import byIdSearch from '../__fixtures__/vwr/by-id/search-sodium-chloride.json';
import ordertableUnknown from '../__fixtures__/vwr/by-id/ordertable-unknown.json';
import ordertable4560992 from '../__fixtures__/vwr/by-id/ordertable-4560992.json';
import ordertable4560994 from '../__fixtures__/vwr/by-id/ordertable-4560994.json';
import ordertable7422440 from '../__fixtures__/vwr/by-id/ordertable-7422440.json';
import stock4560992 from '../__fixtures__/vwr/by-id/stock-4560992.json';
import stock4560994 from '../__fixtures__/vwr/by-id/stock-4560994.json';
import stock7422440 from '../__fixtures__/vwr/by-id/stock-7422440.json';
import { SupplierVWR } from '../SupplierVWR';

const CANONICAL_URL = 'https://www.vwr.com/us/en/product/11805968/sulphuric-acid-95-0-98-0-acs';

type VWRInternals = {
  titleSelector(data: unknown): string;
  initProductBuilders(results: unknown[]): ProductBuilder<Product>[];
  getProductData(builder: ProductBuilder<Product>): Promise<ProductBuilder<Product> | void>;
  queryProducts(query: string, limit: number): Promise<ProductBuilder<Product>[] | void>;
  searchQueryParam(query: string): string;
};

const makeSupplier = () => new SupplierVWR('sulfuric acid', 3);

// The first search product (code NA3626344 / baseProduct 11805968) — matches an ordertable row
// whose catalog number (80722-392) appears in the stock fixture.
const firstProduct = () => searchFixture.products[0];

/**
 * Wires up the http + auth spies used by the getProductData enrichment tests. Bypasses the cache
 * layer and routes each endpoint to its fixture.
 */
const stubEnrichment = (supplier: SupplierVWR) => {
  vi.spyOn(supplier as never, 'getProductDataWithCache').mockImplementation((async (
    builder: ProductBuilder<Product>,
    fetcher: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>,
  ) => fetcher(builder)) as never);
  vi.spyOn(supplier as never, 'httpGetJson').mockImplementation((async ({
    path,
  }: {
    path: string;
  }) => {
    if (path.includes('ordertable')) return ordertableFixture;
    if (path.includes('assetreferences')) return assetsFixture;
    if (path.includes('chemical/substance')) return substanceFixture;
    if (path.includes('chemical/specification')) return specificationFixture;
    return undefined;
  }) as never);
  vi.spyOn(supplier as never, 'httpPostJson').mockImplementation((async ({
    path,
  }: {
    path: string;
  }) => {
    if (path.includes('getAnonymousStockAvailability')) return stockFixture;
    if (path.includes('/products/search')) return searchFixture;
    return undefined;
  }) as never);
  // canonicalurlandhref returns a plain-text href via httpGet().text().
  vi.spyOn(supplier as never, 'httpGet').mockImplementation((async () => ({
    text: async () => CANONICAL_URL,
  })) as never);
};

describe('SupplierVWR', () => {
  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(() => {
    resetChromeStorageMock();
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockImplementation(() => {
      throw new Error('Fetch not mocked');
    });
  });

  describe('titleSelector', () => {
    it('returns the product displayName', () => {
      const supplier = makeSupplier() as unknown as VWRInternals;
      expect(supplier.titleSelector(firstProduct())).toBe(firstProduct().displayName);
    });
  });

  describe('searchQueryParam', () => {
    it.each([
      ['7757-83-7', 'cas_number=7757-83-7'], // CAS
      ['Na2SO3', 'chemical_formula_adv=Na2SO3'], // formula
      ['sulfuric acid', 'chemical_name=sulfuric acid'], // name (multi-word)
      ['acetone', 'chemical_name=acetone'], // name (single word)
      ['O=S(=O)(O)O', 'O=S(=O)(O)O'], // SMILES → raw
    ])('routes %s to the right VWR search field', (query, expected) => {
      const supplier = makeSupplier() as unknown as VWRInternals;
      expect(supplier.searchQueryParam(query)).toBe(expected);
    });
  });

  describe('initProductBuilders', () => {
    it('maps search data into builders with a baseProduct-encoded url', () => {
      const supplier = makeSupplier() as unknown as VWRInternals;
      const [builder] = supplier.initProductBuilders([firstProduct()]);
      const dump = builder.dump();

      expect(dump.title).toBe(firstProduct().displayName);
      expect(dump.supplier).toBe('VWR');
      // url is resolved to an absolute URL that encodes the baseProduct id.
      expect(dump.url).toContain('/store/product/11805968/');
      expect(dump.price).toBe(firstProduct().uomSpecificPrices[0].value);
      expect(dump.currencyCode).toBe('USD');
      expect(dump.id).toBe(firstProduct().code);
      expect(dump.sku).toBe(firstProduct().vwrCatalogNumber);
      expect(dump.images?.length).toBeGreaterThan(0);
    });
  });

  describe('queryProducts', () => {
    const searchProduct = (code: string) => ({
      code,
      baseProduct: '1',
      displayName: code,
      uomSpecificPrices: [{ value: 1, currencyIso: 'USD' }],
    });
    const page = (products: unknown[], totalPages: number) => ({
      products,
      pagination: { totalPages },
    });
    // Identity fuzzy filter so these tests isolate pagination/filtering from ranking.
    const stubFuzz = (supplier: SupplierVWR) =>
      vi
        .spyOn(supplier as never, 'fuzzyFilterAst')
        .mockImplementation(((data: unknown[]) => data) as never);
    // Pin the parallel batch size for deterministic request counts.
    const setBatchSize = (supplier: SupplierVWR, size: number) => {
      (supplier as unknown as { maxConcurrentRequests: number }).maxConcurrentRequests = size;
    };
    const ids = (builders: ProductBuilder<Product>[] | void) =>
      (builders as ProductBuilder<Product>[]).map((b) => b.get('id'));

    it('excludes restricted products', async () => {
      const supplier = makeSupplier();
      stubFuzz(supplier);
      setBatchSize(supplier, 1);
      // Single page (totalPages: 1) so pagination stops after the first request.
      vi.spyOn(supplier as never, 'httpPostJson').mockResolvedValue({
        ...searchFixture,
        pagination: { totalPages: 1 },
      } as never);

      const builders = await (supplier as unknown as VWRInternals).queryProducts(
        'sulfuric acid',
        10,
      );

      // Only NA5786168 is non-restricted in the fixture.
      expect(ids(builders)).toEqual(['NA5786168']);
    });

    it('fetches pages in parallel batches until it reaches the limit', async () => {
      const supplier = makeSupplier();
      stubFuzz(supplier);
      setBatchSize(supplier, 2);
      const httpPostJson = vi
        .spyOn(supplier as never, 'httpPostJson')
        .mockImplementation((async ({ params }: { params: { currentPage: number } }) =>
          page(
            [searchProduct(`A${params.currentPage}`), searchProduct(`B${params.currentPage}`)],
            10,
          )) as never);

      const builders = await (supplier as unknown as VWRInternals).queryProducts('acid', 5);

      // 2 pages/batch x 2 survivors/page = 4/batch. Batch 1 -> 4 (<5), batch 2 -> 8 (>=5) -> stop.
      expect((builders as ProductBuilder<Product>[]).length).toBe(5);
      expect(httpPostJson).toHaveBeenCalledTimes(4);
    });

    it('stops after two consecutive empty batches', async () => {
      const supplier = makeSupplier();
      stubFuzz(supplier);
      setBatchSize(supplier, 2);
      const httpPostJson = vi
        .spyOn(supplier as never, 'httpPostJson')
        .mockImplementation((async ({ params }: { params: { currentPage: number } }) =>
          params.currentPage === 0 ? page([searchProduct('A')], 10) : page([], 10)) as never);

      const builders = await (supplier as unknown as VWRInternals).queryProducts('acid', 10);

      // Batch 1 (pages 0,1) -> 1 survivor; batch 2 (2,3) empty (streak 1); batch 3 (4,5) empty (stop).
      expect(ids(builders)).toEqual(['A']);
      expect(httpPostJson).toHaveBeenCalledTimes(6);
    });
  });

  describe('getProductData', () => {
    it('enriches with quantity, tech data, docs, availability and variants', async () => {
      const supplier = makeSupplier();
      stubEnrichment(supplier);

      const [builder] = (supplier as unknown as VWRInternals).initProductBuilders([firstProduct()]);
      const result = await (supplier as unknown as VWRInternals).getProductData(builder);

      expect(result).toBe(builder);
      const dump = builder.dump() as Partial<Product> & { variants?: Variant[] };

      // Quantity/uom parsed from the matched ordertable row's o_size ("2.5 L").
      expect(dump.quantity).toBe(2.5);
      expect(dump.uom).toBeDefined();

      // Tech data from the substance endpoint (MW_value "79.06 g/mol" -> numeric 79.06).
      expect(dump.cas).toBe('1066-33-7');
      expect(dump.formula).toBe('NH₄HCO₃');
      expect(dump.moleweight).toBe(79.06);

      // Purity from the specification endpoint ("> 98 %").
      expect(dump.purity).toBe('>98%');

      // Canonical product URL from the canonicalurlandhref endpoint.
      expect(dump.url).toBe(CANONICAL_URL);
      expect(dump.permalink).toBe(CANONICAL_URL);

      // Documents: SDS (MSDS) + COA (certificate of analysis).
      expect(dump.sdsUrl).toContain('digitalassets.avantorsciences.com');
      expect(dump.coaUrl).toContain('digitalassets.avantorsciences.com');

      // Availability from the batched stock call (catalog 80722-392 -> inStock).
      expect(dump.availability).toBe('in_stock');
      expect(dump.statusTxt).toBe('Usually ships next day');

      // One variant per ordertable row.
      expect(dump.variants?.length).toBe(ordertableFixture.productRows.length);
    });
  });

  describe('coaUrl round-trip through build()', () => {
    it('carries the certificate-of-analysis url onto the built product', async () => {
      const builder = new ProductBuilder<Product>('https://us.vwr.com');
      builder
        .setBasicInfo('Sulfuric acid', '/store/product/11805968/NA3626344', 'VWR')
        .setPricing(335.55, 'USD', '$')
        .setQuantity(2.5, 'L')
        .setCoaUrl('https://us.vwr.com/coa/sulfuric-acid.pdf');

      const product = await builder.build();
      expect(product?.coaUrl).toBe('https://us.vwr.com/coa/sulfuric-acid.pdf');
    });
  });
});

describe('SupplierVWR refreshProducts', () => {
  const byBase: Record<string, { ordertable: unknown; stock: unknown }> = {
    '4560992': { ordertable: ordertable4560992, stock: stock4560992 },
    '4560994': { ordertable: ordertable4560994, stock: stock4560994 },
    '7422440': { ordertable: ordertable7422440, stock: stock7422440 },
  };
  const baseOf = (path: string, params?: { productId?: string }) => params?.productId ?? path;

  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(() => {
    resetChromeStorageMock();
    vi.restoreAllMocks();
  });

  /** Stock replies keyed by the first catalog number in the request body. */
  const stockFor = (body: { catalogNumber: string }[]) =>
    Object.values(byBase).find(({ stock }) =>
      JSON.stringify(stock).includes(`"${body[0].catalogNumber}"`),
    )?.stock;

  /** The product as the search path builds it: listing, then every detail endpoint. */
  async function searchPath(base: string): Promise<Product> {
    const supplier = new SupplierVWR('sodium chloride', 5) as any;
    vi.spyOn(supplier, 'getProductDataWithCache').mockImplementation((b: any, f: any) => f(b));
    vi.spyOn(supplier, 'httpGetJson').mockImplementation(async ({ path, params }: any) =>
      path.includes('ordertable') ? byBase[baseOf(path, params)].ordertable : undefined,
    );
    vi.spyOn(supplier, 'httpPostJson').mockImplementation(async ({ body }: any) => stockFor(body));
    vi.spyOn(supplier, 'httpGet').mockResolvedValue({ text: async () => '' });
    const item = byIdSearch.products.find((p) => p.baseProduct === base);
    const [builder] = supplier.initProductBuilders([item]);
    return supplier.finishProduct(await supplier.getProductData(builder));
  }

  /** Runs the refetch path against the same fixtures and records the calls. */
  async function refetch(product: Product, ordertable?: (base: string) => unknown) {
    const supplier = new SupplierVWR('sodium chloride', 5) as any;
    const httpGet = vi.spyOn(supplier, 'httpGet').mockImplementation(async ({ params }: any) => {
      const body = ordertable ? ordertable(params.productId) : byBase[params.productId].ordertable;
      return new Response(JSON.stringify(body));
    });
    const httpGetJson = vi.spyOn(supplier, 'httpGetJson');
    const httpPostJson = vi
      .spyOn(supplier, 'httpPostJson')
      .mockImplementation(async ({ body }: any) => stockFor(body));
    vi.spyOn(supplier, 'ensureAccessToken').mockResolvedValue(undefined);
    const ref = toProductRef(product);
    if (!ref) throw new Error('no ref');
    const [result] = await supplier.refreshProducts([ref]);
    return { result, httpGet, httpGetJson, httpPostJson };
  }

  it('is enabled for price alerts', () => {
    expect(SupplierVWR.supportsPriceAlerts).toBe(true);
  });

  it.each(['4560992', '4560994', '7422440'])(
    'keeps the same price series, price and size as the search path for %s',
    async (base) => {
      const searched = await searchPath(base);
      const { result, httpGet, httpGetJson, httpPostJson } = await refetch(searched);

      expect(result.status).toBe(PRODUCT_REFRESH_STATUS.OK);
      // One ordertable request and one stock request; no SDS, spec, substance or asset calls.
      expect(httpGet).toHaveBeenCalledTimes(1);
      expect(httpGetJson).not.toHaveBeenCalled();
      expect(httpPostJson).toHaveBeenCalledTimes(1);

      const fresh: Product = result.product;
      expect(Object.keys(collectNativePrices(fresh))).toEqual(
        Object.keys(collectNativePrices(searched)),
      );
      expect(collectNativePrices(fresh)).toEqual(collectNativePrices(searched));
      expect(fresh.price).toBe(searched.price);
      expect(fresh.currencyCode).toBe(searched.currencyCode);
      expect([fresh.quantity, fresh.uom]).toEqual([searched.quantity, searched.uom]);
      expect(fresh.availability).toBe(searched.availability);
      expect(fresh.variants?.length).toBe(searched.variants?.length);
    },
  );

  it('headlines the size of the ref, not the first ordertable row', async () => {
    const searched = await searchPath('7422440');
    const { result } = await refetch(searched);
    expect(result.product.quantity).toBe(10);
    expect(result.product.price).toBe(274.38);
  });

  it('picks up a price change', async () => {
    const searched = await searchPath('4560992');
    const changed = structuredClone(ordertable4560992);
    changed.productRows[0].prices[0].listPrice = 199.99;
    const { result } = await refetch(searched, () => changed);
    expect(result.product.price).toBe(199.99);
  });

  it('reads the base product from the canonical url too', async () => {
    const searched = await searchPath('4560992');
    const canonical = { ...searched, url: 'https://www.vwr.com/us/en/product/4560992/some-slug' };
    const { result, httpGet } = await refetch(canonical);
    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.OK);
    expect((httpGet.mock.calls[0][0] as any).params.productId).toBe('4560992');
  });

  it('reports an unknown product as UNAVAILABLE', async () => {
    const searched = await searchPath('4560992');
    const supplier = new SupplierVWR('sodium chloride', 5) as any;
    vi.spyOn(supplier, 'ensureAccessToken').mockResolvedValue(undefined);
    vi.spyOn(supplier, 'httpGet').mockRejectedValue(
      new HttpError(400, 'Bad Request', JSON.stringify(ordertableUnknown)),
    );
    const ref = toProductRef(searched);
    if (!ref) throw new Error('no ref');
    const [result] = await supplier.refreshProducts([ref]);
    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.UNAVAILABLE);
  });

  it('fails on other HTTP errors', async () => {
    const searched = await searchPath('4560992');
    const supplier = new SupplierVWR('sodium chloride', 5) as any;
    vi.spyOn(supplier, 'ensureAccessToken').mockResolvedValue(undefined);
    vi.spyOn(supplier, 'httpGet').mockRejectedValue(new HttpError(500, 'Server Error', 'oops'));
    const ref = toProductRef(searched);
    if (!ref) throw new Error('no ref');
    const [result] = await supplier.refreshProducts([ref]);
    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.FAILED);
  });

  it.each([
    ['an invalid ordertable', () => ({ nope: true })],
    ['an ordertable with no rows', () => ({ ...ordertable4560992, productRows: [] })],
    [
      'a row with no price',
      () => ({
        ...ordertable4560992,
        productRows: ordertable4560992.productRows.map((row) => ({ ...row, prices: [] })),
      }),
    ],
  ])('fails on %s', async (_name, body) => {
    const searched = await searchPath('4560992');
    const { result } = await refetch(searched, body);
    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.FAILED);
  });
});
