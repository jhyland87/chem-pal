import { parseQuantity } from "@/helpers/quantity";
import { firstMap } from "@/helpers/utils";
import type { Product } from "@/types";
import type { ItemListing, QueryParams, SearchResponse, ShopifyVariant } from "@/types/shopify";
import { ProductBuilder } from "@/utils/ProductBuilder";
import SupplierBase from "./supplierBase";

/**
 * Base class for Shopify-based suppliers that provides common functionality for
 * interacting with Shopify API endpoints.
 *
 * @remarks
 * I'm pretty sure that there's a different API tht could be used, but I noticed that when I started
 * searching for a product in the search bar, all of the shopify sites were making a call to a
 * `/getresults` endpoint hosted at `searchserverapi.com`. That domain belongs to
 * {@link https://searchanise.io/ | Searchanise}, who provides tracking data and autocomplete
 * functionality for the search feature on the website. There are quite a few query parameters for
 * that page, but the ones we care about most are:
 * - `api_key` - The API key for the search server, this is unique for each supplier.
 * - `q` - The query to search for.
 * - `maxResults` - The maximum number of results to return.
 *
 * - {@link https://searchserverapi.com/getresults?api_key=8B7o0X1o7c&q=acid&maxResults=3 | Query three "Acid" products from LabAlley}
 *
 *
 * The suppliers using this endpoint need literally no custom code at all, with the exception of the
 * `api_key` value being specified.
 * Another possible solution would be the graphql api endpoint, which can be found at
 * `/api/2024-10/graphql.json`. I can use this to query data about specific products, but I don't
 * see that its an more useful than just the searchserveapi results.
 *
 * @module SupplierBaseShopify
 * @category Suppliers
 * @example
 * ```typescript
 * // Crate a new class using the SupplierBaseShopify class
 * export default class SupplierFoobar
 *   extends SupplierBaseShopify
 *   implements AsyncIterable<Product>
 * {
 *   // Name of supplier (for display purposes)
 *   public readonly supplierName: string = "Foobar";
 *
 *   protected _apiKey: string = "<api_key>";
 *
 *   // Base URL for HTTP(s) requests
 *   protected _baseURL: string = "https://www.foobar.com";
 * }
 * ```
 */
