import { CACHE, CHROME_WEBSTORE_REVIEWS_URL } from '@/constants/common';
import { useReviewPrompt } from '@/hooks/useReviewPrompt';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DAY_MS = 24 * 60 * 60 * 1000;

let store: Record<string, unknown> = {};

// Real reviewStats runs against this in-memory store.
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

const tabsCreate = vi.fn();

/**
 * Installs a chrome stub. A manifest with `update_url` reads as a Web Store
 * install; `getURL` decides the Chrome-vs-Firefox runtime check.
 */
function setupChrome({
  webstore = true,
  firefox = false,
}: { webstore?: boolean; firefox?: boolean } = {}) {
  const manifest = webstore
    ? { update_url: 'https://clients2.google.com/service/update2/crx' }
    : {};
  const url = firefox ? 'moz-extension://abc/' : 'chrome-extension://abc/';
  (globalThis as unknown as { chrome: Record<string, unknown> }).chrome = {
    runtime: { getManifest: () => manifest, getURL: () => url },
    tabs: { create: tabsCreate },
  };
}

/** Lets the hook's async check settle before asserting a silent outcome. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Seeds the stored review-prompt record. */
function seed(state: Record<string, unknown>) {
  store[CACHE.REVIEW_PROMPT] = state;
}

/** A record that satisfies every gate: 15 days installed, 6 searches, undismissed. */
function eligibleState(overrides: Record<string, unknown> = {}) {
  return {
    installedAt: Date.now() - 15 * DAY_MS,
    searchCount: 6,
    totalResults: 42,
    dismissCount: 0,
    ...overrides,
  };
}

describe('useReviewPrompt', () => {
  beforeEach(() => {
    store = {};
    tabsCreate.mockReset();
    setupChrome();
  });

  it('shows once the day and search thresholds are met', async () => {
    seed(eligibleState());
    const { result } = renderHook(() => useReviewPrompt());

    await waitFor(() => expect(result.current.notice).toBeDefined());
    expect(result.current.notice).toEqual({ days: 15, searches: 6, products: 42 });
  });

  it.each([
    ['too few days installed', { installedAt: Date.now() - 10 * DAY_MS }],
    ['too few searches', { searchCount: 4 }],
    ['already reviewed', { reviewed: true }],
    ['dismissed twice', { dismissCount: 2 }],
    ['snoozed and still within the window', { dismissCount: 1, snoozedUntil: Date.now() + DAY_MS }],
  ])('stays silent when %s', async (_label, overrides) => {
    seed(eligibleState(overrides));
    const { result } = renderHook(() => useReviewPrompt());

    await settle();
    expect(result.current.notice).toBeUndefined();
  });

  // The one final showing after the ~30-day snooze elapses.
  it('shows again once the snooze window has passed', async () => {
    seed(eligibleState({ dismissCount: 1, snoozedUntil: Date.now() - DAY_MS }));
    const { result } = renderHook(() => useReviewPrompt());

    await waitFor(() => expect(result.current.notice).toBeDefined());
  });

  it('stays silent for non-Web-Store installs', async () => {
    setupChrome({ webstore: false });
    seed(eligibleState());
    const { result } = renderHook(() => useReviewPrompt());

    await settle();
    expect(result.current.notice).toBeUndefined();
  });

  it('stays silent on Firefox', async () => {
    setupChrome({ firefox: true });
    seed(eligibleState());
    const { result } = renderHook(() => useReviewPrompt());

    await settle();
    expect(result.current.notice).toBeUndefined();
  });

  it('backfills the install date for a pre-existing user with no record', async () => {
    const { result } = renderHook(() => useReviewPrompt());

    await settle();
    // Nothing to show yet (0 days, 0 searches), but the date is now recorded.
    expect(result.current.notice).toBeUndefined();
    expect((store[CACHE.REVIEW_PROMPT] as { installedAt: number }).installedAt).toBeGreaterThan(0);
  });

  it('opens the reviews page and silences the prompt on review', async () => {
    seed(eligibleState());
    const { result } = renderHook(() => useReviewPrompt());
    await waitFor(() => expect(result.current.notice).toBeDefined());

    act(() => result.current.onReview());

    expect(tabsCreate).toHaveBeenCalledWith({ url: CHROME_WEBSTORE_REVIEWS_URL, active: true });
    await waitFor(() =>
      expect((store[CACHE.REVIEW_PROMPT] as { reviewed?: boolean }).reviewed).toBe(true),
    );
    expect(result.current.notice).toBeUndefined();
  });

  it('snoozes the prompt on dismiss', async () => {
    seed(eligibleState());
    const { result } = renderHook(() => useReviewPrompt());
    await waitFor(() => expect(result.current.notice).toBeDefined());

    act(() => result.current.onDismiss());

    await waitFor(() =>
      expect((store[CACHE.REVIEW_PROMPT] as { dismissCount: number }).dismissCount).toBe(1),
    );
    expect(result.current.notice).toBeUndefined();
  });
});
