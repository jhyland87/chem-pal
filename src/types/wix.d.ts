declare global {
  /**
   * Response type for Wix access token requests. Contains authentication and app instance information.
   */
  interface AccessTokenResponse {
    /**
     * Object containing app-specific information keyed by app ID
     */
    apps: {
      [key: string]: {
        /** Instance token for the app */
        instance: string;
        /** Internal ID number for the app */
        intId: number;
      };
    };
    /**
     * Additional dynamic properties that may be present in the response
     */
    [key: string]: unknown;
  }

  /**
   * Represents a specific product item with its price and options. Used for product variations.
   */
  interface ProductItem {
    /** Unique identifier for the product item */
    id: string;
    /** Array of selected option IDs that define this specific product variation */
    optionsSelections: number[];
    /** Numeric price value of the product item */
    price: number;
    /** Human-readable formatted price string (e.g. "$19.99") */
    formattedPrice: string;
  }

  /**
   * Represents a product option (e.g. size, color) that can be selected for a product.
   */
  interface ProductOption {
    /** Unique identifier for the option */
    id: string;
    /** Machine-readable key identifier for the option */
    key: string;
    /** Human-readable display title of the option */
    title: string;
    /** Type of option UI control (e.g. "dropdown", "radio") */
    optionType: string;
    /** Array of available selections for this option */
    selections: ProductSelection[];
  }

  /**
   * Represents a specific selection choice within a product option.
   */
  interface ProductSelection {
    /** Unique numeric identifier for the selection */
    id: number;
    /** Display value of the selection */
    value: string;
    /** Additional descriptive text for the selection */
    description: string;
    /** Machine-readable key identifier for the selection */
    key: string;
    /** Indicates whether this selection is currently in stock */
    inStock: boolean | null;
  }

  /**
   * Represents a complete product with all its details, options, and variations.
   */
  interface ProductObject {
    /** Unique identifier for the product */
    id: string;
    /** Array of available customization options for the product */
    options: ProductOption[];
    /** Array of specific product variations with their unique combinations */
    productItems: ProductItem[];
    /** Classification or category of the product */
    productType: string;
    /** Base price of the product before options */
    price: number;
    /** Stock keeping unit identifier */
    sku: string;
    /** Indicates whether the product is currently available for purchase */
    isInStock: boolean;
    /** URL-friendly identifier used in product page links */
    urlPart: string;
    /** Human-readable formatted price string (e.g. "$19.99") */
    formattedPrice: string;
    /** Display name of the product */
    name: string;
    /** Detailed product description */
    description: string;
    /** Manufacturer or brand name of the product */
    brand: string | null;
    /** Array of variant products */
    variants?: ProductObject[];
  }

  /**
   * Represents the request parameters for querying the Wix product catalog.
   */
  interface QueryRequestParameters {
    /** Operation identifier */
    o: string;
    /** Source identifier */
    s: string;
    /** GraphQL query string */
    q: string;
    /** JSON stringified variables for the query */
    v: string;
  }

  /**
   * Variables used in GraphQL queries for the Wix product catalog.
   */
  interface GraphQLQueryVariables {
    /** ID of the main collection to query */
    mainCollectionId: string;
    /** Number of items to skip in pagination */
    offset: number;
    /** Maximum number of items to return */
    limit: number;
    /** Sort criteria for the results */
    sort: string | null;
    /** Filter criteria for the query */
    filters: {
      term: {
        /** Field to filter on */
        field: string;
        /** Operation to perform (e.g. equals, contains) */
        op: string;
        /** Values to filter by */
        values: string[];
      };
    };
    /** Whether to include option details in the response */
    withOptions: boolean;
    /** Whether to include price range information in the response */
    withPriceRange: boolean;
  }

  /**
   * Response type for Wix product catalog queries, containing paginated product data.
   */
  interface QueryResponse {
    /** Root response data object */
    data: {
      /** Catalog information */
      catalog: {
        /** Category information */
        category: {
          /** Total number of products in the category */
          numOfProducts: number;
          /** Paginated product data with metadata */
          productsWithMetaData: {
            /** Total count of all available products matching the query */
            totalCount: number;
            /** Array of products in the current page */
            list: ProductObject[];
          };
        };
      };
    };
  }
}

// This export is needed to make the file a module
export {};
