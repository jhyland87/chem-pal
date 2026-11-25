import { AVAILABILITY, PRODUCT_REFRESH_STATUS } from '@/constants/common';
import type { ProductRef } from '@/helpers/productRef';
import { productSeriesKey, variantSeriesKey } from '@/helpers/priceHistory';
import { CURRENCY_SYMBOL_MAP } from '@/constants/currency';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { afterEach, describe, expect, it, vi } from 'vitest';
import withVariantsResponse from '../__fixtures__/thelabstockroom/product-with-variants.json';
import byIdResponse from '../__fixtures__/thelabstockroom/products-by-id.json';

// initProductBuilders is pure parsing (no cache/network); a light SupplierCache
// stub keeps the constructor happy.
vi.mock('@/utils/SupplierCache', () => ({
  SupplierCache: class {
    constructor(..._args: unknown[]) {}
    getProductIdentityCacheKey(identity: string) {
      return `id:${identity}`;
    }
  },
}));

const { SupplierBaseShopify } = await import('@/suppliers/SupplierBaseShopify');
const { SupplierTheLabStockroom } = await import('@/suppliers/SupplierTheLabStockroom');

/** A Shopify product node shaped like the real Storefront API response. */
const sampleNode = (): ShopifyProductNode => ({
  id: 'gid://shopify/Product/6609050009792',
  handle: 'is28128',
  title: '0.1M Sodium Hydroxide Solution',
  descriptionHtml:
    '<p>Sodium hydroxide 0.1M standardized solution. CAS 1310-73-2. Formula: NaOH. MW: 39.997 g/mol. Purity 99%.</p>',
  onlineStoreUrl: 'https://www.thelabstockroom.com/products/is28128',
  featuredImage: {
    url: 'https://cdn.shopify.com/s/files/1/x_150x150_crop_center.jpg',
    altText: null,
  },
  media: {
    edges: [
      {
        node: {
          id: 'gid://shopify/MediaImage/1',
          mediaContentType: 'IMAGE',
          alt: 'NaOH',
          image: { url: 'https://cdn.shopify.com/s/files/1/x.jpg', width: 800, height: 600 },
        },
      },
    ],
  },
  variants: {
    edges: [
      {
        node: {
          id: 'gid://shopify/ProductVariant/39549873651904',
          title: 'Default Title',
          sku: 'IS28128',
          availableForSale: true,
          currentlyNotInStock: false,
          weight: 1.1,
          weightUnit: 'POUNDS',
          price: { amount: '12.99', currencyCode: 'USD' },
          compareAtPrice: null,
          selectedOptions: [{ name: 'Title', value: 'Default Title' }],
        },
      },
    ],
  },
});

class TestShopify extends SupplierBaseShopify {
  public static readonly supplierName = 'TestShopify';
  public static readonly baseURL = 'https://shop.example';
  public static readonly shipping = 'worldwide' as ShippingRange;
  public static readonly country = 'US' as CountryCode;
  public static readonly paymentMethods = [] as PaymentMethod[];
  protected static readonly apiURL = 'test.myshopify.com';

  public callInitProductBuilders(nodes: ShopifyProductNode[]) {
    return (
      this as unknown as {
        initProductBuilders: (n: ShopifyProductNode[]) => ProductBuilder<Product>[];
      }
    ).initProductBuilders(nodes);
  }

  public callFilterProducts(nodes: ShopifyProductNode[]) {
    return (
      this as unknown as {
        filterProducts: (n: ShopifyProductNode[]) => ShopifyProductNode[];
      }
    ).filterProducts(nodes);
  }
}

