// ProductBuilder must be imported before anything that pulls in SupplierBase (module-init cycle).
import { ProductBuilder } from '@/utils/ProductBuilder';
import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from '@/__fixtures__/helpers/chrome/storageMock';
import { PRODUCT_REFRESH_STATUS } from '@/constants/common';
import { HttpError } from '@/helpers/exceptions';
import { collectNativePrices } from '@/helpers/priceAlerts';
import { productSeriesKey } from '@/helpers/priceHistory';
import { toProductRef, type ProductRef } from '@/helpers/productRef';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import eur_to_usd_rate from '../__fixtures__/common/eur-to-usd-rate.json';
import malicAcid from '../__fixtures__/laboratoriumdiscounter/by-id-dl-malic-acid.json';
import citricAcid500g from '../__fixtures__/laboratoriumdiscounter/by-id-citric-acid-500g.json';
import citricAcidMonohydrate from '../__fixtures__/laboratoriumdiscounter/by-id-citric-acid-monohydrate.json';
import searchResponse from '../__fixtures__/laboratoriumdiscounter/search-by-id.json';
import { SupplierLaboratoriumDiscounter } from '../SupplierLaboratoriumDiscounter';

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
  getProductDataFromJSON: (
    builder: ProductBuilder<Product>,
  ) => Promise<ProductBuilder<Product> | void>;
  finishProduct: (builder: ProductBuilder<Product>) => Promise<Product | void>;
};

/** A request to the stubbed API: its path and params. */
type Call = { path: string; params?: Record<string, unknown>; rethrowErrors?: boolean };

const details = [citricAcidMonohydrate, malicAcid, citricAcid500g];

/** The fixture a product page path serves. */
const detailFor = (path: string) =>
  details.find((detail) => path.endsWith(detail.product.url.replace(/^\//, '')));

/** A supplier whose shop serves the fixtures: the search on `httpGetJson`, pages on `httpGet`. */
const makeSupplier = (page: (path: string) => unknown = detailFor) => {
  const supplier = new SupplierLaboratoriumDiscounter('citric acid', 10);
  vi.spyOn(supplier as never, 'fuzzyFilterAst').mockImplementation((items: unknown) => items);
  vi.spyOn(supplier as never, 'httpGetJson').mockImplementation(async (request: unknown) => {
    const { path } = request as Call;
    return path.includes('/search/') ? searchResponse : page(path);
  });
  const get = vi
    .spyOn(supplier as never, 'httpGet')
    .mockImplementation(async (request: unknown) => {
      const { path } = request as Call;
      const body = page(path);
      if (body === undefined) throw new HttpError(404, 'Not Found');
      return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      });
    });
  const html = vi.spyOn(supplier as never, 'httpGetHtml');
  return { supplier, internals: supplier as unknown as Internals, get, html };
};

/** Searches, then fills each result from its JSON page, like a search does. */
async function searchProducts(): Promise<Product[]> {
  const { internals } = makeSupplier();
  const builders = (await internals.queryProducts('citric acid', 10)) ?? [];
  const products: Product[] = [];
  for (const builder of builders) {
    const detailed = await internals.getProductDataFromJSON(builder);
    const product = detailed && (await internals.finishProduct(detailed));
    if (product) products.push(product);
  }
  return products;
}

const refsOf = (products: Product[]): ProductRef[] =>
  products.flatMap((product) => toProductRef(product) ?? []);

describe('SupplierLaboratoriumDiscounter refreshProducts', () => {
  it('refetches each product from its JSON page, one request each, without the HTML fallback', async () => {
    const watched = refsOf(await searchProducts());
    const { supplier, get, html } = makeSupplier();

    const results = await supplier.refreshProducts(watched);

    expect(watched).toHaveLength(3);
    expect(get).toHaveBeenCalledTimes(3);
    const [call] = get.mock.calls[0] as [Call];
    expect(call).toMatchObject({ params: { format: 'json' }, rethrowErrors: true });
    expect(call.path).toMatch(/^en\//);
    expect(html).not.toHaveBeenCalled();
    expect(results.map((result) => result.status)).toEqual(
      watched.map(() => PRODUCT_REFRESH_STATUS.OK),
    );
  });

  it('yields the same series, currency, pack size and price as search plus detail', async () => {
    const searched = await searchProducts();
    const { supplier } = makeSupplier();

    const results = await supplier.refreshProducts(refsOf(searched));

    expect(searched).toHaveLength(3);
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
        currencyCode: 'EUR',
        quantity: before.quantity,
        uom: before.uom,
      });
    }
  });

  it('reports a product the shop answers 404 for as UNAVAILABLE', async () => {
    const watched = refsOf(await searchProducts());
    const { supplier } = makeSupplier((path) =>
      path.includes('malic') ? undefined : detailFor(path),
    );

    const results = await supplier.refreshProducts(watched);

    expect(
      Object.fromEntries(results.map((result) => [result.ref.title, result.status])),
    ).toMatchObject({
      'DL-Malic Acid 99+%, food grade, E296': PRODUCT_REFRESH_STATUS.UNAVAILABLE,
      'Citric Acid >98.0%(T) 500g': PRODUCT_REFRESH_STATUS.OK,
    });
  });

  it('fails a product whose JSON is not a product, rather than scraping its HTML', async () => {
    const watched = refsOf(await searchProducts());
    const { supplier, html } = makeSupplier((path) =>
      path.includes('malic') ? { product: { title: 'broken' } } : detailFor(path),
    );

    const results = await supplier.refreshProducts(watched);

    expect(
      results.filter((result) => result.status === PRODUCT_REFRESH_STATUS.FAILED),
    ).toHaveLength(1);
    expect(results.filter((result) => result.status === PRODUCT_REFRESH_STATUS.OK)).toHaveLength(2);
    expect(html).not.toHaveBeenCalled();
  });
});
