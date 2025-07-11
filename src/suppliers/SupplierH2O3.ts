import { mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import SupplierBase from "./SupplierBase";

export default class SupplierH2O3 extends SupplierBase<Product, Product> implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "H2O3";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://n2o3.com/";

  // Shipping scope for H2O3
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  public readonly country: CountryCode = "PL";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = [
    "mastercard",
    "visa",
    "paypal",
    "banktransfer",
  ];

  // Override the type of queryResults to use our specific type
  protected queryResults: Array<Product> = [];

  // Used to keep track of how many requests have been made to the supplier.
  protected httpRequstCount: number = 0;

  // HTTP headers used as a basis for all queries.
  protected headers: HeadersInit = {
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
   *   console.error("No products found or search failed");
   * }
   * ```
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const queryProductPage = async (query: string, page: number): Promise<Element[] | void> => {
      const searchResponse = await this.httpGetHtml({
        path: "en/catalogue/",
        params: {
          szukaj: encodeURIComponent(query),
          offset: page.toString(),
        },
      });

      if (searchResponse === undefined) {
        this.logger.error("Bad search response:", searchResponse);
        return;
      }

      const $fuzzResults = this.fuzzHtmlResponse(query, searchResponse);
      return $fuzzResults;
    };

    const results: Element[] = [];

    for (let offset = 0; offset < Math.ceil(limit / 10); offset++) {
      const $fuzzResults = await queryProductPage(query, offset);

      if (!$fuzzResults) {
        console.log("No results for page:", offset);
        break;
      }

      results.push(...$fuzzResults);

      if ($fuzzResults.length < 10) {
        break;
      }
    }

    console.log("results:", results);

    return this.initProductBuilders(results);
  }

  private listingElementToObject(element: Element): Record<string, string | undefined> | undefined {
    const titleElem = element.querySelector("div a.a2");
    if (!titleElem) {
      this.logger.error("No title element found");
      return;
    }

    const result = {
      href: titleElem.getAttribute("href") || "",
      title: titleElem.textContent?.trim() || "",
      id: element.querySelector("div > div > div:nth-child(2) > span")?.textContent || "",
      cas: undefined as string | undefined,
      quantity: undefined as string | undefined,
      grade: undefined as string | undefined,
      price: undefined as string | undefined,
      uom: undefined as string | undefined,
      currencyCode: undefined as string | undefined,
      currencySymbol: undefined as string | undefined,
    };

    for (const a of element.querySelectorAll("div > div > div:nth-child(2) > div > a")) {
      const [dataKey, dataValue] = a.textContent?.split(":") || [];
      if (dataKey === "CAS") {
        result.cas = dataValue || undefined;
      }
    }

    for (const tr of element.querySelectorAll("table.table_param2 > tbody > tr")) {
      let match = undefined;
      const attrKey = tr.querySelector("th");
      switch (attrKey?.textContent?.toLowerCase()) {
        case "quantity":
          match = (tr.querySelector("td")?.textContent?.trim() as string).match(
            /(?<quantity>\d+) \[(?<uom>\w+)\]/,
          );
          if (match) {
            result.quantity = match.groups?.quantity || undefined;
            result.uom = match.groups?.uom || undefined;
          }
          break;
        case "grade":
          result.grade = (tr.querySelector("td")?.textContent?.trim() as string) || undefined;
          break;
        default:
          break;
      }
    }

    // const qtyPriceRows = element.querySelectorAll("table:not(.table_param2) > tbody > tr");

    // // First tr is the quantity, the second is the price. So check that there are at leat two rows
    // if (qtyPriceRows.length >= 2) {
    //   const qtyPriceRow = qtyPriceRows[0];
    //   const qtyPrice = qtyPriceRow.querySelector("td");
    //   if (qtyPrice && qtyPrice.textContent?.toLowerCase().includes("quantity")) {
    //     const uomMatch = qtyPrice.textContent?.match(/Quantity \[(?<uom>.*)\]/);
    //     if (uomMatch) {
    //       result.uom = uomMatch.groups?.uom || undefined;
    //     }
    //   }
    //   const grossPrice = qtyPriceRows[1].querySelector("td");
    //   if (grossPrice) {
    //     const priceMatch = grossPrice.textContent
    //       ?.trim()
    //       .match(/Gross price \[(?<currencyCode>[A-Z]{3})\/(?<uom>\w+)\]/, "i");
    //     console.log("priceMatch:", priceMatch);
    //     if (priceMatch) {
    //       result.currencyCode = priceMatch.groups?.currencyCode || undefined;
    //       if (!result.uom && priceMatch.groups?.uom) {
    //         result.uom = priceMatch.groups?.uom;
    //       }
    //     }
    //   }
    // }

    // const priceOnes = element.querySelector(`#przel_cena_brut1_${result.id}`)?.textContent;
    // const priceTens = element.querySelector(`#przel_cena_brut2_${result.id}`)?.textContent;
    const priceFull = element.querySelector(`#przel_cena_${result.id}`)?.textContent;

    if (priceFull) {
      result.price = priceFull;
      result.currencyCode = "PLN";
      result.currencySymbol = "zł";
    }

    console.log("result:", result);
    return result;
  }

  protected fuzzHtmlResponse(query: string, response: string): Element[] {
    // Create a new DOM to do the travesing/parsing
    const parser = new DOMParser();
    const parsedHTML = parser.parseFromString(response, "text/html");

    // Select all products by a known selector path
    const products = parsedHTML.querySelectorAll("#produkty > .tr1");

    // Do the fuzzy filtering using the element found when using this.titleSelector()
    return this.fuzzyFilter<Element>(query, Array.from(products));
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns Title of the product
   */
  protected titleSelector(data: Element): string {
    const title = data.querySelector("a.a2");
    if (title === null) {
      this.logger.error("No title for product");
      return "";
    }
    return title.textContent?.trim() || "";
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
   */
  protected initProductBuilders(data: Element[]): ProductBuilder<Product>[] {
    const parsedResults = mapDefined(data, (element) => {
      const item = this.listingElementToObject(element);
      if (!item) return;
      const product = new ProductBuilder(this.baseURL);
      product.setBasicInfo(item.title as string, item.href as string, this.supplierName);
      if (item.price) product.setPrice(item.price);
      if (item.quantity) product.setQuantity(item.quantity);
      if (item.uom) product.setUOM(item.uom);
      if (item.currencyCode) product.setCurrencyCode(item.currencyCode);
      if (item.currencySymbol) product.setCurrencySymbol(item.currencySymbol);
      //if (item.currency) product.setCurrency(item.currency);
      if (item.cas) product.setCAS(item.cas);
      if (item.grade) product.setGrade(item.grade);

      return product;
    });

    console.log("parsedResults:", parsedResults);

    return parsedResults;
  }

  /**
   * Fetches product data for a given product builder
   * @param product - Product builder to fetch data for
   * @returns Promise resolving to product builder or void if data fetch fails
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return product;
  }
}
