declare global {
  /**
   * Represents price information for a product, including both inclusive and exclusive prices
   * as well as old prices for comparison.
   */
  interface PriceObject {
    /* eslint-disable */
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
    /* eslint-enable */
  }

  /**
   * Represents a product in the Laboratorium Discounter system.
   * Contains all product details including pricing, availability, and metadata.
   */
  interface LaboratoriumDiscounterSearchResponseProduct {
    /* eslint-disable */
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
    price: PriceObject;
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
    /* eslint-enable */
  }

  interface VariantObject {
    /* eslint-disable */
    /** Index signature for additional properties */
    id: number;
    position: number;
    price: PriceObject;
    sku: string;
    ean: string;
    code: string;
    title: string;
    active: boolean;
    stock: {
      available: boolean;
      on_stock: boolean;
      level: number;
      minimum: number;
      maximum: number;
      delivery?: {
        title: string;
      };
      allow_backorders: boolean;
    };
    /* eslint-enable */
  }

  /**
   * Represents the complete response from the Laboratorium Discounter API.
   * Contains page information, request details, and product collection.
   */
  interface SearchResponse {
    /* eslint-disable */
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
      post: Record<string, unknown>[];
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
      count: number;
      limit: number;
      page: number;
      pages: number;
      total: string;
      /** Map of products indexed by their identifiers */
      products: {
        [key: string]: SearchResponseProduct;
      };
      /** Index signature for additional collection properties */
      [key: string]: unknown;
    };
    shop: {
      /** Base currency */
      base_currency: string;
      status: string;
      currency: string;
      language: string;
      country: string;
      /** Index signature for additional shop properties */
      [key: string]: unknown;
    };
    /** Index signature for additional response properties */
    [key: string]: unknown;
  }

  interface LaboratoriumDiscounterProductObject
    extends LaboratoriumDiscounterSearchResponseProduct {
    /* eslint-disable */
    product: LaboratoriumDiscounterSearchResponseProduct & {
      variants?: boolean | { [key: string]: VariantObject };
    };
    shop: {
      currencies: {
        [key: string]: {
          symbol: string;
          code: string;
        };
      };
      currency: string;
      country: string;
      language: string;
      status: string;
      base_currency: string;
    };
    /* eslint-enable */
  }

  /**
   * Type for product index objects that can contain any string-keyed properties.
   */
  interface ProductIndexObject {
    /** Index signature for any string-keyed properties */
    [key: string]: unknown;
  }

  /**
   * Search parameters for Laboratorium Discounter API
   */
  interface LaboratoriumDiscounterSearchParams {
    limit: string;
    format: string;
    /** Index signature for additional properties */
    [key: string]: string | number | boolean | undefined;
  }

  /**
   * Type alias for SearchResponseProduct to maintain backward compatibility
   */
  type SearchResponseProduct = LaboratoriumDiscounterSearchResponseProduct;
}

// This export is needed to make the file a module
export {};
