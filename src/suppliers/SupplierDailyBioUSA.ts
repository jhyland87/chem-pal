import { parseQuantity } from '@/helpers/quantity';
import { SupplierBaseWix } from './SupplierBaseWix';

// Daily Bio USA encodes the pack size in the SKU as a "SIZE" segment: "A932.SIZE.500G",
// "L011.SIZE.1L". The separator is usually a dot but the catalog has comma typos too
// ("A992.SIZE,500G"), so both are accepted.
const SKU_SIZE_REGEX = /\bSIZE\s*[.,]\s*([\d.,]+\s*[A-Za-z]+)/i;

/**
 * The SupplierDailyBioUSA module is meant to perform searches and retrieve product details from the
 * US based Biofuran Chem company website which utilizes a Wix ecommerce platform.
 *
 * The website is https://www.dailybiousa.com/
 * @remarks
 *
 * Wix has an exposed GraphQL API which can be used to retrieve product data. The queries are
 * mostly listed in the javascript file `CartIconController.bundle.min.js`.
 * @category Suppliers
 * @source
 */
export class SupplierDailyBioUSA extends SupplierBaseWix implements ISupplier {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = 'Daily Bio USA';

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = 'https://www.dailybiousa.com/';

  // Shipping scope for Biofuran Chem
  public readonly shipping: ShippingRange = 'domestic';

  // The country code of the supplier.
  // This is used to determine the currency and other country-specific information.
  public readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ['ebayonly'];

  public readonly ebayStoreURL: string = 'https://www.ebay.com/str/dailybiousa';

  // Pure-search supplier: the initial search returns every field and
  // getProductData is a passthrough, so there's no per-product detail to cache.
  protected readonly skipProductDetailCache: boolean = true;

  /**
   * Recovers the pack size from the product SKU for the single-size listings that Wix returns
   * with no options and no productItems. Daily Bio USA writes the size into the SKU itself
   * ("A932.SIZE.500G"), which is the only place it appears in machine-readable form on those
   * products, so without this they'd all be dropped for having no quantity. The product name
   * repeats the same catalog code and is checked second, since a handful of listings have
   * something else in the SKU field entirely (one holds a bare price).
   * @param product - The raw Wix product object from the search response
   * @returns The parsed quantity/uom, or nothing when no SIZE segment is found
   * @example
   * ```typescript
   * // product.sku === "A932.SIZE.500G"
   * this.getFallbackQuantity(product); // { quantity: 500, uom: "g" }
   * // product.sku === "LW001", name carries no size either
   * this.getFallbackQuantity(product); // undefined
   * ```
   * @source
   */
  protected override getFallbackQuantity(product: ProductObject): ReturnType<typeof parseQuantity> {
    const sizeMatch = SKU_SIZE_REGEX.exec(product.sku ?? '') ?? SKU_SIZE_REGEX.exec(product.name);
    if (!sizeMatch) return;

    return parseQuantity(sizeMatch[1]);
  }
}
