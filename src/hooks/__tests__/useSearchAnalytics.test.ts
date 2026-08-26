import { emitSearchEvent, SearchEvent } from '@/events/searchEvents';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const trackEvent = vi.fn();
vi.mock('@/helpers/analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

const { useSearchAnalytics } = await import('@/hooks/useSearchAnalytics');

/** Outcome payload shared by the terminal-event cases. */
const OUTCOME = { count: 7, durationMs: 1240, suppliersQueried: 8, suppliersCompleted: 2 };

/** The PostHog properties {@link OUTCOME} maps to, for a search of "acetone". */
const OUTCOME_PARAMS = {
  search_term: 'acetone',
  result_count: 7,
  duration_ms: 1240,
  suppliers_queried: 8,
  suppliers_completed: 2,
};

describe('useSearchAnalytics', () => {
  afterEach(() => {
    trackEvent.mockReset();
  });

  it('maps STARTED to search_query and a clean COMPLETED to search_results', () => {
    renderHook(() => useSearchAnalytics());

    emitSearchEvent(SearchEvent.STARTED, { query: '  acetone  ' });
    expect(trackEvent).toHaveBeenCalledWith('search_query', { search_term: 'acetone' });

    emitSearchEvent(SearchEvent.COMPLETED, OUTCOME);
    expect(trackEvent).toHaveBeenCalledWith('search_results', OUTCOME_PARAMS);
  });

  it.each([
    {
      name: 'COMPLETED carrying an abortReason (the user stopped it)',
      emit: () =>
        emitSearchEvent(SearchEvent.COMPLETED, { ...OUTCOME, abortReason: 'user_aborted' }),
      expected: { ...OUTCOME_PARAMS, reason: 'user_aborted' },
    },
    {
      name: 'COMPLETED carrying an abortReason (the time budget elapsed)',
      emit: () =>
        emitSearchEvent(SearchEvent.COMPLETED, {
          ...OUTCOME,
          abortReason: 'time_budget_exceeded',
        }),
      expected: { ...OUTCOME_PARAMS, reason: 'time_budget_exceeded' },
    },
    {
      name: 'ABORTED',
      emit: () => emitSearchEvent(SearchEvent.ABORTED, { ...OUTCOME, reason: 'user_aborted' }),
      expected: { ...OUTCOME_PARAMS, reason: 'user_aborted' },
    },
    {
      name: 'ABORTED with no reason',
      emit: () => emitSearchEvent(SearchEvent.ABORTED, OUTCOME),
      expected: { ...OUTCOME_PARAMS, reason: 'unknown' },
    },
    {
      name: 'FAILED',
      emit: () => emitSearchEvent(SearchEvent.FAILED, { ...OUTCOME, error: 'boom' }),
      expected: { ...OUTCOME_PARAMS, reason: 'error', error_message: 'boom' },
    },
    {
      name: 'FAILED with no message',
      emit: () => emitSearchEvent(SearchEvent.FAILED, OUTCOME),
      expected: { ...OUTCOME_PARAMS, reason: 'error' },
    },
  ])('reports search_terminated for $name', ({ emit, expected }) => {
    renderHook(() => useSearchAnalytics());
    emitSearchEvent(SearchEvent.STARTED, { query: 'acetone' });
    trackEvent.mockReset();

    emit();

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('search_terminated', expected);
  });

  it('does not report search_results for a terminated search', () => {
    renderHook(() => useSearchAnalytics());
    emitSearchEvent(SearchEvent.STARTED, { query: 'acetone' });

    emitSearchEvent(SearchEvent.COMPLETED, { ...OUTCOME, abortReason: 'user_aborted' });

    expect(trackEvent).not.toHaveBeenCalledWith('search_results', expect.anything());
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useSearchAnalytics());
    unmount();
    trackEvent.mockReset();

    emitSearchEvent(SearchEvent.STARTED, { query: 'salt' });
    emitSearchEvent(SearchEvent.COMPLETED, OUTCOME);
    emitSearchEvent(SearchEvent.ABORTED, { ...OUTCOME, reason: 'user_aborted' });
    emitSearchEvent(SearchEvent.FAILED, { ...OUTCOME, error: 'boom' });
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