describe('SupplierBaseShopify initProductBuilders', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses image, ids, and chemical identifiers from the new query shape', () => {
    const supplier = new TestShopify('q', 5, new AbortController());
    const [builder] = supplier.callInitProductBuilders([sampleNode()]);

    expect(builder.get('title')).toBe('0.1M Sodium Hydroxide Solution');
    expect(builder.get('sku')).toBe('IS28128');
    expect(builder.get('id')).toBe('gid://shopify/Product/6609050009792');
    expect(builder.get('cacheKey')).toBe('gid://shopify/Product/6609050009792');
    // Full image from media, followed by the pre-transformed featuredImage as its thumbnail.
    expect(builder.get('images')).toEqual([
      { href: 'https://cdn.shopify.com/s/files/1/x.jpg', type: 'image', altText: 'NaOH' },
      { href: 'https://cdn.shopify.com/s/files/1/x_150x150_crop_center.jpg', type: 'thumbnail' },
    ]);
    // Chemical identifiers parsed from title + descriptionHtml.
    expect(builder.get('cas')).toBe('1310-73-2');
    expect(builder.get('concentration')).toBe('0.1 M');
    expect(builder.get('moleweight')).toBe(39.997);
    expect(builder.get('purity')).toBe('99%');
  });

  it("uses the store's own currency", async () => {
    const supplier = new TestShopify('q', 5, new AbortController());
    const node = sampleNode();
    node.variants.edges[0].node.price = { amount: '1200.00', currencyCode: 'INR' };
    const [builder] = supplier.callInitProductBuilders([node]);
    expect(builder.get('price')).toBe(1200);
    expect(builder.get('currencyCode')).toBe('INR');
    expect(builder.get('currencySymbol')).toBe(CURRENCY_SYMBOL_MAP.INR);

    // The non-USD product must still pass build()'s validation, with a converted price.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ status_code: 200, data: { mid: 0.012 } })),
    );
    const product = await builder.build();
    vi.unstubAllGlobals();
    expect(product?.usdPrice).toBe(14.4);
  });

  it('carries the fuzzy match score from the scored item onto the product', () => {
    const supplier = new TestShopify('q', 5, new AbortController());
    // fuzzyFilterAst stamps matchPercentage on the raw node before initProductBuilders runs.
    const scored = Object.assign(sampleNode(), { matchPercentage: 87 });
    expect(supplier.callInitProductBuilders([scored])[0].get('matchPercentage')).toBe(87);
  });

  it("sets top-level availability from the primary variant's stock flag", () => {
    const supplier = new TestShopify('q', 5, new AbortController());

    const inStock = sampleNode();
    inStock.variants.edges[0].node.currentlyNotInStock = false;
    expect(supplier.callInitProductBuilders([inStock])[0].get('availability')).toBe(
      AVAILABILITY.IN_STOCK,
    );

    const outOfStock = sampleNode();
    outOfStock.variants.edges[0].node.currentlyNotInStock = true;
    expect(supplier.callInitProductBuilders([outOfStock])[0].get('availability')).toBe(
      AVAILABILITY.OUT_OF_STOCK,
    );
  });

  it('adds every image from the media connection, skipping non-image and url-less nodes', () => {
    const node = sampleNode();
    node.featuredImage = {
      url: 'https://cdn.shopify.com/s/files/1/a_150x150_crop_center.jpg',
      altText: null,
    };
    node.media = {
      edges: [
        {
          node: {
            id: 'gid://shopify/MediaImage/1',
            mediaContentType: 'IMAGE',
            alt: 'front',
            image: { url: 'https://cdn.shopify.com/s/files/1/a.jpg', width: 800, height: 600 },
          },
        },
        {
          node: {
            id: 'gid://shopify/Video/2',
            mediaContentType: 'VIDEO',
            alt: 'clip',
            image: null,
          },
        },
        {
          node: {
            id: 'gid://shopify/MediaImage/3',
            mediaContentType: 'IMAGE',
            alt: '',
            image: { url: 'https://cdn.shopify.com/s/files/1/b.jpg', width: 800, height: 600 },
          },
        },
      ],
    };

    const supplier = new TestShopify('q', 5, new AbortController());
    const [builder] = supplier.callInitProductBuilders([node]);

    expect(builder.get('images')).toEqual([
      // Primary image, then the pre-transformed featuredImage as its thumbnail.
      { href: 'https://cdn.shopify.com/s/files/1/a.jpg', type: 'image', altText: 'front' },
      { href: 'https://cdn.shopify.com/s/files/1/a_150x150_crop_center.jpg', type: 'thumbnail' },
      // Additional image, then a CDN width-derived thumbnail.
      { href: 'https://cdn.shopify.com/s/files/1/b.jpg', type: 'image' },
      { href: 'https://cdn.shopify.com/s/files/1/b.jpg?width=200', type: 'thumbnail' },
    ]);
  });

  it('falls back to a handle-based URL when onlineStoreUrl is null', () => {
    const supplier = new TestShopify('q', 5, new AbortController());
    const node = { ...sampleNode(), onlineStoreUrl: null };
    const [builder] = supplier.callInitProductBuilders([node]);
    expect(builder.get('url')).toBe('https://shop.example/products/is28128');
  });

  it('parses the quantity from the title, ignoring the packaging weight', () => {
    const supplier = new TestShopify('q', 5, new AbortController());
    const node = sampleNode();
    node.title = 'Sodium Iodide Reagent, 100g';
    node.variants.edges[0].node.weight = 0.3;
    node.variants.edges[0].node.weightUnit = 'POUNDS';
    const [builder] = supplier.callInitProductBuilders([node]);
    expect(builder.get('quantity')).toBe(100);
    expect(builder.get('uom')).toBe('g');
  });

  it('falls back to the variant weight when the title has no quantity, preserving sub-1 values and converting to metric', () => {
    const supplier = new TestShopify('q', 5, new AbortController());
    const node = sampleNode();
    node.title = 'Medium Sodium Spoon';
    node.variants.edges[0].node.weight = 0.4;
    node.variants.edges[0].node.weightUnit = 'POUNDS';
    const [builder] = supplier.callInitProductBuilders([node]);
    // 0.4 lb -> 181.44 g (would have been misread as "4 lb" by the string parser).
    expect(builder.get('quantity')).toBe(181.44);
    expect(builder.get('uom')).toBe('g');
  });

  it('filterProducts is a pass-through in the base class', () => {
    const supplier = new TestShopify('q', 5, new AbortController());
    const nodes = [sampleNode(), sampleNode()];
    expect(supplier.callFilterProducts(nodes)).toEqual(nodes);
  });
});

