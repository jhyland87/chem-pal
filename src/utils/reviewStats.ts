/**
 * Persists the small bookkeeping record behind the "leave a review" prompt:
 * when the extension was installed, how many searches the user has run, how many
 * products those searches returned, and the prompt's dismissal state.
 *
 * Stored as a single object under {@link CACHE.REVIEW_PROMPT} in
 * `chrome.storage.local` (via {@link cstorage}). Every mutation is a
 * read-modify-write of that one record; reads normalize partial or legacy shapes
 * so callers always receive a fully-populated {@link ReviewPromptState}.
 * @module reviewStats
 * @category Utils
 * @group Stats
 * @source
 */

import { CACHE } from '@/constants/common';
import { cstorage } from '@/utils/storage';

/** Milliseconds in a day, for install-age and snooze math. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** How long the first dismissal snoozes the prompt before its final showing. */
export const REVIEW_SNOOZE_MS = 30 * DAY_MS;

/**
 * The review-prompt record persisted under {@link CACHE.REVIEW_PROMPT}.
 * @category Utils
 * @group Stats
 */
export interface ReviewPromptState {
  /** Epoch ms the extension was installed (or first seen, for pre-existing users). */
  installedAt: number;
  /** Lifetime count of user-initiated searches. */
  searchCount: number;
  /** Lifetime count of products returned across all searches. */
  totalResults: number;
  /** Times the prompt has been dismissed: 0 (never), 1 (snoozed), 2 (silenced). */
  dismissCount: number;
  /** Epoch ms before which the prompt stays hidden after the first dismissal. */
  snoozedUntil?: number;
  /** True once the user has opened the reviews page — the prompt never returns. */
  reviewed?: boolean;
}

/** A fresh record: no install date yet, all counters zeroed. */
const DEFAULT_STATE: ReviewPromptState = {
  installedAt: 0,
  searchCount: 0,
  totalResults: 0,
  dismissCount: 0,
};

/**
 * Narrows an unknown storage value to a plain object for field extraction.
 * @param value - Raw value read from storage.
 * @returns True when the value is a non-null object.
 * @source
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Coerces a raw storage value into a complete {@link ReviewPromptState},
 * defaulting any missing or malformed field. Tolerates partial records so a
 * later-added field never throws on an older stored shape.
 * @param raw - The object read from storage.
 * @returns A fully-populated review-prompt state.
 * @source
 */
function normalize(raw: Record<string, unknown>): ReviewPromptState {
  const num = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return {
    installedAt: num(raw.installedAt, 0),
    searchCount: num(raw.searchCount, 0),
    totalResults: num(raw.totalResults, 0),
    dismissCount: num(raw.dismissCount, 0),
    snoozedUntil: typeof raw.snoozedUntil === 'number' ? raw.snoozedUntil : undefined,
    reviewed: raw.reviewed === true ? true : undefined,
  };
}

/**
 * Reads the current review-prompt state, normalized. Returns a zeroed default
 * when nothing has been stored yet.
 * @returns The persisted {@link ReviewPromptState}.
 * @example
 * ```typescript
 * const state = await getReviewPromptState();
 * state.searchCount; // 0 on a fresh profile
 * ```
 * @category Utils
 * @group Stats
 * @source
 */
export async function getReviewPromptState(): Promise<ReviewPromptState> {
  try {
    const stored = (await cstorage.local.get([CACHE.REVIEW_PROMPT]))[CACHE.REVIEW_PROMPT];
    return isRecord(stored) ? normalize(stored) : { ...DEFAULT_STATE };
  } catch (error) {
    console.error('Failed to read review-prompt state:', { error });
    return { ...DEFAULT_STATE };
  }
}

/**
 * Records the install date the first time it's seen. New installs get an exact
 * date from the service worker; pre-existing users are backfilled with "now" on
 * their first open after this ships. A no-op once `installedAt` is set.
 * @returns Resolves once the date has been backfilled (or was already present).
 * @example
 * ```typescript
 * await ensureInstallDate(); // sets installedAt on a profile that had none
 * ```
 * @category Utils
 * @group Stats
 * @source
 */
export async function ensureInstallDate(): Promise<void> {
  const state = await getReviewPromptState();
  if (state.installedAt > 0) return;
  await cstorage.local.set({
    [CACHE.REVIEW_PROMPT]: { ...state, installedAt: Date.now() },
  });
}

/**
 * Tallies one completed search and the products it returned. Also backfills the
 * install date, so counting starts even if the record was never seeded.
 * @param resultCount - The number of products this search produced.
 * @returns Resolves once the updated counters have been persisted.
 * @example
 * ```typescript
 * await recordSearch(42); // searchCount += 1, totalResults += 42
 * ```
 * @category Utils
 * @group Stats
 * @source
 */
export async function recordSearch(resultCount: number): Promise<void> {
  const state = await getReviewPromptState();
  const added = Number.isFinite(resultCount) && resultCount > 0 ? resultCount : 0;
  await cstorage.local.set({
    [CACHE.REVIEW_PROMPT]: {
      ...state,
      installedAt: state.installedAt > 0 ? state.installedAt : Date.now(),
      searchCount: state.searchCount + 1,
      totalResults: state.totalResults + added,
    },
  });
}

/**
 * Records a dismissal. The first ✕ snoozes the prompt for {@link REVIEW_SNOOZE_MS}
 * so it can show one final time; any later dismissal just advances the counter,
 * which silences it for good.
 * @returns Resolves once the dismissal has been persisted.
 * @example
 * ```typescript
 * await snoozeReviewPrompt(); // dismissCount 0 -> 1, sets snoozedUntil
 * ```
 * @category Utils
 * @group Stats
 * @source
 */
export async function snoozeReviewPrompt(): Promise<void> {
  const state = await getReviewPromptState();
  const dismissCount = state.dismissCount + 1;
  await cstorage.local.set({
    [CACHE.REVIEW_PROMPT]: {
      ...state,
      dismissCount,
      snoozedUntil: dismissCount === 1 ? Date.now() + REVIEW_SNOOZE_MS : state.snoozedUntil,
    },
  });
}

/**
 * Marks the prompt as answered once the user opens the reviews page, so it never
 * appears again.
 * @returns Resolves once the reviewed flag has been persisted.
 * @example
 * ```typescript
 * await markReviewed(); // sets reviewed: true
 * ```
 * @category Utils
 * @group Stats
 * @source
 */
export async function markReviewed(): Promise<void> {
  const state = await getReviewPromptState();
  await cstorage.local.set({
    [CACHE.REVIEW_PROMPT]: { ...state, reviewed: true },
  });
}
