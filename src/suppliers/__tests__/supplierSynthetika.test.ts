// ProductBuilder must be imported before anything that pulls in SupplierBase (module-init cycle).
import { ProductBuilder } from '@/utils/ProductBuilder';
import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from '@/__fixtures__/helpers/chrome/storageMock';
import { PRODUCT_REFRESH_STATUS } from '@/constants/common';
import { collectNativePrices } from '@/helpers/priceAlerts';
import { productSeriesKey, variantSeriesKey } from '@/helpers/priceHistory';
import { toProductRef, type ProductRef } from '@/helpers/productRef';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import eur_to_usd_rate from '../__fixtures__/common/eur-to-usd-rate.json';
import listByIds from '../__fixtures__/synthetika/list-by-ids.json';
import searchCitricAcid from '../__fixtures__/synthetika/search-citric-acid.json';
import { SupplierSynthetika } from '../SupplierSynthetika';

vi.mock('@/helpers/currency', async () => {
  const actual = await vi.importActual<typeof import('@/helpers/currency')>('@/helpers/currency');
  return { ...actual, toUSD: vi.fn(() => Promise.resolve(eur_to_usd_rate)) };
});

beforeAll(() => {
  setupChromeStorageMock();
});

beforeEach(() => {
  resetChromeStorageMock();
});

afterEach(() => vi.restoreAllMocks());

