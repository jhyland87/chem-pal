import { CACHE } from '@/constants/common';
import {
  REVIEW_SNOOZE_MS,
  ensureInstallDate,
  getReviewPromptState,
  markReviewed,
  recordSearch,
  snoozeReviewPrompt,
} from '@/utils/reviewStats';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let store: Record<string, unknown> = {};

vi.mock('@/utils/storage', () => ({
  cstorage: {
    local: {
      get: (keys: string[]) =>
        Promise.resolve(Object.fromEntries(keys.map((key) => [key, store[key]]))),
      set: (items: Record<string, unknown>) => {
        Object.assign(store, items);
        return Promise.resolve();
      },
    },
  },
}));

/** The persisted record, typed loosely for assertions. */
const stored = () => store[CACHE.REVIEW_PROMPT] as Record<string, number | boolean | undefined>;

describe('reviewStats', () => {
  beforeEach(() => {
    store = {};
  });

  describe('getReviewPromptState', () => {
    it('returns a zeroed default when nothing is stored', async () => {
      expect(await getReviewPromptState()).toEqual({
        installedAt: 0,
        searchCount: 0,
        totalResults: 0,
        dismissCount: 0,
        snoozedUntil: undefined,
        reviewed: undefined,
      });
    });

    it('normalizes a partial or malformed record', async () => {
      store[CACHE.REVIEW_PROMPT] = { searchCount: 3, totalResults: 'nope', reviewed: 'yes' };
      const state = await getReviewPromptState();
      expect(state.searchCount).toBe(3);
      expect(state.totalResults).toBe(0);
      expect(state.installedAt).toBe(0);
      expect(state.reviewed).toBeUndefined();
    });
  });

  describe('ensureInstallDate', () => {
    it('backfills the install date when absent', async () => {
      await ensureInstallDate();
      expect(stored().installedAt).toBeGreaterThan(0);
    });

    it('leaves an existing install date untouched', async () => {
      store[CACHE.REVIEW_PROMPT] = {
        installedAt: 1000,
        searchCount: 0,
        totalResults: 0,
        dismissCount: 0,
      };
      await ensureInstallDate();
      expect(stored().installedAt).toBe(1000);
    });
  });

  describe('recordSearch', () => {
    it('increments the search count and adds the result total', async () => {
      await recordSearch(10);
      await recordSearch(5);
      expect(stored().searchCount).toBe(2);
      expect(stored().totalResults).toBe(15);
    });

    it('backfills the install date on first search', async () => {
      await recordSearch(1);
      expect(stored().installedAt).toBeGreaterThan(0);
    });

    it.each([0, -3, NaN])(
      'counts the search but adds no products for %s results',
      async (count) => {
        await recordSearch(count);
        expect(stored().searchCount).toBe(1);
        expect(stored().totalResults).toBe(0);
      },
    );
  });

  describe('snoozeReviewPrompt', () => {
    it('snoozes ~30 days on the first dismissal', async () => {
      const before = Date.now();
      await snoozeReviewPrompt();
      expect(stored().dismissCount).toBe(1);
      expect(stored().snoozedUntil).toBeGreaterThanOrEqual(before + REVIEW_SNOOZE_MS);
    });

    it('advances the counter without re-snoozing on later dismissals', async () => {
      await snoozeReviewPrompt();
      const firstSnooze = stored().snoozedUntil;
      await snoozeReviewPrompt();
      expect(stored().dismissCount).toBe(2);
      expect(stored().snoozedUntil).toBe(firstSnooze);
    });
  });

  it('marks the prompt as reviewed', async () => {
    await markReviewed();
    expect(stored().reviewed).toBe(true);
  });
});
