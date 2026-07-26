import { SHIPPING_OPTIONS } from '@/constants/common';
import * as suppliers from '@/suppliers';
import { describe, expect, it } from 'vitest';

// Shipping/country/paymentMethods moved from `abstract` instance props to `static`
// fields (so they're readable as `SupplierX.shipping` without instantiating). TS has
// no `abstract static`, so a supplier that forgets to declare one now compiles fine.
// This test restores the lost guarantee: every live supplier must expose valid
// static metadata, read straight off the class — no instances created.
const supplierClasses = Object.entries(suppliers).filter(
  ([, value]) => typeof value === 'function',
) as unknown as [
  string,
  {
    supplierName: string;
    baseURL: string;
    shipping: string;
    country: string;
    paymentMethods: unknown[];
    requiredHosts: string[];
  },
][];

describe.concurrent('supplier static metadata', () => {
  it('has live suppliers to check', () => {
    expect(supplierClasses.length).toBeGreaterThan(0);
  });

  it.each(supplierClasses)('%s declares a static supplierName + baseURL', (name, cls) => {
    expect(cls.supplierName, `${name}.supplierName`).toBeTypeOf('string');
    expect(cls.supplierName.length, `${name}.supplierName`).toBeGreaterThan(0);
    expect(cls.baseURL, `${name}.baseURL`).toBeTypeOf('string');
    expect(cls.baseURL.length, `${name}.baseURL`).toBeGreaterThan(0);
    // requiredHosts derives from the static baseURL/apiURL without instantiating.
    expect(cls.requiredHosts, `${name}.requiredHosts`).toContain(`${cls.baseURL}/*`);
  });

  it.each(supplierClasses)('%s declares a valid static shipping scope', (name, cls) => {
    expect(SHIPPING_OPTIONS, `${name}.shipping`).toContain(cls.shipping);
  });

  it.each(supplierClasses)('%s declares a static country code', (name, cls) => {
    expect(cls.country, `${name}.country`).toBeTypeOf('string');
    expect(cls.country.length, `${name}.country`).toBeGreaterThan(0);
  });

  it.each(supplierClasses)('%s declares static paymentMethods', (name, cls) => {
    expect(Array.isArray(cls.paymentMethods), `${name}.paymentMethods`).toBe(true);
  });
});