type Internals = {
  queryProducts: (query: string, limit: number) => Promise<ProductBuilder<Product>[] | void>;
  fetchProductDetail: (builder: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
  finishProduct: (builder: ProductBuilder<Product>) => Promise<Product | void>;
};

/** A request to the stubbed API: its path and params. */
type Call = { path: string; params?: Record<string, unknown> };

const listed = listByIds.list;

/**
 * A supplier whose API serves the fixtures: the search, the detail and the list endpoints.
 * @param overrides - Replaces the answer of the list endpoint
 */
const makeSupplier = (overrides?: (ids: string[]) => unknown) => {
  const supplier = new SupplierSynthetika('citric acid', 10);
  vi.spyOn(supplier as never, 'fuzzyFilterAst').mockImplementation((items: unknown) => items);
  const get = vi
    .spyOn(supplier as never, 'httpGetJson')
    .mockImplementation(async (request: unknown) => {
      const { path } = request as Call;
      if (path.includes('/search/')) return searchCitricAcid;
      if (path.includes('/list/')) {
        const ids = path.split('/list/')[1].split(',');
        return (
          overrides?.(ids) ?? {
            count: 0,
            pages: 1,
            page: 1,
            list: listed.filter((item) => ids.includes(String(item.id))),
          }
        );
      }
      return listed.find((item) => path.endsWith(`/${item.id}`)) ?? { error: 'Not Found' };
    });
  return { supplier, internals: supplier as unknown as Internals, get };
};

/** Searches, then fills each result from the detail endpoint, like a search does. */
async function searchProducts(): Promise<Product[]> {
  const { internals } = makeSupplier();
  const builders = (await internals.queryProducts('citric acid', 10)) ?? [];
  const products: Product[] = [];
  for (const builder of builders) {
    const detailed = await internals.fetchProductDetail(builder);
    const product = detailed && (await internals.finishProduct(detailed));
    if (product) products.push(product);
  }
  return products;
}

describe('SupplierSynthetika price alerts', () => {
  it('stores each grouped size product id on the variant uuid', async () => {
    const products = await searchProducts();
    const citric = products.find((product) => product.cacheKey === '824');
    expect(citric?.variants?.map((variant) => variant.uuid)).toEqual(['825', '826', '827']);
    expect(citric?.id).toBe(824);
  });

  it('does not change a variant series key by giving it a uuid', async () => {
    const products = await searchProducts();
    const citric = products.find((product) => product.cacheKey === '824');
    if (!citric?.variants) throw new Error('expected variants');
    const withoutUuid = citric.variants.map((variant) => ({ ...variant, uuid: undefined }));
    expect(citric.variants.map((variant) => variantSeriesKey(citric, variant))).toEqual(
      withoutUuid.map((variant) => variantSeriesKey(citric, variant)),
    );
    expect(variantSeriesKey(citric, citric.variants[0])).toMatch(
      /::Citric Acid Monohydrate - 1000g$/,
    );
  });

  describe('refreshProducts', () => {
    const refs = async (): Promise<ProductRef[]> =>
      (await searchProducts()).flatMap((product) => toProductRef(product) ?? []);

    it('fetches the whole batch, heads and sizes, in one list request', async () => {
      const watched = await refs();
      const { supplier, get } = makeSupplier();
      get.mockClear();

      const results = await supplier.refreshProducts(watched);

      const lists = get.mock.calls.filter(([call]) => (call as Call).path.includes('/list/'));
      expect(lists).toHaveLength(1);
      expect(get).toHaveBeenCalledTimes(1);
      const [call] = lists[0] as [Call];
      expect(call.path.split('/list/')[1].split(',').sort()).toEqual(
        ['824', '825', '826', '827', '8402', '7670'].sort(),
      );
      expect(call.params).toMatchObject({ limit: 50, page: 1 });
      expect(results.map((result) => result.status)).toEqual(
        watched.map(() => PRODUCT_REFRESH_STATUS.OK),
      );
    });

    it('yields the same series, currency, pack size and price as search plus detail', async () => {
      const searched = await searchProducts();
      const watched = searched.flatMap((product) => toProductRef(product) ?? []);
      const { supplier } = makeSupplier();

      const results = await supplier.refreshProducts(watched);

      expect(searched.length).toBe(3);
      for (const result of results) {
        const before = searched.find((product) => product.cacheKey === result.ref.cacheKey);
        if (result.status !== PRODUCT_REFRESH_STATUS.OK || !before) {
          throw new Error(`expected both routes to produce ${result.ref.cacheKey}`);
        }
        const after = result.product;
        expect(productSeriesKey(after)).toBe(productSeriesKey(before));
        expect(Object.keys(collectNativePrices(after))).toEqual(
          Object.keys(collectNativePrices(before)),
        );
        expect(collectNativePrices(after)).toEqual(collectNativePrices(before));
        expect(after).toMatchObject({
          price: before.price,
          currencyCode: before.currencyCode,
          quantity: before.quantity,
          uom: before.uom,
        });
      }
      const citric = results.find((result) => result.ref.cacheKey === '824');
      expect(citric?.status === PRODUCT_REFRESH_STATUS.OK && citric.product.currencyCode).toBe(
        'EUR',
      );
    });

    it('takes the pack size from the options, as the detail page does', async () => {
      const searched = await searchProducts();
      const dichromate = searched.find((product) => product.cacheKey === '7670');
      const { supplier } = makeSupplier();
      const [result] = await supplier.refreshProducts(
        [dichromate].flatMap((product) => (product && toProductRef(product)) || []),
      );
      // The options hold 1000g, 500g and 250g, so the pack size differs from the one in the title.
      expect(dichromate?.quantity).toBeDefined();
      if (result.status !== PRODUCT_REFRESH_STATUS.OK) throw new Error('expected OK');
      expect(result.product).toMatchObject({
        quantity: dichromate?.quantity,
        uom: dichromate?.uom,
      });
    });

    it('leaves out a size the store no longer lists', async () => {
      const watched = (await refs()).filter((ref) => ref.cacheKey === '824');
      const { supplier } = makeSupplier((ids) => ({
        count: 3,
        pages: 1,
        page: 1,
        list: listed.filter((item) => ids.includes(String(item.id)) && item.id !== 826),
      }));

      const [result] = await supplier.refreshProducts(watched);

      expect(result.status).toBe(PRODUCT_REFRESH_STATUS.OK);
      const titles =
        result.status === PRODUCT_REFRESH_STATUS.OK
          ? result.product.variants?.map((variant) => variant.title)
          : [];
      expect(titles).toEqual(['Citric Acid Monohydrate - 1000g', 'Citric Acid Monohydrate - 100g']);
    });

    it('reports a head the store no longer lists as UNAVAILABLE', async () => {
      const watched = (await refs()).filter((ref) => ref.cacheKey === '824');
      const { supplier } = makeSupplier((ids) => ({
        count: 3,
        pages: 1,
        page: 1,
        list: listed.filter((item) => ids.includes(String(item.id)) && item.id !== 824),
      }));

      const [result] = await supplier.refreshProducts(watched);

      expect(result.status).toBe(PRODUCT_REFRESH_STATUS.UNAVAILABLE);
    });

    it('reports a head that is no longer sold as UNAVAILABLE, like search', async () => {
      const watched = (await refs()).filter((ref) => ref.cacheKey === '8402');
      const { supplier } = makeSupplier((ids) => ({
        count: 1,
        pages: 1,
        page: 1,
        list: listed
          .filter((item) => ids.includes(String(item.id)))
          .map((item) => ({ ...item, can_buy: false })),
      }));

      const [result] = await supplier.refreshProducts(watched);

      expect(result.status).toBe(PRODUCT_REFRESH_STATUS.UNAVAILABLE);
    });

    it('fails the product, not the batch, when its head is malformed', async () => {
      const watched = await refs();
      const { supplier } = makeSupplier((ids) => ({
        count: 2,
        pages: 1,
        page: 1,
        list: listed
          .filter((item) => ids.includes(String(item.id)))
          .map((item) => (item.id === 8402 ? { id: 8402, name: 'broken' } : item)),
      }));

      const results = await supplier.refreshProducts(watched);

      expect(
        Object.fromEntries(results.map((result) => [result.ref.cacheKey, result.status])),
      ).toMatchObject({
        '8402': PRODUCT_REFRESH_STATUS.FAILED,
        '824': PRODUCT_REFRESH_STATUS.OK,
      });
    });

    it('fails every product when the list answer is not a product list', async () => {
      const watched = await refs();
      const { supplier } = makeSupplier(() => ({ error_description: 'Server error' }));

      const results = await supplier.refreshProducts(watched);

      expect(results.every((result) => result.status === PRODUCT_REFRESH_STATUS.FAILED)).toBe(true);
    });

    it('reads every page of the list answer', async () => {
      const watched = (await refs()).filter((ref) => ref.cacheKey === '824');
      const { supplier, get } = makeSupplier();
      const pages = [
        { count: 4, pages: 2, page: 1, list: listed.slice(0, 2) },
        { count: 4, pages: 2, page: 2, list: listed.slice(2, 4) },
      ];
      get.mockImplementation((async (request: Call) => {
        const { path, params } = request;
        if (path.includes('/list/')) return pages[Number(params?.page) - 1];
        return searchCitricAcid;
      }) as never);

      const [result] = await supplier.refreshProducts(watched);

      expect(result.status).toBe(PRODUCT_REFRESH_STATUS.OK);
      expect(get).toHaveBeenCalledTimes(2);
    });

    describe('a ref saved before sizes carried their ids', () => {
      /** The ref a search used to leave: sizes inherited the head's uuid. */
      const legacy = async (): Promise<ProductRef> => {
        const watched = (await refs()).find((ref) => ref.cacheKey === '824');
        if (!watched) throw new Error('expected a ref');
        return {
          ...watched,
          variants: watched.variants.map((variant) => ({ ...variant, uuid: watched.uuid })),
        };
      };

      it('finds the sizes by title with a search and rebuilds the same product', async () => {
        const old = await legacy();
        const { supplier, get } = makeSupplier();

        const [result] = await supplier.refreshProducts([old]);

        const [searchCall] = get.mock.calls[0] as [Call];
        expect(searchCall.path).toContain('/search/Citric+Acid+Monohydrate+-');
        expect(result.status).toBe(PRODUCT_REFRESH_STATUS.OK);
        const [searched] = (await searchProducts()).filter((product) => product.cacheKey === '824');
        if (result.status !== PRODUCT_REFRESH_STATUS.OK) throw new Error('expected OK');
        expect(collectNativePrices(result.product)).toEqual(collectNativePrices(searched));
      });

      it('fails rather than returning a product with sizes missing', async () => {
        const old = await legacy();
        const { supplier } = makeSupplier();
        old.variants.push({ title: 'Citric Acid Monohydrate - 25kg', uuid: old.uuid });

        const [result] = await supplier.refreshProducts([old]);

        expect(result.status).toBe(PRODUCT_REFRESH_STATUS.FAILED);
      });

      it('needs no search for a product that has no sizes', async () => {
        const watched = (await refs()).find((ref) => ref.cacheKey === '8402');
        if (!watched) throw new Error('expected a ref');
        const { supplier, get } = makeSupplier();

        await supplier.refreshProducts([watched]);

        expect(get).toHaveBeenCalledTimes(1);
        expect((get.mock.calls[0][0] as Call).path).toContain('/list/');
      });
    });
  });
});
