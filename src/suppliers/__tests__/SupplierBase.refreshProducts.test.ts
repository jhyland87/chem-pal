// ProductBuilder must be imported before SupplierBase (module-init cycle).
import { PRODUCT_REFRESH_STATUS } from '@/constants/common';
import type { ProductLookup, ProductRef } from '@/helpers/productRef';
import { Logger } from '@/utils/Logger';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierBase } from '../SupplierBase';

vi.mock('@/utils/SupplierCache', () => ({
  SupplierCache: class {
    constructor(..._args: unknown[]) {}
    getProductIdentityCacheKey(identity: string) {
      return `id:${identity}`;
    }
  },
}));

/** Fake supplier whose by-id hook is a replaceable function. */
class RefreshSupplier extends SupplierBase<unknown, Product> {
  public static readonly supplierName: string = 'RefreshSupplier';
  public static readonly baseURL = 'https://example.invalid';
  public static readonly shipping = 'worldwide' as ShippingRange;
  public static readonly country = 'US' as CountryCode;
  public static readonly paymentMethods = [] as PaymentMethod[];

  public setupCalls = 0;
  public batches: string[][] = [];
  public requestCountAtStart: number[] = [];
  public hook: (refs: readonly ProductRef[]) => Promise<ProductLookup<Product>> = async () => ({
    builders: [],
  });

  protected titleSelector(): Maybe<string> {
    return '';
  }

  protected getUniqueProductKey(data: unknown): string {
    return String((data as { id?: unknown })?.id ?? '');
  }

  protected async queryProducts(): Promise<ProductBuilder<Product>[] | void> {
    return [];
  }

  protected async setup(): Promise<void> {
    this.setupCalls++;
  }

  protected override async queryProductsById(
    refs: readonly ProductRef[],
  ): Promise<ProductLookup<Product>> {
    this.batches.push(refs.map((ref) => ref.cacheKey));
    this.requestCountAtStart.push(this.requestCount);
    // Pretend the batch spent requests, so the per-batch reset is observable.
    this.requestCount += 5;
    return this.hook(refs);
  }

  public setBatchSize(size: number) {
    this.refreshBatchSize = size;
  }

  public setFinish(fn: (builder: ProductBuilder<Product>) => Promise<Maybe<Product>>) {
    (this as unknown as { finishProduct: typeof fn }).finishProduct = fn;
  }

  public callRefreshViaDetail(
    refs: readonly ProductRef[],
    fetchDetail?: (
      builder: ProductBuilder<Product>,
      ref: ProductRef,
    ) => Promise<ProductBuilder<Product> | void>,
  ) {
    return this.refreshViaDetail(refs, fetchDetail);
  }
}

/** Plain supplier that does not override the hook. */
class DefaultHookSupplier extends RefreshSupplier {
  public static readonly supplierName = 'DefaultHookSupplier';
  protected override async queryProductsById(refs: readonly ProductRef[]) {
    return SupplierBase.prototype['queryProductsById'].call(this, refs);
  }
}

const makeRef = (cacheKey: string, extra: Partial<ProductRef> = {}): ProductRef => ({
  cacheKey,
  title: `Product ${cacheKey}`,
  url: `https://example.invalid/p/${cacheKey}`,
  variants: [],
  ...extra,
});

/** A builder complete enough to pass `finishProduct`. */
const makeBuilder = (cacheKey: string, price = 10): ProductBuilder<Product> => {
  const builder = new ProductBuilder<Product>('https://example.invalid');
  builder
    .setBasicInfo(`Product ${cacheKey}`, `https://example.invalid/p/${cacheKey}`, 'RefreshSupplier')
    .setPricing(price, 'USD', '$')
    .setQuantity(500, 'g')
    .setCacheKey(cacheKey);
  return builder;
};

