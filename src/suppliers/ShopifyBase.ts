import type { Product } from "types";
import type { ShopifyQueryParams, ShopifySearchResponse } from "../types/shopify.d";
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
  protected _accessToken: string = "";

  protected _apiUrl: string = "https://searchserverapi.com";

  protected async queryProducts(): Promise<void> {
    const getParams: ShopifyQueryParams = {
      // Setting the limit here to 1000, since the limit parameter should
      // apply to results returned from Supplier3SChem, not the rquests
      // made by it.
      api_key: this._accessToken,
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

    const searchRequest = await this.httpGetJson(
      `${this._apiUrl}/getresults?${new URLSearchParams(getParams).toString()}`,
    );

    if (!this._isSearchRepsonse(searchRequest)) {
      throw new Error("Invalid search response");
    }

    console.log("searchRequest:", searchRequest);

    this._queryResults = searchRequest.items[this._limit];
  }

  protected _isSearchRepsonse(response: unknown): response is ShopifySearchResponse {
    return (
      typeof response === "object" &&
      response !== null &&
      "totalItems" in response &&
      "items" in response
    );
  }
}
