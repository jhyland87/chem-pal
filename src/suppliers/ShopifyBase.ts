import type { Product, Variant } from "types";
import { isQuantityObject, parseQuantity, parseQuantityCoalesce } from "../helpers/quantity";
import type { ShopifyItem, ShopifyQueryParams, ShopifySearchResponse } from "../types/shopify.d";
import SupplierBase from "./supplier_base";

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

export default abstract class ShopifyBase<T extends Product>
  extends SupplierBase<T>
  implements AsyncIterable<T>
{
  protected _apiKey: string = "";

  protected _limit: number = 5;

  protected _apiHost: string = "searchserverapi.com";

  protected async queryProducts(): Promise<void> {
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
    const getParams: ShopifyQueryParams = {
      // Setting the limit here to 1000, since the limit parameter should
      // apply to results returned from Supplier3SChem, not the rquests
      // made by it.
      api_key: this._apiKey,
      q: this._query,
      maxResults: 15,
      startIndex: 0,
      items: true,
      pages: true,
      facets: true,
      categories: true,
      suggestions: true,
      vendors: true,
      tags: true,
      pageStartIndex: 0,
      pagesMaxResults: 15,
      categoryStartIndex: 0,
      categoriesMaxResults: 3,
      suggestionsMaxResults: 4,
      vendorsMaxResults: 4,
      tagsMaxResults: 3,
      output: "json",
      _: new Date().getTime(),
    };

    const searchRequest = await this.httpGetJson({
      path: `/getresults`,
      host: this._apiHost,
      params: getParams,
    });

    console.log("searchRequest:", searchRequest);

    if (!this._isShopifySearchResponse(searchRequest)) {
      throw new Error("Invalid search response");
    }

    this._queryResults = searchRequest.items.slice(0, this._limit);
  }

  protected _isShopifySearchResponse(response: unknown): response is ShopifySearchResponse {
    return (
      typeof response === "object" &&
      response !== null &&
      "totalItems" in response &&
      "items" in response
    );
  }

  protected async _getProductData(product: ShopifyItem): Promise<Product | void> {
    if (!product.price) {
      return;
    }

    const variants: Variant[] = product.shopify_variants.map((variant) => {
      let quantity = parseQuantity(variant.sku);
      if (!quantity && typeof variant?.options === "object")
        quantity = parseQuantity((variant.options as { Model: string }).Model);

      if (!quantity)
        quantity = {
          quantity: parseInt(variant.quantity_total) ?? 1,
          uom: "piece",
        };
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
      const qty = parseQuantityCoalesce([
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

    if (!isQuantityObject(quantity) || !product.price) {
      console.warn("Invalid product data:", product);
      return;
    }

    return {
      ...defaultVariant,
      title: product.title,
      price: parseFloat(product.price),
      description: product.description,
      url: product.link,
      quantity: quantity,
      uom: uom ?? "unit",
      currencyCode: "USD",
      currencySymbol: "$",
      supplier: this.supplierName,
      variants: variants,
      vendor: product.vendor,
      id: product.product_id,
    };
  }
}
