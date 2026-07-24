import { describe, it } from 'vitest';
import { isSearchResultItem } from '../onyxmet';

describe.concurrent('OnyxMet TypeGuards', () => {
  describe('isSearchResultItem', () => {
    const validItem = {
      label: 'Sodium Chloride',
      image: 'nacl.jpg',
      description: 'High purity NaCl',
      href: '/products/nacl',
    };

    it('should return true for a valid search result item', ({ expect }) => {
      expect(isSearchResultItem(validItem)).toBe(true);
    });

    it('should return true for a valid item with additional properties', ({ expect }) => {
      const itemWithExtraProps = {
        ...validItem,
        extraProp1: 'value1',
        extraProp2: 123,
        extraProp3: true,
      };

      expect(isSearchResultItem(itemWithExtraProps)).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isSearchResultItem(null)).toBe(false);
    });

    it.for([
      'not an object',
      123,
      true,
      false,
      undefined,
      () => {},
      Symbol('item'),
      [],
    ])('should return false for non-object value %#: %j', (value, { expect }) => {
      expect(isSearchResultItem(value)).toBe(false);
    });

    it.for([
      {
        // Missing label
        image: 'nacl.jpg',
        description: 'High purity NaCl',
        href: '/products/nacl',
      },
      {
        label: 'Sodium Chloride',
        // Missing image
        description: 'High purity NaCl',
        href: '/products/nacl',
      },
      {
        label: 'Sodium Chloride',
        image: 'nacl.jpg',
        // Missing description
        href: '/products/nacl',
      },
      {
        label: 'Sodium Chloride',
        image: 'nacl.jpg',
        description: 'High purity NaCl',
        // Missing href
      },
      {
        // Missing all properties
      },
    ])('should return false for objects missing required properties %#', (item, { expect }) => {
      expect(isSearchResultItem(item)).toBe(false);
    });

    it.for([
      {
        ...validItem,
        label: 123, // Any type is allowed
      },
      {
        ...validItem,
        image: null, // Any type is allowed
      },
      {
        ...validItem,
        description: undefined, // Any type is allowed
      },
      {
        ...validItem,
        href: 456, // Any type is allowed
      },
    ])('should return true for items with property values of any type %#', (item, { expect }) => {
      expect(isSearchResultItem(item)).toBe(true);
    });
  });
});
