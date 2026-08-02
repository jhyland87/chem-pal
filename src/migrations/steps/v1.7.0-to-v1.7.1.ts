import { CACHE } from '@/constants/common';
import { cstorage } from '@/utils/storage';
import type { Migration } from '../types';

/**
 * Narrows an unknown value to a plain (non-array) object record.
 * @param value - The value to test.
 * @returns `true` when `value` is a non-null, non-array object.
 * @source
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Rebuilds `suppliers` keeping only the live keys (`disabled`, `excludeNonShipping`,
 * `resultLimit`). This drops the vestigial `enabled` allow-list (never used by
 * search — selection is session-scoped) and any stray numeric keys left by an
 * array that was spread into an object. Idempotent and non-mutating.
 * @param raw - The stored `user_settings` value.
 * @returns The settings with a cleaned `suppliers`, or `raw` when not an object.
 * @source
 */
function dropSupplierEnabled(raw: unknown): unknown {
  if (!isRecord(raw) || !isRecord(raw.suppliers)) return raw;
  const source = raw.suppliers;
  const suppliers: Record<string, unknown> = {};
  if ('disabled' in source) suppliers.disabled = source.disabled;
  if ('excludeNonShipping' in source) suppliers.excludeNonShipping = source.excludeNonShipping;
  if ('resultLimit' in source) suppliers.resultLimit = source.resultLimit;
  return { ...raw, suppliers };
}

/**
 * 1.7.1 drops the vestigial `suppliers.enabled` allow-list from stored settings
 * (search never used it — supplier selection is session-scoped, and the deny-list
 * is `suppliers.disabled`). Also self-heals profiles whose `suppliers` was
 * corrupted into an array-like `{0:…}` object.
 *
 * Transforms `chrome.storage.local` rather than the IndexedDB `db` handle — user
 * settings don't live in the cache. The popup applies pending steps before
 * loading settings, so it reads the cleaned shape.
 *
 * @source
 */
export const migration: Migration = {
  from: '1.7.0',
  to: '1.7.1',
  description: 'Drop the unused suppliers.enabled list from saved settings',
  async up({ logger }) {
    const stored = (await cstorage.local.get([CACHE.USER_SETTINGS]))[CACHE.USER_SETTINGS];
    if (typeof stored !== 'object' || stored === null) return;
    await cstorage.local.set({ [CACHE.USER_SETTINGS]: dropSupplierEnabled(stored) });
    logger.info('Dropped suppliers.enabled from user_settings');
  },
};
