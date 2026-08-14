import { CACHE, PANEL } from '@/constants/common';
import { describe, expect, it } from 'vitest';
import { resolveInitialPanel } from '../resolveInitialPanel';

describe.concurrent('resolveInitialPanel', () => {
  it.each([
    {
      name: 'a pending context-menu search wins over an empty cache',
      session: { [CACHE.SEARCH_IS_NEW_SEARCH]: true, [CACHE.QUERY]: 'acetone' },
      count: 0,
      expected: PANEL.RESULTS,
    },
    {
      name: 'a pending search wins even when results are cached',
      session: { [CACHE.SEARCH_IS_NEW_SEARCH]: true, [CACHE.QUERY]: 'acetone' },
      count: 5,
      expected: PANEL.RESULTS,
    },
    {
      name: 'cached results open the results table',
      session: {},
      count: 3,
      expected: PANEL.RESULTS,
    },
    {
      name: 'an empty cache falls back to the search home',
      session: {},
      count: 0,
      expected: PANEL.SEARCH_HOME,
    },
    {
      name: 'the new-search flag without a query is not a pending search',
      session: { [CACHE.SEARCH_IS_NEW_SEARCH]: true },
      count: 0,
      expected: PANEL.SEARCH_HOME,
    },
    {
      name: 'the new-search flag with a blank query is not a pending search',
      session: { [CACHE.SEARCH_IS_NEW_SEARCH]: true, [CACHE.QUERY]: '   ' },
      count: 0,
      expected: PANEL.SEARCH_HOME,
    },
    {
      name: 'a query without the new-search flag is not a pending search',
      session: { [CACHE.QUERY]: 'acetone' },
      count: 0,
      expected: PANEL.SEARCH_HOME,
    },
    {
      name: 'a stale query still yields the table when results exist',
      session: { [CACHE.QUERY]: 'acetone' },
      count: 2,
      expected: PANEL.RESULTS,
    },
  ])('$name', ({ session, count, expected }) => {
    expect(resolveInitialPanel(session, count)).toBe(expected);
  });
});
