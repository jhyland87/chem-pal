/**
 * Response type for Wix access token requests
 */
export interface AccessTokenResponse {
  apps: {
    [key: string]: {
      instance: string;
      intId: number;
    };
  };
  [key: string]: unknown;
}

/**
 * Represents a specific product item with its price and options
 */
export interface ProductItem {
  /** Unique identifier for the product item */
  id: string;
  /** Array of selected option IDs */
  optionsSelections: number[];
  /** Numeric price value */
  price: number;
  /** Formatted price string (e.g. "$19.99") */
  formattedPrice: string;
}

/**
 * Represents a product option (e.g. size, color)
 */
export interface ProductOption {
  /** Unique identifier for the option */
  id: string;
  /** Key identifier for the option */
  key: string;
  /** Display title of the option */
  title: string;
  /** Type of option (e.g. "dropdown", "radio") */
  optionType: string;
  /** Available selections for this option */
  selections: ProductSelection[];
}

/**
 * Represents a specific selection within a product option
 */
export interface ProductSelection {
  /** Unique identifier for the selection */
  id: number;
  /** Value of the selection */
  value: string;
  /** Description of the selection */
  description: string;
  /** Key identifier for the selection */
  key: string;
  /** Stock availability status */
  inStock: boolean | null;
}

/**
 * Represents a complete product with all its details
 */
export interface ProductObject {
  /** Unique identifier for the product */
  id: string;
  /** Available options for the product */
  options: ProductOption[];
  /** Specific product items with their variations */
  productItems: ProductItem[];
  /** Type of product */
  productType: string;
  /** Base price of the product */
  price: number;
  /** Stock keeping unit */
  sku: string;
  /** Overall stock availability status */
  isInStock: boolean;
  /** URL-friendly identifier for the product */
  urlPart: string;
  /** Formatted price string (e.g. "$19.99") */
  formattedPrice: string;
  /** Name of the product */
  name: string;
  /** Product description */
  description: string;
  /** Brand name, if applicable */
  brand: string | null;
}

/**
 * Represents the request parameters for a Wix product catalog query
 */
export interface QueryRequestParameters {
  o: string;
  s: string;
  q: string;
  v: string;
}

/**
 * Response type for Wix product catalog queries
 */
export interface QueryResponse {
  data: {
    catalog: {
      category: {
        /** Total number of products in the category */
        numOfProducts: number;
        productsWithMetaData: {
          /** Total count of products returned */
          totalCount: number;
          /** List of products in the response */
          list: ProductObject[];
        };
      };
    };
  };
}
