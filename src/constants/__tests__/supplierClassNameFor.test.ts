import { SUPPLIER_META, supplierClassNameFor } from '@/constants/supplierMeta';
import { describe, expect, it } from 'vitest';

describe('supplierClassNameFor', () => {
  it.each(Object.entries(SUPPLIER_META))(
    'maps %s back from its display name',
    (className, meta) => {
      expect(supplierClassNameFor(meta.displayName)).toBe(className);
    },
  );

  it.each([
    ['an unknown name', 'Not A Supplier'],
    ['an empty string', ''],
    ['a class name rather than a display name', 'SupplierCarolina'],
  ])('returns undefined for %s', (_label, name) => {
    expect(supplierClassNameFor(name)).toBeUndefined();
  });
});
