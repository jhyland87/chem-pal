import type { ProductBuilder } from "@/utils/ProductBuilder";
import SupplierBase from "./supplierBase";

/**
 * Macklin API Client
 * Handles API requests with custom authentication and request signing
 * Uses native fetch API instead of axios
 *
 * @remarks
 Request Signature Generation Process
 *
 * The Macklin API requires a custom signature for each request to ensure authenticity.
 * The signature is generated through the following steps:
 *
 * Step 1: Header String Generation
 *    - Collect all non-empty, non-object header values (excluding Content-Type)
 *    - Sort headers alphabetically by key (case-insensitive)
 *    - Format as "key=value" pairs joined by "&"
 *    - Append "&salt=ndksyr9834@#$32ndsfu"
 *    - Convert to lowercase
 *    - Hash using custom MD5-like transform
 *
 * Step 2: Parameter String Generation
 *    - For GET requests: Use URL parameters
 *    - For POST/PUT requests: Use request body
 *    - Sort parameters alphabetically by key (case-insensitive)
 *    - Format as "key=value" pairs joined by "&"
 *    - Append "&salt=ndksyr9834@#$32ndsfu"
 *    - Convert to lowercase
 *    - Hash using custom MD5-like transform
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
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Macklin";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://www.macklin.cn";

  // Shipping scope for Macklin
  public readonly shipping: ShippingRange = "worldwide";

  // The country code of the supplier.
  public readonly country: CountryCode = "CN";

  // Override the type of _queryResults to use our specific type
  protected _queryResults: Array<Product> = [];

  // Used to keep track of how many requests have been made to the supplier.
  protected _httpRequstCount: number = 0;

  // HTTP headers used as a basis for all queries.
  protected _headers: HeadersInit = {
    /* eslint-disable */
    accept: "*/*",
    "accept-language": "en-US,en;q=0.8",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "sec-gpc": "1",
    //sign: "f742494546c8c83c565f76296302d2efc8b7493979ff65bac3c4e0568813cc0b",
    "x-agent": "web",
    "x-device-id": "4CFD96AC481662EE",
    "x-language": "en",
    "x-timestamp": "1748749188",
    "x-user-token": "",
    Referer: "https://www.macklin.cn/",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    /* eslint-enable */
  };

  protected async _queryProducts(
    query: string,
    limit: number = this._limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    this._limit = limit;
  }

  protected _titleSelector(data: Product): string {
    return data.title;
  }

  protected async _getProductData(
    product: ProductBuilder<Product>,
  ): Promise<void | ProductBuilder<Product>> {
    return product;
  }

  protected _initProductBuilders(data: Product[]): ProductBuilder<Product>[] {
    return [];
  }
}