const make = () => new RefreshSupplier('', 5, new AbortController());

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SupplierBase.refreshProducts', () => {
  it('returns one result per ref, in order, with OK / UNAVAILABLE / FAILED', async () => {
    const supplier = make();
    supplier.hook = async () => ({
      builders: [makeBuilder('c', 12), makeBuilder('a', 11)],
      failed: new Set(['b']),
    });
    const refs = [makeRef('a'), makeRef('b'), makeRef('c'), makeRef('d')];

    const results = await supplier.refreshProducts(refs);

    expect(results.map((r) => [r.ref.cacheKey, r.status])).toEqual([
      ['a', PRODUCT_REFRESH_STATUS.OK],
      ['b', PRODUCT_REFRESH_STATUS.FAILED],
      ['c', PRODUCT_REFRESH_STATUS.OK],
      ['d', PRODUCT_REFRESH_STATUS.UNAVAILABLE],
    ]);
    const [a, , c] = results;
    expect(a.status === PRODUCT_REFRESH_STATUS.OK && a.product.price).toBe(11);
    expect(c.status === PRODUCT_REFRESH_STATUS.OK && c.product.price).toBe(12);
    expect(results[1]).toMatchObject({ reason: 'Request failed' });
    expect(results[3]).not.toHaveProperty('product');
  });

  it('returns nothing for no refs and never calls the hook', async () => {
    const supplier = make();
    await expect(supplier.refreshProducts([])).resolves.toEqual([]);
    expect(supplier.batches).toEqual([]);
  });

  it('prefers failed over a builder with the same key', async () => {
    const supplier = make();
    supplier.hook = async () => ({ builders: [makeBuilder('a')], failed: new Set(['a']) });
    const [result] = await supplier.refreshProducts([makeRef('a')]);
    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.FAILED);
  });

  it('fails the whole batch, and only that batch, when the hook throws', async () => {
    const supplier = make();
    supplier.setBatchSize(2);
    let call = 0;
    supplier.hook = async () => {
      call++;
      if (call === 1) throw new Error('boom');
      return { builders: [makeBuilder('c'), makeBuilder('d')] };
    };

    const results = await supplier.refreshProducts(['a', 'b', 'c', 'd'].map((k) => makeRef(k)));

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.FAILED,
      PRODUCT_REFRESH_STATUS.FAILED,
      PRODUCT_REFRESH_STATUS.OK,
      PRODUCT_REFRESH_STATUS.OK,
    ]);
    expect(results[0]).toMatchObject({ reason: 'boom' });
    expect(supplier.batches).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('fails a ref whose build rejects, e.g. an exchange-rate outage, without touching the others', async () => {
    const supplier = make();
    supplier.hook = async () => ({ builders: [makeBuilder('a'), makeBuilder('b')] });
    const original = ProductBuilder.prototype.build;
    vi.spyOn(ProductBuilder.prototype, 'build').mockImplementation(async function (
      this: ProductBuilder<Product>,
    ) {
      if (this.get('cacheKey') === 'a') throw new Error('Exchange rate unavailable');
      return original.call(this);
    });

    const results = await supplier.refreshProducts([makeRef('a'), makeRef('b')]);

    expect(results[0]).toMatchObject({
      status: PRODUCT_REFRESH_STATUS.FAILED,
      reason: 'Exchange rate unavailable',
    });
    expect(results[1].status).toBe(PRODUCT_REFRESH_STATUS.OK);
  });

  it('fails a ref when finishProduct rejects', async () => {
    const supplier = make();
    supplier.hook = async () => ({ builders: [makeBuilder('a')] });
    supplier.setFinish(async () => {
      throw new Error('finish failed');
    });
    const [result] = await supplier.refreshProducts([makeRef('a')]);
    expect(result).toMatchObject({
      status: PRODUCT_REFRESH_STATUS.FAILED,
      reason: 'finish failed',
    });
  });

  it('fails a ref when finishProduct returns nothing', async () => {
    const supplier = make();
    supplier.hook = async () => ({ builders: [makeBuilder('a')] });
    supplier.setFinish(async () => undefined);
    const [result] = await supplier.refreshProducts([makeRef('a')]);
    expect(result).toMatchObject({
      status: PRODUCT_REFRESH_STATUS.FAILED,
      reason: 'Incomplete product data',
    });
  });

  it('fails a builder that is too incomplete to finish', async () => {
    const supplier = make();
    const bare = new ProductBuilder<Product>('https://example.invalid');
    bare.setCacheKey('a');
    supplier.hook = async () => ({ builders: [bare] });
    const [result] = await supplier.refreshProducts([makeRef('a')]);
    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.FAILED);
  });

  it('chunks by refreshBatchSize and resets the request count for each batch', async () => {
    const supplier = make();
    supplier.setBatchSize(3);
    const refs = Array.from({ length: 7 }, (_, i) => makeRef(`k${i}`));

    const results = await supplier.refreshProducts(refs);

    expect(results).toHaveLength(7);
    expect(supplier.batches.map((b) => b.length)).toEqual([3, 3, 1]);
    expect(supplier.requestCountAtStart).toEqual([0, 0, 0]);
  });

  it('runs setup once across batches', async () => {
    const supplier = make();
    supplier.setBatchSize(1);
    await supplier.refreshProducts([makeRef('a'), makeRef('b'), makeRef('c')]);
    expect(supplier.setupCalls).toBe(1);
  });

  it('fails the batch, with no unhandled rejection, when the time budget elapses', async () => {
    vi.useFakeTimers();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const supplier = make();
      supplier.setSupplierSearchTimeBudgetSec(2);
      let rejectHook: (error: Error) => void = () => undefined;
      supplier.hook = () =>
        new Promise((_, reject) => {
          rejectHook = reject;
        });

      const pending = supplier.refreshProducts([makeRef('a'), makeRef('b')]);
      await vi.advanceTimersByTimeAsync(2_100);
      const results = await pending;

      expect(results.map((r) => r.status)).toEqual([
        PRODUCT_REFRESH_STATUS.FAILED,
        PRODUCT_REFRESH_STATUS.FAILED,
      ]);
      expect(results[0]).toMatchObject({ reason: 'Timed out' });

      // The abandoned request failing later must not surface.
      rejectHook(new Error('late'));
      await vi.advanceTimersByTimeAsync(10);
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('does not time out a batch that finishes inside the budget', async () => {
    const supplier = make();
    supplier.setSupplierSearchTimeBudgetSec(2);
    supplier.hook = async () => ({ builders: [makeBuilder('a')] });
    const [result] = await supplier.refreshProducts([makeRef('a')]);
    expect(result.status).toBe(PRODUCT_REFRESH_STATUS.OK);
  });

  it('fails every ref by default, since the base hook cannot refetch', async () => {
    const supplier = new DefaultHookSupplier('', 5, new AbortController());
    const results = await supplier.refreshProducts([makeRef('a'), makeRef('b')]);
    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.FAILED,
      PRODUCT_REFRESH_STATUS.FAILED,
    ]);
    expect(results[0]).toMatchObject({
      reason: 'DefaultHookSupplier cannot refetch specific products',
    });
  });
});

