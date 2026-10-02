import { describe, expect, it } from 'vitest';
import { ProductCategory } from '@/constants/laboratoriumdiscounter';

describe('ProductCategory', () => {
  it('maps every category to a distinct numeric id', () => {
    const ids = Object.values(ProductCategory).filter((v) => typeof v === 'number');

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exposes the chemicals A-Z root', () => {
    expect(ProductCategory.CHEMICALS_AZ).toBe(9319959);
  });
});
