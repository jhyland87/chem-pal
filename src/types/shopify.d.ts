/**
 * Represents a category in the Shopify store.
 * Categories are used to organize products into logical groups.
 *
 * @example
 * ```typescript
 * const category: ItemCategory = {
 *   category_id: "123",
 *   title: "Laboratory Chemicals",
 *   link: "/collections/lab-chemicals",
 *   image_link: "/images/lab-chemicals.jpg",
 *   description: "High purity chemicals for laboratory use"
 * };
 * ```
 */
export interface ItemCategory {
  /* eslint-disable */
  /**
   * Unique identifier for the category.
   * Used to reference this category in collections and filtering.
   * @example "123456789"
   */
  category_id: string;

  /**
   * Display title of the category.
   * Used in navigation and category listings.
   * @example "Laboratory Chemicals"
   */
  title: string;

  /**
   * URL path to the category's listing page.
   * Can be relative to the store's base URL.
   * @example "/collections/lab-chemicals"
   */
  link: string;

  /**
   * URL to the category's featured image.
   * Used in category listings and navigation.
   * @example "/images/categories/lab-chemicals-banner.jpg"
   */
  image_link: string;

  /**
   * Detailed description of the category.
   * Used on category landing pages and SEO.
   * @example "Browse our selection of high-purity laboratory chemicals"
   */
  description: string;
  /* eslint-enable */
}

/**
 * Represents a page in the Shopify store.
 * Pages are static content like About Us, Contact, Terms of Service, etc.
 *
 * @example
 * ```typescript
 * const page: StorePage = {
 *   page_id: "about-us",
 *   title: "About Our Company",
 *   link: "/pages/about-us",
 *   image_link: "/images/about-banner.jpg",
 *   description: "Learn about our history and mission"
 * };
 * ```
 */
export interface StorePage {
  /* eslint-disable */
  /**
   * Unique identifier for the page.
   * Used in URLs and internal references.
   * @example "about-us-123"
   */
  page_id: string;

  /**
   * Display title of the page.
   * Used in navigation and page header.
   * @example "About Our Company"
   */
  title: string;

  /**
   * URL path to the page.
   * Can be relative to the store's base URL.
   * @example "/pages/about-us"
   */
  link: string;

  /**
   * URL to the page's featured image.
   * Used in page headers and navigation.
   * @example "/images/pages/about-banner.jpg"
   */
  image_link: string;

  /**
   * Detailed description or content summary of the page.
   * Used for SEO and page previews.
   * @example "Learn about our company's history, mission, and commitment to quality"
   */
  description: string;
  /* eslint-enable */
}

/**
 * Represents product options in Shopify.
 * Options are customizable aspects of a product like size, color, etc.
 * Uses an index signature to allow any string key with various value types.
 *
 * @example
 * ```typescript
 * const option: ProductOption = {
 *   Size: "500g",
 *   Purity: "99.9%",
 *   Grade: "ACS",
 *   IsHazardous: true,
 *   OrderLimit: 5
 * };
 * ```
 */
export interface ProductOption {
  /* eslint-disable */
  /**
   * Dynamic key-value pairs for product options.
   * Keys are option names and values can be strings, numbers, or booleans.
   * Undefined is allowed to represent unset options.
   */
  [key: string]: string | number | boolean | undefined;
  /* eslint-enable */
}

/**
 * Represents a product variant in Shopify.
 * Variants are specific combinations of product options that can be purchased.
 *
 * @example
 * ```typescript
 * const variant: ProductVariant = {
 *   variant_id: "123456",
 *   sku: "CHEM-NACL-500G",
 *   barcode: "123456789012",
 *   price: 29.99,
 *   list_price: "34.99",
 *   taxable: "true",
 *   options: { Size: "500g", Purity: "99.9%" },
 *   available: "true",
 *   quantity_total: "100",
 *   link: "/products/sodium-chloride-500g"
 * };
 * ```
 */
