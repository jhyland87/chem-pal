// ProductBuilder must be imported before SupplierBase/SupplierLabChem to avoid a module-init cycle.
import { ProductBuilder } from '@/utils/ProductBuilder';
import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from '@/__fixtures__/helpers/chrome/storageMock';
import { clearAllCaches } from '@/utils/idbCache';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import acetonSearch from '../__fixtures__/labchem/aceton-search.json';
import acetonVariations from '../__fixtures__/labchem/aceton-variations.json';
import acetonVariationProduct from '../__fixtures__/labchem/aceton-variation-product.json';
import catalogAllProducts from '../__fixtures__/labchem/catalog-all-products.json';
import { SupplierLabChem } from '../SupplierLabChem';

type LabChemInternals = {
  titleSelector(data: unknown): string;
  initProductBuilders(products: unknown[]): ProductBuilder<Product>[];
  queryProducts(query: string, limit: number): Promise<ProductBuilder<Product>[] | void>;
  getProductData(builder: ProductBuilder<Product>): Promise<ProductBuilder<Product> | void>;
  loadCatalog(): Promise<unknown[]>;
};

const makeSupplier = (query = 'aceton', limit = 5) => new SupplierLabChem(query, limit);

const asInternals = (supplier: SupplierLabChem) => supplier as unknown as LabChemInternals;

/** Routes the detail-phase HTTP calls to fixtures and bypasses the cache wrapper. */
const stubEnrichment = (supplier: SupplierLabChem) => {
  vi.spyOn(supplier as never, 'getProductDataWithCache').mockImplementation((async (
    builder: ProductBuilder<Product>,
    fetcher: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>,
  ) => fetcher(builder)) as never);
  vi.spyOn(supplier as never, 'httpGetJson').mockImplementation((async ({
    path,
  }: {
    path: string;
  }) => {
    if (path.includes('/variations')) return acetonVariations;
    return acetonVariationProduct;
  }) as never);
};

