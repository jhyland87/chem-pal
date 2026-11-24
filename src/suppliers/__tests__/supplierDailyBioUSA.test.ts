// ProductBuilder must be imported before anything that pulls in SupplierBase (module-init cycle).
import { ProductBuilder } from '@/utils/ProductBuilder';
import {
  resetChromeStorageMock,
  setupChromeStorageMock,
} from '@/__fixtures__/helpers/chrome/storageMock';
import { AVAILABILITY, PRODUCT_REFRESH_STATUS } from '@/constants/common';
import { productSeriesKey, variantSeriesKey } from '@/helpers/priceHistory';
import type { ProductRef } from '@/helpers/productRef';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import byIdResponse from '../__fixtures__/dailybiousa/products-by-id.json';
import { SupplierDailyBioUSA } from '../SupplierDailyBioUSA';

beforeAll(() => {
  setupChromeStorageMock();
});

beforeEach(() => {
  resetChromeStorageMock();
});

const products = JSON.parse(
  readFileSync(resolve(__dirname, '../__fixtures__/dailybiousa/products.json'), 'utf8'),
);

const makeSupplier = () => new SupplierDailyBioUSA('acid', 5);

type DailyBioUSAInternals = {
  getFallbackQuantity: (product: ProductObject) => { quantity: number; uom: string } | undefined;
  initProductBuilders: (results: ProductObject[]) => ProductBuilder<Product>[];
  finishProduct: (builder: ProductBuilder<Product>) => Promise<Product>;
};

describe('SupplierDailyBioUSA getFallbackQuantity', () => {
  it("reads the size out of the SKU's SIZE segment", () => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;
    expect(supplier.getFallbackQuantity(products.skuSize)).toEqual({ quantity: 500, uom: 'g' });
  });

  it('falls back to the product name when the SKU field holds something else', () => {
    // This listing's `sku` is literally "13.99"; the catalog code lives in the name instead.
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;
    expect(products.skuIsPrice.sku).toBe('13.99');
    expect(supplier.getFallbackQuantity(products.skuIsPrice)).toEqual({ quantity: 500, uom: 'g' });
  });

  it('returns nothing when neither the SKU nor the name carries a SIZE segment', () => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;
    expect(supplier.getFallbackQuantity(products.noSize)).toBeUndefined();
  });

  it.each([
    ['A992.SIZE,500G', { quantity: 500, uom: 'g' }],
    ['L836.SIZE.2.5L', { quantity: 2.5, uom: 'l' }],
    ['L933.SIZE.500ML', { quantity: 500, uom: 'ml' }],
    ['A795.SIZE.500g', { quantity: 500, uom: 'g' }],
    ['LW001', undefined],
  ])('parses the size in %s', (sku, expected) => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;
    const product = { ...products.skuSize, sku, name: 'Some reagent' };
    expect(supplier.getFallbackQuantity(product)).toEqual(expected);
  });
});

describe('SupplierDailyBioUSA initProductBuilders', () => {
  it('keeps an option-less product by taking its quantity from the SKU', () => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;

    const builders = supplier.initProductBuilders([products.skuSize]);

    expect(builders).toHaveLength(1);
    const product = builders[0].dump();
    expect(product.title).toBe('Sodium nitrite  A932.SIZE.500G  CAS:[7632-00-0]');
    expect(product.quantity).toBe(500);
    expect(product.uom).toBe('g');
    expect(product.price).toBe(21);
    expect(product.currencyCode).toBe('USD');
    // Grade lives in the description as a labeled "Grade:" field.
    expect(product.grade).toBe('Pure Grade');
    expect(product.cas).toBe('7632-00-0');
    // Availability comes from the Wix product's isInStock flag.
    expect(product.availability).toBe(AVAILABILITY.IN_STOCK);
  });

  it('uses the discounted price when the product is on sale', () => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;

    const onSale = { ...products.skuSize, formattedDiscountedPrice: '$17.50' };
    const product = supplier.initProductBuilders([onSale])[0].dump();
    expect(product.price).toBe(17.5);
  });

  it('marks a product out of stock when isInStock is false', () => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;

    const outOfStock = { ...products.skuSize, isInStock: false };
    const product = supplier.initProductBuilders([outOfStock])[0].dump();
    expect(product.availability).toBe(AVAILABILITY.OUT_OF_STOCK);
  });

  it('stamps the eBay payment method and storefront onto the finished product', async () => {
    // The whole chain the detail-panel notice depends on: supplier statics -> finishProduct ->
    // ProductBuilder -> Product. paymentMethods used to arrive empty here, because the runtime
    // payment-method mirror didn't list "ebayonly" and the builder filtered it out.
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;

    const builder = supplier.initProductBuilders([products.skuSize])[0];
    const product = await supplier.finishProduct(builder);

    expect(product.paymentMethods).toEqual(['ebayonly']);
    expect(product.supplierEbayStoreURL).toBe('https://www.ebay.com/str/dailybiousa');
    expect(product.supplierAmazonStoreURL).toBeUndefined();
  });

  it('drops an option-less product whose SKU carries no size', () => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;
    expect(supplier.initProductBuilders([products.noSize])).toHaveLength(0);
  });

  it('still prefers real Wix options over the SKU fallback', () => {
    const supplier = makeSupplier() as unknown as DailyBioUSAInternals;

    const builders = supplier.initProductBuilders([products.withOptions]);

    expect(builders).toHaveLength(1);
    const product = builders[0].dump();
    expect(
      product.variants?.map((v) => ({ quantity: v.quantity, uom: v.uom, price: v.price })),
    ).toEqual([
      { quantity: 50, uom: 'g', price: 38 },
      { quantity: 100, uom: 'g', price: 61 },
      { quantity: 250, uom: 'g', price: 90 },
    ]);
  });
});