export default abstract class SupplierBaseShopify
  extends SupplierBase<ItemListing, Product>
  implements AsyncIterable<Product>
{
  protected _apiKey: string = "";

  protected _apiHost: string = "searchserverapi.com";

  /**
   * Query products from the Shopify API
   *
   * @param query - The query to search for
   * @param limit - The limit of products to return
   * @returns A promise that resolves when the products are queried
   * @example
   * ```typescript
   * // Search for sodium chloride with a limit of 10 results
   * const products = await this._queryProducts("sodium chloride", 10);
   * if (products) {
   *   console.log(`Found ${products.length} products`);
   *   for (const product of products) {
   *     const builtProduct = await product.build();
   *     console.log({
   *       title: builtProduct.title,
   *       price: builtProduct.price,
   *       quantity: builtProduct.quantity,
   *       uom: builtProduct.uom
   *     });
   *   }
   * }
   * ```
   */
  protected async _queryProducts(
    query: string,
    limit: number = this._limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    // curl -s --get https://searchserverapi.com/getresults \
    //   --data-urlencode "api_key=8B7o0X1o7c" \
    //   --data-urlencode "q=sulf" \
    //   --data-urlencode "maxResults=6" \
    //   --data-urlencode "startIndex=0" \
    //   --data-urlencode "items=true" \
    //   --data-urlencode "pages=true" \
    //   --data-urlencode "facets=false" \
    //   --data-urlencode "categories=true" \
    //   --data-urlencode "suggestions=true" \
    //   --data-urlencode "vendors=false" \
    //   --data-urlencode "tags=false" \
    //   --data-urlencode "pageStartIndex=0" \
    //   --data-urlencode "pagesMaxResults=3" \
    //   --data-urlencode "categoryStartIndex=0" \
    //   --data-urlencode "categoriesMaxResults=3" \
    //   --data-urlencode "suggestionsMaxResults=4" \
    //   --data-urlencode "vendorsMaxResults=3" \
    //   --data-urlencode "tagsMaxResults=3" \
    //   --data-urlencode "_=1740051794061" | jq
    const getParams: QueryParams = {
      // Setting the limit here to 1000, since the limit parameter should
      // apply to results returned from Supplier3SChem, not the rquests
      // made by it.
      /* eslint-disable */
      api_key: this._apiKey,
      q: query,
      maxResults: 200,
      startIndex: 0,
      items: true,
      pageStartIndex: 0,
      pagesMaxResults: 1,
      vendorsMaxResults: 200,
      output: "json",
      _: new Date().getTime(),
      ...this._baseSearchParams,
      /* eslint-enable */
    };

    const searchRequest = await this._httpGetJson({
      path: "/getresults",
      host: this._apiHost,
      params: getParams,
    });

    if (!this._isValidSearchResponse(searchRequest)) {
      throw new Error("Invalid search response");
    }

    const fuzzResults = this._fuzzyFilter<ItemListing>(query, searchRequest.items);
    this._logger.info("fuzzResults:", fuzzResults);

    return this._initProductBuilders(fuzzResults.slice(0, limit));
  }

  /**
   * Initialize product builders from Shopify search response data.
   * Transforms Shopify product listings into ProductBuilder instances, handling:
   * - Basic product information (title, link, supplier)
   * - Pricing information in USD
   * - Product descriptions
   * - SKU/product codes
   * - Vendor information
   * - Quantity parsing from multiple fields
   * - Shopify-specific variants with their attributes
   *
   * @param results - Array of Shopify item listings from search results
   * @returns Array of ProductBuilder instances initialized with Shopify product data
   * @example
   * ```typescript
   * const results = await this._queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this._initProductBuilders(results);
   *   // Each builder contains parsed product data from Shopify
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log({
   *       title: product.title,
   *       price: product.price,
   *       quantity: product.quantity,
   *       uom: product.uom,
   *       variants: product.variants
   *     });
   *   }
   * }
   * ```
   */
  protected _initProductBuilders(results: ItemListing[]): ProductBuilder<Product>[] {
    return results
      .map((item) => {
        const builder = new ProductBuilder(this._baseURL);
        builder
          .setBasicInfo(item.title, item.link, this.supplierName)
          .setPricing(parseFloat(item.price), "USD", "$")
          .setDescription(item.description)
          .setSku(item.product_code)
          .setVendor(item.vendor);

        const quantity = firstMap(parseQuantity, [
          item.product_code,
          item.quantity,
          item.title,
          item.description,
        ]);

        if (!quantity) {
          this._logger.warn("Failed to get quantity from retrieved product data:", item);
          return;
        }

        builder.setQuantity(quantity.quantity, quantity.uom);

        if ("shopify_variants" in item && Array.isArray(item.shopify_variants)) {
          item.shopify_variants.forEach((variant) => {
            if (!this._isShopifyVariant(variant)) return;

            const variantQuantity = firstMap(parseQuantity, [
              variant.sku,
              (variant?.options?.Model as string) ?? "",
            ]);

            builder.addVariant({
              id: variant.variant_id,
              sku: variant.sku,
              //title: variant.title,
              price: variant.price,
              title: (variant?.options?.Model as string) ?? "",
              url: variant.link,
              ...variantQuantity,
            });
          });
        }

        return builder;
      })
      .filter((builder): builder is ProductBuilder<Product> => builder !== undefined);
  }

  /**
   * Validates if the response from the search API is a valid SearchResponse object.
   * @param response - The response object to validate
   * @returns True if the response is a valid SearchResponse object, false otherwise
   * @example
   * ```typescript
   * const response = await this._httpGetJson({
   *   path: "/getresults",
   *   params: searchParams
   * });
   *
   * if (this._isValidSearchResponse(response)) {
   *   // Process valid response
   *   console.log(`Found ${response.items.length} items`);
   * } else {
   *   console.error("Invalid search response structure");
   * }
   * ```
   */
  protected _isValidSearchResponse(response: unknown): response is SearchResponse {
    if (typeof response !== "object" || response === null) {
      this._logger.warn("Invalid search response - non object:", response);
      return false;
    }

    const requiredProps = {
      totalItems: "number",
      startIndex: "number",
      itemsPerPage: "number",
      currentItemCount: "number",
      //categoryStartIndex: "number",
      //totalCategories: "number",
      pageStartIndex: "number",
      totalPages: "number",
      suggestions: Array.isArray,
      //categories: Array.isArray,
      pages: Array.isArray,
      items: Array.isArray,
    };

    const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
      if (typeof validator === "string") {
        return key in response && typeof response[key as keyof typeof response] === validator;
      }
      return key in response && validator(response[key as keyof typeof response]);
    });

    if (!hasRequiredProps) {
      this._logger.warn("Invalid search response - missing required properties:", response);
      return false;
    }

    // Check that items array contains valid listings
    const result = (response as SearchResponse).items.every((item) => {
      const isOk = this._isItemListing(item);
      if (!isOk) {
        this._logger.warn("Invalid search response - invalid item:", item);
      }
      return isOk;
    });

    if (!result) {
      this._logger.warn("Invalid search response - invalid items:", response);
      return false;
    }

    return true;
  }

  /**
   * Type guard for ShopifyVariant
   * @param variant - The variant object to validate
   * @returns True if the variant is a valid ShopifyVariant, false otherwise
   * @example
   * ```typescript
   * const variant = {
   *   sku: "CHEM-001",
   *   price: "29.99",
   *   link: "/products/chemical-1",
   *   variant_id: "12345",
   *   quantity_total: "100",
   *   options: {
   *     Model: "500g"
   *   }
   * };
   *
   * if (this._isShopifyVariant(variant)) {
   *   console.log("Valid variant:", variant.sku);
   * } else {
   *   console.error("Invalid variant structure");
   * }
   * ```
   */
  protected _isShopifyVariant(variant: unknown): variant is ShopifyVariant {
    if (typeof variant !== "object" || variant === null) {
      return false;
    }

    const requiredProps = {
      /* eslint-disable */
      sku: "string",
      price: "string",
      link: "string",
      variant_id: "string",
      quantity_total: (val: unknown) => typeof val === "string" || typeof val === "number",
      options: (val: unknown) => typeof val === "object" && val !== null,
      /* eslint-enable */
    };

    const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
      if (typeof validator === "string") {
        return key in variant && typeof variant[key as keyof typeof variant] === validator;
      }
      return key in variant && validator(variant[key as keyof typeof variant]);
    });

    if (!hasRequiredProps) return false;

    // Check options object if it exists
    const options = (variant as ShopifyVariant).options;
    if (typeof options === "undefined") return false;
    /*
    if (options && typeof options === "object") {
      if ("Model" in options && typeof options.Model !== "string") {
        return false;
      }
    }
    */

    return true;
  }

  /**
   * Type guard for ItemListing
   * @param item - The item object to validate
   * @returns True if the item is a valid ItemListing, false otherwise
   * @example
   * ```typescript
   * const item = {
   *   title: "Sodium Chloride",
   *   price: "29.99",
   *   link: "/products/nacl",
   *   product_id: "12345",
   *   product_code: "CHEM-001",
   *   quantity: "500g",
   *   vendor: "Chemical Supplier",
   *   original_product_id: "12345",
   *   list_price: "39.99",
   *   shopify_variants: [
   *     {
   *       sku: "CHEM-001-500G",
   *       price: "29.99",
   *       link: "/products/nacl?variant=1",
   *       variant_id: "1",
   *       quantity_total: "100",
   *       options: {
   *         Model: "500g"
   *       }
   *     }
   *   ]
   * };
   *
   * if (this._isItemListing(item)) {
   *   console.log("Valid item listing:", item.title);
   * } else {
   *   console.error("Invalid item listing structure");
   * }
   * ```
   */
  protected _isItemListing(item: unknown): item is ItemListing {
    if (typeof item !== "object" || item === null) {
      return false;
    }

    const requiredProps = {
      /* eslint-disable */
      title: "string",
      price: (val: unknown) => typeof val === "string" || typeof val === "number",
      link: "string",
      product_id: "string",
      product_code: "string",
      quantity: "string",
      shopify_variants: Array.isArray,
      vendor: "string",
      original_product_id: "string",
      list_price: "string",
      /* eslint-enable */
    };

    const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
      if (typeof validator === "string") {
        return key in item && typeof item[key as keyof typeof item] === validator;
      }
      return key in item && validator(item[key as keyof typeof item]);
    });

    if (!hasRequiredProps) return false;

    // Check that shopify_variants array contains valid variants
    const variants = (item as ItemListing).shopify_variants;
    return variants.every((variant) => {
      const isOk = this._isShopifyVariant(variant);
      if (!isOk) {
        this._logger.warn("Invalid search response - invalid variant:", variant);
      }
      return isOk;
    });
  }

  /**
   * Transforms a Shopify product listing into the common Product type.
   * @param product - The Shopify product listing to transform
   * @returns Promise resolving to a partial Product object or void if invalid
   * @example
   * ```typescript
   * const products = await this._queryProducts("sodium chloride");
   * if (products) {
   *   const product = await this._getProductData(products[0]);
   *   if (product) {
   *     const builtProduct = await product.build();
   *     console.log({
   *       title: builtProduct.title,
   *       price: builtProduct.price,
   *       quantity: builtProduct.quantity,
   *       uom: builtProduct.uom,
   *       variants: builtProduct.variants
   *     });
   *   }
   * }
   * ```
   */
  protected async _getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    if (product instanceof ProductBuilder === false) {
      console.error("Invalid Shopify product listing:", product);
      return;
    }

    return product;
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns - The title of the product
   */
  protected _titleSelector(data: ItemListing): string {
    return data.title;
  }
}
