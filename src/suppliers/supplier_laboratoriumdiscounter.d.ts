/**
 * Represents price information for a product, including both inclusive and exclusive prices
 * as well as old prices for comparison.
 * @mergeTarget SupplierLaboratoriumDiscounter
 */
export type _Price = {
  /** The current price of the product */
  price: number;
  /** The current price including taxes */
  price_incl: number;
  /** The current price excluding taxes */
  price_excl: number;
  /** The previous price of the product */
  price_old: number;
  /** The previous price including taxes */
  price_old_incl: number;
  /** The previous price excluding taxes */
  price_old_excl: number;
};

/**
 * Represents a product in the Laboratorium Discounter system.
 * Contains all product details including pricing, availability, and metadata.
 * @mergeTarget SupplierLaboratoriumDiscounter
 */
export type _Product = {
  /** Unique identifier for the product */
  id: number;
  /** Variant identifier */
  vid: number;
  /** Image identifier */
  image: number;
  /** Whether the product has a brand */
  brand: boolean;
  /** Product code */
  code: string;
  /** European Article Number (EAN) */
  ean: string;
  /** Stock Keeping Unit */
  sku: string;
  /** Product score or rating */
  score: number;
  /** Price information for the product */
  price: _Price;
  /** Whether the product is currently available */
  available: boolean;
  /** Unit information */
  unit: boolean;
  /** URL to the product page */
  url: string;
  /** Short product title */
  title: string;
  /** Full product title including variant information */
  fulltitle: string;
  /** Product variant information */
  variant: string;
  /** Product description */
  description: string;
  /** Additional data field */
  data_01: string;
  /** Index signature for additional properties */
  [key: string]: unknown;
};

/**
 * Represents the complete response from the Laboratorium Discounter API.
 * Contains page information, request details, and product collection.
 */
export type LaboriumDiscounterResponse = {
  /** Page-related information */
  page: {
    /** Search query string */
    search: string;
    /** Session identifier */
    session_id: string;
    /** API key */
    key: string;
    /** Page title */
    title: string;
    /** HTTP status code */
    status: number;
    /** Index signature for additional page properties */
    [key: string]: unknown;
  };
  /** Request information */
  request: {
    /** Request URL */
    url: string;
    /** HTTP method used */
    method: string;
    /** GET parameters */
    get: {
      /** Response format */
      format: string;
      /** Result limit */
      limit: string;
    };
    /** POST parameters */
    post: any[];
    /** Device information */
    device: {
      /** Platform information */
      platform: string;
      /** Device type */
      type: string;
      /** Whether the device is mobile */
      mobile: boolean;
    };
    /** Country code */
    country: string;
    /** Index signature for additional request properties */
    [key: string]: unknown;
  };
  /** Collection of products */
  collection: {
    /** Map of products indexed by their identifiers */
    products: {
      [key: string]: _Product;
    };
    /** Index signature for additional collection properties */
    [key: string]: unknown;
  };
  /** Index signature for additional response properties */
  [key: string]: unknown;
};

/**
 * Type for product index objects that can contain any string-keyed properties.
 */
export type _productIndexObject = {
  /** Index signature for any string-keyed properties */
  [key: string]: unknown;
};

// Add type definitions at the top of the file after imports
/**
 * Type for search parameters used in API requests.
 * Represents a map of string key-value pairs for search queries.
 */
export type SearchParams = {
  /** Index signature for search parameter key-value pairs */
  [key: string]: string;
};
