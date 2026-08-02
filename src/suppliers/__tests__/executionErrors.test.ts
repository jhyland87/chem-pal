// ProductBuilder must load before SupplierBase/SupplierFactory to avoid the module-init cycle.
import '@/utils/ProductBuilder';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordException = vi.fn();
vi.mock('@/helpers/errorBuffer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/helpers/errorBuffer')>();
  return { ...actual, recordException: (...args: unknown[]) => recordException(...args) };
});

const { SupplierFactory } = await import('../SupplierFactory');

/** Reaches the private aggregation helper for direct testing. */
type FactoryInternals = {
  reportExecutionErrors: (errors: { error: unknown; supplier: { supplierName: string } }[]) => void;
};

const makeFactory = () =>
  new SupplierFactory<Product>('test', { limit: 5, controller: new AbortController() });

describe('SupplierFactory execution-error aggregation', () => {
  beforeEach(() => {
    recordException.mockReset();
  });

  it('aggregates supplier failures into a search-sourced AggregateError', () => {
    const factory = makeFactory();
    const errors = [
      { error: new Error('boom A'), supplier: { supplierName: 'AlphaChem' } },
      { error: new Error('boom B'), supplier: { supplierName: 'BetaChem' } },
    ];

    (factory as unknown as FactoryInternals).reportExecutionErrors(errors);

    expect(factory.executionErrors).toBe(errors);
    expect(recordException).toHaveBeenCalledTimes(1);
    const [aggregate, source] = recordException.mock.calls[0];
    expect(source).toBe('search');
    expect(aggregate).toBeInstanceOf(AggregateError);
    expect(aggregate.errors).toHaveLength(2);
    expect(aggregate.message).toContain('AlphaChem');
    expect(aggregate.message).toContain('BetaChem');
  });

  it('records nothing when no supplier failed', () => {
    const factory = makeFactory();
    (factory as unknown as FactoryInternals).reportExecutionErrors([]);
    expect(factory.executionErrors).toEqual([]);
    expect(recordException).not.toHaveBeenCalled();
  });
});
