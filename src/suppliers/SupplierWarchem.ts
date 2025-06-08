import { findCAS, isCAS } from "@/helpers/cas";
import { parseQuantity } from "@/helpers/quantity";
import { createDOM } from "@/helpers/request";
import { firstMap, mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import priceParser from "price-parser";
import SupplierBase from "./SupplierBase";
/**
 * Supplier implementation for Warchem, a Polish based chemical supplier.
 *
 *
 * @typeParam S - The supplier-specific product type (Partial<Product>)
 * @typeParam T - The common Product type that all suppliers map to
 *
 * @example
 * ```typescript
 * const supplier = new SupplierWachem("sodium chloride", 10, new AbortController());
 * for await (const product of supplier) {
 *   console.log("Found product:", product.title, product.price);
 * }
 * ```
 */
export default class SupplierWarchem
  extends SupplierBase<Partial<Product>, Product>
  implements ISupplier
{
  // Display name of the supplier used for UI and logging
  public readonly supplierName: string = "Warchem";

  // Base URL for all API and web requests to Warchem
  public readonly baseURL: string = "https://warchem.pl";

  // Shipping scope for Warchem
  public readonly shipping: ShippingRange = "domestic";

  // The country code of the supplier.
  // This is used to determine the currency and other country-specific information.
  public readonly country: CountryCode = "PL";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  // Cached search results from the last query execution
  protected queryResults: Array<Partial<Product>> = [];

  // Maximum number of HTTP requests allowed per search query
  // Used to prevent excessive requests to supplier
  protected httpRequestHardLimit: number = 50;

  // Counter for HTTP requests made during current query execution
  protected httpRequstCount: number = 0;

  // Number of requests to process in parallel when fetching product details
  protected maxConcurrentRequests: number = 5;

  /**
   * Warchem stores the search result limit in the cookies which needs to be set
   * in a POST call before the query.
   * @returns A promise that resolves when the setup is complete.
   */
  protected async setup(): Promise<void> {
    await this.httpPost({
      path: "/szukaj.html",
      body: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ilosc_na_stronie: 36,
      },
    });
  }

  /**
   * Queries Wachem products based on a search string.
   * Makes a GET request to the Wachem search endpoint and parses the HTML response
   * to extract basic product information.
   *
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to query for
   * @returns Promise resolving to an array of partial product objects or void if search fails
   *
   * @example
   * ```typescript
   * const supplier = new SupplierWachem("acetone", 10, new AbortController());
   * const results = await supplier.queryProducts("acetone");
   * if (results) {
   *   console.log(`Found ${results.length} products`);
   *   console.log("First product:", results[0].title);
   * }
   * ```
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const searchResponse = await this.httpGetHtml({
      path: "/szukaj.html",
      params: {
        szukaj: encodeURIComponent(query),
        opis: "tak",
        fraza: "nie",
        nrkat: "nie",
        kodprod: "nie",
        ean: "nie",
        kategoria: "1",
        podkat: "tak",
      },
    });

    if (!searchResponse) {
      this.logger.error("No search response");
      return;
    }

    this.logger.log("searchResponse:", searchResponse);

    const fuzzResults = this.fuzzHtmlResponse(query, searchResponse);

    this.logger.info("fuzzResults:", Array.from(fuzzResults));

    const builders = this.initProductBuilders(fuzzResults.slice(0, limit));
    return builders;
  }

  /**
   * Parses HTML response and performs fuzzy filtering on product elements.
   * Creates a DOM from the HTML response, selects product elements, and applies
   * fuzzy filtering to find matches for the search query.
   *
   * @param query - The search term to filter products by
   * @param response - The HTML response string containing product listings
   * @returns Array of DOM Elements that match the fuzzy search criteria
   *
   * @example
   * ```typescript
   * const html = await this.httpGetHtml({ path: "/search", params: { q: "acetone" } });
   * if (html) {
   *   const matchingElements = this.fuzzHtmlResponse("acetone", html);
   *   console.log(`Found ${matchingElements.length} matching products`);
   *   // Elements can be used to extract product details
   *   for (const element of matchingElements) {
   *     const title = element.querySelector("h4 a")?.textContent;
   *     console.log("Product:", title);
   *   }
   * }
   * ```
   */
  protected fuzzHtmlResponse(query: string, response: string): Element[] {
    // Create a new DOM to do the travesing/parsing
    const parsedHTML = createDOM(response);
    if (!parsedHTML || parsedHTML === null) {
      throw new Error("No data found when loading HTML");
    }

    const productContainers = parsedHTML.querySelectorAll(
      "div.ListingWierszeKontener > div.Wiersz.LiniaDolna",
    );
    if (!productContainers || productContainers.length === 0) {
      this.logger.error("No products found");
      return [];
    }

    // Do the fuzzy filtering using the element found when using this.titleSelector()
    return this.fuzzyFilter<Element>(query, Array.from(productContainers));
  }

  /**
   * Initialize product builders from Wachem HTML search response data.
   * Transforms HTML product listings into ProductBuilder instances, handling:
   * - Basic product information (title, URL, supplier)
   * - Pricing information with currency details
   * - Product descriptions
   * - Product IDs and SKUs
   * - HTML parsing of product listings
   * - Price extraction from formatted strings
   * - URL and ID extraction from product links
   *
   * @param elements - Array of DOM Elements containing product listings
   * @returns Array of ProductBuilder instances initialized with product data
   * @example
   * ```typescript
   * const results = await this.queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this.initProductBuilders(results);
   *   // Each builder contains parsed product data from HTML
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log(product.title, product.price, product.id);
   *   }
   * }
   * ```
   */
  protected initProductBuilders(elements: Element[]): ProductBuilder<Product>[] {
    return mapDefined(elements, (element: Element) => {
      const builder = new ProductBuilder<Product>(this.baseURL);

      const priceElem = element.querySelector(".ProdCena .Brutto");
      if (!priceElem) {
        this.logger.error("No price element for product", element);
        return;
      }

      const headerElem = element.querySelector("h3 > a");
      if (!headerElem) {
        this.logger.error("No header for product", element);
        return;
      }

      const title = headerElem.textContent?.trim();

      if (!title) {
        this.logger.error("No title for product", element);
        return;
      }

      const href = headerElem.getAttribute("href");

      if (!href) {
        this.logger.error("No URL for product");
        return;
      }

      const url = new URL(href, this.baseURL);

      return builder.setBasicInfo(title, url.toString(), this.supplierName);
    });
  }

  /**
   * Transforms a partial product item into a complete Product object.
   * Fetches additional product details from the product page, extracts quantity, CAS number,
   * and other specifications, then builds a standardized Product object.
   *
   * @param product - Partial product object to transform
   * @returns Promise resolving to a complete Product object or void if transformation fails
   *
   * @example
   * ```typescript
   * const partialProduct = {
   *   title: "Sodium Chloride",
   *   url: "/product/123",
   *   price: 19.99
   * };
   * const fullProduct = await supplier.getProductData(partialProduct);
   * if (fullProduct) {
   *   console.log("Complete product:", {
   *     title: fullProduct.title,
   *     cas: fullProduct.cas,
   *     quantity: fullProduct.quantity,
   *     uom: fullProduct.uom
   *   });
   * }
   * ```
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    // Meta tags: ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'product:price:amount', 'product:price:currency', 'product:availability', 'product:condition', 'product:retailer_item_id']
    return this.getProductDataWithCache(product, async (builder) => {
      this.logger.debug("Querying data for partialproduct:", builder);
      if (typeof builder === "undefined") {
        this.logger.error("No products to get data for");
        return;
      }

      const productResponse = await this.httpGetHtml({
        path: builder.get("url"),
      });

      if (!productResponse) {
        this.logger.warn("No product response");
        return;
      }

      this.logger.debug("productResponse:", productResponse);

      const parsedHTML = createDOM(productResponse);
      const metaTags = parsedHTML.getElementsByTagName("meta");

      const productMeta = Array.from(metaTags).reduce(
        (acc, meta) => {
          const property = meta.getAttribute("property");
          if (typeof property === "string") {
            acc[property] = meta.getAttribute("content") ?? "";
          }
          return acc;
        },
        {} as Record<string, string>,
      );

      this.logger.debug("productMeta", productMeta);

      // @todo The typing on this seems to be incorrect, will require a global type override
      const priceParsed = priceParser.parseFirst(
        `${productMeta["product:price:amount"]} ${productMeta["product:price:currency"]}`,
      );

      if (priceParsed?.currency) {
        product.setCurrencySymbol(priceParsed?.currency?.symbols?.at(0));
      }

      if (productMeta["product:price:amount"]) {
        product.setPrice(productMeta["product:price:amount"]);
      }

      if (productMeta["product:price:currency"]) {
        product.setCurrencyCode(productMeta["product:price:currency"]);
      }

      if (productMeta["product:retailer_item_id"]) {
        product.setID(productMeta["product:retailer_item_id"]);
      }

      if (productMeta["og:description"]) {
        product.setDescription(productMeta["og:description"]);
      }

      if (productMeta["product:availability"]) {
        product.setAvailability(productMeta["product:availability"]);
      }

      const cas = firstMap(
        (p) => findCAS(p),
        [productMeta["og:title"], productMeta["og:description"]],
      );

      if (isCAS(cas)) {
        product.setCAS(cas);
      }

      const qtyRaw = parsedHTML.querySelector(".CechaProduktu label span")?.textContent;
      if (qtyRaw) {
        const qty = parseQuantity(qtyRaw);
        if (qty) {
          product.setQuantity(qty);
        }
      }
      this.logger.debug("product", product);
      return product;
    });
  }

  /**
   * Extracts the product title from a DOM Element.
   * Searches for the product title within the product listing element using
   * a specific CSS selector path. Returns an empty string if no title is found.
   *
   * @param data - The DOM Element containing the product listing
   * @returns The product title as a string, or empty string if not found
   *
   * @example
   * ```typescript
   * const element = document.querySelector(".product-layout");
   * if (element) {
   *   const title = this.titleSelector(element);
   *   console.log("Product title:", title);
   *   // Output: "Sodium Chloride, ACS Grade, 500g"
   * }
   * ```
   */
  protected titleSelector(data: Element): Maybe<string> {
    if (!data) {
      this.logger.error("No data for product");
      return undefined;
    }
    // document.querySelectorAll('div.ListingWierszeKontener > div.Wiersz')[1].querySelector('div.ProdCena > h3 > a').innerText
    const title = data.querySelector("div.ProdCena > h3 > a")?.textContent?.trim();
    if (title === null) {
      this.logger.error("No title for product");
      return undefined;
    }
    return title;
  }
}
