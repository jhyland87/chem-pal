import { CACHE } from '@/constants/common';
import { Logger } from '@/utils/Logger';
import { describe, expect, it, vi } from 'vitest';
import type { MigrationContext } from '../types';

const store: Record<string, unknown> = {};
vi.mock('@/utils/storage', () => ({
  cstorage: {
    local: {
      get: async (keys: string[]) => Object.fromEntries(keys.map((key) => [key, store[key]])),
      set: async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      },
    },
  },
}));

const { migration } = await import('../steps/v1.6.1-to-v1.7.0');

/** The step ignores the IndexedDB handle; a stub context is enough. */
const ctx = { logger: new Logger('test') } as unknown as MigrationContext;

describe('v1.6.1-to-v1.7.0 migration', () => {
  it('rewrites stored user_settings into the nested shape and drops old keys', async () => {
    store[CACHE.USER_SETTINGS] = {
      caching: true,
      cacheTtlMinutes: 60,
      trackPriceHistory: false,
      disabledSuppliers: ['SupplierX'],
      supplierResultLimit: 25,
    };

    await migration.up(ctx);

    expect(store[CACHE.USER_SETTINGS]).toMatchObject({
      caching: { enabled: true, ttlMinutes: 60 },
      priceTracking: { enabled: false },
      suppliers: { disabled: ['SupplierX'], resultLimit: 25 },
    });
    expect(store[CACHE.USER_SETTINGS]).not.toHaveProperty('cacheTtlMinutes');
    expect(store[CACHE.USER_SETTINGS]).not.toHaveProperty('disabledSuppliers');
  });

  it('no-ops when nothing is stored', async () => {
    delete store[CACHE.USER_SETTINGS];
    await expect(migration.up(ctx)).resolves.toBeUndefined();
    expect(store[CACHE.USER_SETTINGS]).toBeUndefined();
  });
});
