import { AVAILABILITY } from "@/constants/common";
import { FUZZ_SCORERS, type FuzzScorerFn } from "@/constants/fuzzScorers";
import { findCAS } from "@/helpers/cas";
import { parseQuantity } from "@/helpers/quantity";
import { createDOM } from "@/helpers/request";
import { firstMap, mapDefined } from "@/helpers/utils";
import { ProductBuilder } from "@/utils/ProductBuilder";
import priceParser from "price-parser";
import { SupplierBase } from "./SupplierBase";
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
 * @source
 */
export class SupplierWarchem extends SupplierBase<Partial<Product>, Product> implements ISupplier {
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
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa", "ach", "cash"];

  // Cached search results from the last query execution
  protected queryResults: Array<Partial<Product>> = [];

  // Maximum number of HTTP requests allowed per search query
  // Used to prevent excessive requests to supplier
  protected httpRequestHardLimit: number = 50;

  // Counter for HTTP requests made during current query execution
  protected httpRequstCount: number = 0;

  // Number of requests to process in parallel when fetching product details
  protected maxConcurrentRequests: number = 5;

  // Warchem product names append qualifiers (grade, hydrate form, etc.), so the
  // default `ratio` scorer penalizes a short query like "WINIAN AMONU" against
  // the longer full names — they land right at the cutoff. token_set_ratio
  // scores ~100 when the query's words are a subset of the title, which keeps
  // those fuller-named variants in the results.
  protected readonly fuzzScorer: FuzzScorerFn = FUZZ_SCORERS.token_set_ratio;