/** Exposes applySdsUrl and stubs the background fetcher's HTTP status. */
class TestLabStockroom extends SupplierTheLabStockroom {
  public sdsStatus = 200;
  public requestedUrls: string[] = [];

  protected override async backgroundFetch(url: string): Promise<Response> {
    this.requestedUrls.push(url);
    return { status: this.sdsStatus, ok: this.sdsStatus < 400 } as Response;
  }

  public callApplySdsUrl(builder: ProductBuilder<Product>) {
    return (
      this as unknown as { applySdsUrl: (b: ProductBuilder<Product>) => Promise<void> }
    ).applySdsUrl(builder);
  }

  public callFilterProducts(nodes: ShopifyProductNode[]) {
    return (
      this as unknown as {
        filterProducts: (n: ShopifyProductNode[]) => ShopifyProductNode[];
      }
    ).filterProducts(nodes);
  }

  public callInitProductBuilders(nodes: ShopifyProductNode[]) {
    return (
      this as unknown as {
        initProductBuilders: (n: ShopifyProductNode[]) => ProductBuilder<Product>[];
      }
    ).initProductBuilders(nodes);
  }
}

/** Builds a minimal product node with the given title and tags for filter tests. */
const taggedNode = (title: string, tags: string[]): ShopifyProductNode => ({
  ...sampleNode(),
  title,
  tags,
});

describe('SupplierTheLabStockroom filterProducts', () => {
  const supplier = () => new TestLabStockroom('q', 5, new AbortController());

  it('keeps products with a qualifying chemical tag', () => {
    const node = taggedNode('Sodium Iodide Reagent, 100g', [
      'Category_Chemicals',
      'Chemical_Sodium Iodide',
    ]);
    expect(supplier().callFilterProducts([node])).toEqual([node]);
  });

  it('keeps products tagged with any Chemical_ prefix', () => {
    const node = taggedNode('Something', ['Manufacturer_Eisco', 'Chemical_Potassium Chloride']);
    expect(supplier().callFilterProducts([node])).toEqual([node]);
  });

  it('excludes equipment whose tags include none of the chemical tags', () => {
    const spoon = taggedNode('Medium Sodium Spoon', [
      'Category_Lab Equipment',
      'Subcategory_Scoops and Spatulas',
    ]);
    expect(supplier().callFilterProducts([spoon])).toEqual([]);
  });

  it('excludes Category_Lab Equipment even when a chemical tag is also present', () => {
    const testStrip = taggedNode('Potassium Iodide Indicator Paper, 100-Leaf', [
      'Category_Lab Equipment',
      'Chemical_Test Strips',
      'Chemistry',
      'Chemistry_Chemicals',
    ]);
    expect(supplier().callFilterProducts([testStrip])).toEqual([]);
  });

  it('keeps an untagged product when its title yields a quantity', () => {
    const node = taggedNode('Potassium Nitrate 125g', []);
    expect(supplier().callFilterProducts([node])).toEqual([node]);
  });

  it('excludes an untagged product when its title has no parseable quantity', () => {
    const node = taggedNode('Mystery Untagged Gadget', []);
    expect(supplier().callFilterProducts([node])).toEqual([]);
  });
});

