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
 * Rewrites the legacy flat settings keys into the 1.7.0 nested shape:
 * - `caching` (boolean) + `cacheTtlMinutes` + `doNotCacheEmptyResults`
 *   → `caching: { enabled, ttlMinutes, doNotCacheEmptyResults }`
 * - `trackPriceHistory` + `priceHistoryMaxPoints` → `priceTracking: { enabled, maxDataPoints }`
 * - `suppliers` (array) + `disabledSuppliers` + `excludeNonShippingSuppliers` +
 *   `supplierResultLimit` → `suppliers: { enabled, disabled, excludeNonShipping, resultLimit }`
 *
 * Idempotent (already-nested input passes through) and non-mutating. Non-object
 * input is returned unchanged.
 * @param raw - The stored `user_settings` value.
 * @returns The migrated settings object, or `raw` when it isn't an object.
 * @example
 * ```ts
 * nestSettings({ caching: true, cacheTtlMinutes: 60 });
 * // => { caching: { enabled: true, doNotCacheEmptyResults: undefined, ttlMinutes: 60 } }
 * ```
 * @source
 */
function nestSettings(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const out: Record<string, unknown> = { ...raw };

  if (
    !isRecord(out.caching) &&
    ('caching' in out || 'cacheTtlMinutes' in out || 'doNotCacheEmptyResults' in out)
  ) {
    out.caching = {
      enabled: typeof raw.caching === 'boolean' ? raw.caching : undefined,
      doNotCacheEmptyResults: raw.doNotCacheEmptyResults,
      ttlMinutes: raw.cacheTtlMinutes,
    };
  }
  delete out.cacheTtlMinutes;
  delete out.doNotCacheEmptyResults;

  if (
    !isRecord(out.priceTracking) &&
    ('trackPriceHistory' in out || 'priceHistoryMaxPoints' in out)
  ) {
    out.priceTracking = {
      enabled: raw.trackPriceHistory,
      maxDataPoints: raw.priceHistoryMaxPoints,
    };
  }
  delete out.trackPriceHistory;
  delete out.priceHistoryMaxPoints;

  const legacyEnabled = Array.isArray(raw.suppliers) ? raw.suppliers : undefined;
  if (
    legacyEnabled ||
    'disabledSuppliers' in out ||
    'excludeNonShippingSuppliers' in out ||
    'supplierResultLimit' in out
  ) {
    const existing = isRecord(out.suppliers) ? out.suppliers : {};
    out.suppliers = {
      ...existing,
      enabled: legacyEnabled ?? existing.enabled,
      disabled: raw.disabledSuppliers ?? existing.disabled,
      excludeNonShipping: raw.excludeNonShippingSuppliers ?? existing.excludeNonShipping,
      resultLimit: raw.supplierResultLimit ?? existing.resultLimit,
    };
  }
  delete out.disabledSuppliers;
  delete out.excludeNonShippingSuppliers;
  delete out.supplierResultLimit;

  return out;
}

/**
 * 1.7.0 groups the flat cache, price-history, and supplier settings into nested
 * `caching` / `priceTracking` / `suppliers` objects. This step rewrites the
 * `user_settings` record in `chrome.storage.local` into that shape (dropping the
 * old flat keys) so existing users keep their saved preferences on upgrade.
 *
 * It transforms `chrome.storage.local` rather than the IndexedDB `db` handle —
 * user settings don't live in the cache. The popup applies pending steps before
 * loading settings, so it reads the migrated shape.
 *
 * @source
 */
export const migration: Migration = {
  from: '1.6.1',
  to: '1.7.0',
  description: 'Group cache, price-tracking, and supplier settings into nested objects',
  async up({ logger }) {
    const stored = (await cstorage.local.get([CACHE.USER_SETTINGS]))[CACHE.USER_SETTINGS];
    if (typeof stored !== 'object' || stored === null) return;
    await cstorage.local.set({ [CACHE.USER_SETTINGS]: nestSettings(stored) });
    logger.info('Migrated user_settings to the nested 1.7.0 shape');
  },
};
