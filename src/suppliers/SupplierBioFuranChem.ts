import { SupplierBaseWix } from './SupplierBaseWix';

/**
 * The SupplierBioFuranChem module is meant to perform searches and retrieve product details from the
 * US based Biofuran Chem company website which utilizes a Wix ecommerce platform.
 *
 * The website is https://www.biofuranchem.com/
 * @remarks
 *
 * Wix has an exposed GraphQL API which can be used to retrieve product data. The queries are
 * mostly listed in the javascript file `CartIconController.bundle.min.js`.
 * @category Suppliers
 * @source
 */
export class SupplierBioFuranChem extends SupplierBaseWix implements ISupplier {
  // Name of supplier (for display purposes)
  public static readonly supplierName: string = 'BioFuran Chem';

  // Base URL for HTTP(s) requests
  public static readonly baseURL: string = 'https://www.biofuranchem.com';

  // Shipping scope for Biofuran Chem
  public static readonly shipping: ShippingRange = 'international';

  // The country code of the supplier.
  // This is used to determine the currency and other country-specific information.
  public static readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public static readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];

  // Pure-search supplier: the initial search returns every field and
  // getProductData is a passthrough, so there's no per-product detail to cache.
  protected readonly skipProductDetailCache: boolean = true;
}