export interface ProductVariant {
  /* eslint-disable */
  /**
   * Unique identifier for the variant.
   * Used in cart operations and variant selection.
   * @example "123456789"
   */
  variant_id: string;

  /**
   * Stock Keeping Unit for the variant.
   * Merchant-defined unique identifier.
   * @example "CHEM-NACL-500G"
   */
  sku: string;

  /**
   * Universal Product Code or similar barcode.
   * Used for inventory tracking.
   * @example "123456789012"
   */
  barcode: string;

  /**
   * Current selling price of the variant.
   * Numeric value without currency symbol.
   * @example 29.99
   */
  price: number;

  /**
   * Original or MSRP price before any discounts.
   * String value that may include currency symbol.
   * @example "34.99"
   */
  list_price: string;

  /**
   * Whether the variant is subject to tax calculations.
   * String representation of boolean.
   * @example "true"
   */
  taxable: string;

  /**
   * Set of options that define this variant.
   * Key-value pairs of option names and values.
   */
  options: ProductOption;

  /**
   * Whether the variant is currently available for purchase.
   * String representation of boolean.
   * @example "true"
   */
  available: string;

  /**
   * Array of variant metafields used for search functionality.
   * Contains additional variant data for search indexing.
   */
  search_variant_metafields_data: string[];

  /**
   * Array of variant metafields used for filtering.
   * Contains additional variant data for filter operations.
   */
  filter_variant_metafields_data: string[];

  /**
   * URL to the variant's primary image.
   * Used in product listings and detail pages.
   * @example "/images/products/sodium-chloride-500g.jpg"
   */
  image_link: string;

  /**
   * Alternative text for the variant's image.
   * Used for accessibility and SEO.
   * @example "500g bottle of Sodium Chloride, ACS Grade"
   */
  image_alt: string;

  /**
   * Total quantity available in inventory.
   * String representation of numeric value.
   * @example "100"
   */
  quantity_total: string;

  /**
   * URL path to the variant's detail page.
   * Can be relative to the store's base URL.
   * @example "/products/sodium-chloride?variant=123456789"
   */
  link: string;
  /* eslint-enable */
}

/**
 * Represents a product item in Shopify.
 * Contains all the information needed to display and sell a product.
 *
 * @example
 * ```typescript
 * const product: ItemListing = {
 *   product_id: "123456",
 *   title: "Sodium Chloride",
 *   description: "High purity NaCl",
 *   price: "29.99",
 *   vendor: "ChemSupplier",
 *   shopify_variants: [{
 *     sku: "CHEM-NACL-500G",
 *     price: 29.99,
 *     quantity_total: "100"
 *   }]
 * };
 * ```
 */
export interface ItemListing {
  /* eslint-disable */
  /**
   * Unique identifier for the product in Shopify.
   * Used for product operations and URLs.
   * @example "123456789"
   */
  product_id: string;

  /**
   * Original product identifier from external system.
   * Used for synchronization with other platforms.
   * @example "EXT-123456"
   */
  original_product_id: string;

  /**
   * Display title of the product.
   * Used in product listings and detail pages.
   * @example "Sodium Chloride, ACS Grade"
   */
  title: string;

  /**
   * Detailed description of the product.
   * Used on product detail pages and for SEO.
   * @example "High purity sodium chloride suitable for laboratory use"
   */
  description: string;

  /**
   * URL path to the product's detail page.
   * Can be relative to the store's base URL.
   * @example "/products/sodium-chloride-acs"
   */
  link: string;

  /**
   * Current selling price of the product.
   * String value that may include currency symbol.
   * @example "29.99"
   */
  price: string;

  /**
   * Original or MSRP price before any discounts.
   * String value that may include currency symbol.
   * @example "34.99"
   */
  list_price: string;

  /**
   * Available quantity of the product.
   * String representation of numeric value.
   * @example "100"
   */
  quantity: string;

  /**
   * Product code or SKU.
   * Merchant-defined unique identifier.
   * @example "CHEM-NACL-500G"
   */
  product_code: string;

