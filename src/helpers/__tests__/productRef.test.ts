import { describe, expect, it } from 'vitest';
import { toProductRef } from '../productRef';

/** A product with just the fields a ref reads; the rest of `Product` is irrelevant here. */
const makeProduct = (overrides: Partial<Product> = {}): Product =>
  ({
    title: 'Acetone',
    supplier: 'Test Supplier',
    price: 12.5,
    quantity: 500,
    uom: 'ml',
    url: 'https://shop.example/api/acetone',
    cacheKey: 'gid://shopify/Product/42',
    ...overrides,
  }) as Product;

describe('toProductRef', () => {
  it('captures the identifiers needed to refetch the product', () => {
    const ref = toProductRef(
      makeProduct({
        id: 42,
        uuid: 'u-42',
        sku: 'ACE-500',
        permalink: 'https://shop.example/acetone',
      }),
    );

    expect(ref).toEqual({
      cacheKey: 'gid://shopify/Product/42',
      id: 42,
      uuid: 'u-42',
      sku: 'ACE-500',
      title: 'Acetone',
      url: 'https://shop.example/api/acetone',
      permalink: 'https://shop.example/acetone',
      quantity: 500,
      uom: 'ml',
      variants: [],
    });
  });

  it('does not carry the price', () => {
    expect(toProductRef(makeProduct())).not.toHaveProperty('price');
  });

  it('references each variant by its own identifiers', () => {
    const ref = toProductRef(
      makeProduct({
        variants: [
          { id: 1, sku: 'V-1', title: '100 ml', price: 5, uuid: 'x-1', quantity: 100 },
          { id: 2, sku: 'V-2', title: '1 L', price: 20 },
        ] as Variant[],
      }),
    );

    expect(ref?.variants).toEqual([
      { id: 1, uuid: 'x-1', sku: 'V-1', title: '100 ml' },
      { id: 2, uuid: undefined, sku: 'V-2', title: '1 L' },
    ]);
  });

  it('gives a product with no variants an empty list', () => {
    expect(toProductRef(makeProduct({ variants: undefined }))?.variants).toEqual([]);
  });

  it('keeps the parent identifiers apart from its variants', () => {
    const ref = toProductRef(
      makeProduct({ id: 'parent', sku: 'P', variants: [{ id: 'child', sku: 'C' }] as Variant[] }),
    );

    expect(ref).toMatchObject({ id: 'parent', sku: 'P' });
    expect(ref?.variants[0]).toMatchObject({ id: 'child', sku: 'C' });
  });

  it.each([
    ['no cacheKey', { cacheKey: undefined }],
    ['an empty cacheKey', { cacheKey: '' }],
    ['no url', { url: undefined }],
    ['an empty url', { url: '' }],
  ])('returns undefined for a product with %s', (_label, overrides) => {
    expect(toProductRef(makeProduct(overrides as Partial<Product>))).toBeUndefined();
  });
});
