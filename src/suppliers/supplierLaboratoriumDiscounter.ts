import { AVAILABILITY } from "@/constants/common";
import { findCAS } from "@/helpers/cas";
import { urlencode } from "@/helpers/request";
import { mapDefined } from "@/helpers/utils";
import { type CountryCode, type Product, type ShippingRange } from "@/types";
import {
  type ProductObject,
  type SearchParams,
  type SearchResponseProduct,
} from "@/types/laboratoriumdiscounter";
import { ProductBuilder } from "@/utils/ProductBuilder";
import {
  isProductObject,
  isSearchResponseOk,
  isValidSearchParams,
} from "@/utils/typeGuards/laboratoriumdiscounter";
import SupplierBase from "./supplierBase";

/**
 * Class for retrieving search results and iterating over Laboratorium Discounter online
 * web store.
 *
 * @remarks
 * Laboratorium Discounters seems to use Lightspeed eCom (webshopapp) as their ecommerce platform, as
 * can be determined by loking at the shop.domains.main value of a search response, or
 * looking at where some of their assets are pulled from (cdn.webshopapp.com).
 *
 * Laboratorium Discounters API is pretty easy to use, and the search results are in JSON format.
 * It looks like any page (including home page) can be displayed in JSON format if you append
 * `?format=json` to the URL.
 * - {@link https://www.laboratoriumdiscounter.nl/en/search/acid?format=json | Search Results for "acid" (JSON)}
 *   - With the search results being found at `collection.products` and some other useful data at
 *    `gtag.events.view_item_list.items[]`.
 *
 * But to get the variants or other product specific data, you need to fetch the product details page.
 * - {@link https://www.laboratoriumdiscounter.nl/en/nitric-acid-5.html?format=json | Nitric acid (JSON)}
 *   - With all the product specific data found at `product` and variants at `product.variants`.
 *
 * Links:
 * - {@link https://www.laboratoriumdiscounter.nl | Laboratorium Discounters Home Page}
 * - {@link https://www.laboratoriumdiscounter.nl/en/sitemap/?format=json | Sitemap (JSON)}
 * - {@link https://www.laboratoriumdiscounter.nl/en/search/acid | Search Results for "acid"}
 * - {@link https://www.laboratoriumdiscounter.nl/en/search/acid?format=json | Search Results for "acid" (JSON)}
 * - {@link https://ecom-support.lightspeedhq.com/hc/en-us/articles/115002509593-3-g-AJAX-and-JSON | Lightspeed eCom Support - AJAX and JSON}
 *  > [!IMPORTANT]
 *  >  Be careful that your scripts do not produce too many XHR calls. A few (2-3) calls per page or making
 *  > calls based on user input could be acceptable, but letting users do multiple calls in a short period of time
 *  > could see them BANNED from shops. Please only use these methods as workarounds in specific instances.
 *
 * @category Suppliers
 * @example
 * ```typescript
 * const supplier = new SupplierLaboratoriumDiscounter();
 * for await (const product of supplier) {
 *   console.log(product);
 * }
 * ```
 */
