import { ProductBuilder } from '@/utils/ProductBuilder';
import { describe, expect, it } from 'vitest';

describe('ProductBuilder setCacheKey', () => {
  it('stores a non-empty string identity', () => {
    const builder = new ProductBuilder<Product>('https://example.com').setCacheKey('FAM_889460');
    expect(builder.get('cacheKey')).toBe('FAM_889460');
  });

  it('coerces a numeric identity to a string', () => {
    const builder = new ProductBuilder<Product>('https://example.com').setCacheKey(12345);
    expect(builder.get('cacheKey')).toBe('12345');
  });

  it('ignores an empty or invalid identity', () => {
    expect(
      new ProductBuilder<Product>('https://example.com').setCacheKey('').get('cacheKey'),
    ).toBeUndefined();
    expect(
      new ProductBuilder<Product>('https://example.com').setCacheKey(undefined).get('cacheKey'),
    ).toBeUndefined();
  });

  it('round-trips through dump() -> createFromCache()', () => {
    const dumped = new ProductBuilder<Product>('https://example.com')
      .setBasicInfo('Sodium chloride', '/products/nacl', 'TestSupplier')
      .setCacheKey('FAM_889460')
      .dump();
    expect(dumped.cacheKey).toBe('FAM_889460');

    const [restored] = ProductBuilder.createFromCache<Product>('https://example.com', [dumped]);
    expect(restored.get('cacheKey')).toBe('FAM_889460');
  });

  it('is routed through setData()', () => {
    const builder = new ProductBuilder<Product>('https://example.com').setData({
      cacheKey: 'sku-123',
    } as Partial<Product>);
    expect(builder.get('cacheKey')).toBe('sku-123');
  });
});
