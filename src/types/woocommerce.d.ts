declare global {
  /**
   * Search parameters for WooCommerce API
   */
  interface SearchParams {
    /**
     * Search query string to filter products
     */
    search: string;
  }

  /**
   * Search response from WooCommerce API
   */
  type WooCommerceSearchResponse = Array<WooCommerceSearchResponseItem>;

  /**
   * Represents a product item from the WooCommerce API search response
   */
  interface WooCommerceSearchResponseItem extends SyntheticFields {
    /* eslint-disable */
    /** Unique identifier for the product */
    id: number;

    /** Name of the product */
    name: string;

    /** Type of product (e.g., 'simple', 'variable', 'grouped') */
    type: string;

    /** Full HTML description of the product */
    description: string;

    /** Brief HTML description of the product */
    short_description: string;

    /** URL to the product's page on the store */
    permalink: string;

    /** Whether the product is currently in stock */
    is_in_stock: boolean;

    /** Whether the product can only be bought one at a time */
    sold_individually: boolean;

    /** Stock keeping unit - unique product identifier */
    sku: string;

    /** Detailed pricing information for the product */
    prices: {
      /** Current price of the product */
      price: string;

      /** Regular price before any sales */
      regular_price: string;

      /** Sale price if the product is on sale */
      sale_price: string;

      /** ISO currency code (e.g., 'USD', 'EUR') */
      currency_code: string;

      /** Currency symbol (e.g., '$', '€') */
      currency_symbol: string;

      /** Number of decimal places for the currency */
      currency_minor_unit: number;

      /** Character used as decimal separator */
      currency_decimal_separator: string;

      /** Character used as thousands separator */
      currency_thousand_separator: string;

      /** Text to display before the price */
      currency_prefix: string;

      /** Text to display after the price */
      currency_suffix: string;
    };

    /** Categories the product belongs to */
    categories?: {
      /** Unique identifier for the category */
      id: number;

      /** Display name of the category */
      name: string;

      /** URL-friendly version of the category name */
      slug: string;

      /** URL to the category page */
      link: string;
    }[];

    /** Product attributes and their possible values */
    attributes: {
      /** Unique identifier for the attribute */
      id: number;
      /** Display name of the attribute */
      name: string;
      /** Taxonomy identifier for the attribute */
      taxonomy: string;
      /** Whether this attribute is used for product variations */
      has_variations: boolean;
      /** Possible values for this attribute */
      terms: {
        /** Unique identifier for the term */
        id: number;
        /** Display name of the term */
        name: string;
        /** URL-friendly version of the term name */
        slug: string;
      }[];
    }[];

    /** Product variations if this is a variable product */
    variations: {
      /** Unique identifier for the variation */
      id: number;
      /** Attributes that define this variation */
      attributes: {
        /** Name of the attribute */
        name: string;
        /** Value of the attribute */
        value: string;
      }[];
    }[];

    /** Add to cart button configuration */
    add_to_cart?: {
      /** Button text */
      text?: string;
      /** Button description */
      description?: string;
      /** URL to add the product to cart */
      url?: string;
    };

    /** Array of tag names associated with the product */
    tags?: string[];
  }

  /**
   * Individual product response format from WooCommerce API when requesting a single product.
   * Extends SearchResponseItem with variation-specific information.
   * @see https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/src/StoreApi/docs/products.md#get-product
   */
  interface WooCommerceProductVariant extends WooCommerceSearchResponseItem {
    /** Variation identifier */
    variation: string;
  }
}

// This export is needed to make the file a module
export {};