export default class SupplierLaboratoriumDiscounter
  extends SupplierBase<ProductObject, Product>
  implements AsyncIterable<Product>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Laboratorium Discounter";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://www.laboratoriumdiscounter.nl";

  // Shipping scope for Laboratorium Discounter
  public readonly shipping: ShippingRange = "domestic";

  // The country code of the supplier.
  public readonly country: CountryCode = "NL";

  // Override the type of _queryResults to use our specific type
  protected _queryResults: Array<ProductObject> = [];

  // Used to keep track of how many requests have been made to the supplier.
  protected _httpRequstCount: number = 0;

  // HTTP headers used as a basis for all queries.
  protected _headers: HeadersInit = {
    /* eslint-disable */
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.6",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "sec-ch-ua": '"Brave";v="135\', "Not-A.Brand";v="8\', "Chromium";v="135"',
    "sec-ch-ua-arch": '"arm"',
    "sec-ch-ua-full-version-list":
      '"Brave";v="135.0.0.0\', "Not-A.Brand";v="8.0.0.0\', "Chromium";v="135.0.0.0"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": '""',
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sec-gpc": "1",
    "x-requested-with": "XMLHttpRequest",
    /* eslint-enable */
  };

  /**
   * Constructs the query parameters for a product search request
   * @param limit - The maximum number of results to query for
   * @returns Object containing all required search parameters
   * @example
   * ```typescript
   * const params = this._makeQueryParams(20);
   * // Returns: { limit: "20", format: "json" }
   *
   * // Use in search request
   * const response = await this._httpGetJson({
   *   path: "/en/search/chemical",
   *   params: this._makeQueryParams(20)
   * });
   * ```
   */
  protected _makeQueryParams(limit: number = this._limit): SearchParams {
    return {
      limit: limit.toString(),
      format: "json",
    };
  }

  /**
   * Executes a product search query and returns matching products
   * @param query - Search term to look for
   * @param limit - The maximum number of results to query for
   * @returns Promise resolving to array of product objects or void if search fails
   * @example
   * ```typescript
   * // Search for sodium chloride with a limit of 10 results
   * const products = await this._queryProducts("sodium chloride", 10);
   * if (products) {
   *   console.log(`Found ${products.length} products`);
   *   for (const product of products) {
   *     const builtProduct = await product.build();
   *     console.log(builtProduct.title, builtProduct.price);
   *   }
   * } else {
   *   console.error("No products found or search failed");
   * }
   * ```
   */
  protected async _queryProducts(
    query: string,
    limit: number = this._limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const params = this._makeQueryParams();
    if (!isValidSearchParams(params)) {
      this._logger.warn("Invalid search parameters:", params);
      return;
    }

    const response: unknown = await this._httpGetJson({
      path: `/en/search/${urlencode(query)}`,
      params,
    });

    if (!isSearchResponseOk(response)) {
      this._logger.warn("Bad search response:", response);
      return;
    }

    const rawSearchResults = Object.values(response.collection.products);

    const fuzzFiltered = this._fuzzyFilter<SearchResponseProduct>(query, rawSearchResults);
    this._logger.info("fuzzFiltered:", fuzzFiltered);

    return this._initProductBuilders(fuzzFiltered.slice(0, limit));
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns Title of the product
   */
  protected _titleSelector(data: SearchResponseProduct): string {
    return data.title;
  }

  /**
   * Initialize product builders from Laboratorium Discounter search response data.
   * Transforms product listings into ProductBuilder instances, handling:
   * - Basic product information (title, URL, supplier)
   * - Product descriptions and content
   * - Product IDs and SKUs
   * - Availability status
   * - CAS number extraction from product content
   * - Quantity parsing from variant information
   * - Product codes and EANs
   *
   * @param data - Array of product listings from search results
   * @returns Array of ProductBuilder instances initialized with product data
   * @example
   * ```typescript
   * const results = await this._queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this._initProductBuilders(results);
   *   // Each builder contains parsed product data
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log({
   *       title: product.title,
   *       price: product.price,
   *       quantity: product.quantity,
   *       uom: product.uom,
   *       cas: product.cas
   *     });
   *   }
   * }
   * ```
   */
  protected _initProductBuilders(data: SearchResponseProduct[]): ProductBuilder<Product>[] {
    return mapDefined(data, (product) => {
      const productBuilder = new ProductBuilder(this.baseURL);
      productBuilder
        //.addRawData(product)
        .setBasicInfo(product.title, product.url, this.supplierName)
        .setDescription(product.description)
        .setId(product.id)
        .setAvailability(product.available)
        .setSku(product.sku)
        .setUUID(product.code)
        //.setPricing(product.price.price, product?.currency as string, CURRENCY_SYMBOL_MAP.EUR)
        .setQuantity(product.variant)
        .setCAS(typeof product.content === "string" ? (findCAS(product.content) ?? "") : "");
      return productBuilder;
    });
  }

  /**
   * Transforms a Laboratorium Discounter product into the common Product type
   * Extracts quantity information from various product fields and normalizes the data
   * @param product - Product object from Laboratorium Discounter
   * @returns Promise resolving to a partial Product object or void if invalid
   * @example
   * ```typescript
   * const products = await this._queryProducts("acid");
   * if (products) {
   *   const product = await this._getProductData(products[0]);
   *   if (product) {
   *     const builtProduct = await product.build();
   *     console.log({
   *       title: builtProduct.title,
   *       price: builtProduct.price,
   *       quantity: builtProduct.quantity,
   *       uom: builtProduct.uom,
   *       variants: builtProduct.variants
   *     });
   *   }
   * }
   * ```
   */
  protected async _getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    try {
      if (product instanceof ProductBuilder === false) {
        this._logger.warn("Invalid product object - Expected ProductBuilder instance:", product);
        return;
      }

      const productResponse = await this._httpGetJson({
        path: product.get("url"),
        params: {
          format: "json",
        },
      });

      if (isProductObject(productResponse) === false) {
        this._logger.warn("Invalid product data - did not pass typeguard:", productResponse);
        return;
      }
      const productData = productResponse.product;

      const currency = productResponse.shop.currencies[productResponse.shop.currency];
      product.setPricing(productData.price.price, currency.code, currency.symbol);

      if (typeof productData.variants === "object") {
        for (const variant of Object.values(productData.variants)) {
          if (variant.active === false) continue;
          product.addVariant({
            id: variant.id,
            uuid: variant.code,
            sku: variant.sku,
            title: variant.title,
            price: variant.price.price,
            availability: variant.stock
              ? typeof variant.stock === "object"
                ? ((stock) => {
                    if (stock.available) return AVAILABILITY.IN_STOCK;
                    if (stock.on_stock) return AVAILABILITY.IN_STOCK;
                    if (stock.allow_backorders) return AVAILABILITY.BACKORDER;
                    return AVAILABILITY.OUT_OF_STOCK;
                  })(variant.stock)
                : undefined
              : undefined,
          });
        }
      }

      return product;
    } catch (error) {
      this._logger.error("Error processing product data:", error);
      return;
    }
  }
}
