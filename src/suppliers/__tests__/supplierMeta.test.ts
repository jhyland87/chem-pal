import { SUPPLIER_META, supplierSupportsPriceAlerts } from '@/constants/supplierMeta';
import { SUPPLIER_CLASS_NAMES } from '@/constants/suppliers';
import { describe, expect, it } from 'vitest';
// ProductBuilder must be imported before SupplierBase (module-initialization cycle).
import '@/utils/ProductBuilder';
import { SupplierBase } from '@/suppliers/SupplierBase';
import * as suppliers from '@/suppliers';
import * as priceAlertSuppliers from '@/suppliers/priceAlertSuppliers';

/**
 * `SUPPLIER_META` is extracted from the supplier classes' static fields at build time
 * (`tools/generate-supplier-meta.js`) so the UI can read them without loading the
 * supplier layer. These tests are the staleness guard: edit a class's name, country,
 * shipping or `shipsTo` without re-running `pnpm run generate` and this fails.
 */

/** The supplier statics this registry mirrors, read off the class without instantiating. */
interface SupplierStatics {
  supplierName: string;
  country: CountryCode;
  shipping: ShippingRange;
  shipsTo?: CountryCode[];
  supportsPriceAlerts: boolean;
}

const supplierEntries = Object.entries(suppliers) as Array<[string, unknown]>;

describe('SUPPLIER_META', () => {
  it('covers exactly the suppliers the barrel exports', () => {
    expect(Object.keys(SUPPLIER_META).sort()).toEqual(supplierEntries.map(([k]) => k).sort());
  });

  it('covers exactly the glob-derived live supplier names', () => {
    expect(Object.keys(SUPPLIER_META).sort()).toEqual([...SUPPLIER_CLASS_NAMES].sort());
  });

  it.each(supplierEntries)('matches %s', (name, supplierClass) => {
    const statics = supplierClass as SupplierStatics;
    const meta = SUPPLIER_META[name as SupplierClassName];

    expect(meta).toBeDefined();
    expect(meta.displayName).toBe(statics.supplierName);
    expect(meta.country).toBe(statics.country);
    expect(meta.shipping).toBe(statics.shipping);
    // Normalize absent vs. empty so a class that drops its allowlist still fails loudly.
    expect(meta.shipsTo ?? undefined).toEqual(statics.shipsTo ?? undefined);
    expect(meta.supportsPriceAlerts ?? false).toBe(statics.supportsPriceAlerts);
  });
});

describe('priceAlertSuppliers barrel', () => {
  const flagged = supplierEntries
    .filter(([, cls]) => (cls as SupplierStatics).supportsPriceAlerts)
    .map(([name]) => name)
    .sort();

  it('exports exactly the suppliers whose class sets supportsPriceAlerts', () => {
    expect(Object.keys(priceAlertSuppliers).sort()).toEqual(flagged);
  });

  it('exports the very classes the main barrel does', () => {
    for (const [name, cls] of Object.entries(priceAlertSuppliers)) {
      expect(cls, name).toBe((suppliers as Record<string, unknown>)[name]);
    }
  });

  it('has suppliers to watch', () => {
    expect(flagged.length).toBeGreaterThan(0);
  });

  it('keeps the flag off the base class', () => {
    expect((SupplierBase as unknown as SupplierStatics).supportsPriceAlerts).toBe(false);
  });
});

describe('supplierSupportsPriceAlerts', () => {
  it('is true for a supplier that can refetch its products', () => {
    expect(supplierSupportsPriceAlerts('Carolina Chemical')).toBe(true);
  });

  it('is false for a supplier that cannot', () => {
    expect(supplierSupportsPriceAlerts('Warchem')).toBe(false);
  });

  it('is false for an unknown or empty name', () => {
    expect(supplierSupportsPriceAlerts('No Such Supplier')).toBe(false);
    expect(supplierSupportsPriceAlerts('')).toBe(false);
  });

  it('matches display names exactly, not class names', () => {
    expect(supplierSupportsPriceAlerts('SupplierCarolinaChemical')).toBe(false);
  });

  it.each(Object.entries(SUPPLIER_META))('agrees with the registry for %s', (_name, meta) => {
    expect(supplierSupportsPriceAlerts(meta.displayName)).toBe(meta.supportsPriceAlerts === true);
  });
});
