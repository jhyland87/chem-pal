import { parsePrice } from "../helpers/currency";
import { parseQuantity } from "../helpers/quantity";
import { Product, TextOptionFacet, WixProduct } from "../types";
import SupplierBase from "./supplier_base";

export default abstract class SupplierWixBase<T extends Product>
  extends SupplierBase<T>
  implements AsyncIterable<T>
{
  protected _accessToken: string = "";

  protected async _setup(): Promise<void> {
    const accessTokenResponse = await fetch(`${this._baseURL}/_api/v1/access-tokens`, {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.5",
        "cache-control": "no-cache",
        pragma: "no-cache",
        priority: "u=1, i",
        referer: this._baseURL,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      },
    });

    const data = await accessTokenResponse.json();
    this._accessToken = data.apps["1380b703-ce81-ff05-f115-39571d94dfcd"].instance;
  }

  protected async queryProducts(): Promise<void> {
    const commonConfig = {
      brand: "wix",
      host: "VIEWER",
      // Needed since the Aspect in the server expects BSI according to it's proto: https://github.com/wix-private/fed-infra/blob/master/fed-infra-protos/src/main/proto/common-config.proto#L26
      BSI: "1f8e4289-4ddb-4c92-8fa7-816a4d62713a|4",
      siteRevision: "318",
      renderingFlow: "NONE",
      language: "en",
      locale: "en-us",
    };

    const body = {
      query: this._query,
      limit: this._limit,
      includeSeoHidden: false,
      language: "en",
      properties: [],
    };

    const productQuery = await this.httpPost(
      `${this._baseURL}/_api/search-services-sitesearch/v1/suggest/federated`,
      body,
      {
        accept: "application/json, text/plain, */*",
        authorization: this._accessToken,
        comonconfig: encodeURIComponent(JSON.stringify(commonConfig)),
        //'commonconfig': '%7B%22brand%22%3A%22wix%22%2C%22host%22%3A%22VIEWER%22%2C%22BSI%22%3A%221f8e4289-4ddb-4c92-8fa7-816a4d62713a%7C4%22%2C%22siteRevision%22%3A%22318%22%2C%22renderingFlow%22%3A%22NONE%22%2C%22language%22%3A%22en%22%2C%22locale%22%3A%22en-us%22%7D',
        "content-type": "application/json",
        "x-wix-brand": "wix",
        "x-wix-client-artifact-id": "wix-thunderbolt",
        //'x-wix-search-bi-correlation-id': '3b57cb81-b895-489c-3e83-d85c1aabd2dc',
        Referer: this._baseURL,
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    );
    const productQueryData = await productQuery?.json();

    if (!productQueryData) {
      console.log("No JSON returned for", this._query);
      return;
    }

    const resultDocuments = productQueryData.results.find(
      (r: { documentType: string }) => r.documentType === "public/stores/products",
    )?.documents;
    if (!resultDocuments) {
      console.log("No results for", this._query);
      return;
    }

    this._queryResults = resultDocuments;
  }
  /*
  protected async parseProducts(): Promise<void> {
    const res = this._queryResults.map((value: unknown) => {
      // supplier, title, url, price, quantity,
      const typedValue = value as WixProduct;
      const priceObj = parsePrice(typedValue.price.toString()) || {
        price: typedValue.price,
        currencyCode: this._productDefaults.currencyCode,
        currencySymbol: this._productDefaults.currencySymbol,
      };
      const quantityFacet = typedValue.textOptionsFacets?.find((f: TextOptionFacet) =>
        ["Weight", "Size", "Quantity", "Volume"].includes(f.name),
      );

      const quantityObj = parseQuantity(quantityFacet?.value || "");

      console.debug("quantityObj:", quantityObj);

      return {
        ...this._productDefaults,
        ...priceObj,
        ...quantityObj,
        supplier: this.supplierName,
        title: typedValue.title,
        url: `${this._baseURL}/${typedValue.url}`,
        displayPrice: `${priceObj.currencySymbol}${priceObj.price}`,
      } as Product;
    });
    this._products = res;
  }
  */
  protected async _getProductData(product: WixProduct): Promise<Product | void> {
    if (!product.discountedPrice) {
      return;
    }

    const priceObj = (product.discountedPrice ? parsePrice(product.discountedPrice) : null) || {
      price: product.discountedPrice,
      currencyCode: this._productDefaults.currencyCode,
      currencySymbol: this._productDefaults.currencySymbol,
    };

    const quantityFacet = product.textOptionsFacets?.find((f: TextOptionFacet) =>
      ["Weight", "Size", "Quantity", "Volume"].includes(f.name),
    );

    if (!quantityFacet?.value) {
      return;
    }

    const quantityObj = parseQuantity(quantityFacet.value);

    if (!quantityObj) return;

    return Promise.resolve({
      ...this._productDefaults,
      ...priceObj,
      ...quantityObj,
      supplier: this.supplierName,
      title: product.title,
      url: `${this._baseURL}/${product.url}`,
      displayPrice: `${priceObj.currencySymbol}${priceObj.price}`,
      displayQuantity: `${quantityObj.quantity} ${quantityObj.uom}`,
    } as Product);
  }
}