describe('SupplierTheLabStockroom grade from tags', () => {
  const gradeOf = (tags: string[]) => {
    const supplier = new TestLabStockroom('q', 5, new AbortController());
    const [builder] = supplier.callInitProductBuilders([taggedNode('Some Reagent, 100g', tags)]);
    return builder.get('grade');
  };

  const cases: Array<{ tag: string; grade: string }> = [
    { tag: 'Grade__Laboratory-Grade', grade: 'Lab Grade' },
    { tag: 'Grade_Lab-Grade', grade: 'Lab Grade' },
    { tag: 'Grade_Lab', grade: 'Lab Grade' },
    { tag: 'Grade_Reagent-Grade', grade: 'Reagent Grade' },
    { tag: 'Grade_Reagent', grade: 'Reagent Grade' },
    { tag: 'Grade_ACS-Grade', grade: 'ACS Grade' },
    { tag: 'Grade_ACS', grade: 'ACS Grade' },
  ];

  it.each(cases)('maps $tag -> $grade', ({ tag, grade }) => {
    expect(gradeOf(['Category_Chemicals', tag])).toBe(grade);
  });

  it('leaves grade unset when no grade tag is present', () => {
    expect(gradeOf(['Category_Chemicals', 'Chemical_Sodium Iodide'])).toBeUndefined();
  });

  it('does not read a grade from non-Grade tags containing the keyword', () => {
    // "Category_Lab Equipment" contains "lab" but isn't a Grade_ tag (and is excluded anyway).
    expect(gradeOf(['Category_Chemicals', 'Subcategory_Lab Supplies'])).toBeUndefined();
  });
});

describe('SupplierTheLabStockroom SDS probe', () => {
  const makeBuilder = (sku?: string) => {
    const b = new ProductBuilder<Product>('https://www.thelabstockroom.com');
    if (sku) b.setSku(sku);
    return b;
  };

  it('sets sdsUrl (uppercased SKU) when the HEAD probe returns 200', async () => {
    const supplier = new TestLabStockroom('q', 5, new AbortController());
    const builder = makeBuilder('is28090');
    await supplier.callApplySdsUrl(builder);

    expect(supplier.requestedUrls).toEqual([
      'https://s3.amazonaws.com/enalas-public/Public/SDS/IS28090.pdf',
    ]);
    expect(builder.get('sdsUrl')).toBe(
      'https://s3.amazonaws.com/enalas-public/Public/SDS/IS28090.pdf',
    );
  });

  it('does not set sdsUrl when the probe is not 200', async () => {
    const supplier = new TestLabStockroom('q', 5, new AbortController());
    supplier.sdsStatus = 404;
    const builder = makeBuilder('IS99999');
    await supplier.callApplySdsUrl(builder);
    expect(builder.get('sdsUrl')).toBeUndefined();
  });

  it('no-ops (no request) when the product has no SKU', async () => {
    const supplier = new TestLabStockroom('q', 5, new AbortController());
    const builder = makeBuilder();
    await supplier.callApplySdsUrl(builder);
    expect(supplier.requestedUrls).toEqual([]);
    expect(builder.get('sdsUrl')).toBeUndefined();
  });
});

