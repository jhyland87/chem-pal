import { AVAILABILITY } from '@/constants/common';
import { describe, it } from 'vitest';
import {
  isAvailability,
  isCachedProductData,
  isProductImage,
  isValidVariant,
} from '../productbuilder';

describe.concurrent('ProductBuilder TypeGuards', () => {
  describe('isAvailability', () => {
    it.for(Object.values(AVAILABILITY))(
      'should return true for valid AVAILABILITY enum value %j',
      (availability, { expect }) => {
        expect(isAvailability(availability)).toBe(true);
      },
    );

    it.skip('should return false for invalid availability values', ({ expect }) => {
      const invalidValues = [
        'available',
        'in_stock',
        'out_of_stock',
        'IN STOCK',
        'OUT OF STOCK',
        'backordered',
        'discontinued',
        '',
        ' ',
      ];

      invalidValues.forEach((value) => {
        expect(isAvailability(value)).toBe(false);
      });
    });

    it.for([null, undefined, 123, true, false, {}, [], () => {}, Symbol('IN_STOCK')])(
      'should return false for non-string value %#: %j',
      (value, { expect }) => {
        expect(isAvailability(value)).toBe(false);
      },
    );
  });

  describe('isValidVariant', () => {
    const validCompleteVariant = {
      title: 'Sodium Chloride 500g',
      price: 29.99,
      quantity: 500,
    };

    const validPartialVariant = {
      price: 39.99,
      quantity: 1000,
      // title inherited from parent product
    };

    it('should return true for a valid complete variant', ({ expect }) => {
      expect(isValidVariant(validCompleteVariant)).toBe(true);
    });

    it('should return true for a valid partial variant', ({ expect }) => {
      expect(isValidVariant(validPartialVariant)).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isValidVariant(null)).toBe(false);
    });

    it.for(['not an object', 123, true, false, undefined, () => {}, Symbol('variant')])(
      'should return false for non-object value %#: %j',
      (value, { expect }) => {
        expect(isValidVariant(value)).toBe(false);
      },
    );

    it.for([
      {
        ...validCompleteVariant,
        price: '29.99', // Should be number
      },
      {
        ...validCompleteVariant,
        quantity: '500', // Should be number
      },
      {
        ...validCompleteVariant,
        price: true, // Should be number
        quantity: null, // Should be number
      },
    ])(
      'should return false for variants with wrong numeric property types %#',
      (variant, { expect }) => {
        expect(isValidVariant(variant)).toBe(false);
      },
    );

    it.for([
      {
        ...validCompleteVariant,
        title: 123, // Should be string
      },
      {
        ...validCompleteVariant,
        title: true, // Should be string
      },
      {
        ...validCompleteVariant,
        title: null, // Should be string
      },
    ])(
      'should return false for variants with wrong string property types %#',
      (variant, { expect }) => {
        expect(isValidVariant(variant)).toBe(false);
      },
    );

    it('should return true for variants with additional properties', ({ expect }) => {
      const variantWithExtraProps = {
        ...validCompleteVariant,
        extraProp1: 'value1',
        extraProp2: 123,
        extraProp3: true,
      };

      expect(isValidVariant(variantWithExtraProps)).toBe(true);
    });

    it('should return true for empty object (minimal valid variant)', ({ expect }) => {
      expect(isValidVariant({})).toBe(true);
    });
  });

  describe('isProductImage', () => {
    it('should return true for valid image and thumbnail entries', ({ expect }) => {
      expect(isProductImage({ href: 'https://example.com/a.jpg', type: 'image' })).toBe(true);
      expect(isProductImage({ href: 'https://example.com/a-t.jpg', type: 'thumbnail' })).toBe(true);
      expect(
        isProductImage({ href: 'https://example.com/a.jpg', type: 'image', altText: 'front' }),
      ).toBe(true);
    });

    it('should return false for an unknown type', ({ expect }) => {
      expect(isProductImage({ href: 'https://example.com/a.jpg', type: 'banner' })).toBe(false);
    });

    it('should return false when href is missing or not a string', ({ expect }) => {
      expect(isProductImage({ type: 'image' })).toBe(false);
      expect(isProductImage({ href: 42, type: 'image' })).toBe(false);
    });

    it.for([null, undefined, [{ href: 'a', type: 'image' }], 'a', 42])(
      'should return false for null, arrays, and primitives %#: %j',
      (value, { expect }) => {
        expect(isProductImage(value)).toBe(false);
      },
    );
  });

  describe('isCachedProductData', () => {
    it('should return true for a plain product-data object', ({ expect }) => {
      expect(isCachedProductData({ title: 'Acetone', price: 9.99, cacheKey: 'id-1' })).toBe(true);
    });

    it('should return true for an empty object', ({ expect }) => {
      expect(isCachedProductData({})).toBe(true);
    });

    it('should return false for null, undefined, and arrays', ({ expect }) => {
      expect(isCachedProductData(null)).toBe(false);
      expect(isCachedProductData(undefined)).toBe(false);
      expect(isCachedProductData([{ title: 'x' }])).toBe(false);
    });

    it.for([42, 'id-1', true])('should return false for primitive %#: %j', (value, { expect }) => {
      expect(isCachedProductData(value)).toBe(false);
    });
  });
});
