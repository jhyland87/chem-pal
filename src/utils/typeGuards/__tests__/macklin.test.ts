import { describe, it } from 'vitest';
import productInfoFixture from '@/suppliers/__fixtures__/macklin/product-info.json';
import {
  ApiEndpoints,
  AuthRequiredEndpoints,
  isAuthCheckEndpoint,
  isAuthRequiredEndpoint,
  isMacklinApiResponse,
  isMacklinMsdsSearchResponse,
  isMacklinProductDetails,
  isMacklinProductDetailsResponse,
  isMacklinProductInfo,
  isMacklinSearchResult,
  isTimestampResponse,
} from '../macklin';

describe.concurrent('Macklin TypeGuards', () => {
  describe('isTimestampResponse', () => {
    const validResponse = {
      timestamp: 1748793383,
    };

    it('should return true for a valid timestamp response', ({ expect }) => {
      expect(isTimestampResponse(validResponse)).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isTimestampResponse(null)).toBe(false);
    });

    it.for([
      'not an object',
      123,
      true,
      false,
      undefined,
      () => {},
      Symbol('timestamp'),
      [],
    ])('should return false for non-object value %#: %j', (value, { expect }) => {
      expect(isTimestampResponse(value)).toBe(false);
    });

    it('should return false for objects missing timestamp property', ({ expect }) => {
      const noTimestamp = {};
      expect(isTimestampResponse(noTimestamp)).toBe(false);
    });

    it('should return false for objects with non-numeric timestamp', ({ expect }) => {
      const invalidTimestamp = {
        timestamp: '1748793383', // Should be number
      };
      expect(isTimestampResponse(invalidTimestamp)).toBe(false);
    });
  });

  describe('isMacklinApiResponse', () => {
    const validResponse = {
      code: 200,
      message: 'Success',
      data: {
        // Any data type is allowed
        someData: 'value',
      },
    };

    it('should return true for a valid API response', ({ expect }) => {
      expect(isMacklinApiResponse(validResponse)).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isMacklinApiResponse(null)).toBe(false);
    });

    it.for([
      'not an object',
      123,
      true,
      false,
      undefined,
      () => {},
      Symbol('response'),
      [],
    ])('should return false for non-object value %#: %j', (value, { expect }) => {
      expect(isMacklinApiResponse(value)).toBe(false);
    });

    it.for([
      {
        // Missing code
        message: 'Success',
        data: {},
      },
      {
        code: 200,
        // Missing message
        data: {},
      },
      {
        code: 200,
        message: 'Success',
        // Missing data
      },
      {
        // Missing all properties
      },
    ])('should return false for objects missing required properties %#', (response, { expect }) => {
      expect(isMacklinApiResponse(response)).toBe(false);
    });

    it.for([
      {
        code: '200', // Should be number
        message: 'Success',
        data: {},
      },
      {
        code: 200,
        message: 123, // Should be string
        data: {},
      },
    ])('should return false for objects with wrong property types %#', (response, { expect }) => {
      expect(isMacklinApiResponse(response)).toBe(false);
    });
  });

  describe('isAuthRequiredEndpoint', () => {
    it.for(Object.values(AuthRequiredEndpoints))(
      'should return true for auth required endpoint %j',
      (endpoint, { expect }) => {
        expect(isAuthRequiredEndpoint(endpoint)).toBe(true);
      },
    );

    it.for([
      '/api/timestamp',
      '/api/item/search',
      '/api/user/info',
      '/api/fruit/head',
      '/api/favourite/add',
      '/api/fruit/add',
      '/api/quick/buy',
      '/invalid/endpoint',
      '',
      'not a url',
    ])('should return false for non-auth required endpoint %j', (endpoint, { expect }) => {
      expect(isAuthRequiredEndpoint(endpoint)).toBe(false);
    });
  });

  describe('isAuthCheckEndpoint', () => {
    it.for([
      ApiEndpoints.USER_INFO,
      ApiEndpoints.FRUIT_HEAD,
      ApiEndpoints.FAVOURITE_ADD,
      ApiEndpoints.FRUIT_ADD,
    ])('should return true for auth check endpoint %j', (endpoint, { expect }) => {
      expect(isAuthCheckEndpoint(endpoint)).toBe(true);
    });

    it.for([
      ApiEndpoints.TIMESTAMP,
      ApiEndpoints.SEARCH,
      ApiEndpoints.QUICK_BUY,
      '/invalid/endpoint',
      '',
      'not a url',
    ])('should return false for non-auth check endpoint %j', (endpoint, { expect }) => {
      expect(isAuthCheckEndpoint(endpoint)).toBe(false);
    });
  });

  describe('isMacklinSearchResult', () => {
    const validSearchResult = {
      list: [
        {
          // Any item type is allowed
          id: 1,
          name: 'Product 1',
        },
      ],
    };

    it('should return true for a valid search result', ({ expect }) => {
      expect(isMacklinSearchResult(validSearchResult)).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isMacklinSearchResult(null)).toBe(false);
    });

    it.for([
      'not an object',
      123,
      true,
      false,
      undefined,
      () => {},
      Symbol('searchResult'),
      [],
    ])('should return false for non-object value %#: %j', (value, { expect }) => {
      expect(isMacklinSearchResult(value)).toBe(false);
    });

    it('should return false for objects missing list property', ({ expect }) => {
      const noList = {};
      expect(isMacklinSearchResult(noList)).toBe(false);
    });

    it('should return false for objects with non-object list', ({ expect }) => {
      const invalidList = {
        list: 'not an object', // Should be object
      };
      expect(isMacklinSearchResult(invalidList)).toBe(false);
    });

    it('should return false for objects with null list', ({ expect }) => {
      const nullList = {
        list: null,
      };
      expect(isMacklinSearchResult(nullList)).toBe(false);
    });
  });

  describe('isMacklinProductDetailsResponse', () => {
    const validProductDetails = {
      item_id: 123,
      item_code: 'ABC123',
      product_id: 456,
      product_code: 'PROD456',
      product_price: '29.99',
      product_unit: 'g',
      product_locked_stock: '0',
      product_pack: '500',
      item_en_name: 'Sodium Chloride',
      product_stock: '100',
      chem_cas: '7647-14-5',
      delivery_desc_show: 'In stock',
    };

    const validResponse = {
      list: [validProductDetails],
    };

    it('should return true for a valid product details response', ({ expect }) => {
      expect(isMacklinProductDetailsResponse(validResponse)).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isMacklinProductDetailsResponse(null)).toBe(false);
    });

    it.for([
      'not an object',
      123,
      true,
      false,
      undefined,
      () => {},
      Symbol('response'),
      [],
    ])('should return false for non-object value %#: %j', (value, { expect }) => {
      expect(isMacklinProductDetailsResponse(value)).toBe(false);
    });

    it('should return false for objects missing list property', ({ expect }) => {
      const noList = {};
      expect(isMacklinProductDetailsResponse(noList)).toBe(false);
    });

    it('should return false for objects with non-array list', ({ expect }) => {
      const invalidList = {
        list: 'not an array', // Should be array
      };
      expect(isMacklinProductDetailsResponse(invalidList)).toBe(false);
    });

    it('should return false for objects with null list', ({ expect }) => {
      const nullList = {
        list: null,
      };
      expect(isMacklinProductDetailsResponse(nullList)).toBe(false);
    });

    it('should return false for objects with invalid items in list', ({ expect }) => {
      const invalidItems = {
        list: [
          {
            // Invalid product details
            item_id: '123', // Should be number
          },
        ],
      };
      expect(isMacklinProductDetailsResponse(invalidItems)).toBe(false);
    });
  });

  describe('isMacklinProductDetails', () => {
    const validProductDetails = {
      item_id: 123,
      item_code: 'ABC123',
      product_id: 456,
      product_code: 'PROD456',
      product_price: '29.99',
      product_unit: 'g',
      product_locked_stock: '0',
      product_pack: '500',
      item_en_name: 'Sodium Chloride',
      product_stock: '100',
      chem_cas: '7647-14-5',
      delivery_desc_show: 'In stock',
    };

    it('should return true for valid product details', ({ expect }) => {
      expect(isMacklinProductDetails(validProductDetails)).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isMacklinProductDetails(null)).toBe(false);
    });

    it.for([
      'not an object',
      123,
      true,
      false,
      undefined,
      () => {},
      Symbol('productDetails'),
      [],
    ])('should return false for non-object value %#: %j', (value, { expect }) => {
      expect(isMacklinProductDetails(value)).toBe(false);
    });

    it.for([
      {
        // Missing item_id
        item_code: 'ABC123',
        product_id: 456,
        product_code: 'PROD456',
        product_price: '29.99',
        product_unit: 'g',
        product_locked_stock: '0',
        product_pack: '500',
        item_en_name: 'Sodium Chloride',
        product_stock: '100',
        chem_cas: '7647-14-5',
        delivery_desc_show: 'In stock',
      },
      {
        item_id: 123,
        // Missing item_code
        product_id: 456,
        product_code: 'PROD456',
        product_price: '29.99',
        product_unit: 'g',
        product_locked_stock: '0',
        product_pack: '500',
        item_en_name: 'Sodium Chloride',
        product_stock: '100',
        chem_cas: '7647-14-5',
        delivery_desc_show: 'In stock',
      },
      // ... and so on for each required property
    ])('should return false for objects missing required properties %#', (details, { expect }) => {
      expect(isMacklinProductDetails(details)).toBe(false);
    });

    it.for([
      {
        ...validProductDetails,
        item_id: '123', // Should be number
      },
      {
        ...validProductDetails,
        item_code: 123, // Should be string
      },
      {
        ...validProductDetails,
        product_id: '456', // Should be number
      },
      // ... and so on for each property
    ])('should return false for objects with wrong property types %#', (details, { expect }) => {
      expect(isMacklinProductDetails(details)).toBe(false);
    });

    it.for([
      {
        ...validProductDetails,
        item_id: null,
      },
      {
        ...validProductDetails,
        item_code: undefined,
      },
      // ... and so on for each property
    ])(
      'should return false for objects with null or undefined property values %#',
      (details, { expect }) => {
        expect(isMacklinProductDetails(details)).toBe(false);
      },
    );
  });

  describe('isMacklinMsdsSearchResponse', () => {
    it('returns true for the unwrapped success data payload (has url)', ({ expect }) => {
      const success = {
        url: 'https://www.macklin.cn/pdf/msds/download?lang=en&id=23884&item_id=819228&chem_cas=33725-74-5',
      };
      expect(isMacklinMsdsSearchResponse(success)).toBe(true);
    });

    it.for([
      [], // error responses unwrap to data: []
      null,
      undefined,
      {},
      { url: 123 }, // wrong url type
    ])('returns false for error payload / bad shape %#: %j', (response, { expect }) => {
      expect(isMacklinMsdsSearchResponse(response)).toBe(false);
    });
  });

  describe('isMacklinProductInfo', () => {
    it('returns true for the real product-info data payload (has item.chem_mw)', ({ expect }) => {
      // request<T> unwraps the envelope, so the guard validates `data`.
      expect(isMacklinProductInfo(productInfoFixture.data)).toBe(true);
    });

    it.for([
      null,
      undefined,
      {},
      { item: [] }, // list response: item is an empty array/object without chem_mw
      { item: {} }, // missing chem_mw
      { item: { chem_mw: 252.13 } }, // chem_mw must be a string
    ])('returns false when item or chem_mw is missing %#: %j', (data, { expect }) => {
      expect(isMacklinProductInfo(data)).toBe(false);
    });
  });
});
