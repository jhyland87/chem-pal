import { describe, expect, it } from 'vitest';
import { SUPPLIER_CLASS_NAMES } from '@/constants/suppliers';
import * as suppliers from '@/suppliers';

describe('SUPPLIER_CLASS_NAMES', () => {
  // The constant is generated from the barrel by tools/generate-supplier-constants.js
  // at prebuild, but it's committed so tests and dev runs work without a build. That
  // means it can go stale if the barrel is edited and nothing regenerates it — which
  // would silently drop a supplier from the settings toggle UI. This catches that.
  it('matches the value exports of the suppliers barrel exactly', () => {
    expect([...SUPPLIER_CLASS_NAMES].sort()).toEqual(Object.keys(suppliers).sort());
  });

  it('has no duplicates', () => {
    expect(new Set(SUPPLIER_CLASS_NAMES).size).toBe(SUPPLIER_CLASS_NAMES.length);
  });

  it('is non-empty and uses the Supplier* naming convention', () => {
    expect(SUPPLIER_CLASS_NAMES.length).toBeGreaterThan(0);
    expect(SUPPLIER_CLASS_NAMES.every((name) => name.startsWith('Supplier'))).toBe(true);
  });
});