  /**
   * URL to the product's main image.
   * Used in listings and detail pages.
   * @example "/images/products/sodium-chloride.jpg"
   */
  image_link: string;

  /**
   * Name of the product vendor or manufacturer.
   * Used for filtering and display.
   * @example "ChemSupplier Inc."
   */
  vendor: string;

  /**
   * Discount information for the product.
   * String representation of discount details.
   * @example "Save 15%"
   */
  discount: string;

  /**
   * ID used for adding the product to cart.
   * Used in cart operations.
   * @example "add-123456789"
   */
  add_to_cart_id: string;

  /**
   * Total number of reviews for the product.
   * String representation of numeric value.
   * @example "42"
   */
  total_reviews: string;

  /**
   * Average review score for the product.
   * String representation of numeric value.
   * @example "4.5"
   */
  reviews_average_score: string;

  /**
   * Array of product variants.
   * Contains detailed variant information.
   */
  shopify_variants: ProductVariant[];

  /**
   * Array of product image URLs.
   * Used for product galleries.
   */
  shopify_images: string[];

  /**
   * Optional array of alt text for product images.
   * Used for accessibility and SEO.
   */
  shopify_images_alt?: string[];

  /**
   * Product tags for categorization and filtering.
   * Comma-separated string of tags.
   * @example "chemicals,laboratory,ACS grade"
   */
  tags: string;
  /* eslint-enable */
}

/**
 * Represents the response from a Shopify search query.
 * Contains paginated results for products, categories, and pages.
 *
 * @example
 * ```typescript
 * const response: SearchResponse = {
 *   totalItems: 100,
 *   startIndex: 0,
 *   itemsPerPage: 20,
 *   currentItemCount: 20,
 *   items: [], // product items
 *   categories: [], // category items
 *   pages: [] // page items
 * };
 * ```
 */
export interface SearchResponse {
  /**
   * Total number of items matching the search criteria.
   * Used for pagination calculations.
   * @example 100
   */
  totalItems: number;

  /**
   * Starting index of the current result set.
   * Zero-based index for pagination.
   * @example 20
   */
  startIndex: number;

  /**
   * Number of items per page.
   * Controls result set size.
   * @example 20
   */
  itemsPerPage: number;

  /**
   * Number of items in the current result set.
   * May be less than itemsPerPage on last page.
   * @example 20
   */
  currentItemCount: number;

  /**
   * Starting index for categories in the result set.
   * Zero-based index for category pagination.
   * @example 0
   */
  categoryStartIndex: number;

  /**
   * Total number of categories matching the search.
   * Used for category pagination calculations.
   * @example 5
   */
  totalCategories: number;

  /**
   * Starting index for pages in the result set.
   * Zero-based index for page pagination.
   * @example 0
   */
  pageStartIndex: number;

  /**
   * Total number of pages matching the search.
   * Used for page pagination calculations.
   * @example 3
   */
  totalPages: number;

  /**
   * Array of search term suggestions.
   * Used for search autocomplete and "did you mean".
   * @example ["sodium chloride", "sodium hydroxide"]
   */
  suggestions: string[];

  /**
   * Array of matching categories.
   * Contains category objects with details.
   */
  categories: ItemCategory[];

  /**
   * Array of matching pages.
   * Contains page objects with details.
   */
  pages: StorePage[];

  /**
   * Array of matching products.
   * Contains product objects with details.
   */
  items: ItemListing[];
}

/**
 * Represents the query parameters for a Shopify search request.
 * Controls search behavior and result formatting.
 *
 * @example
 * ```typescript
 * const params: QueryParams = {
 *   api_key: "shop_api_key_123",
 *   q: "sodium chloride",
 *   maxResults: 20,
 *   items: true,
 *   pages: false,
 *   output: "json"
 * };
 * ```
 */
export interface QueryParams extends RequestParams {
  /* eslint-disable */
  /**
   * API key for authentication.
   * Required for accessing the Shopify API.
   * @example "shop_api_key_123"
   */
  api_key: string;

