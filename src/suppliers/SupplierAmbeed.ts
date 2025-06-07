import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
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

  protected encodedPriceChars: Map<string, string> = new Map([
    ["\u00b6", "."],
    ["\u0142", "$"],
    ["\u00ca", "0"],
    ["\u00c7", "1"],
    ["\u00cb", "2"],
    ["\u00a7", "3"],
    ["\u00cd", "4"],
    ["\u00ff", "5"],
    ["\u00f2", "6"],
    ["\u010f", "7"],
    ["\u00f3", "8"],
    ["\u00ee", "9"],
  ]);

  protected makeQueryParams(query: string): Base64 {
    return btoa(JSON.stringify({ keyword: query })) as Base64;
  }

  /**
   * Ambeed encodes all the prices in a different font (newwebfont/am-new.woff) than the rest
   * of the page which is stored as unicode characters in the API and their weird font
   * characters in the source, but displays just fine in the UI. For example, the API response
   * will have the price as `\u0142\u00c7\u00cd\u00a7\u00b6\u00ca\u00ca`, which in the source
   * is `łÇÍ§¶ÊÊ`, but in the UI is displayed as `$143.00`.
   *
   * This conersion is just a simple character map lookup, which I have stored at this.encodedPriceChars.
   *
   * @param encoded - The encoded price string
   * @returns The decoded price string
   * @example
   * ```js
   * console.log(
   *    this.decodePrice("\u0142\u00c7\u00cd\u00a7\u00b6\u00ca\u00ca"),
   *    this.decodePrice("\u0142\u00a7\u00f2\u00b6\u00ca\u00ca"),
   *    this.decodePrice("\u0142\u00c7\u00ff\u00b6\u00ca\u00ca"),
   *    this.decodePrice("\u0142\u00a7\u00cd\u010f\u00b6\u00ca\u00ca"),
   *    this.decodePrice("\u0142\u00c7\u00ca\u00b6\u00ca\u00ca")
   * )
   * // $143.00 $36.00 $15.00 $347.00 $10.00
   * ```
   */
  protected decodePrice(encoded: string): string {
    return encoded
      .split("")
      .map((char) => this.encodedPriceChars.get(char) || "")
      .join("");
  }

  /**
   * Decodes the price object values, which are encoded in the same font as the prices in the UI.
   * @param priceData - The price object to decode
   * @returns The decoded price object
   * @example
   * ```js
   * console.log(this.decodePriceObjectValues({
   *    pr_usd: "\u0142\u00c7\u00cd\u00a7\u00b6\u00ca\u00ca",
   *    pr_am: "A1144350",
   *    vip_usd: "\u0142\u00a7\u00f2\u00b6\u00ca\u00ca",
   *    discount_usd: "\u0142\u00c7\u00ff\u00b6\u00ca\u00ca",
   *    pr_size: "1mg",
   *    pr_id: 3255116
   * }))
   * // {
   * //   pr_usd: "$143.00",
   * //   pr_am: "A1144350",
   * //   vip_usd: "$36.00",
   * //   discount_usd: "$15.00",
   * //   pr_size: "1mg",
   * //   pr_id: 3255116
   * // }
   * ```
   */
  protected decodePriceObjectValues(
    priceData: AmbeedProductListResponsePriceList,
  ): AmbeedProductListResponsePriceList {
    return {
      ...priceData,
      /* eslint-disable */
      pr_usd: this.decodePrice(priceData.pr_usd),
      vip_usd: this.decodePrice(priceData.vip_usd),
      discount_usd: this.decodePrice(priceData.discount_usd),
      /* eslint-enable */
    };
  }

  /**
   * Sanitizes the searchable fields of a product, removing the <em></em> tags and decoding the prices.
   * @param product - The product to sanitize
   * @returns The sanitized product
   * @example
   * ```js
   * console.log(this.sanitizeSearchableFields({
   *    p_name_en: "2-Ethoxyacetic <em>acid</em>",
   *    p_proper_name3: "2-Ethoxyacetic <em>acid</em>",
   *    p_cas: "108-24-7",
   *    priceList: [
   *      {
   *        pr_usd: "\u0142\u00c7\u00cd\u00a7\u00b6\u00ca\u00ca",
   *        pr_am: "A1144350",
   *        vip_usd: "\u0142\u00a7\u00f2\u00b6\u00ca\u00ca",
   *        discount_usd: "\u0142\u00c7\u00ff\u00b6\u00ca\u00ca",
   *        pr_size: "1mg",
   *        pr_id: 3255116
   *      }
   *    ]
   * }))
   * // {
   * //   p_name_en: "2-Ethoxyacetic acid",
   * //   p_proper_name3: "2-Ethoxyacetic acid",
   * //   p_cas: "108-24-7",
   * //   priceList: [
   * //     {
   * //       pr_usd: "$143.00",
   * //       pr_am: "A1144350",
   * //       vip_usd: "$36.00",
   * //       discount_usd: "$15.00",
   * //       pr_size: "1mg",
   * //       pr_id: 3255116
   * //     }
   * //   ]
   * // }
   * ```
   */
  protected sanitizeSearchableFields(
    product: AmbeedProductListResponseResultItem,
  ): AmbeedProductListResponseResultItem {
    if (product.priceList) {
      product.priceList = product.priceList.map(this.decodePriceObjectValues.bind(this));
    }
    return {
      ...product,
      /* eslint-disable */
      p_name_en: product.p_name_en?.replace(/<\/?em>/g, ""),
      p_proper_name3: product.p_proper_name3?.replace(/<\/?em>/g, ""),
      p_cas: product.p_cas?.replace(/<\/?em>/g, ""),
      /* eslint-enable */
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
      path: "webapi/v1/productlistbykeyword",
      params: {
        params: this.makeQueryParams(query) as Base64,
      },
    });

    assertIsAmbeedProductListResponse(response);

    // Sanitize the products, removing the <em></em> tags and decoding the prices.
    const products = response.value.result.map(this.sanitizeSearchableFields.bind(this));

    const fuzzedResults = this.fuzzyFilter<AmbeedProductListResponseResultItem>(query, products);

    return this.initProductBuilders(fuzzedResults.slice(0, limit));
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

      if (typeof product.priceList?.[0]?.pr_usd !== "string") {
        this.logger.warn(`Ambeed product ${product.p_proper_name3} has no price`, product);
        return;
      }

      if (typeof product.priceList?.[0]?.pr_size !== "string") {
        this.logger.warn(`Ambeed product ${product.p_proper_name3} has no size`, product);
        return;
      }

      if (typeof product.p_cas === "string") {
        productBuilder.setCAS(product.p_cas);
      }

      for (const variant of product.priceList) {
        const parsedPrice = parsePrice(variant.pr_usd) as ParsedPrice;
        const quantity = parseQuantity(variant.pr_size as QuantityString);

        if (!parsedPrice || !quantity) {
          this.logger.warn(
            `Failed to parse Ambeed product price for ${product.p_proper_name3}`,
            product,
            variant,
          );
          continue;
        }

        productBuilder.addVariant({
          price: parsedPrice.price,
          currencyCode: parsedPrice.currencyCode,
          currencySymbol: parsedPrice.currencySymbol,
          quantity: quantity.quantity,
          uom: quantity.uom as string,
          sku: variant.pr_am,
          id: variant.pr_id.toString(),
        });
      }

      // Use the first variant as the main product. The ID will be wrong, but well overwrite it later.
      const mainVariant = productBuilder.getVariant(0);

      if (!mainVariant) {
        this.logger.warn(`Ambeed product ${product.p_proper_name3} has no main variant`, product);
        return;
      }

      productBuilder.setData(mainVariant as Partial<Product>);

      return productBuilder
        .setBasicInfo(product.p_proper_name3, `/products/${product.s_url}`, this.supplierName)
        .setID(product.p_id)
        .setUUID(product.p_am)
        .setDescription(product.p_name_en)
        .setSupplierCountry(this.country)
        .setSupplierShipping(this.shipping);
    });
  }

  /**
   * No real need to get the product data on a second page, the initial product listing
   * page has enough data.
   * @param product - The product builder to get data for
   * @returns The product builder
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return product;
  }
}
