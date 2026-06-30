import { AVAILABILITY } from "@/constants/common";
import { CURRENCY_SYMBOL_MAP } from "@/constants/currency";
import { parseQuantity } from "@/helpers/quantity";
import { mapDefined } from "@/helpers/utils";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { isMinimalProduct } from "@/utils/typeGuards/common";
import {
  isAuthCheckEndpoint,
  isAuthRequiredEndpoint,
  isMacklinApiResponse,
  isMacklinMsdsSearchResponse,
  isMacklinProductDetailsResponse,
  isMacklinProductInfo,
  isMacklinSearchResult,
  isTimestampStorage,
} from "@/utils/typeGuards/macklin";
import { Queue } from "async-await-queue";
import { md5 } from "js-md5";
import { SupplierBase } from "./SupplierBase";

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
 * Macklin is a Chineese based chemical supply company. This module handles API requests with
 * custom authentication and request signing for every call.
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
 * @source
 */
export class SupplierMacklin extends SupplierBase<Product, Product> implements ISupplier {
  /** Name of supplier (for display purposes) */
  public readonly supplierName: string = "Macklin";

  /** Base URL for HTTP(s) requests */
  public readonly baseURL: string = "https://www.macklin.cn";

  /** The host of the Macklin API. */
  public readonly apiURL: string = "api.macklin.cn";

  /** Shipping scope for Macklin */
  public readonly shipping: ShippingRange = "worldwide";

  /** The country code of the supplier. */
  public readonly country: CountryCode = "CN";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

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
   * @source
   */
  private localStorage: Record<string, unknown> = {};

  /** The last signature used for the request */
  private lastSignature: string | null = null;

  /**
   * Memoized batch of `/api/product/list` lookups for the current result set,
   * keyed by item code. Created once on first access so every product's detail
   * fetch shares the same bounded list phase (see getProductListBatch).
   */
  private productListBatch?: Promise<Map<string, MacklinProductDetails[]>>;

  /**
   * Memoized batch of `/api/product/info` lookups for the current result set,
   * keyed by item code. Created once on first access so every product's detail
   * fetch shares the same bounded info phase (see getProductInfoBatch).
   */
  private productInfoBatch?: Promise<Map<string, MacklinProductInfo>>;

  /** Highest rate-limit usage tier (50/75/90/100) already logged this window. */
  private rateLimitTierLogged: number = 0;

