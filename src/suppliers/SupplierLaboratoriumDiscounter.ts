import { AVAILABILITY } from "@/constants/common";
import { CURRENCY_SYMBOL_MAP } from "@/constants/currency";
import { findCAS } from "@/helpers/cas";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { createDOM, urlencode } from "@/helpers/request";
import { firstMap, mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import {
  isFullURL,
  isPopulatedArray,
  isPopulatedObject,
  isQuantityObject,
} from "@/utils/typeGuards/common";
import {
  isProductObject,
  isSearchResponseOk,
  isValidSearchParams,
} from "@/utils/typeGuards/laboratoriumdiscounter";
import { token_set_ratio } from "fuzzball";
import SupplierBase from "./SupplierBase";

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
 *
 * \> [!IMPORTANT]
 * \>  Be careful that your scripts do not produce too many XHR calls. A few (2-3) calls per page or making
 * \> calls based on user input could be acceptable, but letting users do multiple calls in a short period of time
 * \> could see them BANNED from shops. Please only use these methods as workarounds in specific instances.
 *
 * @category Suppliers
 * @example
 * ```typescript
 * const supplier = new SupplierLaboratoriumDiscounter();
 * for await (const product of supplier) {
 *   console.log(product);
 * }
 * ```
 * @source
 */
export default class SupplierLaboratoriumDiscounter
  extends SupplierBase<LaboratoriumDiscounterProductObject, Product>
  implements ISupplier
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Laboratorium Discounter";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://www.laboratoriumdiscounter.nl";

  // Shipping scope for Laboratorium Discounter
  public readonly shipping: ShippingRange = "domestic";

  // The country code of the supplier.
  public readonly country: CountryCode = "NL";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = [
    "mastercard",
    "visa",
    "paypal",
    "banktransfer",
  ];

  // Override the base `ratio` default: this catalog's titles embed the queried
  // compound inside longer descriptive strings (e.g. "Benzyltriethylammonium
  // Borohydride >90.0%(T) 5g"), which scores poorly under full-string
  // Levenshtein. `token_set_ratio` tokenizes + set-compares, so the target
  // compound hits ~100% regardless of surrounding boilerplate.
  protected readonly fuzzScorer = token_set_ratio;

  // Override the type of queryResults to use our specific type
  protected queryResults: Array<LaboratoriumDiscounterProductObject> = [];

  // Used to keep track of how many requests have been made to the supplier.
  protected httpRequstCount: number = 0;

  // HTTP headers used as a basis for all queries.
  protected headers: HeadersInit = {
    /* eslint-disable */
    accept: [
      "text/html",
      "application/xhtml+xml",
      "application/xml;q=0.9",
      "image/avif",
      "image/webp",
      "image/apng",
      "*/*;q=0.8",
    ].join(","),
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
   * Category IDs to include in the search (and including any that aren't in these
   * categories or their sub-categories).
   * @source
   */
  protected readonly categoryIds: number[] = [
    // The "root" category for most of  the below is category 9319956 ("chemicals"),
    // but that also includes categories like ion-exchangers, natural oils, etc. So
    // well keep it to the sub-categories that were certain only store reagents (or
    // any source or quality).)
    9319959, // chemicals/a-z
    11521218, // TCI chemicals (chemicals/tci-chemicals)
    9781324, // own-brand-products/chemicals
    11064117, // chemicals/food-grade-pharma/fine-chemicals
    9718743, // Elements (chemicals/elements)
    11064112, // Food grade / Pharma (chemicals/food-grade-pharma)
    11720203, // Ultra Pure Grade Chemicals (chemicals/ultra-pure-grade-chemicals)
  ];

  /**
   * Constructs the query parameters for a product search request
   * @param limit - The maximum number of results to query for
   * @returns Object containing all required search parameters
   * @example
   * ```typescript
   * const params = this.makeQueryParams(20);
   * // Returns: { limit: "20", format: "json" }
   *
   * // Use in search request
   * const response = await this.httpGetJson({
   *   path: "/search/chemical",
   *   params: this.makeQueryParams(20)
   * });
   * ```
   * @source
   */
  protected makeQueryParams(limit?: number): LaboratoriumDiscounterSearchParams {
    return {
      format: "json",
      limit: limit?.toString() ?? "100",
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
   * const products = await this.queryProducts("sodium chloride", 10);
   * if (products) {
   *   console.log(`Found ${products.length} products`);
   *   for (const product of products) {
   *     const builtProduct = await product.build();
   *     console.log(builtProduct.title, builtProduct.price);
   *   }
   * } else {
   *   console.log("No products found or search failed");
   * }
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const params = this.makeQueryParams();
    if (!isValidSearchParams(params)) {
      this.logger.warn("Invalid search parameters:", { params });
      return;
    }

    const searchRequest: unknown = await this.httpGetJson({
      path: `/en/search/${urlencode(query)}/`, // Leave trailing slash, otherwise will 301
      params,
    });

    if (!isSearchResponseOk(searchRequest)) {
      this.logger.warn("Bad search response:", { searchRequest });
      return;
    }

    const rawSearchResults = Object.values(searchRequest.collection.products);

    const fuzzFiltered = this.fuzzyFilter<SearchResponseProduct>(query, rawSearchResults);
    this.logger.debug("fuzzFiltered:", { query, searchRequest, rawSearchResults, fuzzFiltered });
    const grouped = this.groupVariants<SearchResponseProduct>(fuzzFiltered);
    this.logger.debug("grouped:", {
      query,
      searchRequest,
      rawSearchResults,
      fuzzFiltered,
      grouped,
    });
    return this.initProductBuilders(grouped.slice(0, limit));
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns Title of the product
   * @source
   */
  protected titleSelector(data: SearchResponseProduct): string {
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
   * const results = await this.queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this.initProductBuilders(results);
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
   * @source
   */
  protected initProductBuilders(
    data: LaboratoriumDiscounterSearchResponseProduct[],
  ): ProductBuilder<Product>[] {
    //this.logger.debug("initProductBuilders data:", { data });
    return mapDefined(data, (product) => {
      //this.logger.debug("initProductBuilders product:", { product });
      const productBuilder = new ProductBuilder(this.baseURL);

      const quantity = firstMap(parseQuantity, [
        product.title,
        product.description,
        product.variant,
      ]);

      if (isQuantityObject(quantity)) {
        productBuilder.setQuantity(quantity.quantity, quantity.uom);
      }

      productBuilder
        //.addRawData(product)
        .setBasicInfo(product.title, product.url, this.supplierName)
        .setDescription(product.description)
        .setID(product.id)
        .setAvailability(product.available)
        .setSku(product.sku)
        .setUUID(product.code)
        //.setPricing(product.price.price, product?.currency as string, CURRENCY_SYMBOL_MAP.EUR)
        //.setQuantity(product.variant)
        .setCAS(typeof product.content === "string" ? (findCAS(product.content) ?? "") : "");
      return productBuilder;
    });
  }

  private metaAvailabilityToAvailability(availability: string): AVAILABILITY {
    switch (availability) {
      case "http://schema.org/InStock":
        return AVAILABILITY.IN_STOCK;
      case "http://schema.org/OutOfStock":
        return AVAILABILITY.OUT_OF_STOCK;
      case "http://schema.org/LimitedAvailability":
        return AVAILABILITY.LIMITED_STOCK;
      case "http://schema.org/PreOrder":
        return AVAILABILITY.PRE_ORDER;
      case "http://schema.org/BackOrder":
        return AVAILABILITY.BACKORDER;
      case "http://schema.org/Discontinued":
        return AVAILABILITY.DISCONTINUED;
      default:
        this.logger.warn("Unknown availability - Defaulting to UNKNOWN", { availability });
        return AVAILABILITY.UNKNOWN;
    }
  }

  /**
   * Fetches the product detail HTML page and parses pricing, metadata and variants
   * out of the rendered markup. Used as a fallback when the JSON endpoint does not
   * return a valid product object.
   * @param builder - The ProductBuilder to populate with parsed data
   * @returns Promise resolving to the populated builder, or void if the fetch failed
   * @source
   */
  private async getProductDataFromHTML(
    builder: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    // The builder stores absolute URLs, so extract just the pathname
    // before applying the locale prefix.
    let urlPath = builder.get("url");
    if (isFullURL(urlPath)) {
      urlPath = new URL(urlPath).pathname.replace(/^\//, "");
    }
    const path = urlPath.startsWith("en/") ? urlPath : `en/${urlPath}`;
    const url = new URL(path, this.baseURL);
    const productResponse = await this.httpGetHtml({
      path: url.toString(),
    });
    if (!productResponse) {
      this.logger.warn("No product response", { url });
      return;
    }
    const parsedHTML = createDOM(productResponse);
    const productData = Array.from(parsedHTML.querySelectorAll("div[itemscope] > meta")).reduce<
      Partial<Product>
    >((acc, meta) => {
      const property = meta.getAttribute("itemprop");
      if (!property) return acc;
      switch (property) {
        case "url":
          acc.url = meta.getAttribute("content") ?? "";
          break;
        case "sku":
          acc.sku = meta.getAttribute("content") ?? "";
          break;
        case "name":
          acc.title = meta.getAttribute("content") ?? "";
          break;
        case "description":
          acc.description = meta.getAttribute("content") ?? "";
          const data = acc.description
            ?.split(", ")
            .reduce<Record<string, string>>((acc, val, idx) => {
              if (idx === 0) acc.title = val;
              else if (val.includes("CAS-No")) acc.cas = findCAS(val.split(" ")[1]) ?? "";
              // else if ( val.includes('Mol.weight'))
              //   acc.weight = val.split(' ')[1];
              else if (val.includes("min.") && val.includes("%"))
                acc.conc = `${val.split(" ")[1]}%`;
              return acc;
            }, {});

          Object.assign(acc, data);
          break;
        case "price":
          acc.price = parseFloat(meta.getAttribute("content") ?? "");
          break;
        case "priceCurrency":
          acc.currencyCode = meta.getAttribute("content");
          if (acc.currencyCode) {
            acc.currencySymbol = CURRENCY_SYMBOL_MAP[acc.currencyCode];
          }
          break;
        case "availability":
          acc.availability = this.metaAvailabilityToAvailability(
            meta.getAttribute("content") ?? "",
          );
          break;
      }

      return acc;
    }, {});

    const variants =
      mapDefined(
        Array.from(parsedHTML.querySelectorAll("#bulkProduct > .customOptions")),
        (e) =>
          ({
            price:
              parsePrice(
                e
                  .querySelector(
                    ".variant-costPrice > div > .productPrice > .product-price.incl > span",
                  )
                  ?.textContent?.trim() ?? "",
              )?.price ?? 0,
            quantity:
              parseQuantity(e.querySelector(".variant-title > span")?.textContent?.trim() ?? "")
                ?.quantity ?? 0,
            uom:
              parseQuantity(e.querySelector(".variant-title > span")?.textContent?.trim() ?? "")
                ?.uom ?? "",
            sku:
              Array.from(e.querySelectorAll("table td"))
                ?.find((td) => td.textContent?.trim() === "SKU")
                ?.nextElementSibling?.textContent?.trim() ?? "",
          }) satisfies Variant,
      ) ?? [];

    if (isPopulatedArray(variants)) {
      Object.assign(productData, variants.shift() ?? {});
    }

    Object.assign(productData, {
      variants,
    });

    builder.setData(productData);

    this.logger.debug("getProductDataFromHTML productData:", { builder, productData });
    return builder;
  }

  /**
   * Fetches product data from the JSON product endpoint and populates the builder
   * with pricing and variants. Returns void if the response is missing or fails the
   * product typeguard, signaling the caller to fall back to HTML scraping.
   * @param builder - The ProductBuilder to populate with parsed data
   * @returns Promise resolving to the populated builder, or void on failure
   * @source
   */
  private async getProductDataFromJSON(
    builder: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    // The builder stores absolute URLs, so extract just the pathname
    // before applying the locale prefix.
    let urlPath = builder.get("url");
    if (isFullURL(urlPath)) {
      urlPath = new URL(urlPath).pathname.replace(/^\//, "");
    }
    const path = urlPath.startsWith("en/") ? urlPath : `en/${urlPath}`;

    const productResponse = await this.httpGetJson({
      path,
      params: { format: "json" },
    });

    if (!productResponse || !isProductObject(productResponse)) {
      this.logger.warn("Invalid JSON product data - did not pass typeguard:", {
        path,
        productResponse,
      });
      return;
    }

    const productData = productResponse.product;
    const currency = productResponse.shop.currencies[productResponse.shop.currency];
    builder.setPricing(productData.price.price, currency.code, currency.symbol);
    if (isPopulatedObject(productData.variants)) {
      for (const variant of Object.values(productData.variants)) {
        if (variant.active === false) continue;
        const quantity = parseQuantity(variant.title);
        if (!isQuantityObject(quantity)) {
          this.logger.warn("Invalid quantity - skipping", {
            parsedValue: variant.title,
            variant,
            builder,
            productResponse,
          });
          continue;
        }

        if (quantity.quantity === builder.get("quantity")) {
          this.logger.debug("Quantity already exists - skipping", {
            quantity: quantity.quantity,
            builder,
            productResponse,
          });
          continue;
        }

        builder.addVariant({
          id: variant.id,
          uuid: variant.code,
          sku: variant.sku,
          title: variant.title,
          price: variant.price.price,
          quantity: quantity.quantity,
          uom: quantity.uom,
          availability: variant.stock
            ? typeof variant.stock === "object"
              ? ((stock) => {
                  if (stock.available) return AVAILABILITY.IN_STOCK;
                  if (stock.on_stock) return AVAILABILITY.IN_STOCK;
                  if (stock.allow_backorders) return AVAILABILITY.BACKORDER;
                  this.logger.warn("Unknown availability stock - Defaulting to UNKNOWN", {
                    path,
                    stock: variant.stock,
                    variant,
                  });
                  return AVAILABILITY.UNKNOWN;
                })(variant.stock)
              : undefined
            : undefined,
        });
      }
    }
    return builder;
  }

  /**
   * Fetches product data for a given product builder. Tries the JSON endpoint
   * first, then falls back to scraping the HTML product page.
   * @param product - Product builder to fetch data for
   * @returns Promise resolving to product builder or void if data fetch fails
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(
      product,
      async (builder) => {
        const jsonResponse = await this.getProductDataFromJSON(builder);
        if (jsonResponse) return jsonResponse;
        this.logger.debug("getProductDataFromJSON failed - falling back to HTML scraping", {
          builder,
        });
        const htmlResponse = await this.getProductDataFromHTML(builder);
        this.logger.debug("getProductDataFromHTML result:", { htmlResponse });
        return htmlResponse;
      },
      { format: "json" },
    );
  }
}
