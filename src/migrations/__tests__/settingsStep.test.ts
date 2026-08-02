import { CACHE } from '@/constants/common';
import { Logger } from '@/utils/Logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

/** Seeds stored user_settings, runs the step, and returns the rewritten value. */
async function runOn(stored: unknown): Promise<Record<string, unknown> | undefined> {
  store[CACHE.USER_SETTINGS] = stored;
  await migration.up(ctx);
  const result = store[CACHE.USER_SETTINGS];
  return result as Record<string, unknown> | undefined;
}

describe('v1.6.1-to-v1.7.0 migration', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it('nests legacy caching keys and drops the flat ones', async () => {
    const out = await runOn({ caching: true, cacheTtlMinutes: 60, doNotCacheEmptyResults: true });
    expect(out).toMatchObject({
      caching: { enabled: true, ttlMinutes: 60, doNotCacheEmptyResults: true },
    });
    expect(out).not.toHaveProperty('cacheTtlMinutes');
    expect(out).not.toHaveProperty('doNotCacheEmptyResults');
  });

  it('nests legacy price-history keys', async () => {
    const out = await runOn({ trackPriceHistory: false, priceHistoryMaxPoints: 10 });
    expect(out).toMatchObject({ priceTracking: { enabled: false, maxDataPoints: 10 } });
    expect(out).not.toHaveProperty('trackPriceHistory');
    expect(out).not.toHaveProperty('priceHistoryMaxPoints');
  });

  it('nests legacy supplier keys, mapping the enabled array', async () => {
    const out = await runOn({
      suppliers: ['SupplierA', 'SupplierB'],
      disabledSuppliers: ['SupplierC'],
      excludeNonShippingSuppliers: false,
      supplierResultLimit: 25,
    });
    expect(out).toMatchObject({
      suppliers: {
        enabled: ['SupplierA', 'SupplierB'],
        disabled: ['SupplierC'],
        excludeNonShipping: false,
        resultLimit: 25,
      },
    });
    expect(out).not.toHaveProperty('disabledSuppliers');
    expect(out).not.toHaveProperty('supplierResultLimit');
  });

  it('leaves already-nested settings untouched (idempotent)', async () => {
    const nested = {
      caching: { enabled: true, ttlMinutes: 7200 },
      priceTracking: { enabled: true, maxDataPoints: 5 },
      suppliers: { enabled: [], disabled: [], excludeNonShipping: true },
    };
    expect(await runOn(nested)).toEqual(nested);
  });

  it('no-ops when nothing is stored', async () => {
    await migration.up(ctx);
    expect(store[CACHE.USER_SETTINGS]).toBeUndefined();
  });
});
