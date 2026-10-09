import { SEARCH_ABORT_REASON } from '@/constants/common';
import { Logger } from '@/utils/Logger';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierBase } from '../SupplierBase';

class TimeoutTestSupplier extends SupplierBase<unknown, Product> {
  public static readonly supplierName = 'TimeoutTestSupplier';
  public static readonly baseURL = 'https://example.invalid';
  public static readonly shipping = 'worldwide' as ShippingRange;
  public static readonly country = 'US' as CountryCode;
  public static readonly paymentMethods = [] as PaymentMethod[];

  protected titleSelector(): Maybe<string> {
    return '';
  }

  protected getUniqueProductKey(data: unknown): string {
    return String((data as { id?: unknown })?.id ?? '');
  }

  protected async queryProducts(): Promise<ProductBuilder<Product>[] | void> {
    return [];
  }

  public callArmSearchTimeout<S extends symbol>(
    sentinel: S,
    getProgress?: () => { found: number; completed: number },
  ) {
    return (
      this as unknown as {
        armSearchTimeout: (
          s: S,
          getProgress?: () => { found: number; completed: number },
        ) => {
          promise?: Promise<S>;
          handle?: ReturnType<typeof setTimeout>;
        };
      }
    ).armSearchTimeout(sentinel, getProgress);
  }

  public get abortSignal() {
    return (this as unknown as { controller: AbortController }).controller.signal;
  }
}

describe('SupplierBase search-time budget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats supplierSearchTimeBudgetSec as seconds, not milliseconds', async () => {
    const supplier = new TimeoutTestSupplier('potassium', 5, new AbortController());
    supplier.setSupplierSearchTimeBudgetSec(2);
    const sentinel = Symbol('searchTimeout');

    const { promise } = supplier.callArmSearchTimeout(sentinel);
    expect(promise).toBeDefined();

    // Well past 2ms but short of 2s: the budget must not have fired yet.
    await vi.advanceTimersByTimeAsync(1_900);
    expect(supplier.abortSignal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(200);
    expect(supplier.abortSignal.aborted).toBe(true);
    await expect(promise).resolves.toBe(sentinel);
  });

  it('aborts with the time-budget reason, so the terminal event can name the cause', async () => {
    const supplier = new TimeoutTestSupplier('potassium', 5, new AbortController());
    supplier.setSupplierSearchTimeBudgetSec(2);

    supplier.callArmSearchTimeout(Symbol('searchTimeout'));
    await vi.advanceTimersByTimeAsync(2_100);

    expect(supplier.abortSignal.reason).toBe(SEARCH_ABORT_REASON.TIME_BUDGET);
  });

  it('stays disarmed when the budget is zero', () => {
    const supplier = new TimeoutTestSupplier('potassium', 5, new AbortController());
    supplier.setSupplierSearchTimeBudgetSec(0);

    expect(supplier.callArmSearchTimeout(Symbol('searchTimeout')).promise).toBeUndefined();
  });
});

describe('SupplierBase search-time budget warning', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Arms a 2 s budget, lets it elapse, and returns what the warning said. */
  async function fire(getProgress?: () => { found: number; completed: number }) {
    const supplier = new TimeoutTestSupplier('potassium', 5, new AbortController());
    supplier.setSupplierSearchTimeBudgetSec(2);
    supplier.callArmSearchTimeout(Symbol('searchTimeout'), getProgress);
    await vi.advanceTimersByTimeAsync(2_100);
    return warn.mock.calls[0];
  }

  it('says how many results are being returned, and how many were fully fetched', async () => {
    const [message, details] = await fire(() => ({ found: 5, completed: 2 }));

    expect(message).toBe(
      'Search exceeded supplierSearchTimeBudgetSec (2s); aborting outstanding requests and returning 5 collected results',
    );
    expect(details).toEqual({
      supplier: 'TimeoutTestSupplier',
      resultsFound: 5,
      resultsCompleted: 2,
      resultsBasicOnly: 3,
    });
  });

  it.each([
    [0, 'returning 0 collected results'],
    [1, 'returning 1 collected result'],
    [2, 'returning 2 collected results'],
  ])('words %i found result(s) correctly', async (found, expected) => {
    const [message] = await fire(() => ({ found, completed: 0 }));

    expect(message).toContain(expected);
    expect(message).not.toMatch(/results?\)/);
  });

  it('reports zero when no progress is supplied', async () => {
    const [message, details] = await fire();

    expect(message).toContain('returning 0 collected results');
    expect(details).toMatchObject({ resultsFound: 0, resultsCompleted: 0, resultsBasicOnly: 0 });
  });

  it('reads the progress when the budget elapses, not when it was armed', async () => {
    const progress = { found: 0, completed: 0 };
    const supplier = new TimeoutTestSupplier('potassium', 5, new AbortController());
    supplier.setSupplierSearchTimeBudgetSec(2);
    supplier.callArmSearchTimeout(Symbol('searchTimeout'), () => progress);
    progress.found = 4;
    progress.completed = 1;
    await vi.advanceTimersByTimeAsync(2_100);

    expect(warn.mock.calls[0][1]).toMatchObject({ resultsFound: 4, resultsCompleted: 1 });
  });
});

describe('SupplierBase.execute when the search-time budget elapses', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports every product found, with only the finished ones counted as completed', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const supplier = new TimeoutTestSupplier('potassium', 5, new AbortController());
    supplier.setSupplierSearchTimeBudgetSec(0.3);
    const internals = supplier as unknown as {
      queryProductsWithCache: () => Promise<ProductBuilder<Product>[]>;
      getProductData: (builder: ProductBuilder<Product>) => Promise<ProductBuilder<Product>>;
      finishProduct: (builder: ProductBuilder<Product>) => Promise<Product>;
      isExcluded: () => boolean;
    };
    const builders = [1, 2, 3].map(
      (n) => new ProductBuilder<Product>(`https://example.invalid/${n}`),
    );
    vi.spyOn(internals, 'queryProductsWithCache').mockResolvedValue(builders);
    vi.spyOn(internals, 'isExcluded').mockReturnValue(false);
    // The first product's detail fetch finishes at once; the other two never do.
    vi.spyOn(internals, 'getProductData').mockImplementation((builder) =>
      builder === builders[0] ? Promise.resolve(builder) : new Promise(() => {}),
    );
    vi.spyOn(internals, 'finishProduct').mockImplementation(
      async (builder) =>
        ({
          url: builder.get('url'),
        }) as unknown as Product,
    );

    const yielded: Product[] = [];
    for await (const product of supplier.execute()) {
      yielded.push(product);
    }

    expect(yielded).toHaveLength(3);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('returning 3 collected results'),
      expect.objectContaining({ resultsFound: 3, resultsCompleted: 1, resultsBasicOnly: 2 }),
    );
  });
});