describe('SupplierLabChem', () => {
  beforeAll(() => {
    setupChromeStorageMock();
  });

  beforeEach(async () => {
    // restoreAllMocks strips the storage-mock vi.fn() implementations, so re-wire
    // the storage mock afterwards before clearing its backing maps.
    vi.restoreAllMocks();
    setupChromeStorageMock();
    resetChromeStorageMock();
    await clearAllCaches();
    global.fetch = vi.fn().mockImplementation(() => {
      throw new Error('Fetch not mocked');
    });
  });

  describe('initProductBuilders', () => {
    it('parses CAS, formula, molar mass and basic info from the catalog description', () => {
      const supplier = makeSupplier();
      const [aceton, acetonitril] = asInternals(supplier).initProductBuilders(
        acetonSearch.products,
      );

      const acetonDump = aceton.dump();
      expect(acetonDump.title).toBe('Aceton reinst - LabChem Röttinger');
      // The "Summenformel" (Hill) row is preferred over "Chem. Formel" (CH3COCH3).
      expect(acetonDump.formula).toBe('C3H6O');
      expect(acetonDump.moleweight).toBe(58.08);
      expect(acetonDump.sku).toBe('011700');
      expect(acetonDump.url).toContain('aceton-reinst');

      // The Acetonitril row carries a checksum-valid CAS (the Aceton fixture's
      // "67-41-1" is intentionally left un-asserted — its checksum is invalid, so
      // findCAS correctly drops it).
      const acetonitrilDump = acetonitril.dump();
      expect(acetonitrilDump.cas).toBe('75-05-8');
      expect(acetonitrilDump.moleweight).toBe(41.05);
      // Summenformel uses unicode subscripts (C₂H₃N) — assert the atoms survive.
      expect(acetonitrilDump.formula).toMatch(/C.?H.?N/);
    });
  });

  describe('queryProducts', () => {
    it('keeps catalog titles matching the query as a substring', async () => {
      const supplier = makeSupplier('aceton', 5);
      vi.spyOn(supplier as never, 'loadCatalog').mockResolvedValue(acetonSearch.products as never);

      const builders = await asInternals(supplier).queryProducts('aceton', 5);
      expect(builders).toBeDefined();
      // Both "Aceton reinst" and "Acetonitril reinst" contain "aceton"; order preserved.
      expect(builders?.length).toBe(2);
      expect(builders?.[0].dump().title).toMatch(/^Aceton reinst/);
    });

    it('matches a partial term and excludes unrelated products (no fuzzy noise)', async () => {
      const supplier = makeSupplier('acet', 5);
      const catalog = [
        acetonSearch.products[0], // "Aceton reinst ..."
        { productId: 'n1', name: 'Saponin', title: 'Saponin - LabChem Röttinger', links: [] },
        { productId: 'n2', name: 'Pepsin', title: 'Pepsin - LabChem Röttinger', links: [] },
      ];
      vi.spyOn(supplier as never, 'loadCatalog').mockResolvedValue(catalog as never);

      const builders = await asInternals(supplier).queryProducts('acet', 5);
      expect(builders?.length).toBe(1);
      expect(builders?.[0].dump().title).toMatch(/^Aceton reinst/);
    });

    it('ranks the closest match first, regardless of catalog order', async () => {
      const supplier = makeSupplier('acet', 5);
      // "Aceton reinst" is deliberately not first in the catalog — fuzzy ranking should
      // still surface it above the mid-word "…acetat" matches.
      const catalog = [
        {
          productId: 'e',
          name: 'Ethylacetat',
          title: 'Ethylacetat reinst - LabChem Röttinger',
          slug: 'ethylacetat',
          links: [],
        },
        acetonSearch.products[0], // "Aceton reinst ..."
        {
          productId: 'b',
          name: 'n-Butylacetat',
          title: 'n-Butylacetat (Essigsäure-n-Butylester) reinst - LabChem Röttinger',
          slug: 'n-butylacetat',
          links: [],
        },
      ];
      vi.spyOn(supplier as never, 'loadCatalog').mockResolvedValue(catalog as never);

      const builders = await asInternals(supplier).queryProducts('acet', 5);
      expect(builders?.length).toBe(3);
      expect(builders?.[0].dump().title).toMatch(/^Aceton reinst/);
    });

    it('respects MAX_CANDIDATES over a large limit', async () => {
      const supplier = makeSupplier('labchem', 50);
      vi.spyOn(supplier as never, 'loadCatalog').mockResolvedValue(
        catalogAllProducts.products as never,
      );

      // Every catalog title contains "LabChem", so the cap (not the match count) applies.
      const builders = await asInternals(supplier).queryProducts('labchem', 50);
      expect(builders?.length).toBe(10);
    });
  });

  describe('loadCatalog', () => {
    it('fetches on a cache miss then serves the second call from cache', async () => {
      const supplier = makeSupplier();
      // Trim the response so only page 1 is fetched (total <= RESULTS_PER_PAGE).
      const trimmed = {
        products: catalogAllProducts.products.slice(0, 3),
        totalNumberOfProducts: 3,
      };
      const postSpy = vi
        .spyOn(supplier as never, 'httpPostJson')
        .mockResolvedValue(trimmed as never);

      const first = await asInternals(supplier).loadCatalog();
      const second = await asInternals(supplier).loadCatalog();

      expect(first.length).toBe(3);
      expect(second.length).toBe(3);
      expect(postSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProductData', () => {
    it('enriches with price, quantity, permalink, images and variants from the variation pages', async () => {
      const supplier = makeSupplier();
      const [builder] = asInternals(supplier).initProductBuilders([acetonSearch.products[0]]);
      stubEnrichment(supplier);

      const result = await asInternals(supplier).getProductData(builder);
      expect(result).toBe(builder);

      const dump = builder.dump() as Partial<Product> & {
        variants?: Variant[];
        images?: unknown[];
      };
      expect(dump.price).toBe(14.16);
      expect(dump.currencyCode).toBe('EUR');
      expect(dump.permalink).toBe(acetonVariationProduct.sfUrl);
      // 4 variation items -> cheapest is the headline, the other 3 become variants.
      expect(dump.variants?.length).toBe(3);
      // Full image + thumbnail from the variation page's classifier set.
      expect(dump.images?.length).toBe(2);
    });

    it('skips a product whose variations are all non-purchasable', async () => {
      const supplier = makeSupplier();
      const [builder] = asInternals(supplier).initProductBuilders([acetonSearch.products[0]]);
      vi.spyOn(supplier as never, 'getProductDataWithCache').mockImplementation((async (
        b: ProductBuilder<Product>,
        fetcher: (x: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>,
      ) => fetcher(b)) as never);
      vi.spyOn(supplier as never, 'httpGetJson').mockImplementation((async () => ({
        results: 0,
        items: [],
      })) as never);

      const result = await asInternals(supplier).getProductData(builder);
      // No price set -> the builder came back without pricing.
      expect(result?.dump().price).toBeUndefined();
    });
  });
});
