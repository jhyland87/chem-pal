import { ProductBuilder } from "@/helpers/productBuilder";
import { parseQuantity } from "@/helpers/quantity";
import { firstMap } from "@/helpers/utils";
import type { Product, Variant } from "@/types";
import type { ItemListing, QueryParams, SearchResponse, ShopifyVariant } from "@/types/shopify";
import SupplierBase from "./supplierBase";

// https://searchserverapi.com/getresults?
//   api_key=8B7o0X1o7c
//   &q=sulf
//   &maxResults=6
//   &startIndex=0
//   &items=true
//   &pages=true
//   &facets=false
//   &categories=true
//   &suggestions=true
//   &vendors=false
//   &tags=false
//   &pageStartIndex=0
//   &pagesMaxResults=3
//   &categoryStartIndex=0
//   &categoriesMaxResults=3
//   &suggestionsMaxResults=4
//   &vendorsMaxResults=3
//   &tagsMaxResults=3
//   &output=json
//   &_=1740051794061

export default abstract class SupplierBaseShopify
  extends SupplierBase<ItemListing, Product>
  implements AsyncIterable<Product>
{
  protected _apiKey: string = "";

  protected _limit: number = 10;

  protected _apiHost: string = "searchserverapi.com";

  /**
   * Query products from the Shopify API
   *
   * @param query - The query to search for
   * @param limit - The limit of products to return
   * @returns A promise that resolves when the products are queried
   */
  protected async _queryProducts(query: string): Promise<ItemListing[]> {
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
      maxResults: this._limit,
      startIndex: 0,
      items: true,
      pages: true,
      facets: true,
      categories: true,
      suggestions: true,
      vendors: true,
      tags: true,
      pageStartIndex: 0,
      pagesMaxResults: this._limit,
      categoryStartIndex: 0,
      categoriesMaxResults: 3,
      suggestionsMaxResults: 4,
      vendorsMaxResults: this._limit,
      tagsMaxResults: 3,
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

    return searchRequest.items.slice(0, this._limit);
  }

  /**
   * Validates if the response from the search API is a valid SearchResponse object.
   * @param response - The response object to validate
   * @returns True if the response is a valid SearchResponse object, false otherwise
   * @example
   * ```typescript
   * const isValid = this._isValidSearchResponse(response);
   * if (!isValid) {
   *   throw new Error("Invalid search response");
   * }
   * ```
   */
  protected _isValidSearchResponse(response: unknown): response is SearchResponse {
    if (typeof response !== "object" || response === null) {
      return false;
    }

    const requiredProps = {
      totalItems: "number",
      startIndex: "number",
      itemsPerPage: "number",
      currentItemCount: "number",
      categoryStartIndex: "number",
      totalCategories: "number",
      pageStartIndex: "number",
      totalPages: "number",
      suggestions: Array.isArray,
      categories: Array.isArray,
      pages: Array.isArray,
      items: Array.isArray,
    };

    const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
      if (typeof validator === "string") {
        return key in response && typeof response[key as keyof typeof response] === validator;
      }
      return key in response && validator(response[key as keyof typeof response]);
    });

    if (!hasRequiredProps) return false;

    // Check that items array contains valid listings
    const items = (response as SearchResponse).items;
    return items.every((item) => this._isItemListing(item));
  }

  /**
   * Type guard for ShopifyVariant
   */
  protected _isShopifyVariant(variant: unknown): variant is ShopifyVariant {
    if (typeof variant !== "object" || variant === null) {
      return false;
    }

    const requiredProps = {
      sku: "string",
      price: "number",
      link: "string",
      variant_id: "string",
      quantity_total: (val: unknown) => typeof val === "string" || typeof val === "number",
      options: (val: unknown) => typeof val === "object" && val !== null,
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
    if (options && typeof options === "object") {
      if ("Model" in options && typeof options.Model !== "string") {
        return false;
      }
    }

    return true;
  }

  /**
   * Type guard for ItemListing
   */
  protected _isItemListing(item: unknown): item is ItemListing {
    if (typeof item !== "object" || item === null) {
      return false;
    }

    const requiredProps = {
      title: "string",
      price: (val: unknown) => typeof val === "string" || typeof val === "number",
      link: "string",
      product_id: "string",
      product_code: "string",
      shopify_variants: Array.isArray,
      description: "string",
      vendor: "string",
      quantity: (val: unknown) => typeof val === "string" || typeof val === "number",
      original_product_id: "string",
      list_price: "string",
      image_link: "string",
      discount: "string",
      add_to_cart_id: "string",
      total_reviews: "string",
      reviews_average_score: "string",
      shopify_images: Array.isArray,
      tags: "string",
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
    return variants.every((variant) => this._isShopifyVariant(variant));
  }

  /**
   * Transforms a Shopify product listing into the common Product type.
   * @param product - The Shopify product listing to transform
   * @returns Promise resolving to a partial Product object or void if invalid
   * @example
   * ```typescript
   * const productData = await this._getProductData(itemListing);
   * if (productData) {
   *   // Process valid product data
   *   console.log(productData.title, productData.price);
   * }
   * ```
   */
  protected async _getProductData(product: ItemListing): Promise<Partial<Product> | void> {
    if (!this._isItemListing(product)) {
      console.error("Invalid Shopify product listing:", product);
      return;
    }

    if (!product.price) {
      return;
    }

    const variants: Variant[] = product.shopify_variants
      .filter((variant) => this._isShopifyVariant(variant))
      .map((variant) => {
        let quantity = parseQuantity(variant.sku);
        if (!quantity && typeof variant?.options === "object") {
          quantity = parseQuantity((variant.options as { Model: string }).Model);
        }

        if (!quantity) {
          quantity = {
            quantity: parseInt(variant.quantity_total) ?? 1,
            uom: "piece",
          };
        }

        return {
          url: variant.link,
          price: variant.price,
          sku: variant.sku,
          variant_id: variant.variant_id,
          ...quantity,
        };
      });

    const defaultVariant = variants.find(
      (variant) => variant.sku === parseInt(product.product_code),
    ) as Variant;

    let quantity, uom;

    if (defaultVariant) {
      quantity = defaultVariant.quantity;
      uom = defaultVariant.uom;
    }

    if (!quantity) {
      const qty = firstMap(parseQuantity, [
        product.product_code,
        product.quantity,
        product.title,
        product.description,
      ]);

      if (qty) {
        quantity = qty.quantity;
        uom = qty.uom;
      }
    }

    if (!quantity || !uom) {
      console.warn("Failed to get quantity from retrieved product data:", product);
      return;
    }

    if (!product.price) {
      console.warn("Failed to get price from retrieved product data:", product);
      return;
    }

    const builder = new ProductBuilder(this._baseURL);
    return builder
      .setBasicInfo(product.title, product.link, this.supplierName)
      .setPricing(parseFloat(product.price), "USD", "$")
      .setQuantity(quantity, uom ?? "unit")
      .setDescription(product.description || "")
      .build()
      .then((builtProduct) => {
        if (builtProduct) {
          return {
            ...builtProduct,
            variants,
            vendor: product.vendor,
            id: product.product_id,
          };
        }
        return builtProduct;
      });
  }
}
