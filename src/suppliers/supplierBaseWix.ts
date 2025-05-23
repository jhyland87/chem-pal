import { parsePrice } from "helpers/currency";
import { parseQuantity } from "helpers/quantity";
import merge from "lodash/merge";
import { Product, Variant } from "types";
import { ProductItem, ProductObject, ProductSelection, QueryResponse } from "types/wix";
import { ProductBuilder } from "./productBuilder";
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
   * Typeguarding for the QueryResponse type object
   * @param response - The response to check
   * @returns True if the response is a Wix query response, false otherwise
   */
  protected _isValidSearchResponse(response: unknown): response is QueryResponse {
    if (typeof response !== "object" || response === null) return false;

    return (
      (response as QueryResponse).data?.catalog?.category?.productsWithMetaData?.list !== undefined
    );
  }

  /**
   * Typeguarding for the ProductObject type object
   *
   * @param product - The product to check
   * @returns True if the product is a Wix product, false otherwise
   */
  protected _isWixProduct(product: unknown): product is ProductObject {
    return typeof product === "object" && product !== null && "price" in product;
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
    return "query,getFilteredProductsWithHasDiscount($mainCollectionId:String!,$filters:ProductFilters,$sort:ProductSort,$offset:Int,$limit:Int,$withOptions:Boolean,=,false,$withPriceRange:Boolean,=,false){catalog{category(categoryId:$mainCollectionId){numOfProducts,productsWithMetaData(filters:$filters,limit:$limit,sort:$sort,offset:$offset,onlyVisible:true){totalCount,list{id,options{id,key,title,@include(if:$withOptions),optionType,@include(if:$withOptions),selections,@include(if:$withOptions){id,value,description,key,inStock}}productItems,@include(if:$withOptions){id,optionsSelections,price,formattedPrice}productType,price,sku,isInStock,urlPart,formattedPrice,name,description,brand,priceRange(withSubscriptionPriceRange:true),@include(if:$withPriceRange){fromPriceFormatted}}}}}}";
  }

  /**
   * Get the GraphQL variables for the Wix API
   *
   * @param query - The query to search for
   * @param limit - The limit of products to return
   * @returns The GraphQL variables
   */
  protected _getGraphQLVariables(query: string, limit: number = this._limit): string {
    return `{"mainCollectionId":"00000000-000000-000000-000000000001","offset":0,"limit":${limit},"sort":null,"filters":{"term":{"field":"name","op":"CONTAINS","values":["*${query}*"]}},"withOptions":true,"withPriceRange":false}`;
  }

  /**
   * Query products from the Wix API
   *
   * @param query - The query to search for
   * @param limit - The limit of products to return
   * @returns A promise that resolves when the products are queried
   */
  protected async _queryProducts(query: string): Promise<ProductObject[]> {
    const q = this._getGraphQLQuery();

    const v = this._getGraphQLVariables(query);

    const queryResponse = await this._httpGetJson({
      path: "_api/wix-ecommerce-storefront-web/api",
      params: {
        o: "getFilteredProducts",
        s: "WixStoresWebClient",
        q,
        v,
      },
    });

    console.debug("queryResponse:", queryResponse);

    if (this._isValidSearchResponse(queryResponse) === false) {
      throw new Error(`Invalid or empty Wix query response for ${this._query}`);
    }

    return queryResponse.data.catalog.category.productsWithMetaData.list;
  }

  /**
   * Get the product data from the Wix API
   *
   * @param product - The product to get the data for
   * @returns A promise that resolves to the product data or void if the product has no price
   */
  protected async _getProductData(product: ProductObject): Promise<Partial<Product> | void> {
    if (!product.price) {
      return;
    }

    // Generate an object with the products UUID and formatted price, with the option ID as the keys
    const productItems = Object.fromEntries(
      product.productItems.map((item: ProductItem) => {
        return [
          item.optionsSelections[0],
          {
            ...parsePrice(item.formattedPrice),
            id: item.id,
            quantity: item.price,
          },
        ];
      }),
    );

    // Generate an object with the product quantity selections and the product selection ID
    // as the primary keys (to associate with the above object)
    const productSelections = Object.fromEntries(
      // I know the options is an array that could have more than one object, but it looks like it's
      // always the first one (and I don't see a second one anyways)
      product.options[0].selections.map((selection: ProductSelection) => {
        return [selection.id, parseQuantity(selection.value)];
      }),
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

    const builder = new ProductBuilder(this._baseURL);
    return builder
      .setBasicInfo(
        product.name,
        `${this._baseURL}/product-page/${product.urlPart}`,
        this.supplierName,
      )
      .setPricing(productPrice.price, productPrice.currencyCode, productPrice.currencySymbol)
      .setQuantity(firstVariant.quantity, firstVariant.uom)
      .setDescription(product.description || "")
      .build()
      .then((product) => {
        if (product) {
          return {
            ...product,
            variants: Object.values(productVariants) as unknown as Variant[],
          };
        }
        return product;
      });
  }
}