describe('SupplierBaseShopify queryProductsById', () => {
  afterEach(() => vi.restoreAllMocks());

  const [found1, missing, found2] = byIdResponse.data.nodes;
  const GID_1 = 'gid://shopify/Product/453463801884';
  const GID_MISSING = 'gid://shopify/Product/1';
  const GID_2 = 'gid://shopify/Product/453463834652';

  const ref = (cacheKey: string): ProductRef => ({
    cacheKey,
    title: cacheKey,
    url: `https://shop.example/${cacheKey}`,
    variants: [],
  });

  /** A supplier whose Storefront API answers with `response`. */
  const makeSupplier = (response: unknown) => {
    const supplier = new TestShopify('', 5, new AbortController());
    const post = vi.spyOn(supplier as never, 'httpPostJson').mockResolvedValue(response as never);
    return { supplier, post };
  };

  it('has the fixture shape the tests rely on', () => {
    expect(found1?.id).toBe(GID_1);
    expect(missing).toBeNull();
    expect(found2?.id).toBe(GID_2);
  });

  it('requests the ids in one call, with the product fields fragment printed into the query', async () => {
    const { supplier, post } = makeSupplier(byIdResponse);

    await supplier.refreshProducts([ref(GID_1), ref(GID_MISSING), ref(GID_2)]);

    expect(post).toHaveBeenCalledTimes(1);
    const call = post.mock.calls[0][0] as {
      path: string;
      host: string;
      body: { query: string; variables: { ids: string[] } };
    };
    expect(call.path).toBe('/api/2026-04/graphql.json');
    expect(call.host).toBe('test.myshopify.com');
    expect(call.body.variables).toEqual({ ids: [GID_1, GID_MISSING, GID_2] });
    expect(call.body.query).toContain('nodes(ids: $ids)');
    expect(call.body.query).toMatch(/fragment ShopifyProductFields on Product/);
    expect(call.body.query).toContain('...ShopifyProductFields');
  });

  it('maps found products to OK and a null node to UNAVAILABLE, in ref order', async () => {
    const { supplier } = makeSupplier(byIdResponse);

    const results = await supplier.refreshProducts([ref(GID_1), ref(GID_MISSING), ref(GID_2)]);

    expect(results.map((r) => [r.ref.cacheKey, r.status])).toEqual([
      [GID_1, PRODUCT_REFRESH_STATUS.OK],
      [GID_MISSING, PRODUCT_REFRESH_STATUS.UNAVAILABLE],
      [GID_2, PRODUCT_REFRESH_STATUS.OK],
    ]);
    const [first] = results;
    expect(first.status === PRODUCT_REFRESH_STATUS.OK && first.product.title).toBe(
      'Laboratory Grade Acetone, 1L',
    );
  });

  it('marks a malformed node FAILED without affecting its neighbours', async () => {
    const response = { data: { nodes: [{ id: GID_1, title: 'no variants' }, found2] } };
    const { supplier } = makeSupplier(response);

    const results = await supplier.refreshProducts([ref(GID_1), ref(GID_2)]);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.FAILED,
      PRODUCT_REFRESH_STATUS.OK,
    ]);
  });

  it.each([
    ['no data', { errors: [{ message: 'Throttled' }] }],
    ['nodes is not a list', { data: { nodes: null } }],
    ['not an object', 'oops'],
  ])('fails every ref when the response is invalid (%s)', async (_label, response) => {
    const { supplier } = makeSupplier(response);

    const results = await supplier.refreshProducts([ref(GID_1), ref(GID_2)]);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.FAILED,
      PRODUCT_REFRESH_STATUS.FAILED,
    ]);
    expect(results[0]).toMatchObject({ reason: 'Invalid Shopify products response' });
  });

  it('does not apply filterProducts to refetched products', async () => {
    const { supplier } = makeSupplier(byIdResponse);
    const filter = vi
      .spyOn(supplier as never, 'filterProducts')
      .mockImplementation(() => [] as never);

    const results = await supplier.refreshProducts([ref(GID_1)]);

    expect(filter).not.toHaveBeenCalled();
    expect(results[0].status).toBe(PRODUCT_REFRESH_STATUS.OK);
  });

  it.each([
    ['a single-size product', byIdResponse.data.nodes[0]],
    ['a product with sizes', withVariantsResponse.data.nodes[0]],
  ])(
    'keeps the same product and variant series as a search of the same node (%s)',
    async (_label, node) => {
      const searchResponse = { data: { products: { edges: [{ node }], pageInfo: {} } } };
      const search = new TestShopify('acetone', 5, new AbortController());
      vi.spyOn(search as never, 'httpPostJson').mockResolvedValue(searchResponse as never);
      vi.spyOn(search as never, 'fuzzyFilterAst').mockImplementation((items: unknown) => items);
      const searched = await (
        search as unknown as {
          queryProducts: (q: string, l: number) => Promise<ProductBuilder<Product>[]>;
        }
      ).queryProducts('acetone', 5);
      const searchedProduct = await searched[0].build();

      const { supplier } = makeSupplier({ data: { nodes: [node] } });
      const [result] = await supplier.refreshProducts([ref(String(node?.id))]);

      if (result.status !== PRODUCT_REFRESH_STATUS.OK || !searchedProduct) {
        throw new Error('expected both routes to produce a product');
      }
      expect(productSeriesKey(result.product)).toBeDefined();
      expect(productSeriesKey(result.product)).toBe(productSeriesKey(searchedProduct));
      const keys = (product: Product) =>
        (product.variants ?? []).map((variant) => variantSeriesKey(product, variant));
      expect(keys(result.product)).toEqual(keys(searchedProduct));
      if (node === withVariantsResponse.data.nodes[0]) {
        const variantKeys = keys(result.product);
        expect(variantKeys).toHaveLength(2);
        expect(new Set(variantKeys).size).toBe(2);
        expect(variantKeys.every((key) => key !== undefined)).toBe(true);
      }
    },
  );
});