  /** Last `X-Ratelimit-Remaining` seen; a rise signals the server window reset. */
  private rateLimitLastRemaining: number = Number.POSITIVE_INFINITY;

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
   * @source
   */
  protected async setup(): Promise<void> {
    await this.validateAndUpdateTimestamp();

    if (!this.localStorage.soleId) {
      this.localStorage.soleId = this.generateString(16, 16);
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

    console.log("this.localStorage", this.localStorage);
    console.log("this.headers", this.headers);
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
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    this.limit = limit;
    // Reset the per-search batches so a new query doesn't reuse the previous
    // result set's product/list and product/info lookups.
    this.productListBatch = undefined;
    this.productInfoBatch = undefined;
    const searchRequest: unknown = await this.request<MacklinSearchResultProducts>(
      `/api/item/search`,
      {
        params: { keyword: query, limit: 90, page: 1 },
      },
    );

    if (!isMacklinSearchResult<MacklinSearchResultProducts>(searchRequest)) {
      this.logger.warn("Invalid API response format");
      return;
    }

    // Flatten the array of arrays into a single array of products
    const products = Object.values(searchRequest.list).map((item) => item[0]);

    const fuzzFiltered = this.fuzzyFilterAst<MacklinProductVariant>(products);
    this.logger.debug("fuzzFiltered:", { query, searchRequest, products, fuzzFiltered });
    const processed = fuzzFiltered.slice(0, limit);
    return this.initProductBuilders(processed);
  }

  /**
   * Extracts the English name from a Macklin product variant.
   * Used by the base class to display product titles.
   *
   * @param data - The product variant to extract the title from
   * @returns The English name of the product
   * @source
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
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    const itemCode = product.get("uuid");
    return this.getProductDataWithCache(
      product,
      async (builder) => {
        // Each endpoint is fetched as its own bounded batch shared across all
        // products (list -> info -> sds), so the requests run in distinct phases
        // rather than interleaving per product. Interleaving let some products'
        // list calls get pushed to the very end of the burst, outside the
        // server's signing window, where they were rejected.

        // `/api/product/list` returns every pack-size variant of the product.
        const listVariants = (await this.getProductListBatch()).get(itemCode);

        // Keep only purchasable variants (in stock), then map each to a Variant.
        // A product with no in-stock variant has nothing to show.
        const variants = mapDefined(
          (listVariants ?? [])
            .filter((detail) => Number(detail.product_stock) > 0)
            .sort((a, b) => Number(a.product_price) - Number(b.product_price)),
          (detail) => {
            const built = this.toVariant(detail);
            return built ? { detail, variant: built } : undefined;
          },
        );

        // Bail with `void` (not the half-built builder) when there's nothing
        // usable. Returning the builder here would cache a price-less product
        // (see getProductDataWithCache), poisoning the cache so the product stays
        // broken on every later search. `void` skips the cache write and lets the
        // next search retry.
        if (variants.length === 0) {
          this.logger.warn("No in-stock product/list variants for product:", itemCode);
          return undefined;
        }

        // The cheapest in-stock variant is the product's headline price/size; the
        // rest are attached as selectable variants.
        const [primary] = variants;
        builder.setPricing(primary.detail.product_price, "CNY", CURRENCY_SYMBOL_MAP.CNY);
        if (primary.variant.quantity != null && primary.variant.uom != null) {
          builder.setQuantity(primary.variant.quantity, primary.variant.uom);
        }
        builder.setAvailability(AVAILABILITY.IN_STOCK);
        builder.setDescription(primary.detail.item_en_specification);
        builder.setVariants(variants.map(({ variant }) => variant));

        // Molecular weight comes from `/api/product/info`.
        const info = (await this.getProductInfoBatch()).get(itemCode);
        builder.setMoleweight(info?.item.chem_mw);

        // SDS lookup runs last — one request, and only for products that
        // already have the minimum required data (a request spent on a product
        // that will be dropped anyway is wasted).
        if (isMinimalProduct(builder.dump())) {
          builder.setSDSUrl(await this.sdsSearch(itemCode));
        }

        return builder;
      },
      { code: itemCode },
    );
  }

  /**
   * Converts a single `/api/product/list` variant into a `Partial<Variant>`. The
   * pack size is parsed from `product_code` (formatted `${item_code}-${quantity}`,
   * e.g. `I929937-100mg`); the product-level `product_id`/`product_code` become
   * the variant's `uuid`/`sku`. Returns undefined when the quantity can't be
   * parsed, so the caller can skip it.
   *
   * @param detail - The product-list variant to convert
   * @returns The variant, or undefined when the pack size can't be parsed
   * @example
   * ```ts
   * this.toVariant({ product_code: "I929937-100mg", item_code: "I929937", ... });
   * // -> { uuid: 94613254, sku: "I929937-100mg", title: "... 100mg", quantity: 100, uom: "mg", ... }
   * ```
   * @source
   */
  private toVariant(detail: MacklinProductDetails): Partial<Variant> | undefined {
    const prefix = `${detail.item_code}-`;
    const quantityLabel = detail.product_code.startsWith(prefix)
      ? detail.product_code.slice(prefix.length)
      : detail.product_code;
    const quantity = parseQuantity(quantityLabel);
    if (!quantity) {
      return undefined;
    }
    return {
      id: detail.product_id,
      uuid: detail.product_id,
      sku: detail.product_code,
      title: quantityLabel,
      price: Number(detail.product_price),
      currencyCode: "CNY",
      currencySymbol: CURRENCY_SYMBOL_MAP.CNY,
      quantity: quantity.quantity,
      uom: quantity.uom,
    };
  }

  /**
   * Fetches `/api/product/list` for every product in the current result set as
   * one bounded, memoized batch keyed by item code, storing the first (cheapest)
   * variant. Running the list calls as a single phase — rather than letting each
   * ride the per-product detail queue — keeps every product's list request in
   * the same burst window; previously the later products' list calls were pushed
   * to the end of the run (behind the info/SDS phases) and rejected by the
   * server. The batch is created once and shared.
   *
   * @returns A map of item code to its full list of product variants (only codes
   *   with a valid, non-empty list response are present)
   * @example
   * ```ts
   * const variants = (await this.getProductListBatch()).get("T819228");
   * // variants?.[0].product_price -> "30.00"
   * ```
   * @source
   */
  private async getProductListBatch(): Promise<Map<string, MacklinProductDetails[]>> {
    if (!this.productListBatch) {
      this.productListBatch = (async () => {
        const codes = this.products
          .map((product) => product.get("uuid"))
          .filter((uuid): uuid is string => typeof uuid === "string");
        const queue = new Queue(this.maxConcurrentRequests, this.minConcurrentCycle);
        const variantsByCode = new Map<string, MacklinProductDetails[]>();
        await Promise.all(
          codes.map((code) =>
            queue.run(async () => {
              const response = await this.request<MacklinProductDetails>("/api/product/list", {
                params: { code },
              });
              if (isMacklinProductDetailsResponse(response) && response.list.length > 0) {
                variantsByCode.set(code, response.list);
              }
            }),
          ),
        );
        return variantsByCode;
      })();
    }
    return this.productListBatch;
  }

  /**
   * Fetches a product's chemistry data from the product info endpoint
   * (`POST /api/product/info`, body `{ item_code }`). Returns undefined rather
   * than throwing when the request fails or the response isn't the expected
   * shape, so a missing info payload never drops the product.
   *
   * @param itemCode - The product's item code
   * @returns The validated product info, or undefined when unavailable
   * @example
   * ```ts
   * const info = await this.getProductInfo("P866188");
   * // info?.item.chem_mw -> "252.13"
   * ```
   * @source
   */
  private async getProductInfo(itemCode: string): Promise<MacklinProductInfo | undefined> {
    try {
      const data = await this.request<MacklinProductInfo>("/api/product/info", {
        method: "POST",
        body: { item_code: itemCode },
      });
      return isMacklinProductInfo(data) ? data : undefined;
    } catch (error: unknown) {
      this.logger.debug("product/info fetch failed", { itemCode, error });
      return undefined;
    }
  }

  /**
   * Fetches `/api/product/info` for every product in the current result set as
   * one bounded, memoized batch keyed by item code. Running the info calls as
   * their own phase (rather than interleaving a POST after each product's list
   * GET) keeps the number of concurrently in-flight signed requests inside the
   * browser's per-host connection limit — interleaved list+info bursts were
   * pushing the trailing requests outside the server's window, which rejected
   * them as "Signature failed". The batch is created once and shared, so every
   * per-product detail fetch awaits the same set of results.
   *
   * @returns A map of item code to its product info (only codes with a valid
   *   info payload are present)
   * @example
   * ```ts
   * const info = (await this.getProductInfoBatch()).get("T819228");
   * // info?.item.chem_mw -> "252.13"
   * ```
   * @source
   */
  private async getProductInfoBatch(): Promise<Map<string, MacklinProductInfo>> {
    if (!this.productInfoBatch) {
      this.productInfoBatch = (async () => {
        const codes = this.products
          .map((product) => product.get("uuid"))
          .filter((uuid): uuid is string => typeof uuid === "string");
        const queue = new Queue(this.maxConcurrentRequests, this.minConcurrentCycle);
        const infoByCode = new Map<string, MacklinProductInfo>();
        await Promise.all(
          codes.map((code) =>
            queue.run(async () => {
              const info = await this.getProductInfo(code);
              if (info) {
                infoByCode.set(code, info);
              }
            }),
          ),
        );
        return infoByCode;
      })();
    }
    return this.productInfoBatch;
  }

  /**
   * Looks up a product's SDS (MSDS) document URL by its item code. The endpoint
   * returns `code: 200` with `data.url` when a sheet exists, or an error code
   * with `data: []` when it doesn't.
   *
   * Example request URL:
   * https://api.macklin.cn/api/msds/search?lang=en&keyword=P866188&timestampe=...
   *
   * @param itemCode - The product's item code (the API's `keyword` param)
   * @returns The SDS document URL, or undefined when none is available
   * @example
   * ```ts
   * const url = await this.sdsSearch("P866188");
   * // "https://www.macklin.cn/pdf/msds/download?lang=en&id=23884&..."
   * ```
   * @source
   */
  private async sdsSearch(itemCode: string): Promise<string | undefined> {
    const response = await this.request<unknown>("/api/msds/search", {
      params: { keyword: itemCode, lang: "en" },
    });

    if (isMacklinMsdsSearchResponse(response)) {
      return response.url;
    }

    this.logger.debug("No SDS document for item", { itemCode, response });
    return undefined;
  }

  /**
   * Creates ProductBuilder instances from Macklin product variants. This is the
   * final step in the product search process, converting the API response into
   * a format that can be used by the rest of the application. Pricing, molecular
   * weight, and the SDS URL are filled in later, per product, by getProductData.
   *
   * @param data - Array of product variants to convert
   * @returns Array of ProductBuilder instances
   * @source
   */
  protected initProductBuilders(data: MacklinProductVariant[]): ProductBuilder<Product>[] {
    return data.map((product) =>
      new ProductBuilder(this.baseURL)
        .setBasicInfo(
          `${product.item_en_name}, ${product.item_specification}`,
          `${this.baseURL}/en/products/${product.item_code}`,
          this.supplierName,
        )
        .setID(product.item_id)
        .setUUID(product.item_code)
        .setCAS(product.cas)
        .setSmiles(product.smile_code)
        .setFormula(product.chem_mf)
        .setImage(product.item_upimg)
        .setConcentration(product.item_specification),
    );
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
   * @source
   */
  private generateString(length?: number, charSetSize?: number): string {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const size = charSetSize || chars.length;

    if (length) {
      // Random string mode
      return Array.from({ length }, () => chars[Math.floor(Math.random() * size)]).join("");
    }
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
   * @source
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
   * @source
   */
  private async request<T>(path: string, options: MacklinApiRequestOptions = {}): Promise<T> {
    try {
      if (!isTimestampStorage(this.localStorage.MklTmKey)) {
        throw new Error("Missing or invalid timestamp in localStorage");
      }
      // X-Timestamp must track the *current* server time, not the value synced
      // at setup. The server compares it against its own clock with a tight
      // tolerance, and the frozen value goes stale across the batched phases
      // (list -> info -> sds) — by the SDS phase (the last requests) the gap is
      // large enough that the server rejects the call. Derive the current server
      // time from the live clock plus the server/client drift measured at sync.
      // This is equivalent to what the site does by re-fetching /api/timestamp
      // right before each call, but without the extra round-trips.
      const tm = this.localStorage.MklTmKey;
      const timestamp = Math.round(Date.now() / 1000) + (tm.serverTm - tm.clientTm);

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
        options.method === "GET" || !options.method ? params : (body ?? {}),
      );
      headers.sign = signature;
      this.lastSignature = signature;

      // Debug logging to match api-client.js
      this.logger.debug("Full request URL:", this.href(path, params, this.apiURL));
      this.logger.debug("Request headers:", headers);
      this.logger.debug("Request params:", params);
      this.logger.debug("Request body:", body);

      // GET endpoints carry everything in the query string; POST/PUT/DELETE
      // send a JSON body. Dispatch to the matching HTTP method. Use the
      // lower-level helpers (not the *Json variants) so the raw Response — and
      // its X-Ratelimit-* headers — is available before the body is parsed.
      const httpResponse =
        options.method && options.method !== "GET"
          ? await this.httpPost({
              path,
              // eslint-disable-next-line @typescript-eslint/naming-convention
              headers: { ...headers, "Content-Type": "application/json" },
              params,
              body: body ? JSON.stringify(body) : undefined,
              host: this.apiURL,
            })
          : await this.httpGet({
              path,
              headers,
              params,
              host: this.apiURL,
            });

      if (!httpResponse) {
        throw new MacklinApiError("No response from Macklin API");
      }

      this.trackRateLimit(httpResponse.headers);

      const response: unknown = await httpResponse.json();

      if (!isMacklinApiResponse<T>(response)) {
        throw new MacklinApiError("Invalid API response format");
      }

      // Handle authentication errors exactly like api-client.js
      if (isAuthCheckEndpoint(path) && response.code === 1005) {
        throw new MacklinApiError("Authentication required");
      }

      // Anything other than 200 is a failure (e.g. 504 "Signature failed").
      // The data payload is empty/invalid in that case; downstream typeguards
      // drop it, but surface the failure here so it isn't silent.
      if (response.code !== 200) {
        this.logger.warn("Macklin API returned a non-success code", {
          path,
          code: response.code,
          message: response.message,
        });
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
   * Tracks the Macklin API rate limit from a response's `X-Ratelimit-Limit` /
   * `X-Ratelimit-Remaining` headers. Logs a warning the first time usage crosses
   * 50%, 75%, and 90%, and an error once the limit is exhausted. Each tier is
   * logged at most once per server window — the tracking resets when the
   * remaining count rises again (the window rolled over).
   *
   * @param headers - The response headers to read the rate-limit values from
   * @example
   * ```ts
   * this.trackRateLimit(httpResponse.headers);
   * // console.warn: "Macklin API rate limit: 90/360 remaining (75% used)"
   * ```
   * @source
   */
  private trackRateLimit(headers: Headers): void {
    const limit = Number(headers.get("x-ratelimit-limit"));
    const remaining = Number(headers.get("x-ratelimit-remaining"));
    if (!Number.isFinite(limit) || !Number.isFinite(remaining) || limit <= 0) {
      return;
    }

    // A rise in remaining means the server's rate-limit window reset; allow the
    // tiers to be reported again.
    if (remaining > this.rateLimitLastRemaining) {
      this.rateLimitTierLogged = 0;
    }
    this.rateLimitLastRemaining = remaining;

    const usedPct = ((limit - remaining) / limit) * 100;
    const tier =
      remaining <= 0 ? 100 : usedPct >= 90 ? 90 : usedPct >= 75 ? 75 : usedPct >= 50 ? 50 : 0;
    if (tier <= this.rateLimitTierLogged) {
      return;
    }
    this.rateLimitTierLogged = tier;

    const message = `Macklin API rate limit: ${remaining}/${limit} remaining (${Math.round(usedPct)}% used)`;
    if (tier === 100) {
      this.logger.error(message);
    } else {
      this.logger.warn(message);
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
   * @source
   */
  private async fetchServerTimestamp(): Promise<number> {
    const response = await this.httpGetJson({
      path: `/api/timestamp`,
      host: this.apiURL,
    });

    if (!isMacklinApiResponse<TimestampResponse>(response)) {
      throw new MacklinApiError("Invalid API response format");
    }

    this.logger.debug("serverTimestamp response:", response);

    const clientTime = Math.round(Date.now() / 1000);
    const timestampData: TimestampStorage = {
      serverTm: response.data.timestamp,
      clientTm: clientTime,
    };

    this.localStorage.MklTmKey = timestampData;

    return timestampData.serverTm;
  }

  /**
   * Gets the spec sheet url.
   * Should return: https://www.macklin.cn/pdf/specification/download?lang=en&item_code=S867696
   */
  public getSpecsheetUrl(uuid: string): string {
    return `${this.baseURL}/pdf/specification/download?lang=en&item_code=${uuid}`;
  }

  /**
   * Step 4.2: Request Timestamp Generation
   * Generates a unique timestamp for each request using either:
   * - Current time + random numbers (first request)
   * - Current time + digits from previous signature (subsequent requests)
   *
   * @returns The timestamp string sent verbatim in both GET query strings and
   *   POST bodies. It must stay a string: the site builds it as
   *   `Date.now() + signatureDigits` (string concatenation), and the value is
   *   40+ digits — doing real addition collapses it into scientific notation
   *   (e.g. `3.9e+43`), which the server rejects with "Signature failed".
   * @source
   */
  private generateRequestTimestamp(): string {
    if (this.lastSignature) {
      // Mirrors the site's `Date.now() + t.join("")`: string concatenation of
      // the current time and the previous signature's digits.
      const digits = this.lastSignature.match(/\d+/g)?.join("") ?? "";
      return `${Date.now()}${digits}`;
    }
    // First request (no prior signature): plain current time + small offset.
    return String(Date.now() + Math.floor(Math.random()) + Math.ceil(Math.random()));
  }

  /**
   * Step 4.3: Timestamp Validation and Update
   * Manages the timestamp lifecycle:
   * - Validates current timestamp
   * - Fetches new timestamp if expired
   * - Converts timestamp to string format for headers
   *
   * @returns The current valid timestamp as a string
   * @source
   */
  private async validateAndUpdateTimestamp(): Promise<string> {
    const currentTime = Math.round(Date.now() / 1000);
    const storedTimestamp = isTimestampStorage(this.localStorage.MklTmKey)
      ? this.localStorage.MklTmKey
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
   * @source
   */
  private ensureStringHeader(value: unknown): string {
    if (Array.isArray(value)) {
      // If it's an array, take the first value
      return String(value[0] || "");
    }
    return String(value || "");
  }
}
