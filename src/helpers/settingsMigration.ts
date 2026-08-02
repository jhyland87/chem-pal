/**
 * @group Helpers
 * @groupDescription Pure transform from the legacy flat user-settings schema to
 * the current nested shape (`caching` / `priceTracking` / `suppliers`). Invoked by
 * the 1.6.1→1.7.0 migration step, which rewrites the `user_settings` record in
 * chrome.storage on upgrade so existing users keep their saved preferences.
 * @source
 */

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
 * Migrates legacy flat user-settings keys into the current nested objects:
 * - `caching` (boolean) + `cacheTtlMinutes` + `doNotCacheEmptyResults`
 *   → `caching: { enabled, ttlMinutes, doNotCacheEmptyResults }`
 * - `trackPriceHistory` + `priceHistoryMaxPoints`
 *   → `priceTracking: { enabled, maxDataPoints }`
 * - `suppliers` (array) + `disabledSuppliers` + `excludeNonShippingSuppliers` +
 *   `supplierResultLimit` → `suppliers: { enabled, disabled, excludeNonShipping, resultLimit }`
 *
 * Idempotent (already-nested input passes through untouched) and non-mutating.
 * Non-object input (e.g. `undefined`) is returned unchanged.
 * @param raw - The raw value read from the `user_settings` store.
 * @returns The migrated settings object, or `raw` when it isn't an object.
 * @example
 * ```ts
 * migrateUserSettings({ caching: true, cacheTtlMinutes: 60 });
 * // => { caching: { enabled: true, doNotCacheEmptyResults: undefined, ttlMinutes: 60 } }
 * ```
 * @source
 */
export function migrateUserSettings(raw: unknown): unknown {
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
