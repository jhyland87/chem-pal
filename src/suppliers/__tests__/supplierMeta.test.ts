import { SUPPLIER_META } from '@/constants/supplierMeta';
import { SUPPLIER_CLASS_NAMES } from '@/constants/suppliers';
import { describe, expect, it } from 'vitest';
// ProductBuilder must be imported before SupplierBase (module-initialization cycle).
import '@/utils/ProductBuilder';
import * as suppliers from '@/suppliers';

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
  });
});
