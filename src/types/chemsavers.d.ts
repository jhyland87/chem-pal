/**
 * Represents a product from the Chemsavers catalog.
 *
 * Contains all product details including:
 * - Basic information (name, description, ID)
 * - Pricing information (retail, sale, MAP prices)
 * - Inventory details
 * - Categorization and metadata
 * - Product identifiers (SKU, UPC, CAS)
 */
export interface ProductObject {
  /* eslint-disable */
  /** Chemical Abstracts Service registry number */
  CAS: string;
  /** Final calculated price after any adjustments */
  calculatedPrice: number;
  /** List of categories the product belongs to */
  categories: string[];
  /** Full product description */
  description: string;
  /** Whether the product has variant options */
  hasOptions: boolean;
  /** Unique identifier for the product */
  id: string;
  /** Array of product image URLs */
  images: string[];
  /** Current stock level */
  inventoryLevel: number;
  /** Type of inventory tracking used */
  inventoryTracking: string;
  /** Minimum Advertised Price */
  mapPrice: number;
  /** SEO meta description */
  metaDescription: string;
  /** SEO keywords */
  metaKeywords: string[];
  /** Product name/title */
  name: string;
  /** Current price */
  price: number;
  /** Internal product ID number */
  product_id: number;
  /** Original retail price */
  retailPrice: number;
  /** Discounted sale price */
  salePrice: number;
  /** Stock Keeping Unit identifier */
  sku: string;
  /** Display order priority */
  sortOrder: number;
  /** Universal Product Code */
  upc: string;
  /** Product page URL */
  url: string;
  /* eslint-enable */
}

/**
 * Represents the response structure from the Typesense search API.
 *
 * Contains search results along with pagination information and request parameters.
 * The response is structured as an array of result objects, each containing:
 * - Facet counts for filtering
 * - Total number of matching records
 * - Paginated product hits
 * - Search metadata and parameters
 */
export interface SearchResponse {
  /* eslint-disable */
  /** Array of search result objects */
  results: {
    /** Facet groupings for result filtering */
    fascet_counts: unknown[];
    /** Total number of matching records */
    found: number;
    /** Array of product hits, each containing a ProductObject */
    hits: [
      {
        /** The matching product data */
        document: ProductObject;
      },
    ][];
    /** Total number of records searched */
    out_of: number;
    /** Current page number */
    page: number;
    /** Original search request parameters */
    request_params: {
      /** Name of the Typesense collection searched */
      collection_name: string;
      /** Initial search query */
      first_q: string;
      /** Number of results per page */
      per_page: number;
      /** Actual search query used */
      q: string;
    };
  }[];
  /* eslint-enable */
}