describe('SupplierBase.refreshViaDetail', () => {
  it('seeds identity from the ref but no price, variants or currency', async () => {
    const supplier = make();
    const seeds: ProductBuilder<Product>[] = [];
    const ref = makeRef('a', {
      id: 7,
      sku: 'SKU-A',
      quantity: 500,
      uom: 'g',
      permalink: 'https://example.invalid/page/a',
      variants: [{ id: 1, sku: 'V1', title: '100 g' }],
    });

    const { builders, failed } = await supplier.callRefreshViaDetail([ref], async (seed) => {
      seeds.push(seed);
      return seed;
    });

    expect(builders).toHaveLength(1);
    expect(failed).toEqual(new Set());
    const dump = seeds[0].dump();
    expect(dump).toMatchObject({
      cacheKey: 'a',
      title: 'Product a',
      url: 'https://example.invalid/p/a',
      id: 7,
      sku: 'SKU-A',
      supplier: 'RefreshSupplier',
      quantity: 500,
      uom: 'g',
    });
    expect(dump.price).toBeUndefined();
    expect(dump.currencyCode).toBeUndefined();
    expect(dump.variants ?? []).toEqual([]);
  });

  it('records one failure in failed only, whether the fetch throws or returns nothing', async () => {
    const supplier = make();
    const refs = [makeRef('a'), makeRef('b'), makeRef('c')];

    const { builders, failed } = await supplier.callRefreshViaDetail(refs, async (seed, ref) => {
      if (ref.cacheKey === 'a') throw new Error('detail failed');
      if (ref.cacheKey === 'b') return undefined;
      return seed;
    });

    expect(builders.map((b) => b.get('cacheKey'))).toEqual(['c']);
    expect(failed).toEqual(new Set(['a', 'b']));
  });

  it('feeds refreshProducts: a failed detail is FAILED and the rest are unaffected', async () => {
    const supplier = make();
    supplier.hook = (refs) =>
      supplier.callRefreshViaDetail(refs, async (seed, ref) => {
        if (ref.cacheKey === 'b') throw new Error('nope');
        seed.setPricing(9, 'USD', '$').setQuantity(100, 'g');
        return seed;
      });

    const results = await supplier.refreshProducts([makeRef('a'), makeRef('b')]);

    expect(results.map((r) => r.status)).toEqual([
      PRODUCT_REFRESH_STATUS.OK,
      PRODUCT_REFRESH_STATUS.FAILED,
    ]);
  });
});
