import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchEvent, emitSearchEvent, onSearchEvent } from '../searchEvents';

describe('searchEvents', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delivers typed detail from emit to on', () => {
    const handler = vi.fn();
    const off = onSearchEvent(SearchEvent.RESULTS_COUNT, handler);

    emitSearchEvent(SearchEvent.RESULTS_COUNT, { count: 7 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ count: 7 });
    off();
  });

  it('delivers payloadless events (detail defaults to null)', () => {
    const handler = vi.fn();
    const off = onSearchEvent(SearchEvent.ABORTED, handler);

    emitSearchEvent(SearchEvent.ABORTED);

    // CustomEvent with no detail yields `null` (the DOM default), not undefined.
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(null);
    off();
  });

  it('stops delivering after the returned unsubscribe is called', () => {
    const handler = vi.fn();
    const off = onSearchEvent(SearchEvent.STARTED, handler);

    emitSearchEvent(SearchEvent.STARTED, { query: 'acetone' });
    off();
    emitSearchEvent(SearchEvent.STARTED, { query: 'benzene' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ query: 'acetone' });
  });

  it('only invokes the handler for its own event type', () => {
    const handler = vi.fn();
    const off = onSearchEvent(SearchEvent.COMPLETED, handler);

    emitSearchEvent(SearchEvent.STARTED, { query: 'x' });

    expect(handler).not.toHaveBeenCalled();
    off();
  });
});
