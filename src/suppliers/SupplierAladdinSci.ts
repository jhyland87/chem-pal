import { createDOM } from "@/helpers/request";
import { mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import SupplierBase from "./SupplierBase";

/**
 * Supplier implementation for AladdinSci chemical supplier.
 * Extends the base supplier class and provides AladdinSci-specific implementation
 * for product searching and data extraction.
 *
 * @typeParam S - The supplier-specific product type (Partial<Product>)
 * @typeParam T - The common Product type that all suppliers map to
 *
 * @example
 * ```typescript
 * const supplier = new SupplierAladdinSci("sodium chloride", 10, new AbortController());
 * for await (const product of supplier) {
 *   console.log("Found product:", product.title, product.price);
 * }
 * ```
 * @source
 */
export default class SupplierAladdinSci
  extends SupplierBase<Partial<Product>, Product>
  implements ISupplier
{
  // Display name of the supplier used for UI and logging
  public readonly supplierName: string = "AladdinSci";

  // Base URL for all API and web requests to AladdinSci
  public readonly baseURL: string = "https://www.aladdinsci.com";

  // Shipping scope for AladdinSci
  public readonly shipping: ShippingRange = "worldwide";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  protected async queryProducts(
    query: string,
    limit: number,
  ): Promise<ProductBuilder<Product>[] | void> {
    const searchRequest = await this.httpGetHtml({
      path: "/us_en/catalogsearch/result/index/",
      params: { q: query, product_list_limit: 60 },
    });
    // https://www.aladdinsci.com/us_en/catalogsearch/result/index/?q=sodium&product_list_limit=60

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

  protected initProductBuilders(elements: Element[]): ProductBuilder<Product>[] {
    return mapDefined(elements, (element: Element) => {
      const builder = new ProductBuilder<Product>(this.baseURL);

      return builder;
    });
  }

  protected titleSelector(data: Element): Maybe<string> {
    const titleElem = data.querySelector("dd.product-item-details > strong.product-item-name");
    if (!titleElem) {
      this.logger.error("No title for product", { data });
      return;
    }
    return titleElem.textContent?.trim();
  }

  protected fuzzHtmlResponse(query: string, response: string): Element[] {
    // Create a new DOM to do the travesing/parsing
    const parsedHTML = createDOM(response);
    if (!parsedHTML || parsedHTML === null) {
      throw new Error("No data found when loading HTML");
    }

    const productContainers = parsedHTML.querySelectorAll("div.products-list > ol > li");
    if (!productContainers || productContainers.length === 0) {
      this.logger.log("No products found", { query, response, parsedHTML, productContainers });
      return [];
    }

    // Do the fuzzy filtering using the element found when using this.titleSelector()
    return this.fuzzyFilter<Element>(query, Array.from(productContainers));
  }
}