  /**
   * Search query string.
   * Terms to search for in products, categories, and pages.
   * @example "sodium chloride"
   */
  q: string;

  /**
   * Maximum number of results to return.
   * Limits total result set size.
   * @example 20
   */
  maxResults: number;

  /**
   * Starting index for results.
   * Zero-based index for pagination.
   * @example 0
   */
  startIndex: number;

  /**
   * Whether to include items in results.
   * Controls product inclusion in response.
   * @example true
   */
  items: boolean;

  /**
   * Whether to include pages in results.
   * Controls static page inclusion in response.
   * @example false
   */
  pages: boolean;

  /**
   * Whether to include facets in results.
   * Controls faceted navigation data in response.
   * @example true
   */
  facets: boolean;

  /**
   * Whether to include categories in results.
   * Controls category inclusion in response.
   * @example true
   */
  categories: boolean;

  /**
   * Whether to include suggestions in results.
   * Controls search suggestions in response.
   * @example true
   */
  suggestions: boolean;

  /**
   * Whether to include vendors in results.
   * Controls vendor facet inclusion in response.
   * @example true
   */
  vendors: boolean;

  /**
   * Whether to include tags in results.
   * Controls tag facet inclusion in response.
   * @example true
   */
  tags: boolean;

  /**
   * Starting index for pages.
   * Zero-based index for page pagination.
   * @example 0
   */
  pageStartIndex: number;

  /**
   * Maximum number of pages to return.
   * Limits page result set size.
   * @example 5
   */
  pagesMaxResults: number;

  /**
   * Starting index for categories.
   * Zero-based index for category pagination.
   * @example 0
   */
  categoryStartIndex: number;

  /**
   * Maximum number of categories to return.
   * Limits category result set size.
   * @example 10
   */
  categoriesMaxResults: number;

  /**
   * Maximum number of suggestions to return.
   * Limits suggestion result set size.
   * @example 5
   */
  suggestionsMaxResults: number;

  /**
   * Maximum number of vendors to return.
   * Limits vendor facet result set size.
   * @example 20
   */
  vendorsMaxResults: number;

  /**
   * Maximum number of tags to return.
   * Limits tag facet result set size.
   * @example 50
   */
  tagsMaxResults: number;

  /**
   * Output format for the response.
   * Controls response serialization format.
   * @example "json"
   */
  output: string;

  /**
   * Timestamp for cache busting.
   * Unix timestamp in milliseconds.
   * @example 1625097600000
   */
  _: number;
  /* eslint-enable */
}

/**
 * Represents a Shopify product variant
 */
export interface ShopifyVariant {
  /* eslint-disable */
  /**
   * Stock Keeping Unit (SKU) for the variant.
   * A unique identifier assigned by the merchant.
   * @example "CHEM-NACL-500G"
   */
  sku: string;

  /**
   * Price of the variant in the store's currency.
   * Numeric value without currency symbol.
   * @example 29.99
   */
  price: number;

  /**
   * URL path to the variant's detail page.
   * Can be relative to the store's base URL.
   * @example "/products/sodium-chloride-500g"
   */
  link: string;

  /**
   * Unique identifier for the variant in Shopify's system.
   * Used for cart operations and variant selection.
   * @example "39485736284"
   */
  variant_id: string;

  /**
   * Total quantity available for this variant.
   * Optional string representing stock level.
   * @example "100"
   */
  quantity_total?: string;

  /**
   * Additional options specific to this variant.
   * Can include size, color, model number, etc.
   * @example
   * ```typescript
   * {
   *   Model: "ABC123",
   *   Size: "500g",
   *   Purity: "99.9%"
   * }
   * ```
   */
  options?: {
    /** Model number or identifier for this variant */
    Model?: string;
    /** Additional dynamic option key-value pairs */
    [key: string]: unknown;
  };
  /* eslint-enable */
}
