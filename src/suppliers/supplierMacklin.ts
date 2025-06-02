import { CURRENCY_SYMBOL_MAP } from "@/constants/currency";
import { mapDefined } from "@/helpers/utils";
import { ProductBuilder } from "@/utils/ProductBuilder";
import {
  isAuthCheckEndpoint,
  isAuthRequiredEndpoint,
  isMacklinApiResponse,
  isMacklinProductDetailsResponse,
  isMacklinSearchResult,
} from "@/utils/typeGuards/macklin";
import { md5 } from "js-md5";
import SupplierBase from "./supplierBase";

type RequestParams = Record<string, string | number | boolean>;

class MacklinApiError extends Error {
  constructor(
    message: string,
    public code?: number,
    public status?: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timeout after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Macklin API Client
 * Handles API requests with custom authentication and request signing
 * Uses native fetch API instead of axios
 *
 * @remarks
 * Macklins client side code is very different from the other platforms.
 * Looking at the API structure and authentication pattern, this appears to be a
 * custom implementation rather than a standard ecommerce platform or CMS. The
 * `/api/timestamp` endpoint with the specific authentication flow (using device IDs,
 * custom signing with salt, and timestamp synchronization) is not a common pattern in
 * major platforms. The specific implementation (with `MklTmKey` in `localStorage`, the salt
 * `ndksyr9834@#$32ndsfu`, and the custom MD5-like transformation) suggests this is a
 * custom-built platform, likely Macklin's own ecommerce system, rather than a standard
 * off-the-shelf solution.
 *
 * ## Request Signature Generation Process
 *
 * The Macklin API requires a custom signature for each request to ensure authenticity.
 * The signature is generated through the following steps:
 *
 * Step 1: Header String Generation
 *    - Collect all non-empty, non-object header values (excluding Content-Type)
 *    - Sort headers alphabetically by key (case-insensitive)
 *    - Format as "key=value" pairs joined by "&"
 *    - Append "&salt=ndksyr9834\@#$32ndsfu"
 *    - Convert to lowercase
 *    - Hash using MD5
 *
 * Step 2: Parameter String Generation
 *    - For GET requests: Use URL parameters
 *    - For POST/PUT requests: Use request body
 *    - Sort parameters alphabetically by key (case-insensitive)
 *    - Format as "key=value" pairs joined by "&"
 *    - Append "&salt=ndksyr9834\@#$32ndsfu"
 *    - Convert to lowercase
 *    - Hash using MD5
 *
 * Step 3: Final Signature
 *    - Concatenate header hash and parameter hash
 *    - Result is used as the "sign" header value
 *
 * Step 4: Timestamp Handling
 *    - Each request includes a "timestampe" parameter
 *    - For first request: Uses current timestamp + random numbers
 *    - For subsequent requests: Uses current timestamp + digits from previous signature
 *    - Server timestamp is fetched every 800 seconds to maintain sync
 *
 * @category Suppliers
 * @example
 * ```ts
 * Headers: {
 *   "X-Agent": "web",
 *   "X-Timestamp": "1234567890"
 * }
 * Parameters: {
 *   "keyword": "test",
 *   "page": "1"
 * }
 *
 * // Header String: "x-agent=web&x-timestamp=1234567890&salt=ndksyr9834@#$32ndsfu"
 * // Param String: "keyword=test&page=1&salt=ndksyr9834@#$32ndsfu"
 * // Final Signature: headerHash + paramHash
 *
 * ```
 */
export default class SupplierMacklin
  extends SupplierBase<Product, Product>
  implements AsyncIterable<Product>
{
  /** Name of supplier (for display purposes) */
  public readonly supplierName: string = "Macklin";

  /** Base URL for HTTP(s) requests */
  public readonly baseURL: string = "https://www.macklin.cn";

  /** The host of the Macklin API. */
  public readonly apiHost: string = "api.macklin.cn";

  /** Shipping scope for Macklin */
  public readonly shipping: ShippingRange = "worldwide";

  /** The country code of the supplier. */
  public readonly country: CountryCode = "CN";

  /** Override the type of queryResults to use our specific type */
  protected queryResults: Array<Product> = [];

  /** Used to keep track of how many requests have been made to the supplier. */
  protected httpRequstCount: number = 0;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private readonly TIMESTAMP_REFRESH_THRESHOLD: number = 800;

  /** The salt used to sign requests. */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  private readonly SALT: string = "ndksyr9834@#$32ndsfu";

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private readonly DEFAULT_TIMEOUT: number = 30000;

  /**
   * Local storage object for the Macklin API client.
   * @todo Add the timestamp to the chrome.storage.local
   */
  private localStorage: Record<string, unknown> = {};

  /** The last signature used for the request */
  private lastSignature: string | null = null;

  /** HTTP headers used as a basis for all queries. */
  protected headers: MacklinRequestHeaders = {
    /* eslint-disable @typescript-eslint/naming-convention */
    "X-Agent": "web",
    "X-User-Token": "",
    "X-Device-Id": "",
    "X-Language": "en",
    "X-Timestamp": "",
    /* eslint-enable @typescript-eslint/naming-convention */
  };

  /**
   * Sets up the Macklin API client by:
   * 1. Validating and updating the timestamp
   * 2. Generating a device ID if not present
   * 3. Setting up the headers with the correct values
   *
   * @returns void
   * @throws MacklinApiError If the timestamp request fails or response is invalid
   */
  protected async setup(): Promise<void> {
    await this.validateAndUpdateTimestamp();

    if (!this.localStorage.soleId) {
      this.localStorage.soleId = this.generateString(16);
    }

    if (!this.localStorage.MklUserToken) {
      this.localStorage.MklUserToken = "";
    }

    // Update headers to match api-client.js exactly, using defensive string conversion
    this.headers = {
      /* eslint-disable @typescript-eslint/naming-convention */
      "X-Agent": "web",
      "X-User-Token": this.ensureStringHeader(this.localStorage.MklUserToken),
      "X-Device-Id": this.ensureStringHeader(this.localStorage.soleId),
      "X-Language": "en",
      "X-Timestamp": "",
      /* eslint-enable @typescript-eslint/naming-convention */
    };
  }

  /**
   * Queries the Macklin API for products matching the search term.
   * Handles the complex response structure where products are grouped by CAS number
   * and may have multiple variants per CAS number.
   *
   * @param query - The search term to find products
   * @param limit - Maximum number of products to return (after fuzzy filtering a search
   * limited to 90 results))
   * @returns Array of ProductBuilder instances or void if the request fails
   * @throws MacklinApiError if the API request fails or response is invalid
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    this.limit = limit;
    const response: unknown = await this.request<MacklinSearchResultProducts>(`/api/item/search`, {
      params: { keyword: query, limit: 90, page: 1 },
    });

    if (!isMacklinSearchResult<MacklinSearchResultProducts>(response)) {
      this.logger.warn("Invalid API response format");
      return;
    }

    // Flatten the array of arrays into a single array of products
    const products = Object.values(response.list).map((item) => item[0]);

    const fuzzFiltered = this.fuzzyFilter<MacklinProductVariant>(query, products);
    this.logger.info("fuzzFiltered:", fuzzFiltered);
    return this.initProductBuilders(fuzzFiltered.slice(0, limit));
  }

  /**
   * Extracts the English name from a Macklin product variant.
   * Used by the base class to display product titles.
   *
   * @param data - The product variant to extract the title from
   * @returns The English name of the product
   */
  protected titleSelector(data: MacklinProductVariant): string {
    return data.item_en_name;
  }

  /**
   * Fetches detailed product information from the Macklin API.
   * This includes pricing, stock levels, and delivery information
   * that isn't available in the search results.
   *
   * @param product - The ProductBuilder instance to enrich with details
   * @returns The enriched ProductBuilder or void if the request fails
   * @throws MacklinApiError if the API request fails or response is invalid
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<void | ProductBuilder<Product>> {
    const response: unknown = await this.request<MacklinProductDetails>("/api/product/list", {
      params: { code: product.get("uuid") },
    });

    if (!isMacklinProductDetailsResponse(response)) {
      this.logger.warn("Invalid API response format for product:", product.get("uuid"));
      return product;
    }

    const variant = response.list[0];
    product.setPricing(variant.product_price, "CNY", CURRENCY_SYMBOL_MAP.CNY);
    product.setQuantity(variant.product_pack);
    product.setUOM(variant.product_unit);
    product.setAvailability(variant.product_stock);
    product.setDescription(variant.item_en_specification);

    return product;
  }

  /**
   * Creates ProductBuilder instances from Macklin product variants.
   * This is the final step in the product search process, converting
   * the API response into a format that can be used by the rest of
   * the application.
   *
   * @param data - Array of product variants to convert
   * @returns Array of ProductBuilder instances
   */
  protected initProductBuilders(data: MacklinProductVariant[]): ProductBuilder<Product>[] {
    return mapDefined(data, (product) => {
      return (
        new ProductBuilder(this.baseURL)
          //.addRawData(product)
          .setBasicInfo(
            product.item_en_name,
            `${this.baseURL}/en/products/${product.item_code}`,
            this.supplierName,
          )
          ///.setDescription(product.description)
          .setId(product.item_id)
          //.setAvailability(product.available)
          .setUUID(product.item_code)
          //.setPricing(product.price.price, product?.currency as string, CURRENCY_SYMBOL_MAP.EUR)
          .setCAS(product.cas)
      );
    });
  }

  /**
   * Generates a random string for use in device IDs and user tokens.
   * Can operate in two modes:
   * 1. Random string mode: Generates a string of specified length
   * 2. UUID mode: Generates a UUID-like string if no length is specified
   *
   * @param length - Optional length for random string mode
   * @param charSetSize - Optional size of character set to use
   * @returns A random string
   * @example
   * ```ts
   * const string = this.generateString(20);
   * // "5Wf70hQ0y1akc8rTQ8ps"
   *
   * const uuid = this.generateString();
   * // "550e8400-e29b-41d4-a716-446655440000"
   * ```
   */
  private generateString(length?: number, charSetSize?: number): string {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const size = charSetSize || chars.length;

    if (length) {
      // Random string mode
      return Array.from({ length }, () => chars[Math.floor(Math.random() * size)]).join("");
    } else {
      // UUID mode
      const uuid = new Array(36).fill("");
      uuid[8] = uuid[13] = uuid[18] = uuid[23] = "-";
      uuid[14] = "4";

      for (let i = 0; i < 36; i++) {
        if (!uuid[i]) {
          const random = Math.floor(16 * Math.random());
          uuid[i] = chars[19 === i ? (3 & random) | 8 : random];
        }
      }
      return uuid.join("");
    }
  }

  /**
   * Step 1 & 2: Signature Generation
   * Implements the core signature generation process by:
   * 1. Creating and hashing the header string
   * 2. Creating and hashing the parameter string
   * 3. Combining both hashes for the final signature
   *
   * @param headers - Request headers to sign
   * @param params - Request parameters to sign
   * @returns The final request signature
   */
  private signRequest(headers: MacklinRequestHeaders, params: RequestParams): string {
    // Sort and filter headers exactly like api-client.js
    const headerString =
      Object.entries(headers)
        .filter(([key, value]) => {
          return (
            key !== "Content-Type" && value !== "" && value != null && typeof value !== "object"
          );
        })
        .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .map(([key, value]) => `${key.toLowerCase()}=${value}`)
        .join("&") + `&salt=${this.SALT}`;

    // Sort and filter params exactly like api-client.js
    const paramString =
      Object.entries(params)
        .filter(([, value]) => {
          return value !== "" && value != null && typeof value !== "object";
        })
        .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .map(([key, value]) => `${key}=${String(value).trim()}`)
        .join("&") + `&salt=${this.SALT}`;

    // Debug logging to match api-client.js
    this.logger.debug("Headers for signing:", headers);
    this.logger.debug("Params for signing:", params);
    this.logger.debug("Header string:", headerString.toLowerCase());
    this.logger.debug("Param string:", paramString.toLowerCase());

    const headerHash = md5(headerString.toLowerCase());
    const paramHash = md5(paramString.toLowerCase());
    const finalSignature = headerHash + paramHash;

    this.logger.debug("Header hash:", headerHash);
    this.logger.debug("Param hash:", paramHash);
    this.logger.debug("Final signature:", finalSignature);

    return finalSignature;
  }

  /**
   * Step 3: Request Processing
   * The main request handler that:
   * 1. Updates and validates timestamps
   * 2. Prepares headers and parameters
   * 3. Generates and applies the signature
   * 4. Makes the actual API request
   * 5. Handles response validation and errors
   *
   * @param path - The API endpoint to call
   * @param options - Request configuration
   * @returns The API response
   * @throws ApiError If the request fails or response is invalid
   * @throws TimeoutError If the request times out
   */
  private async request<T>(path: string, options: MacklinApiRequestOptions = {}): Promise<T> {
    try {
      const timestamp = (this.localStorage.MklTmKey as TimestampStorage).serverTm;

      // Create a fresh headers object to avoid any potential array concatenation
      const headers: MacklinRequestHeaders = {
        /* eslint-disable @typescript-eslint/naming-convention */
        "X-Agent": "web",
        "X-User-Token": this.ensureStringHeader(this.localStorage.MklUserToken),
        "X-Device-Id": this.ensureStringHeader(this.localStorage.soleId),
        "X-Language": "en",
        "X-Timestamp": this.ensureStringHeader(timestamp),
        /* eslint-enable @typescript-eslint/naming-convention */
      };

      // Handle auth headers exactly like api-client.js
      if (isAuthRequiredEndpoint(path)) {
        headers["X-User-Token"] = this.ensureStringHeader(this.localStorage.MklUserToken);
      }

      // Handle language parameter exactly like api-client.js
      if (options.params?.lang) {
        headers["X-Language"] = this.ensureStringHeader(options.params.lang);
      }

      // Add any additional headers from options, ensuring they're strings
      if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          headers[key] = this.ensureStringHeader(value);
        });
      }

      // Add timestamp to request exactly like api-client.js
      const requestTimestamp = this.generateRequestTimestamp();
      const params: RequestParams = { ...options.params };
      let body = options.body;

      if (options.method === "GET" || !options.method) {
        params.timestampe = requestTimestamp;
      } else if (body) {
        body = { ...body, timestampe: requestTimestamp };
      }

      // Sign the request
      const signature = this.signRequest(
        headers,
        options.method === "GET" || !options.method ? params : (body as RequestParams),
      );
      headers.sign = signature;
      this.lastSignature = signature;

      // Debug logging to match api-client.js
      this.logger.debug("Full request URL:", this.href(path, params, this.apiHost));
      this.logger.debug("Request headers:", headers);
      this.logger.debug("Request params:", params);
      this.logger.debug("Request body:", body);

      const response: unknown = await this.httpGetJson({
        path,
        headers,
        params,
        body: body ? JSON.stringify(body) : undefined,
        host: this.apiHost,
      });

      if (!isMacklinApiResponse<T>(response)) {
        throw new MacklinApiError("Invalid API response format");
      }

      // Handle authentication errors exactly like api-client.js
      if (isAuthCheckEndpoint(path) && response.code === 1005) {
        throw new MacklinApiError("Authentication required");
      }

      return response.data;
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      if (error instanceof MacklinApiError) {
        throw error;
      }
      throw new MacklinApiError("API request failed", undefined, undefined, error);
    }
  }

  /**
   * Step 4.1: Server Timestamp Management
   * Fetches and stores the server timestamp to maintain time synchronization.
   * Called when local timestamp is missing or expired (over 800 seconds old, or
   * 13 minutes).
   * @todo Add the timestamp to the chrome.storage.local
   * @returns The server timestamp
   * @throws MacklinApiError If the timestamp request fails or response is invalid
   */
  private async fetchServerTimestamp(): Promise<number> {
    const response = await this.httpGetJson({
      path: `/api/timestamp`,
      host: this.apiHost,
    });

    if (!isMacklinApiResponse<TimestampResponse>(response)) {
      throw new MacklinApiError("Invalid API response format");
    }

    this.logger.log("serverTimestamp response:", response);

    const clientTime = Math.round(Date.now() / 1000);
    const timestampData: TimestampStorage = {
      serverTm: response.data.timestamp,
      clientTm: clientTime,
    };

    this.localStorage.MklTmKey = timestampData;

    return timestampData.serverTm;
  }

  /**
   * Step 4.2: Request Timestamp Generation
   * Generates a unique timestamp for each request using either:
   * - Current time + random numbers (first request)
   * - Current time + digits from previous signature (subsequent requests)
   *
   * @returns A unique timestamp string for the request
   */
  private generateRequestTimestamp(): number {
    if (this.lastSignature) {
      const digits = this.lastSignature.match(/\d+/g);
      return Date.now() + (digits ? Number(digits.join("")) : 1);
    }
    return Date.now() + Math.floor(Math.random()) + Math.ceil(Math.random());
  }

  /**
   * Step 4.3: Timestamp Validation and Update
   * Manages the timestamp lifecycle:
   * - Validates current timestamp
   * - Fetches new timestamp if expired
   * - Converts timestamp to string format for headers
   *
   * @returns The current valid timestamp as a string
   */
  private async validateAndUpdateTimestamp(): Promise<string> {
    const currentTime = Math.round(Date.now() / 1000);
    const storedTimestamp = this.localStorage.MklTmKey
      ? (this.localStorage.MklTmKey as TimestampStorage)
      : null;

    if (
      !storedTimestamp ||
      currentTime > storedTimestamp.clientTm + this.TIMESTAMP_REFRESH_THRESHOLD
    ) {
      delete this.localStorage.MklTmKey;
      return String(await this.fetchServerTimestamp());
    }

    return String(storedTimestamp.serverTm);
  }

  /**
   * Ensures header values are always strings, handling arrays and null values.
   * This prevents issues with header concatenation and type mismatches.
   *
   * @param value - The header value to convert
   * @returns A string representation of the value
   * @example
   * ```ts
   * this.ensureStringHeader(["value"]) // "value"
   * this.ensureStringHeader(null) // ""
   * this.ensureStringHeader(123) // "123"
   * ```
   */
  private ensureStringHeader(value: unknown): string {
    if (Array.isArray(value)) {
      // If it's an array, take the first value
      return String(value[0] || "");
    }
    return String(value || "");
  }
}
