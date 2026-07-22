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

  interface WooCommercePriceRange {
    /** Minimum price in the range, in the currency's minor unit (e.g. cents) */
    min_amount?: string;
    /** Maximum price in the range, in the currency's minor unit (e.g. cents) */
    max_amount?: string;
  }
  /**
   * Search response from WooCommerce API
   */
  type WooCommerceSearchResponse = Array<WooCommerceSearchResponseItem>;

  /**
   * Represents a product item from the WooCommerce API search response
   */
  interface WooCommerceSearchResponseItem extends SyntheticFields {
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

    /** Average rating for the product */
    average_rating: string;

    /** Number of reviews for the product */
    review_count: number;

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

      /** Price range of the product */
      price_range?: WooCommercePriceRange;

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

    /** Price HTML of the product */
    price_html: string;

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

    /** Whether the product is purchasable */
    is_purchasable?: boolean | null;

    /** Whether the product is in stock */
    is_in_stock?: boolean | null;

    /** Whether the product is on backorder */
    is_on_backorder?: boolean | null;

    /** Low stock remaining */
    low_stock_remaining?: boolean | null;

    /** Stock availability */
    stock_availability?: {
      /** Text description of the stock availability */
      text: string;
      /** Class name of the stock availability */
      class: string;
    };

    /** Weight of the product */
    weight: string | null;

    /** Formatted weight of the product */
    formatted_weight: string | null;

    /** Images of the product */
    images: {
      /** Unique identifier for the image */
      id: number;
      /** URL of the image */
      src: string;
      /** Thumbnail URL of the image */
      thumbnail: string;
      /** Srcset of the image */
      srcset: string;
      /** Sizes of the image */
      sizes: string;
      /** Thumbnail srcset of the image */
      thumbnail_srcset: string;
      /** Thumbnail sizes of the image */
      thumbnail_sizes: string;
      /** Name of the image */
      name: string;
      /** Alt text of the image */
      alt: string;
    }[];
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

  type WooCommerceProductSearchParams = {
    // dev/wp-json-calls/products-args.json

    /** Scope under which the request is made; determines fields present in response. */
    context?: 'view' | 'edit' | 'embed';
    /** Current page of the collection. */
    page?: number;
    /** Maximum number of items to be returned in result set. */
    per_page?: number;
    /** Limit results to those matching a string. */
    search?: string;
    /** Limit result set to products with specific slug(s). Use commas to separate. */
    slug?: string;
    /** Limit response to resources published after a given ISO8601 compliant date. */
    after?: string;
    /** Limit response to resources published before a given ISO8601 compliant date. */
    before?: string;
    /** Column to use for ordering results. */
    date_column?: 'date' | 'date_gmt' | 'modified' | 'modified_gmt';
    /** Exclude products with specific IDs. */
    exclude?: number[];
    /** Include products with specific IDs. */
    include?: number[];
    /** Offset the result set by a specific number of items. */
    offset?: number;
    /** Order sort attribute ascending or descending. */
    order?: 'asc' | 'desc';
    /** Sort collection by object attribute. */
    orderby?:
      | 'date'
      | 'modified'
      | 'id'
      | 'include'
      | 'title'
      | 'slug'
      | 'price'
      | 'popularity'
      | 'rating'
      | 'menu_order'
      | 'comment_count';
    /** Limit result set to products with specific parent IDs. */
    parent?: number[];
    /** Exclude products with specific parent IDs. */
    parent_exclude?: number[];
    /** Limit result set to products with specific type. */
    type?: 'simple' | 'variable' | 'grouped' | 'external' | 'variation';
    /** Limit result set to products with specific SKU. */
    sku?: string;
    /** Limit result set to featured products. */
    featured?: boolean;
    /** Limit result set to products with specific category. */
    category?: string;
    /** Operator to use for category filtering. */
    category_operator?: 'in' | 'not_in' | 'and';
    /** Limit result set to products with specific brand. */
    brand?: string;
    /** Operator to use for brand filtering. */
    brand_operator?: 'in' | 'not_in' | 'and';
    /** Limit result set to products with specific tag. */
    tag?: string;
    /** Operator to use for tag filtering. */
    tag_operator?: 'in' | 'not_in' | 'and';
    on_sale?: boolean;
    /** Limit result set to products with minimum price. */
    min_price?: string;
    /** Limit result set to products with maximum price. */
    max_price?: string;
    stock_status?: Array<'instock' | 'outofstock' | 'onbackorder'>;
    /** Limit result set to products with specific attributes. */
    attributes?: {
      /** Attribute name. */
      attribute: string;
      /** Term ID. */
      term_id: number;
      /** Limit result set to products with specific slug. */
      slug?: string[];
      /** Operator to use for attribute filtering. */
      operator?: 'in' | 'not_in' | 'and';
    }[];
    /** Relation between attributes. */
    attribute_relation?: 'and' | 'in';
    /** Catalog visibility. */
    catalog_visibility?: 'any' | 'visible' | 'catalog' | 'search' | 'hidden';
    /** Limit result set to products with specific rating. */
    rating?: Array<1 | 2 | 3 | 4 | 5>;
    /** Limit result set to products with specific related ID. */
    related?: number;
  };
}

// This export is needed to make the file a module
export {};
