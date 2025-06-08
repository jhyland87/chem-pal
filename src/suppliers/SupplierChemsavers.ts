import { isCAS } from "@/helpers/cas";
import { parseQuantity } from "@/helpers/quantity";
import { mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import { assertValidSearchResponse } from "@/utils/typeGuards/chemsavers";
import SupplierBase from "./SupplierBase";

/**
 * Module sed to retrieve products sold on the Chemsavers website.
 *
 * @remarks
 *
 * Chemsavers does have an exposed GraphQL API which can be used to retrieve product data, but
 * an even easier option is to use the Typesense search API which has all of their products
 * listed and is easily searchable.
 *
 * @category Suppliers
 */
export default class SupplierChemsavers
  extends SupplierBase<ChemsaversProductObject, Product>
  implements ISupplier
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Chemsavers";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://www.chemsavers.com";

  // Shipping scope for Chemsavers
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  // The API URL for the Typesense search API.
  protected apiURL: string = "0ul35zwtpkx14ifhp-1.a1.typesense.net";

  // Override the type of queryResults to use our specific type
  protected queryResults: Array<ChemsaversProductObject> = [];

  // Used to keep track of how many requests have been made to the supplier.
  protected httpRequstCount: number = 0;

  // The API key for the Typesense search API.
  protected apiKey: string = "iPltuzpMbSZEuxT0fjPI0Ct9R1UBETTd";

  // HTTP headers used as a basis for all queries.
  protected headers: HeadersInit = {
    /* eslint-disable */
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "content-type": "text/plain",
    pragma: "no-cache",
    priority: "u=1, i",
    "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "sec-gpc": "1",
    /* eslint-enable */
  };

  /**
   * Executes a product search query and returns matching products
   * @param query - Search term to look for
   * @param limit - The maximum number of results to query for
   * @returns Promise resolving to array of product objects or void if search fails
   * @example
   * ```typescript
   * const products = await this.queryProducts("acid");
   * if (products) {
   *   products.forEach(product => {
   *     console.log(product.title, product.price);
   *   });
   * }
   * ```
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    try {
      const body = this.makeRequestBody(query);

      const response: unknown = await this.httpPostJson({
        path: `/multi_search`,
        host: this.apiURL,
        params: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "x-typesense-api-key": this.apiKey,
        },
        body,
      });

      this.logger.debug("Query response:", response);

      assertValidSearchResponse(response);

      const products = mapDefined(response.results[0].hits.flat(), (hit: unknown) => {
        if (
          typeof hit !== "object" ||
          hit === null ||
          "document" in hit === false ||
          typeof hit.document !== "object"
        )
          return;
        return hit.document as ChemsaversProductObject;
      });

      this.logger.debug("Mapped response objects:", products);

      const fuzzResults = this.fuzzyFilter<ChemsaversProductObject>(query, products);

      this.logger.info("fuzzResults:", fuzzResults);
      const grouped = this.groupVariants<ChemsaversProductObject>(fuzzResults);
      // Initialize product builders from filtered results
      return this.initProductBuilders(grouped.slice(0, limit));
    } catch (error) {
      this.logger.error("Error querying products:", error);
      return;
    }
  }

  /**
   * Initialize product builders from Chemsavers search response data.
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
   */
  protected initProductBuilders(data: ChemsaversProductObject[]): ProductBuilder<Product>[] {
    return mapDefined(data, (result) => {
      const builder = new ProductBuilder<Product>(this.baseURL);

      const quantity = parseQuantity(result.name);
      if (quantity === undefined) return;

      builder
        .setBasicInfo(result.name, result.url, this.supplierName)
        .setDescription(result.description)
        .setID(result.id)
        .setSku(result.sku)
        .setPricing(result.price, "USD", "$")
        .setQuantity(quantity.quantity, quantity.uom)
        .setCAS(isCAS(result.CAS) ? result.CAS : "");

      if (result.variants) {
        builder.setVariants(
          mapDefined(result.variants, (variant: ChemsaversProductVariant) => {
            const quantity = parseQuantity(variant.name);
            if (quantity === undefined) return;
            return {
              id: variant.id,
              sku: variant.sku,
              title: variant.name,
              price: variant.price,
              url: variant.url,
              ...quantity,
            };
          }),
        );
      }

      return builder;
    });
  }

  /**
   * Creates the request body for the Typesense search API.
   *
   * Constructs a search request object that:
   * - Searches across name, CAS, and SKU fields
   * - Highlights matches in these fields
   * - Returns paginated results based on the specified limit
   * - Uses the 'products' collection
   *
   * @param query - The search term to look for in the product database
   * @param limit - Maximum number of results to return (defaults to this.limit)
   * @returns An object containing the search configuration for the Typesense API
   */
  protected makeRequestBody(query: string, limit: number = 100): object {
    /* eslint-disable */
    return {
      searches: [
        {
          query_by: "name, CAS, sku",
          highlight_full_fields: "name, CAS, sku",
          collection: "products",
          q: query,
          page: 0,
          per_page: limit,
        },
      ],
    };
    /* eslint-enable */
  }

  /**
   * Transforms a Laboratorium Discounter product into the common Product type
   * Extracts quantity information from various product fields and normalizes the data
   * @param product - Product object from Laboratorium Discounter
   * @returns Promise resolving to a partial Product object or void if invalid
   * @example
   * ```typescript
   * const products = await this.queryProducts("acid");
   * if (products) {
   *   const product = await this.getProductData(products[0]);
   *   if (product) {
   *     console.log(product.title, product.price, product.quantity, product.uom);
   *   }
   * }
   * ```
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    // Since Chemsavers includes all product data in search results,
    // we can just return the product builder directly
    return this.getProductDataWithCache(product, async (builder) => builder);
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns - The title of the product
   */
  protected titleSelector(data: ChemsaversProductObject): string {
    return data.name;
  }
}
