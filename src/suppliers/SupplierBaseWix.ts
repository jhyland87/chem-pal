import { UOM } from "@/constants/common";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { findFormulaInHtml } from "@/helpers/science";
import { firstMap, htmlToAscii, mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import { isParsedPrice } from "@/utils/typeGuards/common";
import { isValidVariant } from "@/utils/typeGuards/productbuilder";
import { isProductItem, isProductSelection, isValidSearchResponse } from "@/utils/typeGuards/wix";
import SupplierBase from "./SupplierBase";
/**
 * SupplierBaseWix class that extends SupplierBase and implements AsyncIterable<Product>.
 * @abstract
 * @category Suppliers
 * @source
 */
export default abstract class SupplierBaseWix
  extends SupplierBase<ProductObject, Product>
  implements ISupplier
{
  /** Display name of the supplier */
  public abstract readonly supplierName: string;

  /** Base URL for all API requests */
  public abstract readonly baseURL: string;

  /** Access token for Wix API authentication */
  protected accessToken: string = "";

  /** Default values for products */
  protected productDefaults = {
    uom: UOM.EA,
    quantity: 1,
    currencyCode: "USD",
    currencySymbol: "$",
  };

  /**
   * Sets up the Wix API access by retrieving and setting the access token.
   * This method must be called before making any API requests.
   * @returns Promise that resolves when the access token is set
   * @example
   * ```typescript
   * await this.setup();
   * // Now the access token is set and API requests can be made
   * ```
   * @source
   */
  protected async setup(): Promise<void> {
    const accessTokenResponse = await fetch(`${this.baseURL}/_api/v1/access-tokens`, {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.5",
        "cache-control": "no-cache",
        pragma: "no-cache",
        priority: "u=1, i",
        referer: this.baseURL,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      },
    });

    const data = await accessTokenResponse.json();
    this.accessToken = data.apps["1380b703-ce81-ff05-f115-39571d94dfcd"].instance;
    this.headers = {
      ...this.headers,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Authorization: this.accessToken,
    };
  }

  /**
   * Gets the GraphQL query for fetching filtered products from the Wix API.
   * The query includes product details like ID, options, price, stock status, etc.
   * @returns The GraphQL query string
   * @example
   * ```typescript
   * const query = this.getGraphQLQuery();
   * // Use the query with variables to fetch products
   * const response = await this.httpGetJson({
   *   path: "_api/wix-ecommerce-storefront-web/api",
   *   params: { q: query, v: variables }
   * });
   * ```
   * @source
   */
  protected getGraphQLQuery(): string {
    return `
    query,getFilteredProductsWithHasDiscount(
        $mainCollectionId: String!
        $filters: ProductFilters
        $sort: ProductSort
        $offset: Int
        $limit: Int
        $withOptions: Boolean = false
        $withPriceRange: Boolean = false
      ) {
        catalog {
          category(categoryId: $mainCollectionId) {
            numOfProducts
            productsWithMetaData(
              filters: $filters
              limit: $limit
              sort: $sort
              offset: $offset
              onlyVisible: true
            ) {
              totalCount
              list {
                id
                options {
                  id
                  key
                  title @include(if: $withOptions)
                  optionType @include(if: $withOptions)
                  selections @include(if: $withOptions) {
                    id
                    value
                    description
                    key
                    inStock
                  }
                }
                productItems @include(if: $withOptions) {
                  id
                  optionsSelections
                  price
                  formattedPrice
                }
                productType
                price
                sku
                isInStock
                urlPart
                formattedPrice
                name
                description
                brand
                priceRange(withSubscriptionPriceRange: true) @include(if: $withPriceRange) {
                  fromPriceFormatted
                }
              }
            }
          }
        }
      }
    `;
  }

  /**
   * Get the GraphQL variables for the Wix API
   *
   * @param query - The query to search for
   * @returns The GraphQL variables
   * @source
   */
  protected getGraphQLVariables(query: string): GraphQLQueryVariables {
    return {
      mainCollectionId: "00000000-000000-000000-000000000001",
      offset: 0,
      limit: 150,
      sort: null,
      filters: {
        term: {
          field: "name",
          op: "CONTAINS",
          values: [`*${query}*`],
        },
      },
      withOptions: true,
      withPriceRange: false,
    } satisfies GraphQLQueryVariables;
  }

  /**
   * Query products from the Wix API
   *
   * @param query - The query to search for
   * @param limit - The limit of products to return
   * @returns A promise that resolves when the products are queried
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const graphQLQuery = this.getGraphQLQuery();

    const graphQLVariables = this.getGraphQLVariables(query);

    const searchRequest = await this.httpGetJson({
      path: "_api/wix-ecommerce-storefront-web/api",
      params: {
        o: "getFilteredProducts",
        s: "WixStoresWebClient",
        q: graphQLQuery,
        v: JSON.stringify(graphQLVariables),
      },
    });

    if (isValidSearchResponse(searchRequest) === false) {
      throw new Error(`Invalid or empty Wix query response for ${query}`, {
        cause: {
          searchRequest,
          graphQLQuery,
          graphQLVariables,
          query,
          supplier: this.supplierName,
        },
      });
    }

    const fuzzResults = this.fuzzyFilter<ProductObject>(
      query,
      searchRequest.data.catalog.category.productsWithMetaData.list,
    );

    this.logger.info("fuzzResults", {
      query,
      productResults: searchRequest.data.catalog.category.productsWithMetaData.list,
      fuzzResults,
    });

    return this.initProductBuilders(fuzzResults.slice(0, limit));
  }

  /**
   * Initialize product builders from Wix search response data.
   * Transforms Wix product objects into ProductBuilder instances, handling:
   * - Basic product information (name, URL, supplier)
   * - Pricing information with currency details
   * - Product descriptions
   * - Product IDs and SKUs
   * - CAS number extraction from product text
   * - Complex variant handling:
   *   - Merges product items with their price and quantity information
   *   - Processes product selections for variant options
   *   - Handles multiple variant attributes and their values
   *
   * @param results - Array of Wix product objects from search results
   * @returns Array of ProductBuilder instances initialized with Wix product data
   * @example
   * ```typescript
   * const results = await this.queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this.initProductBuilders(results);
   *   // Each builder contains parsed product data from Wix
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log(product.title, product.price, product.variants);
   *   }
   * }
   * ```
   * @source
   */
  protected initProductBuilders(results: ProductObject[]): ProductBuilder<Product>[] {
    return mapDefined(results, (product) => {
      if (!product.price) {
        return;
      }

      // Build selectionId -> parsed quantity map across ALL options.
      const selectionIndex = new Map<number, ReturnType<typeof parseQuantity>>();
      for (const option of product.options ?? []) {
        for (const selection of option.selections ?? []) {
          if (!isProductSelection(selection)) {
            this.logger.warn("Invalid product selection:", { selection });
            continue;
          }
          const parsed = parseQuantity(selection.value);
          if (parsed) {
            selectionIndex.set(selection.id, parsed);
          }
        }
      }

      // Track which selection IDs are covered by explicit productItems.
      const coveredSelectionIds = new Set<number>();

      // Resolve explicit productItems first.
      const productVariants = mapDefined(product.productItems, (item: ProductItem) => {
        if (!isProductItem(item)) {
          this.logger.warn("Invalid product item:", { item });
          return;
        }

        const parsedPrice = parsePrice(item.formattedPrice ?? product.formattedPrice);
        if (!isParsedPrice(parsedPrice)) {
          return;
        }

        const resolvedQuantities = mapDefined(item.optionsSelections ?? [], (selectionId) => {
          coveredSelectionIds.add(selectionId);
          return selectionIndex.get(selectionId);
        });

        const quantityInfo = resolvedQuantities.find((q) => q && "uom" in q);
        if (!quantityInfo) {
          return;
        }

        return {
          ...parsedPrice,
          ...quantityInfo,
          id: item.id,
        };
      });

      // Synthesize the implicit default variant from the parent price.
      // Wix omits the default variant from productItems, so any selection
      // that wasn't covered above represents the parent's price point.
      const parentParsedPrice = parsePrice(product.formattedPrice);
      if (isParsedPrice(parentParsedPrice)) {
        for (const option of product.options ?? []) {
          for (const selection of option.selections ?? []) {
            if (coveredSelectionIds.has(selection.id)) continue;
            const quantityInfo = selectionIndex.get(selection.id);
            if (!quantityInfo || !("uom" in quantityInfo)) continue;

            productVariants.push({
              ...parentParsedPrice,
              ...quantityInfo,
              id: `${product.id}:${selection.id}`, // synthetic — no real Wix variant ID
            });
            coveredSelectionIds.add(selection.id);
          }
        }
      }

      // Sort variants by quantity within the same UOM, falling back to price.
      productVariants.sort((a, b) => {
        if (a.uom === b.uom) return a.quantity - b.quantity;
        return a.price - b.price;
      });

      if (!isParsedPrice(parentParsedPrice)) {
        return;
      }

      // The parent's own quantity/uom should come from the variant whose
      // price matches the parent price, not just the first variant.
      const parentVariant =
        productVariants.find((v) => v.price === parentParsedPrice.price) ?? productVariants[0];

      if (!parentVariant || !("quantity" in parentVariant) || !("uom" in parentVariant)) {
        return;
      }

      const builder = new ProductBuilder<Product>(this.baseURL);
      const cas = firstMap(findFormulaInHtml, [product.name, product.description, product.urlPart]);

      return builder
        .setBasicInfo(
          product.name,
          `${this.baseURL}/product-page/${product.urlPart}`,
          this.supplierName,
        )
        .setPricing(
          parentParsedPrice.price,
          parentParsedPrice.currencyCode,
          parentParsedPrice.currencySymbol,
        )
        .setQuantity(parentVariant.quantity, parentVariant.uom)
        .setID(product.id)
        .setCAS(cas ?? "")
        .setSku(product.sku)
        .setDescription(htmlToAscii(product.description))
        .setVariants(productVariants.filter(isValidVariant));
    });
  }

  /**
   * Get the product data from the Wix API
   *
   * @param product - The product to get the data for
   * @returns A promise that resolves to the product data or void if the product has no price
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => builder);
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns - The title of the product
   * @source
   */
  protected titleSelector(data: ProductObject): string {
    return data.name;
  }
}
