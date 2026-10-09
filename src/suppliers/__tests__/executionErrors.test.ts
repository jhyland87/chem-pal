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
  logSupplierFailure: (error: unknown, supplier: { supplierName: string }) => void;
  logger: {
    debug: (message: string, detail: { supplier: string }) => void;
    error: (message: string, detail: { supplier: string }) => void;
  };
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

describe('SupplierFactory supplier-failure logging', () => {
  const supplier = { supplierName: 'AlphaChem', secretField: 'must not be logged' };

  /** Runs the logging helper and reports which levels were used. */
  const logFailure = (error: unknown) => {
    const factory = makeFactory();
    const internals = factory as unknown as FactoryInternals;
    const debug = vi.spyOn(internals.logger, 'debug').mockImplementation(() => undefined);
    const logError = vi.spyOn(internals.logger, 'error').mockImplementation(() => undefined);
    internals.logSupplierFailure(error, supplier);
    return { debug, error: logError };
  };

  it.each([
    ['the user stopping the search', 'user_aborted'],
    ['the time budget elapsing', 'time_budget_exceeded'],
    ['an AbortError', new DOMException('stop', 'AbortError')],
  ])('logs %s at debug, not error', (_label, thrown) => {
    const { debug, error } = logFailure(thrown);

    expect(debug).toHaveBeenCalledWith(
      'Supplier stopped by abort',
      expect.objectContaining({ supplier: 'AlphaChem' }),
    );
    expect(error).not.toHaveBeenCalled();
  });

  it.each([
    ['a real error', new TypeError('bad response')],
    ['an unrelated string', 'something else went wrong'],
    ['undefined', undefined],
  ])('logs %s at error', (_label, thrown) => {
    const { debug, error } = logFailure(thrown);

    expect(error).toHaveBeenCalledWith('Error executing supplier', expect.any(Object));
    expect(debug).not.toHaveBeenCalled();
  });

  it('logs only the supplier name, not the whole instance', () => {
    const { error } = logFailure(new Error('boom'));

    const detail = error.mock.calls[0][1];
    expect(detail.supplier).toBe('AlphaChem');
    expect(JSON.stringify(detail)).not.toContain('must not be logged');
  });
});
