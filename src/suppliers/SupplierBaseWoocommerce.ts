import { findCAS } from "@/helpers/cas";
import { parseQuantity } from "@/helpers/quantity";
import { firstMap } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import { isSearchResponse } from "@/utils/typeGuards/woocommerce";
import SupplierBase from "./SupplierBase";

/**
 * Base class for WooCommerce-based suppliers that provides common functionality for
 * interacting with WooCommerce REST API endpoints.
 *
 * @remarks
 * Woocommerce has two versons of API endpoints for products.
 * The V1 endpoints are:
 * - `/wp-json/wc/v1`
 * - `/wp-json/wc/store/v1/products`
 * - `/wp-json/wc/store/v1/products?search=borohydride&per_page=20&page=1`
 * - `/wp-json/wc/store/v1/products/6981`
 *
 * And the V2 endpoints are:
 * - `/wp-json/wp/v2`
 * - `/wp-json/wp/v2/product`
 * - `/wp-json/wp/v2/product?search=borohydride&per_page=20&page=1`
 * - `/wp-json/wp/v2/product/6981`
 *
 * There are plenty of differences between the two, but mainly it looks like the v2 endpoint
 * doesn't include any of the variatins in the search responses.
 *
 * The first endpoint is used to search for products and returns a list of products.
 * The second endpoint is used to get the details of a single product.
 * @category Suppliers
 * @example
 * ```typescript
 * class MyChemicalSupplier extends SupplierBaseWoocommerce {
 *   public readonly supplierName = "My Chemical Supplier";
 *   protected baseURL = "https://mychemicalsupplier.com";
 * }
 *
 * const supplier = new MyChemicalSupplier();
 * for await (const product of supplier) {
 *   console.log(product);
 * }
 * ```
 *
 * @see https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/src/StoreApi/docs/products.md
 * @see https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/src/StoreApi/docs/products.md#list-products
 */
export default abstract class SupplierBaseWoocommerce
  extends SupplierBase<WooCommerceSearchResponseItem, Product>
  implements AsyncIterable<Product>
{
  /**
   * API key for WooCommerce authentication.
   * Used for authenticating requests to the WooCommerce REST API.
   * Should be set in the constructor of implementing classes.
   *
   * @example
   * ```typescript
   * class MySupplier extends SupplierBaseWoocommerce {
   *   constructor() {
   *     super();
   *     this.apiKey = "wc_key_123456789";
   *   }
   * }
   * ```
   */
  protected apiKey: string = "";

  /**
   * Queries the WooCommerce API for products matching the given search term.
   * Makes a GET request to the WooCommerce Store API v1 products endpoint.
   *
   * @param query - Search term to filter products
   * @param limit - The maximum number of results to query for
   * @returns Promise resolving to an array of SearchResponseItem or void if the request fails
   *
   * @example
   * ```typescript
   * const products = await supplier.queryProducts("sodium chloride");
   * if (products) {
   *   console.log(`Found ${products.length} matching products`);
   * }
   * ```
   * https://carolinachemical.com/wp-json/wc/store/v1/products?search=a&page=1&per_page=100
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const searchRequest = await this.httpGetJson({
      path: `/wp-json/wc/store/v1/products`,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      params: { search: query, per_page: 100 },
    });

    if (!isSearchResponse(searchRequest)) {
      this.logger.error("Invalid search response:", searchRequest);
      return;
    }

    const results: WooCommerceSearchResponseItem[] = searchRequest;
    const fuzzFiltered = this.fuzzyFilter<WooCommerceSearchResponseItem>(query, results);
    this.logger.info("fuzzFiltered:", fuzzFiltered);

    return this.initProductBuilders(fuzzFiltered.slice(0, limit));
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns Title of the product
   */
  protected titleSelector(data: WooCommerceSearchResponseItem): string {
    return data.name;
  }

  /**
   * Initialize product builders from WooCommerce search response data.
   * Transforms WooCommerce product data into ProductBuilder instances, handling:
   * - Basic product information (name, URL, supplier)
   * - Product identifiers (ID, SKU)
   * - Pricing information with currency details
   * - CAS number extraction from descriptions
   * - Quantity parsing from product names and descriptions
   * - Product variations with their attributes
   *
   * @param results - Array of WooCommerce search response items
   * @returns Array of ProductBuilder instances initialized with WooCommerce product data
   * @example
   * ```typescript
   * const results = await this.queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this.initProductBuilders(results);
   *   // Each builder contains parsed product data from WooCommerce
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log(product.title, product.price, product.quantity);
   *   }
   * }
   * ```
   */
  protected initProductBuilders(
    results: WooCommerceSearchResponseItem[],
  ): ProductBuilder<Product>[] {
    return results.map((item) => {
      const builder = new ProductBuilder<Product>(this.baseURL);

      builder
        .setBasicInfo(item.name, item.permalink, this.supplierName)
        .setID(item.id)
        .setSku(item.sku)
        .setPricing(
          Number(item.prices.price) / 100,
          item.prices.currency_code,
          item.prices.currency_symbol,
        );

      const cas = firstMap(findCAS, [item.description, item.short_description]);

      if (cas) builder.setCAS(cas);

      const toParseForQuantity = [item.name, item.description, item.short_description];

      if ("variations" in item) {
        const variations = item.variations.map((variation) => {
          const variant: Partial<Variant> = {
            id: variation.id,
          };

          if (Array.isArray(variation.attributes)) {
            const size = variation.attributes.find(
              (attribute) => attribute.name.toLowerCase() === "size",
            );
            if (size && size?.value) {
              toParseForQuantity.push(size?.value);
              const variantQty = parseQuantity(size.value);

              if (variantQty) {
                variant.quantity = variantQty.quantity;
                variant.uom = variantQty.uom;
              }
            }
          }

          return variant;
        });

        if (variations.length > 0) {
          builder.addVariants(variations);
        }
      }

      const quantity = firstMap(parseQuantity, toParseForQuantity);
      if (quantity) {
        builder.setQuantity(quantity.quantity, quantity.uom);
      }

      this.logger.debug("initProductBuilder product:", builder.dump());

      return builder;
    });
  }

  /**
   * Transforms a WooCommerce product item into the common Product type.
   * Fetches additional product details, extracts relevant information, and builds a standardized Product object.
   *
   * This method:
   * 1. Validates the input product
   * 2. Fetches detailed product information
   * 3. Extracts price, quantity, CAS number, and chemical formula
   * 4. Builds and returns a standardized Product object
   *
   * @param product - WooCommerce product item to transform
   * @returns Promise resolving to a partial Product object or void if transformation fails
   *
   * @example
   * ```typescript
   * const searchItem = await supplier.queryProducts("sodium");
   * if (searchItem?.[0]) {
   *   const product = await supplier.getProductData(searchItem[0]);
   *   if (product) {
   *     console.log("Transformed product:", product);
   *   }
   * }
   * ```
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => builder);
  }
}
