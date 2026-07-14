import { findCAS } from "@/helpers/cas";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { findFormulaInText, formatFormula, parsePurity } from "@/helpers/science";
import { firstMap, mapDefined } from "@/helpers/utils";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { isSearchResultItem } from "@/utils/typeGuards/onyxmet";
import { SupplierBase } from "./SupplierBase";

/**
 * Supplier implementation for Onyxmet chemical supplier.
 * Extends the base supplier class and provides Onyxmet-specific implementation
 * for product searching and data extraction.
 *
 * @typeParam S - The supplier-specific product type (Partial<Product>)
 * @typeParam T - The common Product type that all suppliers map to
 *
 * @example
 * ```typescript
 * const supplier = new SupplierOnyxmet("sodium chloride", 10, new AbortController());
 * for await (const product of supplier) {
 *   console.log("Found product:", product.title, product.price);
 * }
 * ```
 * @source
 */
export class SupplierOnyxmet
  extends SupplierBase<OnyxMetSearchResultResponse, Product>
  implements ISupplier
{
  // Display name of the supplier used for UI and logging
  public readonly supplierName: string = "Onyxmet";

  // Base URL for all API and web requests to Onyxmet
  public readonly baseURL: string = "https://onyxmet.com";

  // Shipping scope for Onyxmet
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  // This is used to determine the currency and other country-specific information.
  public readonly country: CountryCode = "CA";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  // Cached search results from the last query execution
  protected queryResults: OnyxMetSearchResultResponse[] = [];

  // Maximum number of HTTP requests allowed per search query
  // Used to prevent excessive requests to supplier
  protected httpRequestHardLimit: number = 50;

  // Counter for HTTP requests made during current query execution
  protected httpRequstCount: number = 0;

  // Number of requests to process in parallel when fetching product details
  protected maxConcurrentRequests: number = 5;

  /**
   * Sets up the supplier by setting the display to list.
   * @returns A promise that resolves when the setup is complete.
   * @source
   */
  protected async setup(): Promise<void> {
    localStorage.setItem("display", "list");
  }

  /**
   * Derives the unique product key from an Onyxmet search-result item: its
   * product page href (the same value passed to `.setBasicInfo`), which is
   * stable across the query→detail transition. Onyxmet exposes no id/sku in the
   * search JSON, so the href is the stable identifier.
   * @param data - The raw Onyxmet search-result item
   * @returns The item's absolute product URL
   * @example
   * ```typescript
   * // If item.href is "https://onyxmet.com/index.php?route=product/product&product_id=123",
   * this.getUniqueProductKey(item); // "123"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: OnyxMetSearchResultItem): string {
    const productId = new URL(data.href).searchParams.get("product_id");

    if (!productId) {
      this.logger.warn("Product ID not found in href", { data });
      return "";
    }
    return productId;
  }

  /**
   * Queries OnyxMet products based on a search string.
   * Makes a GET request to the OnyxMet search endpoint and parses the HTML response
   * to extract basic product information.
   *
   * @param query - The search term to query products for
   * @param limit - The maximum number of results to query for
   * @returns Promise resolving to an array of partial product objects or void if search fails
   *
   * @example
   * ```typescript
   * const supplier = new SupplierOnyxmet("acetone", 10, new AbortController());
   * const results = await supplier.queryProducts("acetone");
   * if (results) {
   *   console.log(`Found ${results.length} products`);
   *   console.log("First product:", results[0].title);
   * }
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    this.logger.log("query:", query);

    const searchResponse = await this.httpGetHtml({
      path: "index.php",
      params: {
        term: query,
        route: "product/search/json",
      },
    });

    if (!searchResponse) {
      this.logger.error("No search response");
      return;
    }

    const data = JSON.parse(searchResponse);

    this.logger.debug("all search results:", data);

    const fuzzResults = this.fuzzyFilterAst<OnyxMetSearchResultItem>(data);

    return this.initProductBuilders(fuzzResults.splice(0, limit));
  }

  /**
   * Initialize product builders from Onyxmet search response data.
   * Transforms product listings into ProductBuilder instances, handling:
   * - Basic product information (title, URL, supplier)
   * - Product descriptions and specifications
   * - Product IDs and SKUs
   * - Pricing information with currency details
   * - CAS number extraction from product text
   * - Quantity parsing from product names and descriptions
   * - Grade/purity level extraction
   * - Product categories and classifications
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
   *     console.log(product.title, product.price, product.grade);
   *   }
   * }
   * ```
   * @source
   */
  protected initProductBuilders(data: OnyxMetSearchResultItem[]): ProductBuilder<Product>[] {
    return mapDefined(data, (item) => {
      if (!isSearchResultItem(item)) {
        this.logger.warn("Invalid search result item:", item);
        return;
      }

      const productId = this.getUniqueProductKey(item);
      if (!productId) {
        this.logger.warn("Product ID not found in href - Skipping", { item });
        return;
      }

      return new ProductBuilder<Product>(this.baseURL)
        .setBasicInfo(item.label, item.href, this.supplierName)
        .setCAS(findCAS(item.description))
        .setImage(item.image)
        .setID(productId)
        .setDescription(item.description.split("\r\n").at(0) || item.label)
        .setCacheKey(productId);
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
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => {
      this.logger.debug("Querying data for partialproduct:", { builder, product });

      const productResponse = await this.httpGetHtml({
        path: builder.get("url"),
      });

      if (!productResponse) {
        this.logger.warn("No product response", { builder });
        return;
      }

      const parser = new DOMParser();
      const parsedHTML = parser.parseFromString(productResponse, "text/html");
      const content = parsedHTML.querySelector("#content");
      this.logger.debug("Products parsedHTML:", parsedHTML);

      if (!content) {
        this.logger.warn("No content for product", { builder });
        return;
      }

      const productData = Array.from(content.querySelectorAll(".desc"))
        .find((element: Element) => element.textContent?.includes("Availability"))
        ?.closest("ul")
        ?.querySelectorAll("li");

      const productInfo = Array.from(productData || []).reduce<Record<string, string>>(
        (acc, element) => {
          const [key, value] = element.textContent?.split(": ") || [];
          if (key && value) {
            acc[key] = value;
          }
          return acc;
        },
        {},
      );

      const title = content.querySelector("h3.product-title")?.textContent?.trim() || "";

      const productCode =
        Array.from(content?.querySelectorAll(".product-right > ul > li") ?? [])
          .find((e) => e.textContent?.includes("Product Code"))
          ?.textContent?.trim()
          .replace(/product\s*code:\s*/i, "") ?? "";

      const statusTxt = productInfo.Availability || "";
      const productPrice = content.querySelector(".product-price")?.textContent?.trim() || "";

      // Radio labels for the "Available Options" sizes (e.g. "10g (5.00€)"). Used as a
      // fallback source for the base product's price/quantity; each is also parsed into
      // its own variant below when there is more than one.
      const productOptions = Array.from(
        content?.querySelectorAll("#product div label:has(input)") ?? [],
      ).map((e) => e.textContent?.trim().replaceAll(/\s+/g, " ") ?? "");

      // Array.from(document.querySelectorAll('#product div label:has(input)'))
      const price = firstMap(parsePrice, [productPrice, ...productOptions]);

      if (!price) {
        // @todo If this fails, the price can be retrieved from the product page via:
        /// document.querySelectorAll('#product > .form-group > div > div > label')
        //    .forEach(e => console.log(e.textContent.trim().replace(/\s+/, ' ')))
        this.logger.warn("No price for product", {
          builder,
          parsed: { productPrice, productOptions },
        });
        return;
      }
      const quantity = firstMap(parseQuantity, [title, productCode, ...productOptions]);

      if (!quantity) {
        // @todo if this fails, retrieve the quantity the from the product page via same
        // JS used for price.
        this.logger.warn("No quantity for product", {
          builder,
          parsed: { title, productCode, productOptions },
        });
        return;
      }

      const productTitleSibling = content.querySelector(".product-title + p");
      if (productTitleSibling && productTitleSibling.textContent) {
        const formula = findFormulaInText(productTitleSibling.textContent);
        if (formula) {
          builder.setFormula(formatFormula(formula));
        }

        const purity = firstMap(parsePurity, [
          productTitleSibling.textContent,
          content.querySelector(".product-title")?.textContent ?? "",
        ]);
        if (purity) {
          builder.setPurity(purity);
        }
      }

      const images = Array.from(content.querySelectorAll("a.elevatezoom-gallery > img") ?? [])
        .map((i: Element) => i.getAttribute("src"))
        .filter(Boolean);

      const metaDesc = content
        .querySelector("meta[name='description']")
        ?.getAttribute("content")
        ?.trim();

      if (metaDesc) {
        builder.setDescription(metaDesc);
      }

      builder
        .addImages(images)
        .setPricing(price.price, price.currencyCode, price.currencySymbol)
        .setQuantity(quantity.quantity, quantity.uom)
        .setAvailability(statusTxt ?? "");

      // More than one "Available Options" radio means the product is sold in several
      // sizes — expose each as a variant. A single option is just the base product.
      const variants = this.parseVariants(content);
      if (variants.length > 1) {
        this.logger.debug("Onyxmet variants found", { builder, variants });
        builder.setVariants(variants);
      }

      return builder;
    });
  }

  /**
   * Parses the "Available Options" size radios on an Onyxmet product page into variants.
   * Each option's label reads like `"10g (5.00€)"`: the amount before the parenthesis
   * gives the quantity/uom and the parenthesized value gives the price. The radio's
   * `value` attribute is Onyxmet's option id, kept as the variant `id`. Currency is left
   * unset so each variant inherits the parent product's currency at build time.
   * @param content - The product page's `#content` element.
   * @returns The parsed variants in page (ascending-size) order; empty when the page has no options.
   * @example
   * ```typescript
   * // For radios "10g (5.00€)" and "100g (30.00€)":
   * this.parseVariants(content);
   * // => [
   * //   { id: "1416", title: "10g", quantity: 10, uom: "g", price: 5 },
   * //   { id: "146", title: "100g", quantity: 100, uom: "g", price: 30 },
   * // ]
   * ```
   * @source
   */
  private parseVariants(content: Element): Partial<Variant>[] {
    const optionLabels = Array.from(
      content.querySelectorAll("#product .form-group label:has(input[type='radio'])"),
    );

    return mapDefined(optionLabels, (label) => {
      const fullText = label.textContent?.replaceAll(/\s+/g, " ").trim() ?? "";
      const priceText = fullText.match(/\(([^)]*)\)/)?.at(1) ?? "";
      const amountText = fullText.replace(/\s*\([^)]*\)\s*/, " ").trim();

      const quantity = parseQuantity(amountText);
      const price = parsePrice(priceText);
      if (!quantity || !price) {
        this.logger.warn("Skipping Onyxmet option, missing quantity or price", { fullText });
        return;
      }

      const id = label.querySelector("input")?.getAttribute("value") ?? undefined;

      return {
        id,
        title: amountText,
        quantity: quantity.quantity,
        uom: quantity.uom,
        price: price.price,
      } satisfies Partial<Variant>;
    });
  }

  /**
   * Extracts the product title from a search result item.
   * Returns the label property of the search result item, which contains
   * the product name/title in Onyxmet's search response format.
   *
   * @param data - The search result item to extract the title from
   * @returns The product title as a string
   *
   * @example
   * ```typescript
   * const searchResult = {
   *   label: "Sodium Chloride, ACS Grade",
   *   image: "nacl.jpg",
   *   description: "High purity NaCl",
   *   href: "/products/nacl"
   * };
   *
   * const title = this.titleSelector(searchResult);
   * console.log("Product title:", title);
   * // Output: "Sodium Chloride, ACS Grade"
   * ```
   * @source
   */
  protected titleSelector(data: OnyxMetSearchResultItem): string {
    return data.label;
  }
}
