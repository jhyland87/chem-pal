import { UOM } from "@/constants/common";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { firstMap, mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import { isValidShopifySearchResponse } from "@/utils/typeGuards/shopify";
import SupplierBase from "./SupplierBase";

/**
 * Base class for Shopify-based suppliers that provides common functionality for
 * interacting with the Shopify GraphQL Storefront API.
 *
 * @remarks
 * This base class queries the Shopify GraphQL API at `{apiURL}/api/{apiVersion}/graphql.json`
 * using a POST request with a product search query. The API is unauthenticated and uses the
 * public Storefront API endpoint available on `myshopify.com` domains.
 *
 * Subclasses only need to provide the `apiURL` (the myshopify.com domain) along with the
 * standard supplier properties (supplierName, baseURL, shipping, country, paymentMethods).
 *
 * @category Suppliers
 * @example
 * ```typescript
 * // Create a new class using the SupplierBaseShopify class
 * export default class SupplierMyStore
 *   extends SupplierBaseShopify
 *   implements ISupplier
 * {
 *   public readonly supplierName: string = "My Store";
 *   public readonly baseURL: string = "https://www.mystore.com";
 *   public readonly shipping: ShippingRange = "domestic";
 *   public readonly country: CountryCode = "US";
 *   public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];
 *   protected apiURL: string = "my-store.myshopify.com";
 * }
 * ```
 * @source
 */
export default abstract class SupplierBaseShopify
  extends SupplierBase<ShopifyProductNode, Product>
  implements ISupplier
{
  /** Shopify GraphQL API version */
  protected apiVersion: string = "2026-04";

  /**
   * Builds the GraphQL query string for searching products by title.
   *
   * @param query - The search term to match against product titles
   * @param limit - Maximum number of products to return
   * @returns The GraphQL query string
   * @source
   */
  protected getGraphQLQuery(query: string, limit: number): string {
    return `{
      products(first: ${limit}, query: "title:*${query}*") {
        edges {
          node {
            id,
            title,
            handle,
            description,
            onlineStoreUrl,
            variants(first: 5) {
              edges {
                node {
                  title,
                  sku,
                  barcode,
                  price {
                    amount
                  },
                  weight,
                  weightUnit,
                  requiresShipping,
                  availableForSale,
                  currentlyNotInStock
                }
              }
            }
          }
        }
      }
    }`;
  }

  /**
   * Query products from the Shopify GraphQL Storefront API.
   *
   * @param query - The search term to query for
   * @param limit - The maximum number of products to return
   * @returns A promise that resolves to an array of ProductBuilder instances or void
   * @example
   * ```typescript
   * const products = await this.queryProducts("gold test kit", 10);
   * if (products) {
   *   for (const product of products) {
   *     const built = await product.build();
   *     console.log(built.title, built.price);
   *   }
   * }
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    this.logger.info("queryProducts", { query, limit });
    const graphQLQuery = this.getGraphQLQuery(query, 200);
    console.log("graphQLQuery", graphQLQuery);
    console.log("apiURL", this.apiURL);
    console.log("apiVersion", this.apiVersion);
    console.log("body", { query: graphQLQuery });
    console.log("headers", { "Content-Type": "application/json" });

    const queryResponse = await this.httpPostJson({
      path: `/api/${this.apiVersion}/graphql.json`,
      host: this.apiURL,
      body: { query: graphQLQuery },
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.logger.info("queryResponse", { queryResponse });
    if (!isValidShopifySearchResponse(queryResponse)) {
      this.logger.error("Invalid Shopify search response", { response: queryResponse });
      return;
    }

    const products = queryResponse.data.products.edges.map((edge) => edge.node);

    this.logger.info("products", { products });
    if (products.length === 0) {
      this.logger.error("Shopify search returned no products", { query });
      return;
    }

    const fuzzResults = this.fuzzyFilter<ShopifyProductNode>(query, products);
    this.logger.info("fuzzResults", { query, products, fuzzResults });

    return this.initProductBuilders(fuzzResults.slice(0, limit));
  }

  /**
   * Initialize product builders from Shopify GraphQL search response data.
   * Transforms Shopify product nodes into ProductBuilder instances, handling:
   * - Basic product information (title, URL, supplier)
   * - Pricing via parsePrice for proper currency detection
   * - Product descriptions
   * - SKU and product IDs
   * - Quantity parsing from SKU, title, and description fields
   * - Variant mapping with price and weight information
   *
   * @param results - Array of Shopify product nodes from search results
   * @returns Array of ProductBuilder instances initialized with Shopify product data
   * @source
   */
  protected initProductBuilders(results: ShopifyProductNode[]): ProductBuilder<Product>[] {
    return mapDefined(results, (product) => {
      const firstVariantEdge = product.variants.edges[0];
      if (!firstVariantEdge) return;

      const firstVariant = firstVariantEdge.node;
      const parsedPrice = parsePrice(`$${firstVariant.price.amount}`);
      if (!parsedPrice) return;

      const builder = new ProductBuilder<Product>(this.baseURL);

      builder
        .setBasicInfo(product.title, product.onlineStoreUrl, this.supplierName)
        .setPricing(parsedPrice)
        .setDescription(product.description)
        .setSku(firstVariant.sku)
        .setID(product.id);

      const quantity = firstMap(parseQuantity, [
        firstVariant.sku,
        product.title,
        product.description,
      ]);

      if (quantity) {
        builder.setQuantity(quantity.quantity, quantity.uom);
      } else {
        builder.setQuantity(1, UOM.EA);
      }

      for (const variantEdge of product.variants.edges) {
        const variant = variantEdge.node;
        const variantPrice = parsePrice(`$${variant.price.amount}`);

        builder.addVariant({
          title: variant.title,
          sku: variant.sku,
          price: variantPrice?.price,
          ...firstMap(parseQuantity, [variant.sku, variant.title]),
        });
      }

      return builder;
    });
  }

  /**
   * Returns the product builder as-is since all product data is available from the search response.
   * Wrapped in getProductDataWithCache for caching support.
   *
   * @param product - The product builder to return
   * @returns Promise resolving to the product builder or void
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => builder);
  }

  /**
   * Selects the title of a product from the Shopify search response for fuzzy matching.
   *
   * @param data - Shopify product node from search response
   * @returns The title of the product
   * @source
   */
  protected titleSelector(data: ShopifyProductNode): string {
    return data.title;
  }
}
