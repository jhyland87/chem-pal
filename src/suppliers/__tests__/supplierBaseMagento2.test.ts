// ProductBuilder must be imported before SupplierBase(Magento2) to avoid a
// module-initialization cycle; the base class is then imported dynamically.
import { PRODUCT_REFRESH_STATUS } from '@/constants/common';
import type { ProductRef } from '@/helpers/productRef';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { describe, expect, it, vi } from 'vitest';
import bySku from '../__fixtures__/labproservices/products-by-sku.json';

const { SupplierBaseMagento2 } = await import('@/suppliers/SupplierBaseMagento2');

/**
 * Minimal concrete Magento 2 supplier that exposes the `protected` methods
 * under test (`getProductUrl`, `initProductBuilders`) as public wrappers. No
 * network is touched — both methods are pure transforms of a product item.
 */
class TestMagento2 extends SupplierBaseMagento2 {
  public static readonly supplierName = 'TestMagento2';
  public static readonly baseURL = 'https://mag.example';
  public static readonly shipping = 'worldwide' as ShippingRange;
  public static readonly country = 'US' as CountryCode;
  public static readonly paymentMethods = [] as PaymentMethod[];

  public callGetProductUrl(item: Magento2ProductItem): string {
    return this.getProductUrl(item);
  }

  public callInitProductBuilders(items: Magento2ProductItem[]): ProductBuilder<Product>[] {
    return this.initProductBuilders(items);
  }
}

/** Builds a minimal `SimpleProduct` item; override only the fields under test. */
function makeItem(overrides: Partial<Magento2ProductItem> = {}): Magento2ProductItem {
  return {
    __typename: 'SimpleProduct',
    uid: 'dWlkLTE=',
    sku: 'SKU-1',
    name: 'Test Product',
    url_rewrites: [],
    url_key: 'test-product',
    url_suffix: '.html',
    price_range: {
      minimum_price: {
        regular_price: { value: 9.9, currency: 'USD' },
      },
    },
    ...overrides,
  } as Magento2ProductItem;
}

const supplier = new TestMagento2('q', 10, new AbortController());

describe('SupplierBaseMagento2.getProductUrl', () => {
  it("returns the first url_rewrite's url when present, ignoring url_key", () => {
    const item = makeItem({
      url_rewrites: [{ url: 'sodium-chloride.html', parameters: [] }],
      url_key: 'ignored-key',
      url_suffix: '.html',
    });
    expect(supplier.callGetProductUrl(item)).toBe('sodium-chloride.html');
  });

  it('uses the first rewrite when several are present', () => {
    const item = makeItem({
      url_rewrites: [
        { url: 'first.html', parameters: [] },
        { url: 'second.html', parameters: [] },
      ],
    });
    expect(supplier.callGetProductUrl(item)).toBe('first.html');
  });

  it('reads a fully-shaped Magento2UrlRewrite (url + parameters)', () => {
    const rewrite: Magento2UrlRewrite = {
      url: 'product/123.html',
      parameters: [{ name: 'id', value: '123' }],
    };
    const item = makeItem({ url_rewrites: [rewrite] });
    expect(supplier.callGetProductUrl(item)).toBe('product/123.html');
  });

  it('falls back to url_key + url_suffix when there are no rewrites', () => {
    const item = makeItem({ url_rewrites: [], url_key: 'potassium-nitrate', url_suffix: '.html' });
    expect(supplier.callGetProductUrl(item)).toBe('potassium-nitrate.html');
  });

  it('respects a non-default url_suffix', () => {
    const item = makeItem({ url_rewrites: [], url_key: 'foo', url_suffix: '.htm' });
    expect(supplier.callGetProductUrl(item)).toBe('foo.htm');
  });

  it('defaults the suffix to .html when url_suffix is undefined', () => {
    const item = makeItem({ url_rewrites: [], url_key: 'foo', url_suffix: undefined });
    expect(supplier.callGetProductUrl(item)).toBe('foo.html');
  });

  it('defaults the suffix to .html when url_suffix is null', () => {
    const item = makeItem({ url_rewrites: [], url_key: 'foo', url_suffix: null });
    expect(supplier.callGetProductUrl(item)).toBe('foo.html');
  });

  it("falls back when the first rewrite's url is an empty string", () => {
    const item = makeItem({
      url_rewrites: [{ url: '', parameters: [] }],
      url_key: 'foo',
      url_suffix: '.html',
    });
    expect(supplier.callGetProductUrl(item)).toBe('foo.html');
  });

  it('falls back when url_rewrites is missing entirely', () => {
    const item = makeItem({ url_key: 'foo', url_suffix: '.html' });
    // An item whose url_rewrites field is absent exercises the optional-chaining path.
    delete (item as { url_rewrites?: unknown }).url_rewrites;
    expect(supplier.callGetProductUrl(item)).toBe('foo.html');
  });
});

