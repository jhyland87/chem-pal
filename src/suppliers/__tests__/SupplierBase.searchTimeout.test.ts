import { ProductBuilder } from '@/utils/ProductBuilder';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierBase } from '../SupplierBase';

class TimeoutTestSupplier extends SupplierBase<unknown, Product> {
  public readonly supplierName = 'TimeoutTestSupplier';
  public readonly baseURL = 'https://example.invalid';
  public readonly shipping = 'worldwide' as ShippingRange;
  public readonly country = 'US' as CountryCode;
  public readonly paymentMethods = [] as PaymentMethod[];

  protected titleSelector(): Maybe<string> {
    return '';
  }

  protected getUniqueProductKey(data: unknown): string {
    return String((data as { id?: unknown })?.id ?? '');
  }

  protected async queryProducts(): Promise<ProductBuilder<Product>[] | void> {
    return [];
  }

  public callArmSearchTimeout<S extends symbol>(sentinel: S) {
    return (
      this as unknown as {
        armSearchTimeout: (s: S) => {
          promise?: Promise<S>;
          handle?: ReturnType<typeof setTimeout>;
        };
      }
    ).armSearchTimeout(sentinel);
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

  it('treats maxAllowableSearchTimeSec as seconds, not milliseconds', async () => {
    const supplier = new TimeoutTestSupplier('potassium', 5, new AbortController());
    supplier.setMaxAllowableSearchTimeSec(2);
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

  it('stays disarmed when the budget is zero', () => {
    const supplier = new TimeoutTestSupplier('potassium', 5, new AbortController());
    supplier.setMaxAllowableSearchTimeSec(0);

    expect(supplier.callArmSearchTimeout(Symbol('searchTimeout')).promise).toBeUndefined();
  });
});
