declare global {
  /**
   * Represents a product variant node from the Shopify GraphQL Storefront API.
   * Contains pricing, inventory, and shipping details for a specific product variation.
   *
   * @example
   * ```typescript
   * const variant: ShopifyVariantNode = {
   *   title: "Default Title",
   *   sku: "CHEM-001-500G",
   *   barcode: "123456789012",
   *   price: { amount: "29.99" },
   *   weight: 3.0,
   *   weightUnit: "OUNCES",

   *   requiresShipping: true,
   *   availableForSale: true,
   *   currentlyNotInStock: false
   * };
   * ```
   */
  interface ShopifyVariantNode {
    /* eslint-disable */
    /** Display title of the variant (e.g. "Default Title", "500g Bottle") */
    title: string;
    /** Stock Keeping Unit identifier */
    sku: string;
    /** Product barcode (UPC, EAN, etc.) */
    barcode: string | null;
    /** Price object containing the amount as a string */
    price: {
      /** Numeric price value as a string (e.g. "14.99") */
      amount: string;
    };
    /** Numeric weight value */
    weight: number;
    /** Unit of weight measurement */
    weightUnit: "POUNDS" | "OUNCES" | "GRAMS" | "KILOGRAMS";
    /** Whether the variant requires physical shipping */
    requiresShipping: boolean;
    /** Whether the variant is currently available for purchase */
    availableForSale: boolean;
    /** Whether the variant is currently out of stock */
    currentlyNotInStock: boolean;
    /* eslint-enable */
  }

  /**
   * Represents a product node from the Shopify GraphQL Storefront API.
   * Contains core product information and nested variant data.
   *
   * @example
   * ```typescript
   * const product: ShopifyProductNode = {
   *   id: "gid://shopify/Product/6047654445205",
   *   title: "Gold Testing Kit",
   *   handle: "gold-test-kit",
   *   description: "Professional gold testing kit",
   *   onlineStoreUrl: "https://www.example.com/products/gold-test-kit",
   *   variants: {
   *     edges: [{ node: { title: "Default Title", sku: "GTK-001", ... } }]
   *   }
   * };
   * ```
   */
  interface ShopifyProductNode {
    /* eslint-disable */
    /** Shopify global ID (e.g. "gid://shopify/Product/6047654445205") */
    id: string;
    /** Display title of the product */
    title: string;
    /** URL-friendly slug for the product */
    handle: string;
    /** Full product description text */
    description: string;
    /** Full URL to the product on the online store */
    onlineStoreUrl: string;
    /** Product variants in Shopify's relay-style edges/node format */
    variants: {
      /** Array of variant edge objects */
      edges: Array<{
        /** The variant node data */
        node: ShopifyVariantNode;
      }>;
    };
    /* eslint-enable */
  }

  /**
   * Represents the full response from a Shopify GraphQL product search query.
   * May contain partial errors (e.g. permission-denied fields) alongside valid data.
   *
   * @example
   * ```typescript
   * const response: ShopifySearchResponse = {
   *   data: {
   *     products: {
   *       edges: [{ node: { id: "gid://shopify/Product/123", title: "Test", ... } }]
   *     }
   *   }
   * };
   * ```
   */
  interface ShopifySearchResponse {
    /** The response object */

    /** Array of GraphQL errors (e.g. permission denied for specific fields) */
    errors?: Array<{
      /** Human-readable error message */
      message: string;
      /** Source locations in the query where the error occurred */
      locations?: Array<{ line: number; column: number }>;
      /** Path to the field that caused the error */
      path?: (string | number)[];
      /** Additional error metadata */
      extensions?: {
        /** Error code (e.g. "ACCESS_DENIED") */
        code: string;
        /** Link to relevant documentation */
        documentation: string;
        /** Description of required access scope */
        requiredAccess: string;
      };
    }>;
    /** The query result data */
    data: {
      /** Product search results in relay-style edges/node format */
      products: {
        /** Array of product edge objects */
        edges: Array<{
          /** The product node data */
          node: ShopifyProductNode;
        }>;
      };
    };
    /** Query cost and performance metadata */
    extensions?: {
      /** API cost information */
      cost?: {
        /** The computed cost of the query */
        requestedQueryCost: number;
      };
    };
  }
}

// This export is needed to make the file a module
export {};
