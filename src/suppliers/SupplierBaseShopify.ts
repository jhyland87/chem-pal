import { UOM } from "@/constants/common";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { firstMap, mapDefined } from "@/helpers/utils";
import searchProductsQuery from "@/queries/shopify-product-query.gql";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { translateAstToShopifyQuery } from "@/utils/search-query/translators/translateAstToShopifyQuery";
import { isQuantityObject } from "@/utils/typeGuards/common";
import { isValidShopifySearchResponse } from "@/utils/typeGuards/shopify";
import { print } from "graphql";
import { SupplierBase } from "./SupplierBase";

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
export abstract class SupplierBaseShopify
  extends SupplierBase<ShopifyProductNode, Product>
  implements ISupplier
{
  /** Shopify GraphQL API version */
  protected apiVersion: string = "2026-04";

  // Shopify's search DSL supports AND/OR/NOT, so advanced queries are translated
  // server-side instead of using the keyword-only fallback.
  protected readonly supportsNativeAdvancedSearch: boolean = true;

  /**
   * Derives the unique product key from a Shopify product node: its globally
   * unique GraphQL id (e.g. `gid://shopify/Product/5710116421799`). Stable
   * regardless of `onlineStoreUrl` (which can be null for unpublished products).
   * @param data - The raw Shopify product node
   * @returns The product's gid
   * @example
   * ```typescript
   * this.getUniqueProductKey(node); // "gid://shopify/Product/5710116421799"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: ShopifyProductNode): string {
    return String(data.id);
  }

  /**
   * Builds the GraphQL variables for the `searchProducts` query. The query text itself lives in
   * `@/queries/shopify-product-query.gql`; only the title search filter and page size vary.
   *
   * @param query - The search term to match against product titles
   * @param limit - Maximum number of products to return
   * @returns The GraphQL variables for the products query
   * @example
   * ```typescript
   * const variables = this.getGraphQLVariables("gold", 200);
   * // Returns { query: "title:*gold*", first: 200 }
   * ```
   * @source
   */
  protected getGraphQLVariables(query: string, limit: number): ShopifyQueryVariables {
    const parsed = this.getAst();
    const queryString = parsed.isAdvanced
      ? translateAstToShopifyQuery(parsed.ast)
      : `title:*${query}*`;
    return { query: queryString, first: limit };
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
    // The .gql import is a parsed DocumentNode (vite-plugin-graphql-loader); the Shopify endpoint
    // wants the raw query text, so print it and pass the variables alongside. The `first` over-fetch
    // (200) gives the fuzzy filter a wide candidate pool before slicing back down to `limit`.
    const graphQLQuery = print(searchProductsQuery);
    const graphQLVariables = this.getGraphQLVariables(query, 200);
    this.logger.debug("graphQLQuery", graphQLQuery);
    this.logger.debug("apiURL", this.apiURL);
    this.logger.debug("apiVersion", this.apiVersion);
    this.logger.debug("body", { query: graphQLQuery, variables: graphQLVariables });
    this.logger.debug("headers", { "Content-Type": "application/json" });

    const searchRequest = await this.httpPostJson({
      path: `/api/${this.apiVersion}/graphql.json`,
      host: this.apiURL,
      body: { query: graphQLQuery, variables: graphQLVariables },
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.logger.debug("searchRequest", { searchRequest });
    if (!isValidShopifySearchResponse(searchRequest)) {
      this.logger.error("Invalid Shopify search response", { response: searchRequest });
      throw new Error("Invalid Shopify search response", { cause: { searchRequest } });
      //return;
    }

    const products = searchRequest.data.products.edges.map((edge) => edge.node);

    if (products.length === 0) {
      this.logger.warn("Shopify search returned no products", { query });
      return;
    }

    this.logger.debug(`Query returned ${products.length} products`, { products });

    const fuzzResults = this.fuzzyFilterAst<ShopifyProductNode>(products);
    this.logger.debug("fuzzResults", { query, searchRequest, products, fuzzResults });

    return this.initProductBuilders(fuzzResults.slice(0, limit));
  }

  /**
   * Initialize product builders from Shopify GraphQL search response data.
   * Transforms Shopify product nodes into ProductBuilder instances, handling:
   * - Extracting the "Default Title" variant as the primary product data (price, SKU, quantity),
   *   falling back to the first variant if no "Default Title" variant exists
   * - Excluding the "Default Title" variant from the variants list
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
      const defaultVariantIndex = product.variants.edges.findIndex(
        (edge) => edge.node.title === "Default Title",
      );
      const primaryVariant =
        defaultVariantIndex !== -1
          ? product.variants.edges[defaultVariantIndex].node
          : product.variants.edges[0]?.node;

      if (!primaryVariant) return;
      this.logger.debug("primaryVariant", { primaryVariant });

      const parsedPrice = parsePrice(`$${primaryVariant.price.amount}`);
      if (!parsedPrice) return;

      const builder = new ProductBuilder<Product>(this.baseURL);

      builder
        .setBasicInfo(product.title, product.onlineStoreUrl, this.supplierName)
        .setPricing(parsedPrice)
        .setDescription(product.description)
        .setSku(primaryVariant.sku)
        .setID(product.id)
        .setCacheKey(this.getUniqueProductKey(product));

      const parseableQuantityStrings = [
        `${primaryVariant.weight} ${primaryVariant.weightUnit}`,
        primaryVariant.sku,
        product.title,
        product.description,
      ];
      this.logger.debug("parseableQuantityStrings", { parseableQuantityStrings });
      const quantity = firstMap(parseQuantity, parseableQuantityStrings);

      if (isQuantityObject(quantity)) {
        builder.setQuantity(quantity.quantity, quantity.uom);
      } else {
        this.logger.warn("Failed to parse quantity from primary variant, defaulting to 1 EA", {
          parseableQuantityStrings,
          quantity,
          builder,
          product,
        });

        builder.setQuantity(1, UOM.EA);
      }

      const remainingVariants = product.variants.edges.filter(
        (_edge, index) => index !== defaultVariantIndex,
      );

      for (const variantEdge of remainingVariants) {
        const variant = variantEdge.node;
        if (!variant.price.amount) continue;
        const variantPrice = parsePrice(`$${variant.price.amount}`);

        const quantity = firstMap(parseQuantity, [
          `${variant.weight} ${variant.weightUnit}`,
          variant.sku,
          variant.title,
        ]);

        builder.addVariant({
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          price: variantPrice?.price,
          ...(isQuantityObject(quantity) ? quantity : { quantity: 1, uom: UOM.EA }),
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
