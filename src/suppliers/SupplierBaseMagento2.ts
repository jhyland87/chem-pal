import { UOM } from "@/constants/common";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { findFormulaInHtml } from "@/helpers/science";
import { firstMap, mapDefined } from "@/helpers/utils";
import searchProductsQuery from "@/queries/magento2-product-query.gql";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { extractAllPositiveTerms } from "@/utils/search-query/extractPositiveTerms";
import { isQuantityObject } from "@/utils/typeGuards/common";
import { isValidMagento2SearchResponse } from "@/utils/typeGuards/magento2";
import { print } from "graphql";
import { SupplierBase } from "./SupplierBase";

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
export abstract class SupplierBaseMagento2
  extends SupplierBase<Magento2ProductItem, Product>
  implements ISupplier
{
  /** Magento store code passed via the `Store` request header (selects locale/storefront) */
  protected storeCode: string = "us_en";

  /** Path to the Magento 2 GraphQL endpoint, relative to {@link baseURL} */
  protected graphQLPath: string = "/graphql";

  protected limit: number = 50;

  // Magento storefronts (e.g. AladdinSci) rate-limit (HTTP 429) bursts of product-page requests.
  // The SupplierBase default cadence (3 concurrent, 100ms apart) triggered frequent 429s in
  // testing — the rejections clustered exactly where 3 requests fired at once. Throttle harder
  // here: at most 2 detail fetches in flight, spaced >=350ms apart. The escalating 429 backoff
  // remains as a safety net for any stragglers.
  protected maxConcurrentRequests: number = 2;
  protected minConcurrentCycle: number = 350;

  // Cap the total search time. The throttled, 429-prone detail phase can otherwise drag on when
  // the server keeps rate-limiting; once this elapses, outstanding requests are aborted and only
  // the products collected so far are returned. Tune per Magento supplier as needed.
  protected maxAllowableSearchTime: number = 45_000;

  // Magento's `products(search:)` full-text field is OR-ish across words, which is a good
  // candidate pool for an advanced query in a SINGLE request — Magento's structured `filter`
  // (ProductAttributeFilterInput) can't express arbitrary name-substring OR/NOT (its `in` is
  // exact-match, same-field conditions AND). So we hand the positive terms to `search` and let
  // the client-side `fuzzyFilterAst` enforce the exact AND/OR/NOT predicate, rather than the
  // keyword-only multi-request fallback.
  protected readonly supportsNativeAdvancedSearch: boolean = true;

  /**
   * Builds the GraphQL variables for the `searchProducts` query. The query text itself lives in
   * `@/queries/magento2-product-query.gql`; only the search term and page size vary per request.
   *
   * For an advanced (boolean) query, the `search` term is the space-joined set of positive terms
   * (negated branches dropped) so Magento's full-text search returns a broad candidate pool in one
   * request; the precise boolean matching is applied client-side in `queryProducts`.
   *
   * @param query - The search term to match against product names
   * @param limit - Maximum number of products to return on the first page
   * @returns The GraphQL variables for the products query
   * @example
   * ```typescript
   * const variables = this.getGraphQLVariables("sodium", 20);
   * // Returns { search: "sodium", pageSize: 20 }
   * ```
   * @source
   */
  protected getGraphQLVariables(query: string, limit: number): Magento2QueryVariables {
    const parsed = this.getAst();
    const search = parsed.isAdvanced
      ? extractAllPositiveTerms(parsed.ast).join(" ") || query
      : query;
    return { search, pageSize: limit };
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
    // The .gql import is a parsed DocumentNode (vite-plugin-graphql-loader); the Magento 2
    // endpoint wants the raw query text, so print it and pass the variables alongside.
    const graphQLQuery = print(searchProductsQuery);
    const graphQLVariables = this.getGraphQLVariables(query, limit);

    const searchRequest = await this.httpPostJson({
      path: this.graphQLPath,
      body: { query: graphQLQuery, variables: graphQLVariables },
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

    const fuzzResults = this.fuzzyFilterAst<Magento2ProductItem>(items);
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
        .setID(item.uid)
        // The picture is the only new field surfaced from the GraphQL search response; the
        // remaining chemical identifiers are scraped per-supplier in getProductData.
        .setImage(item.image?.url, item.image?.label ?? undefined)
        .setPermalink(`${this.baseURL}/${this.storeCode}/${item.url_key}.html`);

      if (item.stock_status) {
        builder.setAvailability(item.stock_status);
      }

      const descriptionHtml = item.description?.html ?? item.short_description?.html ?? "";
      // setDescription runs htmlToAscii itself, so pass the raw HTML straight through.
      builder.setDescription(descriptionHtml);

      if (isQuantityObject(primary.parsedQuantity)) {
        builder.setQuantity(primary.parsedQuantity.quantity, primary.parsedQuantity.uom);
      } else {
        this.logger.warn("Failed to parse quantity from primary variant, defaulting to 1 EA", {
          primary,
          item,
        });
        builder.setQuantity(1, UOM.EA);
      }

      builder.setCAS(
        firstMap(findFormulaInHtml, [item.name, item.image?.label ?? "", descriptionHtml]),
      );

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
