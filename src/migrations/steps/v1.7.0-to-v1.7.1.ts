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
 * Rewrites the flat search/results/display keys into the 1.7.1 nested shape:
 * - `groupProductVariants` + `hideRestrictedProducts` → `search: { … }`
 * - `autoHideEmptyColumns` + `hideColumns` → `results: { autoHideEmpty, hidden }`
 * - `theme` + `fontSize` + `openInTab` → `display: { theme, fontSize, openInTab }`
 *
 * Idempotent (already-nested input passes through untouched) and non-mutating;
 * non-object input is returned unchanged.
 * @param raw - The stored `user_settings` value.
 * @returns The settings with nested groups, or `raw` when not an object.
 * @source
 */
function nestGroupedSettings(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const out: Record<string, unknown> = { ...raw };

  if (!isRecord(out.search) && ('groupProductVariants' in out || 'hideRestrictedProducts' in out)) {
    out.search = {
      groupProductVariants: raw.groupProductVariants,
      hideRestrictedProducts: raw.hideRestrictedProducts,
    };
  }
  delete out.groupProductVariants;
  delete out.hideRestrictedProducts;

  if (!isRecord(out.results) && ('autoHideEmptyColumns' in out || 'hideColumns' in out)) {
    out.results = {
      autoHideEmpty: raw.autoHideEmptyColumns,
      hidden: raw.hideColumns,
    };
  }
  delete out.autoHideEmptyColumns;
  delete out.hideColumns;

  if (!isRecord(out.display) && ('theme' in out || 'fontSize' in out || 'openInTab' in out)) {
    out.display = {
      theme: raw.theme,
      fontSize: raw.fontSize,
      openInTab: raw.openInTab,
    };
  }
  delete out.theme;
  delete out.fontSize;
  delete out.openInTab;

  return out;
}

/**
 * 1.7.1 reshapes saved settings: it drops the vestigial `suppliers.enabled`
 * allow-list (search never used it — supplier selection is session-scoped, and the
 * deny-list is `suppliers.disabled`; also self-heals a `suppliers` corrupted into an
 * array-like `{0:…}` object), and groups the flat search (`groupProductVariants`,
 * `hideRestrictedProducts`), results (`autoHideEmptyColumns`, `hideColumns`), and
 * display (`theme`, `fontSize`, `openInTab`) keys into nested `search` / `results` /
 * `display` objects so existing users keep those preferences on upgrade.
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
  description: 'Drop suppliers.enabled and nest search/results/display settings',
  async up({ logger }) {
    const stored = (await cstorage.local.get([CACHE.USER_SETTINGS]))[CACHE.USER_SETTINGS];
    if (typeof stored !== 'object' || stored === null) return;
    const migrated = nestGroupedSettings(dropSupplierEnabled(stored));
    await cstorage.local.set({ [CACHE.USER_SETTINGS]: migrated });
    logger.info('Cleaned suppliers.enabled and nested search/results/display in user_settings');
  },
};