  /**
   * Warchem stores the search result limit in the cookies which needs to be set
   * in a POST call before the query.
   * @returns A promise that resolves when the setup is complete.
   * @source
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
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const searchRequest = await this.httpGetHtml({
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

    if (!searchRequest) {
      this.logger.error("No search response", { query });
      return;
    }

    this.logger.log("Received search response", { query, searchRequest });

    const fuzzResults = this.fuzzHtmlResponse(query, searchRequest);

    this.logger.info("fuzzResults:", { query, searchRequest, fuzzResults });

    const builders = this.initProductBuilders(fuzzResults.slice(0, limit));
    this.logger.info("builders:", { query, searchRequest, fuzzResults, builders });
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
   * @source
   */
  protected fuzzHtmlResponse(query: string, response: string): Element[] {
    // Create a new DOM to do the travesing/parsing
    const parsedHTML = createDOM(response);
    if (!parsedHTML || parsedHTML === null) {
      throw new Error("No data found when loading HTML");
    }

    const productContainers = parsedHTML.querySelectorAll(
      // This selector excludes any results that have product restriction warnings, which are stored in the .LiniaOpisu element.
      // All product elements have .LiniaOpisu, but the ones with no restrictions have the nested div with just &nbsp;&nbsp;
      // inside, whereas the ones with restrictions have spans with the restriction text.
      "div.ListingWierszeKontener > div.Wiersz.LiniaDolna:not(:has(.LiniaOpisu > div > span))",
    );
    if (!productContainers || productContainers.length === 0) {
      this.logger.log("No products found", { query, response, parsedHTML, productContainers });
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
   * @source
   */
  protected initProductBuilders(elements: Element[]): ProductBuilder<Product>[] {
    this.logger.info("initProductBuilders elements:", { elements });
    return mapDefined(elements, (element: Element) => {
      this.logger.info("initProductBuilders mapping element:", { element });
      const builder = new ProductBuilder<Product>(this.baseURL);

      const productId = element.getAttribute("id");

      const itemDiv = element.querySelector('div[itemprop="item"]');
      const productName = itemDiv?.querySelector('meta[itemprop="name"]')?.getAttribute("content");
      const productUrl = itemDiv?.querySelector('link[itemprop="url"]')?.getAttribute("href");

      if (!productName) {
        this.logger.error("No product name for product", { element });
        return;
      }
      if (!productUrl) {
        this.logger.error("No product URL for product", { element });
        return;
      }

      builder
        .setBasicInfo(productName, productUrl, this.supplierName)
        .setID(productId)
        .setImage(itemDiv?.querySelector('link[itemprop="image"]')?.getAttribute("href"))
        .setSku(itemDiv?.querySelector('meta[itemprop="sku"]')?.getAttribute("content"))
        .setAvailability(
          this.getAvailabilityFromLink(
            itemDiv?.querySelector('link[itemprop="availability"]')?.getAttribute("href") ?? "",
          ),
        )
        .setPrice(itemDiv?.querySelector('meta[itemprop="price"]')?.getAttribute("content") ?? "")
        .setCurrencyCode(
          itemDiv?.querySelector('meta[itemprop="priceCurrency"]')?.getAttribute("content") ?? "",
        );

      // const headerElem = element.querySelector("h3 > a");
      // if (!headerElem) {
      //   this.logger.error("No header for product", { element });
      //   return;
      // }

      this.logger.info("initProductBuilders setting basic info", {
        productName,
        productUrl,
        builder,
      });

      return builder;
    });
  }

  private getAvailabilityFromLink(link: string): AVAILABILITY {
    const availability = link.split("/").pop();
    switch (availability) {
      case "InStock":
        return AVAILABILITY.IN_STOCK;
      case "OutOfStock":
        return AVAILABILITY.OUT_OF_STOCK;
      case "PreOrder":
        return AVAILABILITY.PRE_ORDER;
      case "BackOrder":
        return AVAILABILITY.BACKORDER;
      default:
        return AVAILABILITY.UNKNOWN;
    }
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
    // Meta tags: ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'product:price:amount', 'product:price:currency', 'product:availability', 'product:condition', 'product:retailer_item_id']
    return this.getProductDataWithCache(product, async (builder) => {
      this.logger.debug("Querying data for partialproduct", { builder });
      if (typeof builder === "undefined") {
        this.logger.error("No products to get data for", { builder });
        return;
      }

      const productResponse = await this.httpGetHtml({
        path: builder.get("url"),
      });

      if (!productResponse) {
        this.logger.warn("No product response", { builder });
        return;
      }

      this.logger.debug("productResponse", { builder, productResponse });

      const parsedHTML = createDOM(productResponse);
      const metaTags = parsedHTML.getElementsByTagName("meta");

      const productMeta = Array.from(metaTags).reduce<Record<string, string>>((acc, meta) => {
        const property = meta.getAttribute("property");
        if (typeof property === "string") {
          acc[property] = meta.getAttribute("content") ?? "";
        }
        return acc;
      }, {});

      this.logger.debug("productMeta", { builder, productMeta });

      // @todo The typing on this seems to be incorrect, will require a global type override
      const priceParsed = priceParser.parseFirst(
        `${productMeta["product:price:amount"]} ${productMeta["product:price:currency"]}`,
      );

      product.setCurrencySymbol(priceParsed?.currency?.symbols?.at(0));

      if (productMeta["product:price:amount"]) {
        product.setPrice(productMeta["product:price:amount"]);
      }

      product.setCurrencyCode(productMeta["product:price:currency"]);

      product.setID(productMeta["product:retailer_item_id"]);
      product.setDescription(productMeta["og:description"]);
      product.setImage(productMeta["og:image"]);

      if (productMeta["product:availability"]) {
        product.setAvailability(productMeta["product:availability"]);
      }

      // Sometimes the CAS can be found in the products title or description.
      product.setCAS(
        firstMap(
          (p) => findCAS(p),
          [productMeta["og:title"], productMeta["og:description"]].filter(Boolean),
        ),
      );

      const qtyRaw = parsedHTML.querySelector(".CechaProduktu label span")?.textContent;
      if (qtyRaw) {
        const qty = parseQuantity(qtyRaw);
        if (qty) {
          product.setQuantity(qty);
        }
      }

      this.setDataFileUrls(product, parsedHTML);

      // The meta tags only describe the default pack size; the other sizes and
      // their prices live in the inline `opcje` script + radio inputs.
      const variants = this.parseVariants(productResponse, parsedHTML);
      if (variants.length > 0) {
        this.logger.info("variants found", { builder, productResponse, parsedHTML, variants });
        product.setVariants(variants);
      } else {
        this.logger.warn("No variants found", { builder, productResponse, parsedHTML });
      }

      // The description tab carries a structured spec table with the most
      // reliable CAS, formula, and molar mass for the product.
      this.applyDataTable(product, parsedHTML);

      this.logger.debug("product", product);
      return product;
    });
  }

  /**
   * Set the SDS and specsheet URLs from the product page.
   * The labels are usually "Karta charakterystyki SDS" for SDS link,
   * and "Specyfikacja jakościowa SJ" for specsheet link.
   *
   * @param product - The ProductBuilder to set the URLs for
   * @param productPageDom - The product page Document
   * @returns Nothing; mutates the builder in place.
   * @example
   * ```typescript
   * this.setDataFileUrls(builder, createDOM(productPageHtml));
   * // builder.get("specSheetUrl") -> "https://example.com/spec-sheet.pdf"
   * // builder.get("sdsUrl") -> "https://example.com/sds.pdf"
   * ```
   * @source
   */
  private setDataFileUrls(product: ProductBuilder<Product>, productPageDom: Document): void {
    const links = Array.from(
      productPageDom.querySelectorAll(
        '#TresciZakladek ul li:has(>span.opisPlikLink) > a[rel="nofollow"]',
      ),
    );

    this.logger.debug(`Found ${links.length} links when searching for data files`, { links });

    for (const link of links) {
      const href = link.getAttribute("href");
      const text = link.textContent;
      if (href && text) {
        if (text.match(/\sSJ$/)) {
          product.setSpecSheetUrl(href);
        } else if (text.match(/\sSDS$/)) {
          product.setSDSUrl(href);
        }
      }
    }
  }

  /**
   * Reads Warchem's product "description" spec table — a two-column
   * label/value `<tr>` grid — and applies the structured fields it carries:
   * the CAS number (a far more reliable source than scraping the title or
   * description), the molecular formula, and the molar mass. Labels are
   * Polish: "Numer CAS", "Wzór chemiczny" (chemical formula), and
   * "Masa molowa" (molar mass, e.g. "261,06 g/mol").
   *
   * @param builder - The ProductBuilder to enrich.
   * @param dom - The parsed product page Document.
   * @returns Nothing; mutates the builder in place.
   * @example
   * ```typescript
   * this.applyDataTable(builder, createDOM(html));
   * // builder.get("cas") -> "20199-92-2", builder.get("moleweight") -> 261.06
   * ```
   * @source
   */
  private applyDataTable(builder: ProductBuilder<Product>, productPageDom: Document): void {
    const rows = Array.from(
      productPageDom.querySelectorAll(
        '#TresciZakladek > div[itemprop="description"] > div.FormatEdytor > table > tbody > tr',
      ),
    );

    this.logger.debug(`Found ${rows.length} rows when searching for data table`, { rows });

    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      const label = cells[0]?.textContent?.replace(/\s+/g, " ").replace(/:\s*$/, "").trim();
      const value = cells[1]?.textContent?.replace(/\s+/g, " ").trim();
      if (!label || !value) {
        continue;
      }

      if (label.startsWith("Numer CAS")) {
        // This should override the CAS that may have been set by a match in the title/description
        // if there was one.
        const cas = findCAS(value);
        if (cas) {
          if (builder.get("cas") && builder.get("cas") !== cas) {
            this.logger.warn(
              `There was a CAS # found in the title or description (${builder.get("cas")}), ` +
                `but it differs from the one found in the Numer Cas row of the data ` +
                `table(${cas}).... Weird. Prioritizing the datatable value.`,
              { builder, datatableCas: cas, parsedCas: value },
            );
          }
          builder.setCAS(cas);
        }
      } else if (label.startsWith("Wzór chemiczny")) {
        // The table value is already display-formatted (unicode subscripts and
        // hydrate notation), so store it verbatim rather than re-parsing it.
        builder.setData({ formula: value });
      } else if (label.startsWith("Masa molowa")) {
        // e.g. "261,06 g/mol" — Polish decimal comma, strip the unit.
        builder.setMoleweight(Number(value.replace(/[^\d.,]/g, "").replace(",", ".")));
      }
    }
  }

  /**
   * Parses the size/price variants from a Warchem product page. Warchem stores
   * every variant's prices in an inline `opcje` JS map keyed by
   * `x{data-id-cechy}-{data-id}` (e.g. `opcje['x1-7'] = 'netto;brutto;...'`),
   * while the matching radio input carries the pack size in its `aria-label`
   * (e.g. "Opakowanie:: 25g"). Each radio is tied to its gross (brutto) price —
   * the second `;`-separated field, mirroring the page's own `cenyCech[1]`
   * logic — and its parsed quantity. Currency is intentionally left unset so
   * each variant inherits the parent product's currency when the builder is
   * built.
   *
   * Only single feature-group products (one `data-id-cechy`) are supported;
   * multi-group products use composite `opcje` keys and are skipped.
   *
   * @param html - The raw product page HTML (for the inline `opcje` script).
   * @param productPageDom - The parsed product page Document (for the radio inputs).
   * @returns The parsed variants in DOM (ascending-size) order; empty when the
   *   product exposes no size options.
   * @example
   * ```typescript
   * const variants = this.parseVariants(html, createDOM(html));
   * // [{ id: "7", title: "25g", price: 8, quantity: 25, uom: "g" }, ...]
   * ```
   * @source
   */
  private parseVariants(html: string, productPageDom: Document): Partial<Variant>[] {
    // Each variant's prices are emitted inline as
    //   opcje['x<feature>-<value>'] = 'netto;brutto;poprzednia_netto;poprzednia_brutto;katalogowa'
    // (quotes may be single or double). Named groups label each PLN field; only
    // the gross (brutto) price is shown, but the rest document the format.
    const opcjePattern = new RegExp(
      "opcje\\[(?<q1>['\"])(?<optionKey>x(?<featureId>\\d+)-(?<valueId>\\d+))\\k<q1>\\]\\s*=\\s*" +
        "(?<q2>['\"])(?<netPrice>\\d+(?:\\.\\d+)?);" +
        "(?<grossPrice>\\d+(?:\\.\\d+)?);" +
        "(?<previousNetPrice>\\d+(?:\\.\\d+)?);" +
        "(?<previousGrossPrice>\\d+(?:\\.\\d+)?);" +
        "(?<catalogPrice>\\d+(?:\\.\\d+)?)\\k<q2>;",
      "g",
    );

    const parsedJsPrices = Array.from(html.matchAll(opcjePattern));
    this.logger.debug(`Found ${parsedJsPrices.length} matches when searching for prices`, {
      parsedJsPrices,
    });

    const grossPriceByKey: Record<string, number> = {};
    for (const match of parsedJsPrices) {
      const { optionKey, featureId, valueId, grossPrice } = match.groups ?? {};
      if (featureId && valueId && grossPrice) {
        grossPriceByKey[optionKey] = Number(grossPrice);
      }
    }
    if (Object.keys(grossPriceByKey).length === 0) {
      return [];
    }

    const radios = productPageDom.querySelectorAll('.CechaWyboru input[type="radio"]');
    return mapDefined(Array.from(radios), (radio: Element) => {
      const cecha = radio.getAttribute("data-id-cechy");
      const id = radio.getAttribute("data-id");
      if (!cecha || !id) {
        return;
      }

      const grossPrice = grossPriceByKey[`x${cecha}-${id}`];
      if (grossPrice === undefined || grossPrice <= 0) {
        return;
      }

      const qty = parseQuantity(radio.getAttribute("aria-label") ?? "");

      return {
        id,
        title: qty ? `${qty.quantity}${qty.uom}` : undefined,
        price: grossPrice,
        quantity: qty?.quantity,
        uom: qty?.uom,
      };
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
   * @source
   */
  protected titleSelector(data: Element): Maybe<string> {
    if (!data) {
      this.logger.error("No data for product", { data });
      return undefined;
    }
    // document.querySelectorAll('div.ListingWierszeKontener > div.Wiersz')[1].querySelector('div.ProdCena > h3 > a').innerText
    const title = data.querySelector("div.ProdCena > h3 > a")?.textContent?.trim();
    if (title === null) {
      this.logger.error("No title for product", { data });
      return undefined;
    }
    return title;
  }
}
