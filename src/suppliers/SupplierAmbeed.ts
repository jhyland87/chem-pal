import { mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import { assertIsAmbeedProductListResponse } from "@/utils/typeGuards/ambeed";
import SupplierBase from "./SupplierBase";

/**
 * Ambeed is a Chinese chemical supplier.
 *
 * @remarks
 * Ambeed seems to have a custom API located at `https://www.ambeed.com/webapi/v1`. All the
 * GET endpoints seem to require a `params` query parameter, which is a base64 encoded JSON
 * string.
 *
 * ```js
 * const params = btoa(JSON.stringify({"keyword":"sodium","country":"United States","one_menu_id":0,"one_menu_life_id":0,"menu_id":0}));
 * const url = `https://ambeed.com/webapi/v1/productlistbykeyword?params=${params}`;
 * ```
 * @see https://www.ambeed.com/
 */
export default class SupplierAmbeed
  extends SupplierBase<AmbeedProductObject, Product>
  implements ISupplier
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Ambeed";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://www.ambeed.com";

  // Shipping scope for Ambeed
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  public readonly country: CountryCode = "CN";

  // Override the type of queryResults to use our specific type
  protected queryResults: Array<AmbeedProductObject> = [];

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

  private makeQueryParams(query: string): Base64 {
    return btoa(JSON.stringify({ keyword: query })) as Base64;
  }

  /**
   * The query params are sent over in a base64 encoded JSON.stringify of
   * ```js
   * params=btoa(JSON.stringify({ keyword: "sodium chloride" }))
   * params=btoa(JSON.stringify({ keyword: "acid", page:3 }))
   * ```
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const response: unknown = await this.httpGetJson({
      path: `/webapi/v1/searchquery`,
      params: {
        params: this.makeQueryParams(query) as Base64,
      },
    });

    assertIsAmbeedProductListResponse(response);

    const products = response.value.result;

    const rawSearchResults = this.fuzzyFilter<AmbeedProductListResponseResultItem>(query, products);

    return this.initProductBuilders(rawSearchResults.slice(0, limit));
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns Title of the product
   */
  protected titleSelector(data: AmbeedProductListResponseResultItem): string {
    return data.p_proper_name3;
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
  protected initProductBuilders(
    data: AmbeedProductListResponseResultItem[],
  ): ProductBuilder<Product>[] {
    return mapDefined(data, (product) => {
      const productBuilder = new ProductBuilder(this.baseURL);
      productBuilder
        //.addRawData(product)
        .setBasicInfo(product.p_proper_name3, product.s_url, this.supplierName)
        .setID(product.p_id)
        .setCAS(product.p_cas);
      return productBuilder;
    });
  }

  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    const params = { format: "json" };
    return this.getProductDataWithCache(
      product,
      async (builder) => {
        const productResponse = await this.httpGetJson({
          path: builder.get("url"),
          params,
        });
        assertIsAmbeedProductListResponse(productResponse);
        const productData = productResponse.value.result;
        builder.setPricing(
          productData.p_price,
          productData.p_currency,
          productData.p_currency_symbol,
        );
      },
      params,
    );
  }
}
