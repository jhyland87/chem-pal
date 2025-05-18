import merge from "lodash/merge";
import { parsePrice } from "../helpers/currency";
import { parseQuantity } from "../helpers/quantity";
import { Product, Variant } from "../types";
import SupplierBase from "./supplier_base";
import {
  type WixProduct,
  type WixProductItem,
  type WixProductResponse,
  type WixProductSelection,
} from "./supplier_wixbase.d";

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
    const url = new URL("https://www.biofuranchem.com/_api/wix-ecommerce-storefront-web/api");

    url.searchParams.append("o", "getFilteredProducts");
    url.searchParams.append("s", "WixStoresWebClient");
    url.searchParams.append(
      "q",
      "query,getFilteredProductsWithHasDiscount($mainCollectionId:String!,$filters:ProductFilters,$sort:ProductSort,$offset:Int,$limit:Int,$withOptions:Boolean,=,false,$withPriceRange:Boolean,=,false){catalog{category(categoryId:$mainCollectionId){numOfProducts,productsWithMetaData(filters:$filters,limit:$limit,sort:$sort,offset:$offset,onlyVisible:true){totalCount,list{id,options{id,key,title,@include(if:$withOptions),optionType,@include(if:$withOptions),selections,@include(if:$withOptions){id,value,description,key,inStock}}productItems,@include(if:$withOptions){id,optionsSelections,price,formattedPrice}productType,price,sku,isInStock,urlPart,formattedPrice,name,description,brand,priceRange(withSubscriptionPriceRange:true),@include(if:$withPriceRange){fromPriceFormatted}}}}}}",
    );
    url.searchParams.append(
      "v",
      `{"mainCollectionId":"00000000-000000-000000-000000000001","offset":0,"limit":${this._limit},"sort":null,"filters":{"term":{"field":"name","op":"CONTAINS","values":["*${this._query}*"]}},"withOptions":true,"withPriceRange":false}`,
    );

    console.debug("URL:", url.toString());

    const queryResponse = (await this.httpGetJson(url, {
      Authorization: this._accessToken,
    })) as unknown as WixProductResponse;

    console.debug("queryResponse:", queryResponse);

    if (!queryResponse) {
      console.log("No JSON returned for", this._query);
      return;
    }

    this._queryResults = queryResponse.data.catalog.category.productsWithMetaData
      .list as WixProduct[];
  }

  protected async _getProductData(product: WixProduct): Promise<Product | void> {
    if (!product.price) {
      return;
    }

    // Geerat an object with the products UUID and formatted price, with the option ID as the keys
    const productItems = Object.fromEntries(
      product.productItems.map((item: WixProductItem) => {
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
      product.options[0].selections.map((selection: WixProductSelection) => {
        return [selection.id, parseQuantity(selection.value)];
      }),
    );

    //
    const productVariants = merge(productItems, productSelections);

    console.log("productVariants:", { productVariants });

    return Promise.resolve({
      ...this._productDefaults,
      ...productVariants[1],
      supplier: this.supplierName,
      title: product.name,
      url: `${this._baseURL}/product-page/${product.urlPart}`,
      variants: Object.values(productVariants) as Variant[],
    } as Product);
  }
}
