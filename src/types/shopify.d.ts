declare global {
  /**
   * Variables accepted by the `Catalog` Shopify GraphQL query
   * (`@/queries/shopify-product-query.gql`).
   *
   * @example
   * ```typescript
   * const variables: ShopifyQueryVariables = { q: "sodium OR potassium", n: 200, cursor: null };
   * ```
   */
  interface ShopifyQueryVariables {
    /** Storefront search query (supports AND/OR/NOT and field filters like `title:*gold*`) */
    q: string;
    /** Maximum number of products to return in this page */
    n: number;
    /** Relay pagination cursor (`after`); null for the first page */
    cursor: string | null;
  }

  /** A Shopify money value: a decimal amount string plus its ISO currency code. */
  interface ShopifyMoney {
    /** Numeric value as a string (e.g. "14.99") */
    amount: string;
    /** ISO currency code (e.g. "USD") */
    currencyCode?: string;
  }

  /**
   * A media node from the product's `media` connection. Only `MediaImage` nodes
   * carry an `image`; other media types (video, model3d) leave it undefined.
   */
  interface ShopifyMediaNode {
    /* eslint-disable */
    id: string;
    /** Media type discriminator, e.g. "IMAGE", "VIDEO" */
    mediaContentType: string;
    /** Alt text (present on MediaImage nodes) */
    alt?: string | null;
    /** The image payload (present on MediaImage nodes) */
    image?: {
      url: string;
      width?: number | null;
      height?: number | null;
    } | null;
    /* eslint-enable */
  }

  /**
   * Represents a product variant node from the Shopify GraphQL Storefront API.
   *
   * @example
   * ```typescript
   * const variant: ShopifyVariantNode = {
   *   id: "gid://shopify/ProductVariant/36127200805031",
   *   title: "Default Title",
   *   sku: "CHEM-001-500G",
   *   availableForSale: true,
   *   weight: 3.0,
   *   weightUnit: "OUNCES",
   *   price: { amount: "29.99", currencyCode: "USD" },
   *   compareAtPrice: null,
   *   selectedOptions: [{ name: "Title", value: "Default Title" }],
   * };
   * ```
   */
  interface ShopifyVariantNode {
    /* eslint-disable */
    /** Globally unique variant id, e.g. "gid://shopify/ProductVariant/36127200805031" */
    id: string;
    /** Display title of the variant (e.g. "Default Title", "500g Bottle") */
    title: string;
    /** Stock Keeping Unit identifier */
    sku: string | null;
    /** Whether the variant is currently available for purchase */
    availableForSale: boolean;
    /** Numeric weight value */
    weight: number;
    /** Unit of weight measurement */
    weightUnit: "POUNDS" | "OUNCES" | "GRAMS" | "KILOGRAMS";
    /** Selling price */
    price: ShopifyMoney;
    /** Compare-at (list) price, or null when not on sale */
    compareAtPrice: ShopifyMoney | null;
    /** The option values selected for this variant */
    selectedOptions: Array<{ name: string; value: string }>;
    /** Whether the variant is currently in stock */
    currentlyNotInStock: boolean;
    /* eslint-enable */
  }

  /**
   * Represents a product node from the Shopify GraphQL Storefront API.
   *
   * @example
   * ```typescript
   * const product: ShopifyProductNode = {
   *   id: "gid://shopify/Product/6047654445205",
   *   title: "Gold Testing Kit",
   *   handle: "gold-test-kit",
   *   descriptionHtml: "<p>Professional gold testing kit</p>",
   *   onlineStoreUrl: "https://www.example.com/products/gold-test-kit",
   *   variants: { edges: [{ node: { title: "Default Title", sku: "GTK-001" } }] },
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
    /** Manufacturer / brand */
    vendor?: string;
    /** Product type / category */
    productType?: string;
    /** Storefront tags */
    tags?: string[];
    /** Full product description as HTML */
    descriptionHtml: string;
    /** Whether any variant is available for sale */
    availableForSale?: boolean;
    /** Full URL to the product on the online store (null for unpublished products) */
    onlineStoreUrl: string | null;
    /** Min/max variant price range */
    priceRange?: {
      minVariantPrice: ShopifyMoney;
      maxVariantPrice: ShopifyMoney;
    };
    /**
     * The product's featured (primary) image, returned already transformed to a
     * thumbnail size by the query's `url(transform: ...)` argument.
     */
    featuredImage?: {
      url: string;
      altText?: string | null;
    } | null;
    /** Product media (images etc.) in relay-style edges/node format */
    media?: {
      edges: Array<{ node: ShopifyMediaNode }>;
    };
    /** Product variants in Shopify's relay-style edges/node format */
    variants: {
      edges: Array<{ node: ShopifyVariantNode }>;
    };
    /* eslint-enable */
  }

  /**
   * Represents the full response from a Shopify GraphQL product search query.
   * May contain partial errors (e.g. permission-denied fields) alongside valid data.
   */
  interface ShopifySearchResponse {
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
        /** Relay pagination info */
        pageInfo?: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
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
