import { migrateUserSettings } from '@/helpers/settingsMigration';
import { describe, expect, it } from 'vitest';

describe('migrateUserSettings', () => {
  it('nests legacy caching keys', () => {
    const out = migrateUserSettings({
      caching: true,
      cacheTtlMinutes: 60,
      doNotCacheEmptyResults: true,
    });
    expect(out).toMatchObject({
      caching: { enabled: true, ttlMinutes: 60, doNotCacheEmptyResults: true },
    });
    expect(out).not.toHaveProperty('cacheTtlMinutes');
    expect(out).not.toHaveProperty('doNotCacheEmptyResults');
  });

  it('nests legacy price-history keys', () => {
    const out = migrateUserSettings({ trackPriceHistory: false, priceHistoryMaxPoints: 10 });
    expect(out).toMatchObject({ priceTracking: { enabled: false, maxDataPoints: 10 } });
    expect(out).not.toHaveProperty('trackPriceHistory');
    expect(out).not.toHaveProperty('priceHistoryMaxPoints');
  });

  it('nests legacy supplier keys, mapping the enabled array', () => {
    const out = migrateUserSettings({
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
    expect(out).not.toHaveProperty('excludeNonShippingSuppliers');
    expect(out).not.toHaveProperty('supplierResultLimit');
  });

  it('leaves already-nested settings untouched (idempotent)', () => {
    const nested = {
      caching: { enabled: true, ttlMinutes: 7200 },
      priceTracking: { enabled: true, maxDataPoints: 5 },
      suppliers: { enabled: [], disabled: [], excludeNonShipping: true },
    };
    expect(migrateUserSettings(nested)).toEqual(nested);
  });

  it('passes non-object input through unchanged', () => {
    expect(migrateUserSettings(undefined)).toBeUndefined();
    expect(migrateUserSettings(null)).toBeNull();
    expect(migrateUserSettings('nope')).toBe('nope');
  });
});
