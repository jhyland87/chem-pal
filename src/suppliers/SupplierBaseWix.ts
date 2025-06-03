import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { findFormulaInHtml } from "@/helpers/science";
import { firstMap } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import { isProductItem, isProductSelection, isValidSearchResponse } from "@/utils/typeGuards/wix";
import merge from "lodash/merge";
import SupplierBase from "./SupplierBase";
/**
 * SupplierBaseWix class that extends SupplierBase and implements AsyncIterable<Product>.
 * @abstract
 * @category Suppliers
 */
export default abstract class SupplierBaseWix
  extends SupplierBase<ProductObject, Product>
  implements AsyncIterable<Product>
{
  /** Display name of the supplier */
  public abstract readonly supplierName: string;

  /** Base URL for all API requests */
  protected abstract baseURL: string;

  /** Access token for Wix API authentication */
  protected accessToken: string = "";

  /** Default values for products */
  protected productDefaults = {
    uom: "ea",
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
   */
  protected async setup(): Promise<void> {
    const accessTokenResponse = await fetch(`${this.baseURL}/_api/v1/access-tokens`, {
      headers: {
        /* eslint-disable */
        accept: "*/*",
        "accept-language": "en-US,en;q=0.5",
        "cache-control": "no-cache",
        pragma: "no-cache",
        priority: "u=1, i",
        referer: this.baseURL,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        /* eslint-enable */
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
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const q = this.getGraphQLQuery();

    const v = this.getGraphQLVariables(query);

    const queryResponse = await this.httpGetJson({
      path: "_api/wix-ecommerce-storefront-web/api",
      params: {
        o: "getFilteredProducts",
        s: "WixStoresWebClient",
        q,
        v: JSON.stringify(v),
      },
    });

    if (isValidSearchResponse(queryResponse) === false) {
      throw new Error(`Invalid or empty Wix query response for ${query}`);
    }

    const fuzzResults = this.fuzzyFilter<ProductObject>(
      query,
      queryResponse.data.catalog.category.productsWithMetaData.list,
    );

    this.logger.info("fuzzResults:", fuzzResults);

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
   */
  protected initProductBuilders(results: ProductObject[]): ProductBuilder<Product>[] {
    return results
      .map((product) => {
        if (!product.price) {
          return;
        }

        // Generate an object with the products UUID and formatted price, with the option ID as the keys
        const productItems = Object.fromEntries(
          product.productItems
            .map((item: ProductItem) => {
              if (!isProductItem(item)) {
                console.warn("Invalid product item:", item);
                return [];
              }
              return [
                item.optionsSelections[0],
                {
                  ...parsePrice(item.formattedPrice),
                  id: item.id,
                  quantity: item.price,
                },
              ];
            })
            .filter((entry) => entry.length > 0),
        );

        // Generate an object with the product quantity selections and the product selection ID
        const productSelections = Object.fromEntries(
          product.options[0].selections
            .map((selection: ProductSelection) => {
              if (!isProductSelection(selection)) {
                console.warn("Invalid product selection:", selection);
                return [];
              }
              return [selection.id, parseQuantity(selection.value)];
            })
            .filter((entry) => entry.length > 0),
        );

        const productVariants = merge(productItems, productSelections);
        const productPrice = parsePrice(product.formattedPrice);

        if (!productPrice) {
          return;
        }

        const firstVariant = productVariants[Object.keys(productVariants)[0]];
        if (!firstVariant || !("quantity" in firstVariant) || !("uom" in firstVariant)) {
          return;
        }

        const builder = new ProductBuilder<Product>(this.baseURL);

        const cas = firstMap(findFormulaInHtml, [
          product.name,
          product.description,
          product.urlPart,
        ]);

        builder
          .setBasicInfo(
            product.name,
            `${this.baseURL}/product-page/${product.urlPart}`,
            this.supplierName,
          )
          .setPricing(productPrice.price, productPrice.currencyCode, productPrice.currencySymbol)
          .setQuantity(firstVariant.quantity, firstVariant.uom)
          .setId(product.id)
          .setCAS(cas ?? "")
          .setSku(product.sku)
          .setDescription(product.description)
          .setVariants(Object.values(productVariants) as unknown as Variant[]);

        return builder;
      })
      .filter((builder) => builder !== undefined);
  }

  /**
   * Get the product data from the Wix API
   *
   * @param product - The product to get the data for
   * @returns A promise that resolves to the product data or void if the product has no price
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
   */
  protected titleSelector(data: ProductObject): string {
    return data.name as string;
  }
}
