import { FuzzScorerFn } from "@/constants/fuzzScorers";
import { partial_ratio } from "fuzzball";
import type { ProductDefaults } from "./SupplierBase";
import SupplierBaseSearchanise from "./SupplierBaseSearchanise";

/**
 * SupplierAsesChem2 class that extends SupplierBaseSearchanise and implements AsyncIterable<T>.
 *
 * @remarks
 *
 * Example search URL: https://searchserverapi.com/getresults?api_key=0B7C9N9u3h&q=acid&sortBy=relevance&sortOrder=desc&restrictBy%5Bstock_status%5D=In+Stock&restrictBy%5Bvendor%5D=aseschem&restrictBy%5Bproduct_type%5D=Chemicals&startIndex=0&maxResults=18&items=true&pages=true&categories=true&suggestions=true&queryCorrection=true&suggestionsMaxResults=3&pageStartIndex=0&pagesMaxResults=20&categoryStartIndex=0&categoriesMaxResults=20&facets=true&facetsShowUnavailableOptions=false&recentlyViewedProducts=5710132773031&recentlyAddedToCartProducts=&recentlyPurchasedProducts=&ResultsTitleStrings=2&ResultsDescriptionStrings=2&page=1&rb_stock_status=In+Stock&rb_vendor=aseschem&timeZoneName=America%2FPhoenix&searchUuid=25dac773-8d45-45b1-98f0-73e4dc6887fc&output=jsonp&callback=jQuery37109746323144629598_1777375688819&_=1777375688824
 *
 * @category Suppliers
 * @source
 */
export default class SupplierAsesChem2 extends SupplierBaseSearchanise implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "AsesChem";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://ases.in";

  // Shipping scope for AsesChem2
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  public readonly country: CountryCode = "IN";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  protected productDefaults: ProductDefaults = {
    currencyCode: "INR",
    currencySymbol: "₹",
  };

  // API key for Typesense search API
  protected apiKey: string = "0B7C9N9u3h";

  // Base search parameters for Typesense search API
  protected baseSearchParams: QueryParams = {
    tab: "products",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "restrictBy[filter_ptag_bf51a4bd1f5efe4002b3d50737306113]": "Chemicals",
    //"restrictBy[stock_status]": "In Stock",
    //"restrictBy[vendor]": "aseschem",
    "restrictBy[product_type]": "Chemicals",
  };

  protected readonly fuzzScorerOverride: FuzzScorerFn = partial_ratio;

  protected readonly minMatchPercentage: number = 50;
}
