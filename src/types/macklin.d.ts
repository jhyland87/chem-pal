declare global {
  /**
   * Base response wrapper for all Macklin API responses.
   * All API endpoints return data in this format, with a status code,
   * message, and typed data payload.
   *
   * @example
   * ```json
   * {
   *   "code": 200,
   *   "message": "success",
   *   "data": { ... }
   * }
   * ```
   */
  interface MacklinApiResponse<T = unknown> {
    /** HTTP status code returned by the API */
    code: number;
    /** Status message or error description */
    message: string;
    /** Typed response data */
    data: T;
  }

  /**
   * Response from the timestamp endpoint used for request signing.
   * This timestamp is critical for API authentication and must be
   * synchronized with the server.
   */
  interface TimestampResponse {
    /** Server timestamp in Unix epoch seconds */
    timestamp: number;
  }

  /**
   * Local storage structure for timestamp synchronization.
   * Stores both server and client timestamps to detect drift
   * and trigger resynchronization when needed.
   */
  interface TimestampStorage {
    /** Server timestamp in Unix epoch seconds */
    serverTm: number;
    /** Client timestamp in Unix epoch seconds */
    clientTm: number;
  }

  /**
   * Configuration options for making requests to the Macklin API.
   * Supports both GET and POST/PUT requests with optional headers,
   * URL parameters, and request body.
   */
  interface MacklinApiRequestOptions {
    /** Optional HTTP headers to include in the request */
    headers?: Partial<Record<string, string | number | boolean>>;
    /** URL parameters for GET requests or query parameters */
    params?: Record<string, string | number | boolean>;
    /** Request body for POST/PUT requests */
    body?: Record<string, unknown>;
    /** HTTP method to use (defaults to GET) */
    method?: "GET" | "POST" | "PUT" | "DELETE";
  }

  /**
   * Successful API response with additional metadata.
   * Used internally to track response headers and status codes
   * for debugging and error handling.
   */
  interface MacklinApiSuccessResponse<T> {
    /** The typed response data */
    data: T;
    /** Response headers from the server */
    headers: Headers;
    /** HTTP status code */
    status: number;
  }

  /**
   * HTTP headers required for Macklin API requests.
   * All requests must include these headers for authentication
   * and request signing. The sign header is added automatically
   * by the client.
   */
  interface MacklinRequestHeaders extends Record<string, string> {
    /* eslint-disable */
    /** Server-synchronized timestamp */
    "X-Timestamp"?: string;
    /** User authentication token */
    "X-User-Token"?: string;
    /** Request language (e.g., "en", "zh") */
    "X-Language"?: string;
    /** Request signature generated from headers and params */
    sign?: string;
    /* eslint-enable */
  }

  /**
   * Extended Error type for Macklin API errors.
   * Includes additional error metadata like error codes
   * and HTTP status codes for better error handling.
   */
  interface MacklinApiError extends Error {
    /** Macklin-specific error code */
    code?: number;
    /** HTTP status code if applicable */
    status?: number;
    /** Additional error details or context */
    details?: unknown;
  }

  /**
   * Represents a Macklin product in the search results.
   * Products are indexed by their CAS number, with each CAS number
   * potentially having multiple variants (e.g., different purities,
   * packaging sizes, etc.).
   *
   * @example
   * ```json
   * {
   *   "16903-61-0": [
   *     {
   *       "item_code": "B803083",
   *       "item_en_name": "Bis(triphenylphosphine)copper(I) borohydride",
   *       ...
   *     }
   *   ]
   * }
   * ```
   */
  interface MacklinProduct {
    /** Map of CAS numbers to arrays of product variants */
    [CAS<string>]: MacklinProductVariant[];
  }

  /**
   * Represents a single variant of a Macklin product.
   * Contains detailed information about a specific product variant,
   * including chemical properties, specifications, and identifiers.
   */
  interface MacklinProductVariant {
    /* eslint-disable */
    /** CAS registry number for the chemical */
    chem_cas: CAS<string>;
    /** Unique product code used in URLs and API calls */
    item_code: string;
    /** MDL number for the chemical */
    chem_mdl: string;
    /** Toxicity indicator (0 or 1) */
    chem_if_toxic: number;
    /** English version of product specification */
    item_en_specification: string;
    /** SMILES notation for the chemical structure */
    smile_code: string;
    /** Chinese name of the product */
    item_cn_name: string;
    /** Unique product identifier */
    item_id: number;
    /** Molecular formula with HTML subscripts */
    chem_mf: string;
    /** Chemical registration number (may be null) */
    item_weihuaxuhao: string | null;
    /** Product specification (e.g., purity) */
    item_specification: string;
    /** Biological indicator (0 or 1) */
    item_if_bio: number;
    /** Transport restrictions indicator */
    item_transport: number;
    /** Chemical identifier */
    chem_id: number;
    /** Product ordering number */
    item_order: number;
    /** English name of the product */
    item_en_name: string;
    /** Safety level indicator */
    item_safe_level: number;
    /** Product image URL */
    item_upimg: string;
    /** Product category identifier */
    item_product_cate: number;
    /** Special indicator (0 or 1) */
    if_yj: number;
    /** CAS registry number (duplicate of chem_cas) */
    cas: CAS<string>;
    /* eslint-enable */
  }

  /**
   * Detailed product information returned by the product details endpoint.
   * Contains comprehensive information about a specific product variant,
   * including pricing, stock levels across different warehouses, and
   * delivery information.
   */
  interface MacklinProductDetails {
    /* eslint-disable */
    /** Unique product identifier */
    product_id: number;
    /** Product code used in URLs and API calls */
    product_code: string;
    /** Base price of the product */
    product_price: string;
    /** Unit of measurement (e.g., "g", "kg") */
    product_unit: string;
    /** Stock that is currently locked/reserved */
    product_locked_stock: string;
    /** Estimated delivery time in days */
    product_delivery_days: number;
    /** Stock level at Shanghai warehouse */
    product_stock_sh: string;
    /** Stock level at Shandong warehouse */
    product_stock_sd: string;
    /** Stock level at Nanjing warehouse */
    product_stock_nf: string;
    /** Stock level at Chongqing warehouse */
    product_stock_cq: string;
    /** Stock level at Wuhan warehouse */
    product_stock_wh: string;
    /** Stock level at Harbin warehouse */
    product_stock_hb: string;
    /** Production status indicator */
    product_if_production: number;
    /** Total available stock */
    product_stock: string;
    /** Product weight */
    product_weight: string;
    /** Packaging information */
    product_pack: string;
    /** Product category identifier */
    product_cate: number;
    /** Item identifier (links to MacklinProductVariant) */
    item_id: number;
    /** Item code (links to MacklinProductVariant) */
    item_code: string;
    /** Safety level indicator */
    item_safe_level: number;
    /** Transport restrictions indicator */
    item_transport: number;
    /** Biological indicator */
    item_if_bio: number;
    /** Product category identifier */
    item_product_cate: number;
    /** Sales status indicator */
    item_if_sell: number;
    /** CAS registry number */
    chem_cas: CAS<string>;
    /** Stock status indicator */
    item_if_stock: number;
    /** Maximum package size */
    item_max_package: string;
    /** Package customization indicator */
    item_can_pack: number;
    /** Standard delivery time in days */
    item_delivery_days: number;
    /** Chinese name of the product */
    item_cn_name: string;
    /** English name of the product */
    item_en_name: string;
    /** Chemical registration number */
    item_weihuaxuhao: string | null;
    /** Product specification */
    item_specification: string;
    /** English version of specification */
    item_en_specification: string;
    /** Storage level indicator */
    item_storage_level: number;
    /** Rare item indicator */
    item_if_rare: string | null;
    /** Future discount percentage */
    futures_discount: number;
    /** Current sale price if on discount */
    product_sales_price: string;
    /** Discount rate percentage */
    discount_rate: number;
    /** Voucher price if applicable */
    voucher_price: string;
    /** Sales status indicator */
    if_sales: number;
    /** Real-time stock indicator */
    sr_if_real: string;
    /** Customer discount percentage */
    sr_cus_discount: number;
    /** Special price */
    product_sr_price: number;
    /** Actual delivery time in days */
    delivery_days: number;
    /** Item availability indicator */
    have_in_item: number;
    /** Delivery information and restrictions */
    delivery_desc: string;
    /** Pre-delivery information */
    pre_delivery_desc: string;
    /** Formatted delivery description for display */
    delivery_desc_show: string;
    /* eslint-enable */
  }

  /**
   * Search results wrapper containing a list of products and total count.
   * The list property is generic to support different product representations
   * (e.g., MacklinProduct for search results, MacklinProductDetails for
   * detailed product information).
   */
  interface MacklinSearchResult<T> {
    /** The list of products, type depends on the endpoint */
    list: T;
    /** Total number of products matching the search */
    total: number;
  }
}

export {};
