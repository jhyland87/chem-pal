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

const { migration } = await import('../steps/v1.7.0-to-v1.7.1');

const ctx = { logger: new Logger('test') } as unknown as MigrationContext;

/** Seeds stored user_settings, runs the step, and returns the rewritten value. */
async function runOn(stored: unknown): Promise<Record<string, unknown> | undefined> {
  store[CACHE.USER_SETTINGS] = stored;
  await migration.up(ctx);
  return store[CACHE.USER_SETTINGS] as Record<string, unknown> | undefined;
}

describe('v1.7.0-to-v1.7.1 migration', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it('drops suppliers.enabled while keeping the live keys', async () => {
    const out = await runOn({
      currency: 'USD',
      suppliers: {
        enabled: ['SupplierA', 'SupplierB'],
        disabled: ['SupplierC'],
        excludeNonShipping: true,
        resultLimit: 5,
      },
    });
    expect(out?.suppliers).toEqual({
      disabled: ['SupplierC'],
      excludeNonShipping: true,
      resultLimit: 5,
    });
    expect(out).toMatchObject({ currency: 'USD' });
  });

  it('heals an array-like {0:…} suppliers into an empty object', async () => {
    const out = await runOn({ suppliers: { 0: 'SupplierA', 1: 'SupplierB' } });
    expect(out?.suppliers).toEqual({});
  });

  it('is a no-op when suppliers is absent or nothing is stored', async () => {
    expect(await runOn({ currency: 'USD' })).toEqual({ currency: 'USD' });
    delete store[CACHE.USER_SETTINGS];
    await migration.up(ctx);
    expect(store[CACHE.USER_SETTINGS]).toBeUndefined();
  });

  it('nests flat search/results/display keys and drops the old flat keys', async () => {
    const out = await runOn({
      groupProductVariants: false,
      hideRestrictedProducts: false,
      autoHideEmptyColumns: false,
      hideColumns: ['cas', 'formula'],
      theme: 'dark',
      fontSize: 'large',
      openInTab: true,
    });
    expect(out?.search).toEqual({ groupProductVariants: false, hideRestrictedProducts: false });
    expect(out?.results).toEqual({ autoHideEmpty: false, hidden: ['cas', 'formula'] });
    expect(out?.display).toEqual({ theme: 'dark', fontSize: 'large', openInTab: true });
    for (const key of [
      'groupProductVariants',
      'hideRestrictedProducts',
      'autoHideEmptyColumns',
      'hideColumns',
      'theme',
      'fontSize',
      'openInTab',
    ]) {
      expect(out).not.toHaveProperty(key);
    }
  });

  it('leaves already-nested search/results/display untouched (idempotent)', async () => {
    const nested = {
      search: { groupProductVariants: true, hideRestrictedProducts: true },
      results: { autoHideEmpty: true, hidden: ['purity'] },
      display: { theme: 'light', fontSize: 'medium', openInTab: false },
    };
    expect(await runOn(nested)).toEqual(nested);
  });
});
