import { parsePrice } from "@/helpers/currency";
import { ProductBuilder } from "@/helpers/productBuilder";
import { parseQuantity } from "@/helpers/quantity";
import { type Product, type Variant } from "@/types";
import {
  type GraphQLQueryVariables,
  type ProductItem,
  type ProductObject,
  type ProductSelection,
  type QueryResponse,
} from "@/types/wix";
import merge from "lodash/merge";
//import query from "./queries/getFilteredProductsWithHasDiscount-wix.graphql";
import { findFormulaInHtml } from "@/helpers/science";
import { firstMap } from "@/helpers/utils";
import SupplierBase from "./supplierBase";
/**
 * SupplierBaseWix class that extends SupplierBase and implements AsyncIterable<Product>.
 * @abstract
 * @category Supplier
 * @module SupplierBaseWix
 */
export default abstract class SupplierBaseWix
  extends SupplierBase<ProductObject, Product>
  implements AsyncIterable<Product>
{
  /** Display name of the supplier */
  public abstract readonly supplierName: string;

  /** Base URL for all API requests */
  protected abstract _baseURL: string;

  /** Access token for Wix API authentication */
  protected _accessToken: string = "";

  /** Default values for products */
  protected _productDefaults = {
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
   * await this._setup();
   * // Now the access token is set and API requests can be made
   * ```
   */
  protected async _setup(): Promise<void> {
    const accessTokenResponse = await fetch(`${this._baseURL}/_api/v1/access-tokens`, {
      headers: {
        /* eslint-disable */
        accept: "*/*",
        "accept-language": "en-US,en;q=0.5",
        "cache-control": "no-cache",
        pragma: "no-cache",
        priority: "u=1, i",
        referer: this._baseURL,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        /* eslint-enable */
      },
    });

    const data = await accessTokenResponse.json();
    this._accessToken = data.apps["1380b703-ce81-ff05-f115-39571d94dfcd"].instance;
    this._headers = {
      ...this._headers,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Authorization: this._accessToken,
    };
  }

  /**
   * Typeguard for the QueryResponse type object
   */
  protected _isValidSearchResponse(response: unknown): response is QueryResponse {
    if (typeof response !== "object" || response === null) {
      return false;
    }

    // Check for nested structure existence
    if (
      !("data" in response) ||
      typeof response.data !== "object" ||
      response.data === null ||
      !("catalog" in response.data) ||
      typeof response.data.catalog !== "object" ||
      response.data.catalog === null ||
      !("category" in response.data.catalog) ||
      typeof response.data.catalog.category !== "object" ||
      response.data.catalog.category === null ||
      !("productsWithMetaData" in response.data.catalog.category) ||
      typeof response.data.catalog.category.productsWithMetaData !== "object" ||
      response.data.catalog.category.productsWithMetaData === null
    ) {
      return false;
    }

    const productsData = response.data.catalog.category.productsWithMetaData;

    // Check required properties and their types
    const requiredProps = {
      totalCount: "number",
      list: Array.isArray,
    };

    const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
      if (typeof validator === "string") {
        return (
          key in productsData && typeof productsData[key as keyof typeof productsData] === validator
        );
      }
      return key in productsData && validator((productsData as Record<string, unknown>)[key]);
    });

    if (!hasRequiredProps) return false;

    // Check that list contains valid products
    return (productsData as { list: unknown[] }).list.every((product: unknown) =>
      this._isWixProduct(product),
    );
  }

  /**
   * Type guard for ProductItem
   */
  protected _isProductItem(item: unknown): item is ProductItem {
    if (typeof item !== "object" || item === null) {
      return false;
    }

    const requiredProps = {
      id: "string",
      formattedPrice: "string",
      price: "number",
      optionsSelections: Array.isArray,
    };

    const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
      if (typeof validator === "string") {
        return key in item && typeof item[key as keyof typeof item] === validator;
      }
      return key in item && validator(item[key as keyof typeof item]);
    });

    if (!hasRequiredProps) return false;

    // Check that optionsSelections is a non-empty array
    return (item as ProductItem).optionsSelections.length > 0;
  }

  /**
   * Type guard for ProductSelection
   */
  protected _isProductSelection(selection: unknown): selection is ProductSelection {
    if (typeof selection !== "object" || selection === null) {
      return false;
    }

    const requiredProps = {
      id: (val: unknown) => typeof val === "string" || typeof val === "number",
      value: "string",
      description: "string",
      key: "string",
      inStock: (val: unknown) => typeof val === "boolean" || val === null,
    };

    return Object.entries(requiredProps).every(([key, validator]) => {
      if (typeof validator === "string") {
        return key in selection && typeof selection[key as keyof typeof selection] === validator;
      }
      return key in selection && validator(selection[key as keyof typeof selection]);
    });
  }

  /**
   * Type guard for ProductObject
   */
  protected _isWixProduct(product: unknown): product is ProductObject {
    if (typeof product !== "object" || product === null) {
      return false;
    }

    const requiredProps = {
      price: "number",
      formattedPrice: "string",
      name: "string",
      urlPart: "string",
      productItems: Array.isArray,
      options: Array.isArray,
    };

    const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
      if (typeof validator === "string") {
        return key in product && typeof product[key as keyof typeof product] === validator;
      }
      return key in product && validator(product[key as keyof typeof product]);
    });

    if (!hasRequiredProps) return false;

    // Check product items
    const productItems = (product as ProductObject).productItems;
    if (!productItems.every((item) => this._isProductItem(item))) {
      return false;
    }

    // Check options and selections if they exist
    const options = (product as ProductObject).options;
    if (
      options.length > 0 &&
      !options[0]?.selections?.every((selection) => this._isProductSelection(selection))
    ) {
      return false;
    }

    return true;
  }

  /**
   * Gets the GraphQL query for fetching filtered products from the Wix API.
   * The query includes product details like ID, options, price, stock status, etc.
   * @returns The GraphQL query string
   * @example
   * ```typescript
   * const query = this._getGraphQLQuery();
   * // Use the query with variables to fetch products
   * const response = await this._httpGetJson({
   *   path: "_api/wix-ecommerce-storefront-web/api",
   *   params: { q: query, v: variables }
   * });
   * ```
   */
  protected _getGraphQLQuery(): string {
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
   * @param limit - The limit of products to return
   * @returns The GraphQL variables
   */
  protected _getGraphQLVariables(
    query: string,
    limit: number = this._limit,
  ): GraphQLQueryVariables {
    return {
      mainCollectionId: "00000000-000000-000000-000000000001",
      offset: 0,
      limit: limit,
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
  protected async _queryProducts(
    query: string,
    limit: number = this._limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const q = this._getGraphQLQuery();

    const v = this._getGraphQLVariables(query, limit);

    const queryResponse = await this._httpGetJson({
      path: "_api/wix-ecommerce-storefront-web/api",
      params: {
        o: "getFilteredProducts",
        s: "WixStoresWebClient",
        q,
        v: JSON.stringify(v),
      },
    });

    if (this._isValidSearchResponse(queryResponse) === false) {
      throw new Error(`Invalid or empty Wix query response for ${query}`);
    }

    return this._initProductBuilders(
      queryResponse.data.catalog.category.productsWithMetaData.list.slice(0, limit),
    );
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
   * const results = await this._queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this._initProductBuilders(results);
   *   // Each builder contains parsed product data from Wix
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log(product.title, product.price, product.variants);
   *   }
   * }
   * ```
   */
  protected _initProductBuilders(results: ProductObject[]): ProductBuilder<Product>[] {
    return results
      .map((product) => {
        if (!product.price) {
          return;
        }

        // Generate an object with the products UUID and formatted price, with the option ID as the keys
        const productItems = Object.fromEntries(
          product.productItems
            .map((item: ProductItem) => {
              if (!this._isProductItem(item)) {
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
              if (!this._isProductSelection(selection)) {
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

        const builder = new ProductBuilder<Product>(this._baseURL);

        const cas = firstMap(findFormulaInHtml, [
          product.name,
          product.description,
          product.urlPart,
        ]);

        builder
          .setBasicInfo(
            product.name,
            `${this._baseURL}/product-page/${product.urlPart}`,
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
  protected async _getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return product;
  }
}
