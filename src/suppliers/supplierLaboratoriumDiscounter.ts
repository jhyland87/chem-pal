import { AVAILABILITY } from "@/constants/app";
import { findCAS } from "@/helpers/cas";
import { urlencode } from "@/helpers/request";
import { mapDefined } from "@/helpers/utils";
import { type Product } from "@/types";
import {
  type PriceObject,
  type ProductObject,
  type SearchParams,
  type SearchResponse,
  type SearchResponseProduct,
} from "@/types/laboratoriumdiscounter";
import { ProductBuilder } from "@/utils/ProductBuilder";
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
 * - {@link https://www.laboratoriumdiscounter.nl/en/sitemap/?format=json Sitemap (JSON)}
 * - {@link https://www.laboratoriumdiscounter.nl/en/search/acid | Search Results for "acid"}
 * - {@link https://www.laboratoriumdiscounter.nl/en/search/acid?format=json | Search Results for "acid" (JSON)}
 *
 * @category Suppliers
 * @example
 * ```typescript
 * const supplier = new SupplierLaboratoriumDiscounter();
 * for await (const product of supplier) {
 *   console.log(product);
 * }
 */
export default class SupplierLaboratoriumDiscounter
  extends SupplierBase<ProductObject, Product>
  implements AsyncIterable<Product>
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Laboratorium Discounter";

  // Base URL for HTTP(s) requests
  protected _baseURL: string = "https://www.laboratoriumdiscounter.nl";

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
   * Validates that a response has the expected structure for a search response
   * @param response - Response object to validate
   * @returns Type predicate indicating if response is a valid SearchResponse
   * @example
   * ```typescript
   * const response = await this._httpGetJson({
   *   path: "/en/search/acid",
   *   params: { format: "json" }
   * });
   * if (this._isSearchResponseOk(response)) {
   *   // Process valid response
   *   console.log(response.collection.products);
   * } else {
   *   console.error("Invalid response structure");
   * }
   * ```
   */
  protected _isSearchResponseOk(response: unknown): response is SearchResponse {
    if (typeof response !== "object" || response === null) {
      this._logger.warn("Invalid response: - Non object", { response });
      return false;
    }

    // Check for required top-level properties
    if (!("page" in response && "request" in response && "collection" in response)) {
      this._logger.warn(
        "Invalid response: - Missing required properties: page, request or collection",
        { response },
      );
      return false;
    }

    const { page, request, collection } = response as Partial<SearchResponse>;

    if (typeof page !== "object" || !page) {
      this._logger.warn("Invalid page object, missing required properties", { page });
      return false;
    }

    if (typeof request !== "object" || !request) {
      this._logger.warn("Invalid request object, missing required properties", { request });
      return false;
    }

    if (typeof collection !== "object" || !collection) {
      this._logger.warn("Invalid collection object, missing required properties", { collection });
      return false;
    }

    const badProps = ["search", "session_id", "key", "title", "status"].filter((prop) => {
      if (prop in page === false) {
        this._logger.warn(`Invalid response, expected to find ${prop} in page`, { page });
        return true;
      }
      return false;
    });

    if (badProps.length > 0) {
      this._logger.warn("Invalid page object, missing required properties", { page });
      return false;
    }

    // Validate request object
    if (
      typeof request !== "object" ||
      !request ||
      !("url" in request && "method" in request && "get" in request && "device" in request)
    ) {
      this._logger.warn("Invalid request object, missing required properties from request", {
        request,
      });
      return false;
    }

    // Validate collection and products
    if (
      typeof collection !== "object" ||
      !collection ||
      !("products" in collection) ||
      typeof collection.products !== "object"
    ) {
      this._logger.warn("Invalid collection object, missing required properties from collection", {
        collection,
      });
      return false;
    }

    // Validate each product in the collection
    return Object.values(collection.products).every((product) =>
      this._isSearchResponseProduct(product),
    );
  }

  /**
   * Type guard to validate PriceObject structure
   * @param price - Object to validate as PriceObject
   * @returns Type predicate indicating if price is a valid PriceObject
   * @example
   * ```typescript
   * const priceData = {
   *   price: 29.99,
   *   price_incl: 29.99,
   *   price_excl: 24.79,
   *   price_old: 39.99,
   *   price_old_incl: 39.99,
   *   price_old_excl: 33.05
   * };
   * if (this._isPriceObject(priceData)) {
   *   console.log("Valid price object:", priceData.price);
   * } else {
   *   console.error("Invalid price structure");
   * }
   * ```
   */
  protected _isPriceObject(price: unknown): price is PriceObject {
    if (typeof price !== "object" || price === null) return false;

    const requiredProps = {
      /* eslint-disable */
      price: "number",
      price_incl: "number",
      price_excl: "number",
      price_old: "number",
      price_old_incl: "number",
      price_old_excl: "number",
      /* eslint-enable */
    };

    return Object.entries(requiredProps).every(([key, type]) => {
      return key in price && typeof price[key as keyof typeof price] === type;
    });
  }

  /**
   * Type guard to validate ProductObject structure
   * @param product - Object to validate as ProductObject
   * @returns Type predicate indicating if product is a valid ProductObject
   * @example
   * ```typescript
   * const productData = {
   *   id: 12345,
   *   vid: 67890,
   *   image: 1,
   *   brand: false,
   *   code: "CHEM-001",
   *   ean: "1234567890123",
   *   sku: "SKU-001",
   *   score: 1.0,
   *   available: true,
   *   unit: true,
   *   url: "/products/chemical-1",
   *   title: "Sodium Chloride",
   *   fulltitle: "Sodium Chloride 500g",
   *   variant: "500g",
   *   description: "High purity sodium chloride",
   *   data_01: "Additional info",
   *   price: {
   *     price: 29.99,
   *     price_incl: 29.99,
   *     price_excl: 24.79,
   *     price_old: 39.99,
   *     price_old_incl: 39.99,
   *     price_old_excl: 33.05
   *   }
   * };
   * if (this._isSearchResponseProduct(productData)) {
   *   console.log("Valid product:", productData.title);
   * } else {
   *   console.error("Invalid product structure");
   * }
   * ```
   */
  protected _isSearchResponseProduct(product: unknown): product is SearchResponseProduct {
    if (typeof product !== "object" || product === null) return false;

    const requiredProps = {
      /* eslint-disable */
      id: "number",
      vid: "number",
      image: "number",
      brand: "boolean",
      code: "string",
      ean: "string",
      sku: "string",
      score: "number",
      available: "boolean",
      unit: "boolean",
      url: "string",
      title: "string",
      fulltitle: "string",
      variant: "string",
      description: "string",
      data_01: "string",
      /* eslint-enable */
    };

    const hasRequiredProps = Object.entries(requiredProps).every(([key, type]) => {
      return key in product && typeof product[key as keyof typeof product] === type;
    });

    if (!hasRequiredProps) return false;

    // Validate price object separately
    return "price" in product && this._isPriceObject(product.price);
  }

  /**
   * Type guard to validate ProductObject structure
   * @param data - Object to validate as ProductObject
   * @returns Type predicate indicating if product is a valid ProductObject
   * @example
   * ```typescript
   * const productData = {
   *   product: {
   *     variants: {
   *       "1": {
   *         id: 1,
   *         title: "500g",
   *         price: 29.99
   *       }
   *     }
   *   }
   * };
   * if (this._isProductObject(productData)) {
   *   console.log("Valid product object with variants");
   * } else {
   *   console.error("Invalid product object structure");
   * }
   * ```
   */
  protected _isProductObject(data: unknown): data is ProductObject {
    if (typeof data !== "object" || data === null) return false;
    if ("product" in data === false || typeof data.product !== "object" || data.product === null)
      return false;
    return (
      "variants" in data.product &&
      (typeof data.product.variants === "object" || data.product.variants === false)
    );
  }

  /**
   * Validates search parameters structure and values
   * @param params - Parameters to validate
   * @returns Type predicate indicating if params are valid SearchParams
   * @example
   * ```typescript
   * const searchParams = {
   *   limit: "10",
   *   format: "json"
   * };
   * if (this._isValidSearchParams(searchParams)) {
   *   console.log("Valid search parameters");
   * } else {
   *   console.error("Invalid search parameters");
   * }
   * ```
   */
  protected _isValidSearchParams(params: unknown): params is SearchParams {
    if (typeof params !== "object" || params === null) return false;

    const requiredProps = {
      limit: (val: unknown) => typeof val === "string" && !isNaN(Number(val)),
      format: (val: unknown) => val === "json",
    };

    return Object.entries(requiredProps).every(([key, validator]) => {
      return key in params && validator(params[key as keyof typeof params]);
    });
  }

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
    if (!this._isValidSearchParams(params)) {
      this._logger.warn("Invalid search parameters:", params);
      return;
    }

    const response: unknown = await this._httpGetJson({
      path: `/en/search/${urlencode(query)}`,
      params,
    });

    if (!this._isSearchResponseOk(response)) {
      this._logger.warn("Bad search response:", response);
      return;
    }

    return this._initProductBuilders(Object.values(response.collection.products).slice(0, limit));
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
      const productBuilder = new ProductBuilder(this._baseURL);
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

      if (this._isProductObject(productResponse) === false) {
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
