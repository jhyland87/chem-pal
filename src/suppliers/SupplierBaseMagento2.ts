import { UOM } from "@/constants/common";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { findFormulaInHtml } from "@/helpers/science";
import { firstMap, htmlToAscii, mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import { isQuantityObject } from "@/utils/typeGuards/common";
import { isValidMagento2SearchResponse } from "@/utils/typeGuards/magento2";
import SupplierBase from "./SupplierBase";

/**
 * Internal shape used while normalizing a Magento 2 product's nested variants
 * (Grouped sub-products, Configurable variants, or a synthesized single
 * variant for Simple/unknown product types) before they are written onto a
 * `ProductBuilder`.
 */
interface RawMagento2Variant {
  /** SKU of the variant (typically encodes the size, e.g. "S770339-100g") */
  sku: string;
  /** Display name of the variant */
  name: string;
  /** Numeric variant price in `currency` */
  price: number;
  /** ISO currency code returned by the API for this price */
  currency: string;
}

/**
 * Base class for Magento 2 storefront suppliers that exposes the public
 * unauthenticated GraphQL `products` query.
 *
 * @remarks
 * Querying flows through a single POST to `{baseURL}{graphQLPath}` (default
 * `/graphql`) with `Content-Type: application/json` and a `Store` header
 * (default `"us_en"`) that selects the storefront/locale. The full search
 * response carries every variant the catalog exposes, so `getProductData` is
 * a no-op cache wrapper — there is no separate detail fetch.
 *
 * Subclasses only need to set the standard supplier metadata
 * (`supplierName`, `baseURL`, `shipping`, `country`, `paymentMethods`) and
 * may override `storeCode` if the storefront uses a different locale code.
 *
 * @category Suppliers
 * @example
 * ```typescript
 * // Create a new supplier using the SupplierBaseMagento2 class
 * export default class SupplierMyStore
 *   extends SupplierBaseMagento2
 *   implements ISupplier
 * {
 *   public readonly supplierName: string = "My Store";
 *   public readonly baseURL: string = "https://www.mystore.com";
 *   public readonly shipping: ShippingRange = "domestic";
 *   public readonly country: CountryCode = "US";
 *   public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];
 *   protected storeCode: string = "us_en";
 * }
 * ```
 * @source
 */
export default abstract class SupplierBaseMagento2
  extends SupplierBase<Magento2ProductItem, Product>
  implements ISupplier
{
  /** Magento store code passed via the `Store` request header (selects locale/storefront) */
  protected storeCode: string = "us_en";

  /** Path to the Magento 2 GraphQL endpoint, relative to {@link baseURL} */
  protected graphQLPath: string = "/graphql";

  /**
   * Builds the GraphQL query string for searching products by relevance.
   * Includes the inline fragments required to surface `GroupedProduct` and
   * `ConfigurableProduct` variant data alongside the base product fields.
   *
   * @param query - The search term to match against product names
   * @param limit - Maximum number of products to return on the first page
   * @returns The GraphQL query string
   * @example
   * ```typescript
   * const query = this.getGraphQLQuery("sodium", 20);
   * // Returns a GraphQL query string requesting up to 20 products matching "sodium"
   * ```
   * @source
   */
  protected getGraphQLQuery(query: string, limit: number): string {
    return `{
      products(
        search: "${query}"
        sort: { relevance: DESC }
        pageSize: ${limit}
        currentPage: 1
      ) {
        items {
          __typename
          uid
          sku
          name
          url_key
          url_suffix
          stock_status
          price_range {
            minimum_price { regular_price { value currency } }
          }
          short_description { html }
          description       { html }
          image { label }

          ... on GroupedProduct {
            items {
              product {
                sku
                name
                price_range {
                  minimum_price { regular_price { value currency } }
                }
              }
            }
          }

          ... on ConfigurableProduct {
            variants {
              product {
                sku
                name
                price_range {
                  minimum_price { regular_price { value currency } }
                }
              }
            }
          }
        }
      }
    }`;
  }

  /**
   * Query products from the Magento 2 GraphQL `products` endpoint.
   *
   * @param query - The search term to query for
   * @param limit - The maximum number of products to return
   * @returns A promise that resolves to an array of ProductBuilder instances or void
   * @example
   * ```typescript
   * const products = await this.queryProducts("sodium chloride", 10);
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
    const graphQLQuery = this.getGraphQLQuery(query, 50);

    const searchRequest = await this.httpPostJson({
      path: this.graphQLPath,
      body: { query: graphQLQuery },
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "Content-Type": "application/json",
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Store: this.storeCode,
      },
    });

    this.logger.debug("searchRequest", { searchRequest });
    if (!isValidMagento2SearchResponse(searchRequest)) {
      this.logger.error("Invalid Magento2 search response", { response: searchRequest });
      throw new Error("Invalid Magento2 search response", {
        cause: { searchRequest, query, supplier: this.supplierName },
      });
    }

    const items = searchRequest.data.products.items;

    if (items.length === 0) {
      this.logger.warn("Magento2 search returned no products", { query });
      return;
    }

    this.logger.debug(`Query returned ${items.length} products`, { items });

    const fuzzResults = this.fuzzyFilter<Magento2ProductItem>(query, items);
    this.logger.debug("fuzzResults", { query, items, fuzzResults });

    return this.initProductBuilders(fuzzResults.slice(0, limit));
  }

  /**
   * Collects the variant rows for a Magento 2 product, branching on the
   * `__typename` discriminator. Falls back to a single synthesized variant
   * built from the parent product fields when no nested variants are present
   * (covers `SimpleProduct`, `BundleProduct`, and unknown types).
   *
   * @param item - Magento 2 product item from the search response
   * @returns Array of normalized raw variant rows for the product
   * @example
   * ```typescript
   * const variants = this.collectRawVariants(item);
   * // For a GroupedProduct, returns one entry per `item.items[].product`
   * ```
   * @source
   */
  protected collectRawVariants(item: Magento2ProductItem): RawMagento2Variant[] {
    if (item.__typename === "GroupedProduct" && Array.isArray(item.items)) {
      return mapDefined(item.items, (sub) => {
        const money = sub.product.price_range.minimum_price.regular_price;
        if (typeof money?.value !== "number") return;
        return {
          sku: sub.product.sku,
          name: sub.product.name,
          price: money.value,
          currency: money.currency,
        };
      });
    }

    if (item.__typename === "ConfigurableProduct" && Array.isArray(item.variants)) {
      return mapDefined(item.variants, (variant) => {
        const money = variant.product.price_range.minimum_price.regular_price;
        if (typeof money?.value !== "number") return;
        return {
          sku: variant.product.sku,
          name: variant.product.name,
          price: money.value,
          currency: money.currency,
        };
      });
    }

    const money = item.price_range?.minimum_price?.regular_price;
    if (typeof money?.value !== "number") return [];
    return [
      {
        sku: item.sku,
        name: item.name,
        price: money.value,
        currency: money.currency,
      },
    ];
  }

  /**
   * Initialize product builders from Magento 2 GraphQL search response data.
   * Transforms each Magento 2 product item into a ProductBuilder, handling:
   * - Building the product page URL from `url_key` + `url_suffix`
   * - Collecting variant rows from `items[]` (GroupedProduct), `variants[]`
   *   (ConfigurableProduct), or synthesizing a single row for SimpleProduct
   * - Selecting the lowest-priced variant as the primary (sets the parent's
   *   price + quantity), with the rest pushed via `addVariant`
   * - Parsing quantity from each variant's SKU and name (e.g. "S770339-5g")
   * - Extracting CAS numbers from the product name, image label, and description
   *
   * @param results - Array of Magento 2 product items from search results
   * @returns Array of ProductBuilder instances initialized with Magento 2 product data
   * @example
   * ```typescript
   * const items = searchRequest.data.products.items;
   * const builders = this.initProductBuilders(items);
   * for (const builder of builders) {
   *   const product = await builder.build();
   *   console.log(product.title, product.price, product.variants);
   * }
   * ```
   * @source
   */
  protected initProductBuilders(results: Magento2ProductItem[]): ProductBuilder<Product>[] {
    return mapDefined(results, (item) => {
      const rawVariants = this.collectRawVariants(item);
      if (rawVariants.length === 0) {
        this.logger.warn("Magento2 product had no parseable variants, skipping", { item });
        return;
      }

      const enriched = rawVariants
        .map((raw) => ({
          raw,
          parsedQuantity: firstMap(parseQuantity, [raw.sku, raw.name]),
        }))
        .sort((a, b) => a.raw.price - b.raw.price);

      const primary = enriched[0];
      const productUrl = `${item.url_key}${item.url_suffix ?? ".html"}`;

      const builder = new ProductBuilder<Product>(this.baseURL);

      const primaryPrice =
        parsePrice(`$${primary.raw.price}`) ?? parsePrice(`${primary.raw.price}`);
      if (!primaryPrice) {
        this.logger.warn("Failed to parse primary variant price, skipping product", {
          item,
          primary,
        });
        return;
      }

      builder
        .setBasicInfo(item.name, productUrl, this.supplierName)
        .setPricing(primaryPrice.price, primary.raw.currency, primaryPrice.currencySymbol)
        .setSku(item.sku)
        .setID(item.uid);

      if (item.stock_status) {
        builder.setAvailability(item.stock_status);
      }

      const descriptionHtml = item.description?.html ?? item.short_description?.html ?? "";
      if (descriptionHtml) {
        builder.setDescription(htmlToAscii(descriptionHtml));
      }

      if (isQuantityObject(primary.parsedQuantity)) {
        builder.setQuantity(primary.parsedQuantity.quantity, primary.parsedQuantity.uom);
      } else {
        this.logger.warn("Failed to parse quantity from primary variant, defaulting to 1 EA", {
          primary,
          item,
        });
        builder.setQuantity(1, UOM.EA);
      }

      const cas = firstMap(findFormulaInHtml, [
        item.name,
        item.image?.label ?? "",
        descriptionHtml,
      ]);
      if (cas) {
        builder.setCAS(cas);
      }

      for (const { raw, parsedQuantity } of enriched.slice(1)) {
        builder.addVariant({
          title: raw.name,
          sku: raw.sku,
          price: raw.price,
          ...(isQuantityObject(parsedQuantity)
            ? { quantity: parsedQuantity.quantity, uom: parsedQuantity.uom }
            : { quantity: 1, uom: UOM.EA }),
        });
      }

      return builder;
    });
  }

  /**
   * Returns the product builder as-is since all product data is available from
   * the Magento 2 search response. Wrapped in `getProductDataWithCache` so the
   * unified caching layer is still applied.
   *
   * @param product - The product builder to return
   * @returns Promise resolving to the product builder or void
   * @example
   * ```typescript
   * const enriched = await this.getProductData(builder);
   * if (enriched) {
   *   console.log(await enriched.build());
   * }
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => builder);
  }

  /**
   * Selects the title of a product from the Magento 2 search response for
   * fuzzy matching against the user's query.
   *
   * @param data - Magento 2 product item from search response
   * @returns The title of the product
   * @example
   * ```typescript
   * const title = this.titleSelector(item);
   * // Returns "Sodium iodide"
   * ```
   * @source
   */
  protected titleSelector(data: Magento2ProductItem): string {
    return data.name;
  }
}
