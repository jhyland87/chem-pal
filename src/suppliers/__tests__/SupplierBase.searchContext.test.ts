// ProductBuilder must be imported before SupplierBase/SupplierLabStuff (module-init cycle).
import '@/utils/ProductBuilder';
import { Logger } from '@/utils/Logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierFactory } from '../SupplierFactory';
import { SupplierLabStuff } from '../SupplierLabStuff';

// Supplier and factory loggers carry their own search's query, so a log they emit late (after the
// UI has moved on, e.g. following an abort) is still attributed to the right search.
describe('search query context on supplier loggers', () => {
  const emit = vi.fn();

  beforeEach(() => {
    emit.mockReset();
    Logger.setRemoteSink({ isEnabled: () => true, emit });
    Logger.setContext(undefined);
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    Logger.setRemoteSink(undefined);
    vi.restoreAllMocks();
  });

  it("tags a supplier's logs with the query it was created for", () => {
    const supplier = new SupplierLabStuff('acetone', 5, new AbortController());
    Reflect.get(supplier, 'logger').debug('probe');

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ context: { search_query: 'acetone' } }),
    );
  });

  it('keeps each supplier on its own query when two searches overlap', () => {
    const first = new SupplierLabStuff('acetone', 5, new AbortController());
    const second = new SupplierLabStuff('ethanol', 5, new AbortController());
    Logger.setContext({ search_query: 'ethanol' });
    Reflect.get(first, 'logger').debug('from the first search');
    Reflect.get(second, 'logger').debug('from the second search');

    expect(emit.mock.calls.map(([record]) => record.context.search_query)).toEqual([
      'acetone',
      'ethanol',
    ]);
  });

  it("keeps the search's trace id on a supplier's logs after the search has ended", () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    Logger.setContext({ search_query: 'acetone', trace_id: traceId });
    const supplier = new SupplierLabStuff('acetone', 5, new AbortController());
    Logger.setContext(undefined);
    Reflect.get(supplier, 'logger').debug('late log');

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ context: { search_query: 'acetone', trace_id: traceId } }),
    );
  });

  it('gives the factory the same trace id as the search that created it', () => {
    const traceId = 'a'.repeat(32);
    Logger.setContext({ search_query: 'x', trace_id: traceId });
    const factory = new SupplierFactory('sodium chloride', {
      limit: 5,
      controller: new AbortController(),
    });
    Logger.setContext(undefined);
    Reflect.get(factory, 'logger').debug('probe');

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { search_query: 'sodium chloride', trace_id: traceId },
      }),
    );
  });

  it("tags the factory's logs with its query", () => {
    const factory = new SupplierFactory('sodium chloride', {
      limit: 5,
      controller: new AbortController(),
    });
    Reflect.get(factory, 'logger').debug('probe');

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ context: { search_query: 'sodium chloride' } }),
    );
  });
});