describe('SupplierBaseMagento2 wires getProductUrl into the product permalink', () => {
  it('uses the url_rewrite (plus storeCode) for the permalink', () => {
    const item = makeItem({
      url_rewrites: [{ url: 'sodium-chloride.html', parameters: [] }],
      url_key: 'should-not-be-used',
    });

    const [builder] = supplier.callInitProductBuilders([item]);

    expect(builder).toBeInstanceOf(ProductBuilder);
    const permalink = builder.get('permalink');
    expect(permalink).toBeTypeOf('string');
    expect(permalink).toContain('sodium-chloride.html');
    expect(permalink).toContain('us_en'); // default storeCode
    expect(permalink).not.toContain('should-not-be-used');
  });

  it('uses url_key + url_suffix for the permalink when there is no rewrite', () => {
    const item = makeItem({ url_rewrites: [], url_key: 'potassium-nitrate', url_suffix: '.html' });

    const [builder] = supplier.callInitProductBuilders([item]);

    expect(builder.get('permalink')).toContain('potassium-nitrate.html');
  });
});

describe('SupplierBaseMagento2 sale prices', () => {
  const sale = {
    minimum_price: {
      regular_price: { value: 100, currency: 'USD' },
      final_price: { value: 85, currency: 'USD' },
    },
  } as Magento2PriceRange;

  it('prices a simple product from final_price', () => {
    const [builder] = supplier.callInitProductBuilders([makeItem({ price_range: sale })]);
    expect(builder.get('price')).toBe(85);
  });

  it('prices grouped sub-products from final_price, or regular_price without one', () => {
    const item = makeItem({
      __typename: 'GroupedProduct',
      items: [
        { product: { sku: 'S-5g', name: '5g', price_range: sale } },
        {
          product: {
            sku: 'S-25g',
            name: '25g',
            price_range: { minimum_price: { regular_price: { value: 200, currency: 'USD' } } },
          },
        },
      ] as Magento2GroupedItem[],
    });
    const [builder] = supplier.callInitProductBuilders([item]);
    expect(builder.get('price')).toBe(85);
    expect(builder.get('variants')?.[0]?.price).toBe(200);
  });

  it('prices configurable variants from final_price', () => {
    const item = makeItem({
      __typename: 'ConfigurableProduct',
      variants: [
        { attributes: [], product: { sku: 'S-5g', name: '5g', price_range: sale } },
      ] as unknown as Magento2ConfigurableVariant[],
    });
    const [builder] = supplier.callInitProductBuilders([item]);
    expect(builder.get('price')).toBe(85);
  });
});

describe('SupplierBaseMagento2 queryProductsById', () => {
  const items = bySku.data.products.items;
  const [first, second] = items;

  const refFor = (item: { uid: string; sku: string }, withSku = true): ProductRef => ({
    cacheKey: item.uid,
    title: item.sku,
    url: `${item.sku}.html`,
    ...(withSku && { sku: item.sku }),
    variants: [],
  });

  /** A supplier whose GraphQL endpoint answers with `response`. */
  const makeBySupplier = (response: unknown = bySku) => {
    const by = new TestMagento2('', 5, new AbortController());
    const post = vi.spyOn(by as never, 'httpPostJson').mockResolvedValue(response as never);
    return { by, post };
  };

  type Post = {
    path: string;
    body: { query: string; variables: { skus: string[]; pageSize: number } };
    headers: Record<string, string>;
  };

  it('requests the SKUs and a matching pageSize, with the Store header', async () => {
    const { by, post } = makeBySupplier();

    await by.refreshProducts([refFor(first), refFor(second)]);

    expect(post).toHaveBeenCalledTimes(1);
    const call = post.mock.calls[0][0] as unknown as Post;
    expect(call.path).toBe('/graphql');
    expect(call.body.variables).toEqual({ skus: [first.sku, second.sku], pageSize: 2 });
    expect(call.body.query).toMatch(/sku:\s*\{\s*in:\s*\$skus\s*\}/);
    expect(call.body.query).toMatch(/fragment Magento2ProductFields on ProductInterface/);
    expect(call.headers.Store).toBe('us_en');
  });

  it('returns OK for found SKUs and UNAVAILABLE for a SKU the store no longer lists', async () => {
    const { by } = makeBySupplier();
    const gone: ProductRef = { ...refFor(first), cacheKey: 'gone', sku: 'GONE-1' };

    const results = await by.refreshProducts([refFor(first), gone, refFor(second)]);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.OK,
      PRODUCT_REFRESH_STATUS.UNAVAILABLE,
      PRODUCT_REFRESH_STATUS.OK,
    ]);
  });

  it('fails a ref that has no SKU without sending it, and still fetches the others', async () => {
    const { by, post } = makeBySupplier();

    const results = await by.refreshProducts([refFor(first, false), refFor(second)]);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.FAILED,
      PRODUCT_REFRESH_STATUS.OK,
    ]);
    const call = post.mock.calls[0][0] as unknown as Post;
    expect(call.body.variables).toEqual({ skus: [second.sku], pageSize: 1 });
  });

  it('makes no request when no ref has a SKU', async () => {
    const { by, post } = makeBySupplier();

    const results = await by.refreshProducts([refFor(first, false)]);

    expect(post).not.toHaveBeenCalled();
    expect(results.map((r) => r.status)).toEqual([PRODUCT_REFRESH_STATUS.FAILED]);
  });

  it('fails every ref when the response is invalid', async () => {
    const { by } = makeBySupplier({ errors: [{ message: 'Internal server error' }] });

    const results = await by.refreshProducts([refFor(first), refFor(second)]);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.FAILED,
      PRODUCT_REFRESH_STATUS.FAILED,
    ]);
    expect(results[0]).toMatchObject({ reason: 'Invalid Magento2 products response' });
  });
});
