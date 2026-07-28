import { reviewPrompt } from '@/../config.json';
import { CHROME_WEBSTORE_REVIEWS_URL } from '@/constants/common';
import { getInstallSource } from '@/helpers/updates';
import {
  ensureInstallDate,
  getReviewPromptState,
  markReviewed,
  snoozeReviewPrompt,
} from '@/utils/reviewStats';
import { useCallback, useEffect, useState } from 'react';

/** Milliseconds in a day, for the install-age gate. */
const DAY_MS = 24 * 60 * 60 * 1000;

// Eligibility thresholds live in `config.json` under `reviewPrompt` so they can be
// tuned without a code change: days installed and searches run before the prompt
// appears, and the dismissal count that silences it for good.
const { minDaysInstalled: MIN_DAYS_INSTALLED, minSearches: MIN_SEARCHES } = reviewPrompt;
const MAX_DISMISSALS = reviewPrompt.maxDismissals;

/**
 * The usage milestone worth asking the user to rate the extension over.
 * @category Hooks
 * @group Types
 */
export interface ReviewNotice {
  /** Whole days since the extension was installed (or first seen). */
  days: number;
  /** Lifetime number of searches the user has run. */
  searches: number;
  /** Lifetime number of products those searches returned. */
  products: number;
}

/**
 * Return shape of {@link useReviewPrompt}.
 */
interface UseReviewPrompt {
  /** The milestone to celebrate, or `undefined` when the prompt shouldn't show. */
  notice: ReviewNotice | undefined;
  /** Opens the Web Store reviews page and silences the prompt permanently. */
  onReview: () => void;
  /** Snoozes (first time) or silences (thereafter) the prompt. */
  onDismiss: () => void;
}

/**
 * Detects a Firefox runtime by its extension URL scheme. The reviews link is
 * Chrome-specific, so the prompt stays hidden on Firefox builds.
 * @returns True when running as a `moz-extension://` add-on.
 * @source
 */
function isFirefoxRuntime(): boolean {
  try {
    return chrome.runtime.getURL('').startsWith('moz-extension://');
  } catch {
    return false;
  }
}

/**
 * Nudges engaged users to leave a Chrome Web Store review once they've clearly
 * gotten value from the extension.
 *
 * The prompt appears only for a Web Store install that has been present at least
 * `reviewPrompt.minDaysInstalled` days and run at least `reviewPrompt.minSearches`
 * searches (both from `config.json`).
 * The first dismissal snoozes it ~30 days for one final showing; a second
 * dismissal — or opening the reviews page — silences it for good. Install date
 * and counters come from {@link getReviewPromptState}; a pre-existing user with
 * no recorded date is backfilled with "now" on this first check.
 * @returns The pending {@link ReviewNotice} plus `onReview` / `onDismiss` actions.
 * @category Hooks
 * @example
 * ```tsx
 * const { notice, onReview, onDismiss } = useReviewPrompt();
 * // after 15 days and 6 searches returning 42 products:
 * // notice → { days: 15, searches: 6, products: 42 }
 * ```
 * @source
 */
export function useReviewPrompt(): UseReviewPrompt {
  const [notice, setNotice] = useState<ReviewNotice | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        // Only Web Store (Chrome) installs can leave a store review.
        if (isFirefoxRuntime() || getInstallSource() !== 'webstore') return;

        await ensureInstallDate();
        const state = await getReviewPromptState();
        if (cancelled || state.reviewed || state.installedAt <= 0) return;

        const days = Math.floor((Date.now() - state.installedAt) / DAY_MS);
        if (days < MIN_DAYS_INSTALLED || state.searchCount < MIN_SEARCHES) return;

        // Dismissal window: silenced after MAX_DISMISSALS; the first dismissal
        // snoozes until `snoozedUntil` before the one final showing.
        if (state.dismissCount >= MAX_DISMISSALS) return;
        if (state.dismissCount === 1) {
          if (state.snoozedUntil === undefined || Date.now() < state.snoozedUntil) return;
        }

        setNotice({ days, searches: state.searchCount, products: state.totalResults });
      } catch (error) {
        console.error('Failed to evaluate the review prompt:', { error });
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const onReview = useCallback(() => {
    setNotice(undefined);
    chrome.tabs.create({ url: CHROME_WEBSTORE_REVIEWS_URL, active: true });
    void markReviewed();
  }, []);

  const onDismiss = useCallback(() => {
    setNotice(undefined);
    void snoozeReviewPrompt();
  }, []);

  return { notice, onReview, onDismiss };
}
