import { emitSearchEvent, SearchEvent } from '@/events/searchEvents';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const trackEvent = vi.fn();
vi.mock('@/helpers/analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

const { useSearchAnalytics } = await import('@/hooks/useSearchAnalytics');

describe('useSearchAnalytics', () => {
  afterEach(() => {
    trackEvent.mockReset();
  });

  it('maps STARTED to search_query and COMPLETED to search_results', () => {
    renderHook(() => useSearchAnalytics());

    emitSearchEvent(SearchEvent.STARTED, { query: '  acetone  ' });
    expect(trackEvent).toHaveBeenCalledWith('search_query', { search_term: 'acetone' });

    emitSearchEvent(SearchEvent.COMPLETED, { count: 7 });
    expect(trackEvent).toHaveBeenCalledWith('search_results', {
      search_term: 'acetone',
      result_count: 7,
    });
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useSearchAnalytics());
    unmount();
    trackEvent.mockReset();

    emitSearchEvent(SearchEvent.STARTED, { query: 'salt' });
    emitSearchEvent(SearchEvent.COMPLETED, { count: 1 });
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
