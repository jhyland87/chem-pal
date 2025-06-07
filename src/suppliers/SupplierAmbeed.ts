import { AVAILABILITY } from "@/constants/common";
import { findCAS } from "@/helpers/cas";
import { mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import { isProductObject, isSearchResponseOk } from "@/utils/typeGuards/ambeed";
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

  protected makeQueryParams(query: string): AmbeedSearchParams {
    const encoded = JSON.stringify({ keyword: query });

    return {
      params: btoa(JSON.stringify({ params: btoa(encoded) })),
    };
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
        params: btoa(JSON.stringify({ keyword: btoa(query) })),
      },
    });

    if (!isSearchResponseOk(response)) {
      this.logger.warn("Bad search response:", response);
      return;
    }

    const rawSearchResults = Object.values(response.collection.products);

    const fuzzFiltered = this.fuzzyFilter<SearchResponseProduct>(query, rawSearchResults);
    this.logger.info("fuzzFiltered:", fuzzFiltered);
    return this.initProductBuilders(fuzzFiltered.slice(0, limit));
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns Title of the product
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
   */
  protected initProductBuilders(
    data: LaboratoriumDiscounterSearchResponseProduct[],
  ): ProductBuilder<Product>[] {
    return mapDefined(data, (product) => {
      const productBuilder = new ProductBuilder(this.baseURL);
      productBuilder
        //.addRawData(product)
        .setBasicInfo(product.title, product.url, this.supplierName)
        .setDescription(product.description)
        .setID(product.id)
        .setAvailability(product.available)
        .setSku(product.sku)
        .setUUID(product.code)
        //.setPricing(product.price.price, product?.currency as string, CURRENCY_SYMBOL_MAP.EUR)
        .setQuantity(product.variant)
        .setCAS(typeof product.content === "string" ? (findCAS(product.content) ?? "") : "");
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
        if (!productResponse || !isProductObject(productResponse)) {
          this.logger.warn("Invalid product data - did not pass typeguard:", productResponse);
          return builder;
        }
        const productData = productResponse.product;
        const currency = productResponse.shop.currencies[productResponse.shop.currency];
        builder.setPricing(productData.price.price, currency.code, currency.symbol);
        if (typeof productData.variants === "object" && productData.variants !== null) {
          for (const variant of Object.values(productData.variants) as VariantObject[]) {
            if (variant.active === false) continue;
            builder.addVariant({
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
        return builder;
      },
      params,
    );
  }
}