describe('SupplierDailyBioUSA queryProductsById', () => {
  afterEach(() => vi.restoreAllMocks());

  const [first, second] = byIdResponse.data.catalog.category.productsWithMetaData.list;

  const ref = (cacheKey: string): ProductRef => ({
    cacheKey,
    title: cacheKey,
    url: `https://www.dailybiousa.com/product-page/${cacheKey}`,
    variants: [],
  });

  /** A supplier whose Wix API answers with `response`, with the access-token step skipped. */
  const makeBySupplier = (response: unknown = byIdResponse) => {
    const supplier = makeSupplier();
    const setup = vi.spyOn(supplier as never, 'setup').mockResolvedValue(undefined as never);
    const get = vi.spyOn(supplier as never, 'httpGetJson').mockResolvedValue(response as never);
    return { supplier, get, setup };
  };

  it('filters the catalog by id IN the refs, in one request', async () => {
    const { supplier, get } = makeBySupplier();

    await supplier.refreshProducts([ref(first.id), ref('missing-id'), ref(second.id)]);

    expect(get).toHaveBeenCalledTimes(1);
    const call = get.mock.calls[0][0] as unknown as {
      path: string;
      params: { o: string; q: string; v: string };
    };
    expect(call.path).toBe('_api/wix-ecommerce-storefront-web/api');
    expect(call.params.o).toBe('getFilteredProducts');
    const variables = JSON.parse(call.params.v);
    expect(variables.filters).toEqual({
      term: { field: 'id', op: 'IN', values: [first.id, 'missing-id', second.id] },
    });
    expect(variables.mainCollectionId).toBe('00000000-000000-000000-000000000001');
    expect(variables.limit).toBe(3);
    expect(variables.offset).toBe(0);
  });

  it('runs setup once before the request', async () => {
    const { supplier, setup } = makeBySupplier();
    await supplier.refreshProducts([ref(first.id)]);
    expect(setup).toHaveBeenCalledTimes(1);
  });

  it('returns OK for a found product and UNAVAILABLE for an id the catalog no longer has', async () => {
    const { supplier } = makeBySupplier({
      data: {
        catalog: {
          category: {
            productsWithMetaData: {
              totalCount: 1,
              list: [byIdResponse.data.catalog.category.productsWithMetaData.list[1]],
            },
          },
        },
      },
    });

    const results = await supplier.refreshProducts([ref(second.id), ref('gone')]);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.OK,
      PRODUCT_REFRESH_STATUS.UNAVAILABLE,
    ]);
    const [ok] = results;
    expect(ok.status === PRODUCT_REFRESH_STATUS.OK && ok.product.quantity).toBe(250);
  });

  it('fails every ref when the response is invalid', async () => {
    const { supplier } = makeBySupplier({ errors: [{ message: 'GQL_QUERY_ANALYSIS_ERROR' }] });

    const results = await supplier.refreshProducts([ref(first.id), ref(second.id)]);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.FAILED,
      PRODUCT_REFRESH_STATUS.FAILED,
    ]);
    expect(results[0]).toMatchObject({ reason: 'Invalid or empty Wix query response' });
  });

  it('keeps the same product and variant series as a search of the same products', async () => {
    const { supplier: searcher } = makeBySupplier();
    vi.spyOn(searcher as never, 'fuzzyFilterAst').mockImplementation((items: unknown) => items);
    const searched = await (
      searcher as unknown as {
        queryProducts: (q: string, l: number) => Promise<ProductBuilder<Product>[]>;
      }
    ).queryProducts('acid', 5);
    const searchedProducts = await Promise.all(searched.map((builder) => builder.build()));
    expect(searchedProducts.length).toBeGreaterThan(0);

    const { supplier } = makeBySupplier();
    const results = await supplier.refreshProducts([ref(first.id), ref(second.id)]);

    let compared = 0;
    for (const result of results) {
      if (result.status === PRODUCT_REFRESH_STATUS.UNAVAILABLE) continue;
      compared++;
      const searchedProduct = searchedProducts.find((p) => p?.cacheKey === result.ref.cacheKey);
      if (result.status !== PRODUCT_REFRESH_STATUS.OK || !searchedProduct) {
        throw new Error(`expected both routes to produce ${result.ref.cacheKey}`);
      }
      expect(productSeriesKey(result.product)).toBeDefined();
      expect(productSeriesKey(result.product)).toBe(productSeriesKey(searchedProduct));
      const keys = (product: Product) =>
        (product.variants ?? []).map((variant) => variantSeriesKey(product, variant));
      expect(keys(result.product)).toEqual(keys(searchedProduct));
    }
    expect(compared).toBeGreaterThan(0);
  });
});
