import { SupplierBaseShopify } from "./SupplierBaseShopify";

/**
 * SupplierAsesChem class that extends SupplierBaseShopify.
 *
 * @remarks
 * AsesChem sells cosmetic and personal-care chemical ingredients. Search results come from the
 * Shopify GraphQL Storefront API, but the extra product details (SDS/COA documents, description,
 * molecular formula, PubChem ID and reviews) are only rendered on the product page HTML, so
 * {@link SupplierAsesChem.getProductData} fetches and scrapes that page per product.
 *
 * @category Suppliers
 * @source
 */
export class SupplierPolySciences extends SupplierBaseShopify implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "PolySciences";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://polysciences.com";

  // Shipping scope
  public readonly shipping: ShippingRange = "domestic";

  // The country code of the supplier.
  public readonly country: CountryCode = "US";

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  // Shopify API URL for GraphQL queries
  protected apiURL: string = "96d8f7-c8.myshopify.com";

  private accessToken: string = "6d15eb6a9d04c26eccf9bb5eef536e92";

  private shopId: number = 71352582358;
}
