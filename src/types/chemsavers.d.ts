declare global {
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
  interface ChemsaversProductObject extends SyntheticFields {
    /** Chemical Abstracts Service registry number */
    CAS?: string;
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
    /** Product images, each with full-size and thumbnail URLs */
    images: ChemsaversImage[];
    /** Current stock level */
    inventoryLevel: number;
    /** Type of inventory tracking used */
    inventoryTracking: string;
    /** BigCommerce inventory tracking mode: "none" (untracked, always purchasable), "product", or "variant" */
    inventory_tracking: string;
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
    /** Array of variant products */
    variants?: ChemsaversProductVariant[];
  }

  type ChemsaversProductVariant = Omit<ChemsaversProductObject, "variants">;

  /** A single product image from the Chemsavers catalog. */
  interface ChemsaversImage {
    /** Full-size image URL */
    urlStandard: string;
    /** Thumbnail image URL */
    urlThumbnail: string;
    /** Whether this image is the product's primary thumbnail */
    isThumbnail: boolean;
    /** Display order among the product's images */
    sortOrder: number;
    /** Image description / alt text */
    description: string;
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
  interface ChemsaversSearchResponse {
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
          document: ChemsaversProductObject;
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
  }
}

// This export is needed to make the file a module
export {};
