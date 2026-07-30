import { describe, expect, it } from 'vitest';
import { SUPPLIER_CLASS_NAMES } from '@/constants/suppliers';
import * as suppliers from '@/suppliers';

describe('SUPPLIER_CLASS_NAMES', () => {
  // SUPPLIER_CLASS_NAMES is derived at load from a lazy import.meta.glob of the
  // supplier files (see src/constants/suppliers.ts); the barrel is the separate
  // source of truth for which suppliers are live. They can drift — a new supplier
  // file without a barrel export, a disabled supplier left in src/suppliers/, etc.
  // — which would silently desync the settings toggle UI from what's searchable.
  // This catches that.
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
