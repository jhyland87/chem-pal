import { describe, it } from 'vitest';
import {
  isShopifyProductNode,
  isShopifyVariantNode,
  isValidShopifySearchResponse,
} from '../shopify';

const validVariant = {
  id: 'gid://shopify/ProductVariant/36127200805031',
  title: 'Default Title',
  sku: 'GTK-001',
  availableForSale: true,
  currentlyNotInStock: false,
  weight: 3.0,
  weightUnit: 'OUNCES',
  price: { amount: '14.99' },
};

const validProduct = {
  id: 'gid://shopify/Product/6047654445205',
  title: 'Gold Testing Kit',
  handle: 'gold-test-kit',
  descriptionHtml: '<p>Professional gold testing kit</p>',
  onlineStoreUrl: 'https://www.example.com/products/gold-test-kit',
  variants: {
    edges: [{ node: validVariant }],
  },
};

describe.concurrent('Shopify TypeGuards', () => {
  describe('isShopifyVariantNode', () => {
    it('should return true for a valid variant', ({ expect }) => {
      expect(isShopifyVariantNode(validVariant)).toBe(true);
    });

    it.for(['POUNDS', 'OUNCES', 'GRAMS', 'KILOGRAMS'])(
      'should return true for valid weightUnit %s',
      (unit, { expect }) => {
        expect(isShopifyVariantNode({ ...validVariant, weightUnit: unit })).toBe(true);
      },
    );

    it('should return false for invalid weightUnit', ({ expect }) => {
      expect(isShopifyVariantNode({ ...validVariant, weightUnit: 'TONS' })).toBe(false);
    });

    it('should return false for null', ({ expect }) => {
      expect(isShopifyVariantNode(null)).toBe(false);
    });

    it('should return false for non-object values', ({ expect }) => {
      expect(isShopifyVariantNode('not an object')).toBe(false);
      expect(isShopifyVariantNode(123)).toBe(false);
      expect(isShopifyVariantNode(undefined)).toBe(false);
    });

    it('should return false for missing required properties', ({ expect }) => {
      const missingSku = { ...validVariant };
      delete (missingSku as any).sku;
      expect(isShopifyVariantNode(missingSku)).toBe(false);

      const missingPrice = { ...validVariant };
      delete (missingPrice as any).price;
      expect(isShopifyVariantNode(missingPrice)).toBe(false);
    });

    it('should return false for wrong property types', ({ expect }) => {
      expect(isShopifyVariantNode({ ...validVariant, weight: '3.0' })).toBe(false);
      expect(isShopifyVariantNode({ ...validVariant, availableForSale: 'true' })).toBe(false);
      expect(isShopifyVariantNode({ ...validVariant, price: '14.99' })).toBe(false);
    });

    it('should return false when price.amount is not a string', ({ expect }) => {
      expect(isShopifyVariantNode({ ...validVariant, price: { amount: 14.99 } })).toBe(false);
    });
  });

  describe('isShopifyProductNode', () => {
    it('should return true for a valid product', ({ expect }) => {
      expect(isShopifyProductNode(validProduct)).toBe(true);
    });

    it('should return true for a product with empty variants', ({ expect }) => {
      expect(isShopifyProductNode({ ...validProduct, variants: { edges: [] } })).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isShopifyProductNode(null)).toBe(false);
    });

    it('should return false for missing required properties', ({ expect }) => {
      const missingTitle = { ...validProduct };
      delete (missingTitle as any).title;
      expect(isShopifyProductNode(missingTitle)).toBe(false);

      const missingVariants = { ...validProduct };
      delete (missingVariants as any).variants;
      expect(isShopifyProductNode(missingVariants)).toBe(false);
    });

    it('should return false for invalid variant nodes', ({ expect }) => {
      const invalidVariants = {
        ...validProduct,
        variants: {
          edges: [{ node: { title: 'Invalid', sku: 123 } }],
        },
      };
      expect(isShopifyProductNode(invalidVariants)).toBe(false);
    });

    it('should return false for wrong property types', ({ expect }) => {
      expect(isShopifyProductNode({ ...validProduct, id: 123 })).toBe(false);
      expect(isShopifyProductNode({ ...validProduct, title: 456 })).toBe(false);
    });
  });

  describe('isValidShopifySearchResponse', () => {
    const validResponse = {
      data: {
        products: {
          edges: [{ node: validProduct }],
        },
      },
    };

    it('should return true for a valid search response', ({ expect }) => {
      expect(isValidShopifySearchResponse(validResponse)).toBe(true);
    });

    it('should return true for a response with errors alongside valid data', ({ expect }) => {
      const responseWithErrors = {
        errors: [{ message: 'Access denied for field' }],
        ...validResponse,
      };
      expect(isValidShopifySearchResponse(responseWithErrors)).toBe(true);
    });

    it('should return true for a response with empty products', ({ expect }) => {
      const emptyResponse = {
        data: { products: { edges: [] } },
      };
      expect(isValidShopifySearchResponse(emptyResponse)).toBe(true);
    });

    it('should return false for null', ({ expect }) => {
      expect(isValidShopifySearchResponse(null)).toBe(false);
    });

    it('should return false for non-object values', ({ expect }) => {
      expect(isValidShopifySearchResponse('not an object')).toBe(false);
      expect(isValidShopifySearchResponse(123)).toBe(false);
      expect(isValidShopifySearchResponse(undefined)).toBe(false);
    });

    it('should return false for missing data property', ({ expect }) => {
      expect(isValidShopifySearchResponse({})).toBe(false);
    });

    it('should return false for missing products property', ({ expect }) => {
      expect(isValidShopifySearchResponse({ data: {} })).toBe(false);
    });

    it('should return false for invalid product nodes in edges', ({ expect }) => {
      const invalidResponse = {
        data: {
          products: {
            edges: [{ node: { id: '123' } }],
          },
        },
      };
      expect(isValidShopifySearchResponse(invalidResponse)).toBe(false);
    });
  });
});
