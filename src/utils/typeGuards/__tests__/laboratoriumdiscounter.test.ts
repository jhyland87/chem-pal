import { describe, it } from 'vitest';
import {
  isPriceObject,
  isProductObject,
  isSearchResponseOk,
  isSearchResponseProduct,
  isValidSearchParams,
} from '../laboratoriumdiscounter';

describe.concurrent('LaboratoriumDiscounter TypeGuards', () => {
  describe('isSearchResponseOk', () => {
    const validResponse = {
      page: {
        search: 'sodium chloride',
        session_id: 'abc123',
        key: 'search_key',
        title: 'Search Results',
        status: 200,
      },
      request: {
        url: '/en/search/sodium-chloride',
        method: 'GET',
        get: { q: 'sodium chloride' },
        device: { platform: 'osx', type: 'webkit', mobile: false },
      },
      collection: {
        products: {
          '12345': {
            id: 12345,
            vid: 67890,
            image: 1,
            brand: false,
            code: 'CHEM-001',
            ean: '1234567890123',
            sku: 'SKU-001',
            score: 1.0,
            available: true,
            unit: true,
            url: '/products/chemical-1',
            title: 'Sodium Chloride',
            fulltitle: 'Sodium Chloride 500g',
            variant: '500g',
            description: 'High purity sodium chloride',
            data_01: 'Additional info',
            price: {
              price: 29.99,
              price_incl: 29.99,
              price_excl: 24.79,
              price_old: 39.99,
              price_old_incl: 39.99,
              price_old_excl: 33.05,
            },
          },
        },
      },
    };

    it('should return true for a valid search response', ({ expect }) => {
      expect(isSearchResponseOk(validResponse)).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isSearchResponseOk(null)).toBe(false);
    });

    it.for(['not an object', 123, true, false, undefined, () => {}, Symbol('response'), []])(
      'should return false for non-object value %#: %j',
      (value, { expect }) => {
        expect(isSearchResponseOk(value)).toBe(false);
      },
    );

    it.for([
      {
        // Missing page
        request: validResponse.request,
        collection: validResponse.collection,
      },
      {
        page: validResponse.page,
        // Missing request
        collection: validResponse.collection,
      },
      {
        page: validResponse.page,
        request: validResponse.request,
        // Missing collection
      },
      {
        // Missing all properties
      },
    ])(
      'should return false for objects missing required top-level properties %#',
      (response, { expect }) => {
        expect(isSearchResponseOk(response)).toBe(false);
      },
    );

    it.for([
      {
        page: 'not an object',
        request: validResponse.request,
        collection: validResponse.collection,
      },
      {
        page: validResponse.page,
        request: 'not an object',
        collection: validResponse.collection,
      },
      {
        page: validResponse.page,
        request: validResponse.request,
        collection: 'not an object',
      },
    ])(
      'should return false for objects with non-object top-level properties %#',
      (response, { expect }) => {
        expect(isSearchResponseOk(response)).toBe(false);
      },
    );

    it.for([
      {
        page: {
          // Missing search
          session_id: 'abc123',
          key: 'search_key',
          title: 'Search Results',
          status: 200,
        },
        request: validResponse.request,
        collection: validResponse.collection,
      },
      {
        page: {
          search: 'sodium chloride',
          // Missing session_id
          key: 'search_key',
          title: 'Search Results',
          status: 200,
        },
        request: validResponse.request,
        collection: validResponse.collection,
      },
      // ... and so on for each required page property
    ])(
      'should return false for objects with missing page properties %#',
      (response, { expect }) => {
        expect(isSearchResponseOk(response)).toBe(false);
      },
    );

    it.for([
      {
        page: validResponse.page,
        request: {
          // Missing url
          method: 'GET',
          get: { q: 'sodium chloride' },
          device: { platform: 'osx', type: 'webkit', mobile: false },
        },
        collection: validResponse.collection,
      },
      {
        page: validResponse.page,
        request: {
          url: '/en/search/sodium-chloride',
          // Missing method
          get: { q: 'sodium chloride' },
          device: { platform: 'osx', type: 'webkit', mobile: false },
        },
        collection: validResponse.collection,
      },
      // ... and so on for each required request property
    ])(
      'should return false for objects with missing request properties %#',
      (response, { expect }) => {
        expect(isSearchResponseOk(response)).toBe(false);
      },
    );

    it.for([
      {
        page: validResponse.page,
        request: validResponse.request,
        collection: {
          // Missing products
        },
      },
      {
        page: validResponse.page,
        request: validResponse.request,
        collection: {
          products: 'not an object', // Should be object
        },
      },
    ])(
      'should return false for objects with invalid collection structure %#',
      (response, { expect }) => {
        expect(isSearchResponseOk(response)).toBe(false);
      },
    );

    it('should return false for objects with invalid products', ({ expect }) => {
      const invalidProducts = {
        page: validResponse.page,
        request: validResponse.request,
        collection: {
          products: {
            '12345': {
              // Invalid product (missing required properties)
              id: 12345,
            },
          },
        },
      };

      expect(isSearchResponseOk(invalidProducts)).toBe(false);
    });
  });

  describe('isPriceObject', () => {
    const validPrice = {
      price: 29.99,
      price_incl: 29.99,
      price_excl: 24.79,
      price_old: 39.99,
      price_old_incl: 39.99,
      price_old_excl: 33.05,
    };

    it('should return true for a valid price object', ({ expect }) => {
      expect(isPriceObject(validPrice)).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isPriceObject(null)).toBe(false);
    });

    it.for(['not an object', 123, true, false, undefined, () => {}, Symbol('price'), []])(
      'should return false for non-object value %#: %j',
      (value, { expect }) => {
        expect(isPriceObject(value)).toBe(false);
      },
    );

    it.for([
      {
        // Missing price
        price_incl: 29.99,
        price_excl: 24.79,
        price_old: 39.99,
        price_old_incl: 39.99,
        price_old_excl: 33.05,
      },
      {
        price: 29.99,
        // Missing price_incl
        price_excl: 24.79,
        price_old: 39.99,
        price_old_incl: 39.99,
        price_old_excl: 33.05,
      },
      // ... and so on for each required property
    ])('should return false for objects missing required properties %#', (price, { expect }) => {
      expect(isPriceObject(price)).toBe(false);
    });

    it.for([
      {
        ...validPrice,
        price: '29.99', // Should be number
      },
      {
        ...validPrice,
        price_incl: '29.99', // Should be number
      },
      {
        ...validPrice,
        price_excl: '24.79', // Should be number
      },
      // ... and so on for each property
    ])('should return false for objects with wrong property types %#', (price, { expect }) => {
      expect(isPriceObject(price)).toBe(false);
    });
  });

  describe('isSearchResponseProduct', () => {
    const validProduct = {
      id: 12345,
      vid: 67890,
      image: 1,
      brand: false,
      code: 'CHEM-001',
      ean: '1234567890123',
      sku: 'SKU-001',
      score: 1.0,
      available: true,
      unit: true,
      url: '/products/chemical-1',
      title: 'Sodium Chloride',
      fulltitle: 'Sodium Chloride 500g',
      variant: '500g',
      description: 'High purity sodium chloride',
      data_01: 'Additional info',
      price: {
        price: 29.99,
        price_incl: 29.99,
        price_excl: 24.79,
        price_old: 39.99,
        price_old_incl: 39.99,
        price_old_excl: 33.05,
      },
    };

    it('should return true for a valid search response product', ({ expect }) => {
      expect(isSearchResponseProduct(validProduct)).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isSearchResponseProduct(null)).toBe(false);
    });

    it.for(['not an object', 123, true, false, undefined, () => {}, Symbol('product'), []])(
      'should return false for non-object value %#: %j',
      (value, { expect }) => {
        expect(isSearchResponseProduct(value)).toBe(false);
      },
    );

    it.for([
      {
        // Missing id
        vid: 67890,
        image: 1,
        brand: false,
        code: 'CHEM-001',
        ean: '1234567890123',
        sku: 'SKU-001',
        score: 1.0,
        available: true,
        unit: true,
        url: '/products/chemical-1',
        title: 'Sodium Chloride',
        fulltitle: 'Sodium Chloride 500g',
        variant: '500g',
        description: 'High purity sodium chloride',
        data_01: 'Additional info',
        price: validProduct.price,
      },
      // ... and so on for each required property
    ])('should return false for objects missing required properties %#', (product, { expect }) => {
      expect(isSearchResponseProduct(product)).toBe(false);
    });

    it.for([
      {
        ...validProduct,
        id: '12345', // Should be number
      },
      {
        ...validProduct,
        title: 123, // Should be string
      },
      {
        ...validProduct,
        available: 'true', // Should be boolean
      },
      // ... and so on for each property
    ])('should return false for objects with wrong property types %#', (product, { expect }) => {
      expect(isSearchResponseProduct(product)).toBe(false);
    });

    it('should return false for objects with invalid price object', ({ expect }) => {
      const invalidPrice = {
        ...validProduct,
        price: {
          // Invalid price object (missing properties)
          price: 29.99,
        },
      };

      expect(isSearchResponseProduct(invalidPrice)).toBe(false);
    });
  });

  describe('isProductObject', () => {
    const validProductObject = {
      id: 12345,
      vid: 67890,
      image: 1,
      brand: false,
      code: 'CHEM-001',
      ean: '1234567890123',
      sku: 'SKU-001',
      score: 1.0,
      available: true,
      unit: true,
      url: '/products/chemical-1',
      title: 'Sodium Chloride',
      fulltitle: 'Sodium Chloride 500g',
      variant: '500g',
      description: 'High purity sodium chloride',
      data_01: 'Additional info',
      price: {
        price: 29.99,
        price_incl: 29.99,
        price_excl: 24.79,
        price_old: 39.99,
        price_old_incl: 39.99,
        price_old_excl: 33.05,
      },
      // Additional properties specific to product object
      category: 'Chemicals',
      manufacturer: 'Lab Supplies Inc',
      stock: 100,
      weight: '500g',
      dimensions: '10x5x5cm',
    };

    it.skip('should return true for a valid product object', ({ expect }) => {
      expect(isProductObject(validProductObject)).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isProductObject(null)).toBe(false);
    });

    it.for(['not an object', 123, true, false, undefined, () => {}, Symbol('product'), []])(
      'should return false for non-object value %#: %j',
      (value, { expect }) => {
        expect(isProductObject(value)).toBe(false);
      },
    );

    it.for([
      {
        // Missing id
        vid: 67890,
        image: 1,
        brand: false,
        code: 'CHEM-001',
        ean: '1234567890123',
        sku: 'SKU-001',
        score: 1.0,
        available: true,
        unit: true,
        url: '/products/chemical-1',
        title: 'Sodium Chloride',
        fulltitle: 'Sodium Chloride 500g',
        variant: '500g',
        description: 'High purity sodium chloride',
        data_01: 'Additional info',
        price: validProductObject.price,
        category: 'Chemicals',
        manufacturer: 'Lab Supplies Inc',
        stock: 100,
        weight: '500g',
        dimensions: '10x5x5cm',
      },
      // ... and so on for each required property
    ])('should return false for objects missing required properties %#', (product, { expect }) => {
      expect(isProductObject(product)).toBe(false);
    });

    it.for([
      {
        ...validProductObject,
        id: '12345', // Should be number
      },
      {
        ...validProductObject,
        title: 123, // Should be string
      },
      {
        ...validProductObject,
        available: 'true', // Should be boolean
      },
      // ... and so on for each property
    ])('should return false for objects with wrong property types %#', (product, { expect }) => {
      expect(isProductObject(product)).toBe(false);
    });

    it('should return false for objects with invalid price object', ({ expect }) => {
      const invalidPrice = {
        ...validProductObject,
        price: {
          // Invalid price object (missing properties)
          price: 29.99,
        },
      };

      expect(isProductObject(invalidPrice)).toBe(false);
    });
  });

  describe('isValidSearchParams', () => {
    const validParams = {
      q: 'sodium chloride',
      page: 1,
      limit: 20,
      sort: 'price_asc',
      filter: {
        category: ['chemicals'],
        brand: ['lab-supplies'],
        price_range: [0, 100],
      },
    };

    it.skip('should return true for valid search parameters', ({ expect }) => {
      expect(isValidSearchParams(validParams)).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isValidSearchParams(null)).toBe(false);
    });

    it.for(['not an object', 123, true, false, undefined, () => {}, Symbol('params'), []])(
      'should return false for non-object value %#: %j',
      (value, { expect }) => {
        expect(isValidSearchParams(value)).toBe(false);
      },
    );

    it.for([
      {
        // Missing q
        page: 1,
        limit: 20,
        sort: 'price_asc',
        filter: validParams.filter,
      },
      {
        q: 'sodium chloride',
        // Missing page
        limit: 20,
        sort: 'price_asc',
        filter: validParams.filter,
      },
      // ... and so on for each required property
    ])('should return false for objects missing required properties %#', (params, { expect }) => {
      expect(isValidSearchParams(params)).toBe(false);
    });

    it.for([
      {
        ...validParams,
        q: 123, // Should be string
      },
      {
        ...validParams,
        page: '1', // Should be number
      },
      {
        ...validParams,
        limit: '20', // Should be number
      },
      {
        ...validParams,
        sort: 123, // Should be string
      },
      {
        ...validParams,
        filter: 'invalid', // Should be object
      },
    ])('should return false for objects with wrong property types %#', (params, { expect }) => {
      expect(isValidSearchParams(params)).toBe(false);
    });

    it.for([
      {
        ...validParams,
        filter: {
          // Invalid filter (wrong types)
          category: 'chemicals', // Should be array
          brand: 'lab-supplies', // Should be array
          price_range: '0-100', // Should be array
        },
      },
      {
        ...validParams,
        filter: {
          // Invalid filter (missing properties)
          category: ['chemicals'],
          // Missing brand and price_range
        },
      },
    ])('should return false for objects with invalid filter structure %#', (params, { expect }) => {
      expect(isValidSearchParams(params)).toBe(false);
    });
  });
});
