/**
 * Search parameters for WooCommerce API
 */
export interface SearchParams {
  /**
   * Search query string to filter products
   */
  search: string;
}

/**
 * Search response from WooCommerce API
 */
export interface SearchResponse {
  /**
   * Array of product items returned from the search
   */
  items: ItemListing[];
}

/**
 * Product item from WooCommerce API
 */
export interface ItemListing {
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
  price: {
    /** Current price of the product */
    price: string;

    /** Regular price before any sales */
    regular_price: string;

    /** Sale price if the product is on sale */
    sale_price: string;

    /** Price range for variable products */
    price_range: string;

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
  categories: {
    /** Unique identifier for the category */
    id: number;

    /** Display name of the category */
    name: string;

    /** URL-friendly version of the category name */
    slug: string;

    /** URL to the category page */
    link: string;
  }[];

  /** Array of tag names associated with the product */
  tags: string[];
}
