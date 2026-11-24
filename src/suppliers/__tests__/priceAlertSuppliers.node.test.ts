// @vitest-environment node
import { describe, expect, it } from 'vitest';

// The service worker has no DOM, so every supplier it bundles must construct without one.
describe('priceAlertSuppliers in a DOM-less environment', () => {
  it('runs without a DOM', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
  });

  it('imports and instantiates every exported supplier', async () => {
    // ProductBuilder first: module-initialization cycle with SupplierBase.
    await import('@/utils/ProductBuilder');
    const barrel: Record<string, unknown> = await import('@/suppliers/priceAlertSuppliers');
    const entries = Object.entries(barrel);
    expect(entries.length).toBeGreaterThan(0);

    for (const [name, value] of entries) {
      if (typeof value !== 'function') throw new Error(`${name} is not a class`);
      const Supplier = value as new (
        query: string,
        limit: number,
        controller: AbortController,
      ) => { supplierName: string };
      const instance = new Supplier('', 5, new AbortController());
      expect(instance.supplierName, name).toBeTypeOf('string');
      expect(instance, name).toBeInstanceOf(Supplier);
    }
  });
});
