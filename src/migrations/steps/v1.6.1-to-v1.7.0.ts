import { CACHE } from '@/constants/common';
import { migrateUserSettings } from '@/helpers/settingsMigration';
import { cstorage } from '@/utils/storage';
import type { Migration } from '../types';

/**
 * 1.7.0 groups the flat cache, price-history, and supplier settings into nested
 * `caching` / `priceTracking` / `suppliers` objects. This step rewrites the
 * `user_settings` record in `chrome.storage.local` into the new shape (and drops
 * the old flat keys) so the upgrade is recorded and shown in the update prompt.
 *
 * It transforms `chrome.storage.local` rather than the IndexedDB `db` handle —
 * user settings don't live in the cache. This is the sole migration path: the
 * popup applies pending steps before loading settings, so it reads the migrated
 * shape. (The options page doesn't run this engine, and upgrades from before
 * 1.6.1 skip this step, so those read paths fall back to defaults for old data.)
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
    await cstorage.local.set({ [CACHE.USER_SETTINGS]: migrateUserSettings(stored) });
    logger.info('Migrated user_settings to the nested 1.7.0 shape');
  },
};
