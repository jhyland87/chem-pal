/**
 * Represents a category in the Shopify store
 */
export interface ItemCategory {
  /* eslint-disable */
  /** Unique identifier for the category */
  category_id: string;
  /** Display title of the category */
  title: string;
  /** URL link to the category page */
  link: string;
  /** URL to the category's image */
  image_link: string;
  /** Detailed description of the category */
  description: string;
  /* eslint-enable */
}

/**
 * Represents a page in the Shopify store
 */
export interface StorePage {
  /* eslint-disable */
  /** Unique identifier for the page */
  page_id: string;
  /** Display title of the page */
  title: string;
  /** URL link to the page */
  link: string;
  /** URL to the page's image */
  image_link: string;
  /** Detailed description of the page */
  description: string;
  /* eslint-enable */
}

/**
 * Represents product options in Shopify
 */
export interface ProductOption {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Represents a product variant in Shopify
 */
export interface ProductVariant {
  /* eslint-disable */
  /** Unique identifier for the variant */
  variant_id: string;
  /** Stock Keeping Unit for the variant */
  sku: string;
  /** Barcode for the variant */
  barcode: string;
  /** Current price of the variant */
  price: number;
  /** Original list price of the variant */
  list_price: string;
  /** Whether the variant is taxable */
  taxable: string;
  /** Product options associated with this variant */
  options: ProductOption;
  /** Whether the variant is available for purchase */
  available: string;
  /** Array of variant metafields data for search */
  search_variant_metafields_data: string[];
  /** Array of variant metafields data for filtering */
  filter_variant_metafields_data: string[];
  /** URL to the variant's image */
  image_link: string;
  /** Alt text for the variant's image */
  image_alt: string;
  /** Total quantity available for this variant */
  quantity_total: string;
  /** URL link to the variant's page */
  link: string;
  /* eslint-enable */
}

/**
 * Represents a product item in Shopify
 */
export interface ItemListing {
  /* eslint-disable */
  /** Unique identifier for the product */
  product_id: string;
  /** Original product identifier */
  original_product_id: string;
  /** Display title of the product */
  title: string;
  /** Detailed description of the product */
  description: string;
  /** URL link to the product page */
  link: string;
  /** Current price of the product */
  price: string;
  /** Original list price of the product */
  list_price: string;
  /** Available quantity of the product */
  quantity: string;
  /** Product code/SKU */
  product_code: string;
  /** URL to the product's main image */
  image_link: string;
  /** Name of the product vendor */
  vendor: string;
  /** Discount information for the product */
  discount: string;
  /** ID used for adding the product to cart */
  add_to_cart_id: string;
  /** Total number of reviews for the product */
  total_reviews: string;
  /** Average review score for the product */
  reviews_average_score: string;
  /** Array of product variants */
  shopify_variants: ProductVariant[];
  /** Array of product image URLs */
  shopify_images: string[];
  /** Optional array of alt text for product images */
  shopify_images_alt?: string[];
  /** Product tags */
  tags: string;
  /* eslint-enable */
}

/**
 * Represents the response from a Shopify search query
 */
export interface SearchResponse {
  /** Total number of items found */
  totalItems: number;
  /** Starting index of the current result set */
  startIndex: number;
  /** Number of items per page */
  itemsPerPage: number;
  /** Number of items in the current result set */
  currentItemCount: number;
  /** Starting index for categories */
  categoryStartIndex: number;
  /** Total number of categories found */
  totalCategories: number;
  /** Starting index for pages */
  pageStartIndex: number;
  /** Total number of pages found */
  totalPages: number;
  /** Array of search suggestions */
  suggestions: string[];
  /** Array of matching categories */
  categories: ItemCategory[];
  /** Array of matching pages */
  pages: StorePage[];
  /** Array of matching products */
  items: ItemListing[];
}

/**
 * Represents the query parameters for a Shopify search request
 */
export interface QueryParams extends RequestParams {
  /** API key for authentication */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  api_key: string;
  /** Search query string */
  q: string;
  /** Maximum number of results to return */
  maxResults: number;
  /** Starting index for results */
  startIndex: number;
  /** Whether to include items in results */
  items: boolean;
  /** Whether to include pages in results */
  pages: boolean;
  /** Whether to include facets in results */
  facets: boolean;
  /** Whether to include categories in results */
  categories: boolean;
  /** Whether to include suggestions in results */
  suggestions: boolean;
  /** Whether to include vendors in results */
  vendors: boolean;
  /** Whether to include tags in results */
  tags: boolean;
  /** Starting index for pages */
  pageStartIndex: number;
  /** Maximum number of pages to return */
  pagesMaxResults: number;
  /** Starting index for categories */
  categoryStartIndex: number;
  /** Maximum number of categories to return */
  categoriesMaxResults: number;
  /** Maximum number of suggestions to return */
  suggestionsMaxResults: number;
  /** Maximum number of vendors to return */
  vendorsMaxResults: number;
  /** Maximum number of tags to return */
  tagsMaxResults: number;
  /** Output format for the response */
  output: string;
  /** Timestamp for cache busting */
  _: number;
}
