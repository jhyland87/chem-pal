import { describe, expect, it } from 'vitest';
import {
  isItemListing,
  isSearchaniseCredentials,
  isSearchaniseVariant,
  isValidSearchaniseApiObject,
  isValidSearchResponse,
} from '../searchanise';

describe('Searchanise TypeGuards', () => {
  describe('isValidSearchResponse', () => {
    const validResponse = {
      totalItems: 100,
      startIndex: 0,
      itemsPerPage: 20,
      currentItemCount: 20,
      pageStartIndex: 0,
      totalPages: 5,
      suggestions: ['sodium', 'chloride', 'nacl'],
      pages: [1, 2, 3, 4, 5],
      items: [
        {
          title: 'Sodium Chloride',
          price: '29.99',
          link: '/products/nacl',
          product_id: '12345',
          product_code: 'CHEM-001',
          quantity: '500g',
          vendor: 'Chemical Supplier',
          original_product_id: '12345',
          list_price: '39.99',
          shopify_variants: [
            {
              sku: 'CHEM-001-500G',
              price: '29.99',
              link: '/products/nacl?variant=1',
              variant_id: '1',
              quantity_total: '100',
              options: { Model: '500g' },
            },
          ],
        },
      ],
    };

    it('should return true for a valid search response', () => {
      expect(isValidSearchResponse(validResponse)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidSearchResponse(null)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isValidSearchResponse('not an object')).toBe(false);
      expect(isValidSearchResponse(123)).toBe(false);
      expect(isValidSearchResponse(undefined)).toBe(false);
    });

    it('should return false for missing required properties', () => {
      const missingTotalItems = { ...validResponse };
      delete (missingTotalItems as any).totalItems;
      expect(isValidSearchResponse(missingTotalItems)).toBe(false);

      const missingItems = { ...validResponse };
      delete (missingItems as any).items;
      expect(isValidSearchResponse(missingItems)).toBe(false);
    });

    it('should return false for wrong property types', () => {
      const wrongTypes = {
        ...validResponse,
        totalItems: '100', // Should be number
        itemsPerPage: '20', // Should be number
        items: 'not an array', // Should be array
      };
      expect(isValidSearchResponse(wrongTypes)).toBe(false);
    });

    it('should return false for invalid items array', () => {
      const invalidItems = {
        ...validResponse,
        items: [
          {
            title: 'Invalid Item',
            // Missing required properties
          },
        ],
      };
      expect(isValidSearchResponse(invalidItems)).toBe(false);
    });
  });

  describe('isSearchaniseVariant', () => {
    const validVariant = {
      sku: 'CHEM-001-500G',
      price: '29.99',
      link: '/products/nacl?variant=1',
      variant_id: '1',
      quantity_total: '100',
      options: { Model: '500g' },
    };

    it('should return true for a valid Searchanise variant', () => {
      expect(isSearchaniseVariant(validVariant)).toBe(true);
    });

    it('should return true for variant with numeric quantity', () => {
      const numericQuantityVariant = {
        ...validVariant,
        quantity_total: 100,
      };
      expect(isSearchaniseVariant(numericQuantityVariant)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isSearchaniseVariant(null)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isSearchaniseVariant('not an object')).toBe(false);
      expect(isSearchaniseVariant(123)).toBe(false);
      expect(isSearchaniseVariant(undefined)).toBe(false);
    });

    it('should return false for missing required properties', () => {
      const missingSku = { ...validVariant };
      delete (missingSku as any).sku;
      expect(isSearchaniseVariant(missingSku)).toBe(false);

      const missingOptions = { ...validVariant };
      delete (missingOptions as any).options;
      expect(isSearchaniseVariant(missingOptions)).toBe(false);
    });

    it('should return false for wrong property types', () => {
      const wrongTypes = {
        ...validVariant,
        sku: 12345, // Should be string
        price: 29.99, // Should be string
        link: 123, // Should be string
        variant_id: 1, // Should be string
        quantity_total: true, // Should be string or number
        options: '500g', // Should be object
      };
      expect(isSearchaniseVariant(wrongTypes)).toBe(false);
    });

    it('should return false when options is null', () => {
      const nullOptions = { ...validVariant, options: null };
      expect(isSearchaniseVariant(nullOptions)).toBe(false);
    });

    it('should accept quantity_total as either string or number', () => {
      expect(isSearchaniseVariant({ ...validVariant, quantity_total: '50' })).toBe(true);
      expect(isSearchaniseVariant({ ...validVariant, quantity_total: 50 })).toBe(true);
      expect(isSearchaniseVariant({ ...validVariant, quantity_total: true })).toBe(false);
      expect(isSearchaniseVariant({ ...validVariant, quantity_total: null })).toBe(false);
    });
  });

  describe('isItemListing', () => {
    const validItem = {
      title: 'Sodium Chloride',
      price: '29.99',
      link: '/products/nacl',
      product_id: '12345',
      product_code: 'CHEM-001',
      quantity: '500g',
      vendor: 'Chemical Supplier',
      original_product_id: '12345',
      list_price: '39.99',
      shopify_variants: [
        {
          sku: 'CHEM-001-500G',
          price: '29.99',
          link: '/products/nacl?variant=1',
          variant_id: '1',
          quantity_total: '100',
          options: { Model: '500g' },
        },
      ],
    };

    it('should return true for a valid item listing', () => {
      expect(isItemListing(validItem)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isItemListing(null)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isItemListing('not an object')).toBe(false);
      expect(isItemListing(123)).toBe(false);
      expect(isItemListing(undefined)).toBe(false);
    });

    it('should return false for missing required properties', () => {
      const missingTitle = { ...validItem };
      delete (missingTitle as any).title;
      expect(isItemListing(missingTitle)).toBe(false);
    });

    it('accepts items without vendor or shopify_variants (non-Shopify storefronts)', () => {
      // Shape of a live Laballey item.
      const laballeyItem = {
        product_id: '10741',
        original_product_id: '10741',
        title: 'Sulfuric Acid 5% Solution',
        description: '',
        link: 'https://www.laballey.com/products/sulfuric-acid-5',
        price: '55.1700',
        list_price: '604.0600',
        quantity: '1',
        product_code: 'SUAL5',
        image_link: 'https://www.laballey.com/media/catalog/product/s/u/sulfuric.jpg',
        cas: '7664-93-9',
        molecular_formula: 'H2SO4',
      };
      expect(isItemListing(laballeyItem)).toBe(true);
      expect(
        isValidSearchResponse({
          totalItems: 1,
          startIndex: 0,
          itemsPerPage: 16,
          currentItemCount: 1,
          items: [laballeyItem],
        }),
      ).toBe(true);
    });

    it('should return false for wrong property types', () => {
      const wrongTypes = {
        ...validItem,
        title: 123, // Should be string
        price: 29.99, // Should be string
        product_id: 12345, // Should be string
        shopify_variants: 'invalid', // Should be array
      };
      expect(isItemListing(wrongTypes)).toBe(false);
    });

    it('should accept price as either string or number', () => {
      expect(isItemListing({ ...validItem, price: '29.99' })).toBe(true);
      expect(isItemListing({ ...validItem, price: 29.99 })).toBe(true);
      expect(isItemListing({ ...validItem, price: true })).toBe(false);
    });

    it('should return false for invalid variants array', () => {
      const invalidVariants = {
        ...validItem,
        shopify_variants: [
          {
            sku: 12345, // Should be string
            price: 29.99, // Should be string
            // Missing other required properties
          },
        ],
      };
      expect(isItemListing(invalidVariants)).toBe(false);
    });
  });

  describe('isValidSearchaniseApiObject', () => {
    // Shape of `window.Searchanise` on a live storefront.
    const validObject = {
      host: 'https://searchserverapi1.com',
      api_key: '4p4M0R6q0N',
      SearchInput: '#search,form input[name="q"]',
      options: { ResultsDiv: '#snize_results' },
      forceUseExternalJQuery: true,
    };

    it('accepts a real-shaped object, including extra fields', () => {
      expect(isValidSearchaniseApiObject(validObject)).toBe(true);
    });

    it.each([
      ['a bare host name', { ...validObject, host: 'searchserverapi.com' }],
      ['a different host', { ...validObject, host: 'https://searchserverapi.com' }],
    ])('does not constrain the host (%s)', (_label, data) => {
      expect(isValidSearchaniseApiObject(data)).toBe(true);
    });

    it.each([
      ['too short', '4p4M0R6q0'],
      ['too long', '4p4M0R6q0NX'],
      ['non-alphanumeric', '4p4M0R6q0-'],
      ['empty', ''],
      ['a number', 4040404040],
      ['undefined', undefined],
    ])('rejects an api_key that is %s', (_label, api_key) => {
      expect(isValidSearchaniseApiObject({ ...validObject, api_key })).toBe(false);
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['not a string', 42],
    ])('rejects a host that is %s', (_label, host) => {
      expect(isValidSearchaniseApiObject({ ...validObject, host })).toBe(false);
    });

    it.each([null, undefined, 'string', 42, [], {}])('rejects %j', (data) => {
      expect(isValidSearchaniseApiObject(data)).toBe(false);
    });
  });

  describe('isSearchaniseCredentials', () => {
    const valid = { apiKey: '4p4M0R6q0N', host: 'searchserverapi1.com' };

    it('accepts a well-formed record', () => {
      expect(isSearchaniseCredentials(valid)).toBe(true);
    });

    it.each([
      ['a short key', { ...valid, apiKey: 'abc' }],
      ['a non-alphanumeric key', { ...valid, apiKey: '4p4M0R6q0-' }],
      ['an empty host', { ...valid, host: '' }],
      ['a missing key', { host: valid.host }],
      ['a missing host', { apiKey: valid.apiKey }],
      ['the scraped-page shape', { api_key: valid.apiKey, host: valid.host }],
    ])('rejects %s', (_label, data) => {
      expect(isSearchaniseCredentials(data)).toBe(false);
    });

    it.each([null, undefined, 'string', 42, []])('rejects %j', (data) => {
      expect(isSearchaniseCredentials(data)).toBe(false);
    });
  });
});
