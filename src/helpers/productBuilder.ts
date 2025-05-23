import { UOM } from "constants/app";
import { isCAS } from "helpers/cas";
import { toUSD } from "helpers/currency";
import { toBaseQuantity } from "helpers/quantity";
import { type Product } from "types";

/**
 * Builder class for constructing Product objects with a fluent interface.
 * Implements the Builder pattern to handle complex product construction with optional fields
 * and data validation.
 *
 * @example
 * ```typescript
 * const builder = new ProductBuilder('https://example.com');
 * const product = await builder
 *   .setBasicInfo('Sodium Chloride', '/products/nacl', 'ChemSupplier')
 *   .setPricing(29.99, 'USD', '$')
 *   .setQuantity(500, 'g')
 *   .setDescription('99.9% pure NaCl')
 *   .setCAS('7647-14-5')
 *   .build();
 *
 * if (product) {
 *   console.log(product.title); // "Sodium Chloride"
 *   console.log(product.price); // 29.99
 *   console.log(product.uom);   // "g"
 * }
 * ```
 */
export class ProductBuilder {
  private product: Partial<Product> = {};
  private baseURL: string;

  /**
   * Creates a new ProductBuilder instance.
   *
   * @param baseURL - The base URL of the supplier's website, used for resolving relative URLs
   * @example
   * ```typescript
   * const builder = new ProductBuilder('https://example.com');
   * ```
   */
  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * Sets the basic information for the product including title, URL, and supplier name.
   *
   * @param title - The display name/title of the product
   * @param url - The URL where the product can be found (can be relative to baseURL)
   * @param supplier - The name of the supplier/vendor
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setBasicInfo(
   *   'Hydrochloric Acid',
   *   '/products/hcl-solution',
   *   'ChemSupplier'
   * );
   * ```
   */
  setBasicInfo(title: string, url: string, supplier: string): ProductBuilder {
    this.product.title = title;
    this.product.url = url;
    this.product.supplier = supplier;
    return this;
  }

  /**
   * Sets the pricing information for the product including price and currency details.
   *
   * @param price - The numeric price value
   * @param currencyCode - The ISO currency code (e.g., 'USD', 'EUR')
   * @param currencySymbol - The currency symbol (e.g., '$', '€')
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setPricing(49.99, 'EUR', '€');
   * // For USD pricing
   * builder.setPricing(29.99, 'USD', '$');
   * ```
   */
  setPricing(price: number, currencyCode: string, currencySymbol: string): ProductBuilder {
    this.product.price = price;
    this.product.currencyCode = currencyCode;
    this.product.currencySymbol = currencySymbol;
    return this;
  }

  /**
   * Sets the quantity information for the product.
   *
   * @param quantity - The numeric quantity value
   * @param uom - The unit of measure (e.g., 'g', 'ml', 'kg')
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * // For 500 grams
   * builder.setQuantity(500, 'g');
   * // For 1 liter
   * builder.setQuantity(1, 'L');
   * // For 100 milliliters
   * builder.setQuantity(100, 'ml');
   * ```
   */
  setQuantity(quantity: number, uom: string): ProductBuilder {
    this.product.quantity = quantity;
    this.product.uom = uom;
    return this;
  }

  /**
   * Sets the product description.
   *
   * @param description - The detailed description of the product
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setDescription(
   *   'High purity sodium chloride, 99.9% pure, suitable for laboratory use'
   * );
   * ```
   */
  setDescription(description: string): ProductBuilder {
    this.product.description = description;
    return this;
  }

  /**
   * Sets the CAS (Chemical Abstracts Service) registry number for the product.
   * Validates the CAS number format before setting.
   *
   * @param cas - The CAS registry number in format "XXXXX-XX-X"
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * // For sodium chloride
   * builder.setCAS('7647-14-5');
   * // For invalid CAS number (will not set)
   * builder.setCAS('invalid-cas');
   * ```
   */
  setCAS(cas: string): ProductBuilder {
    if (isCAS(cas)) {
      this.product.cas = cas;
    }
    return this;
  }

  /**
   * Validates that a product object has the minimum required properties.
   *
   * @param product - The product object to validate
   * @returns Type predicate indicating if the object has minimum required properties
   */
  private _isMinimalProduct(product: unknown): product is Partial<Product> {
    if (!product || typeof product !== "object") return false;

    const requiredStringProps = {
      quantity: "number",
      price: "number",
      uom: "string",
      url: "string",
      currencyCode: "string",
      currencySymbol: "string",
      title: "string",
    };

    const hasAllRequiredProps = Object.entries(requiredStringProps).every(([key, val]) => {
      return key in product && typeof product[key as keyof typeof product] === val;
    });

    return hasAllRequiredProps;
  }

  /**
   * Validates that an object is a complete Product type.
   *
   * @param product - The product object to validate
   * @returns Type predicate indicating if the object is a complete Product
   */
  private _isProduct(product: unknown): product is Product {
    return (
      typeof product === "object" &&
      product !== null &&
      "price" in product &&
      "quantity" in product &&
      "uom" in product
    );
  }

  /**
   * Converts a relative or partial URL to an absolute URL using the base URL.
   *
   * @param path - The URL or path to convert
   * @returns The absolute URL as a string
   */
  private _href(path: string | URL): string {
    const urlObj = new URL(path, this.baseURL);
    return urlObj.toString();
  }

  /**
   * Builds and validates the final Product object.
   * Performs the following steps:
   * 1. Validates minimum required properties
   * 2. Calculates USD price if in different currency
   * 3. Converts quantity to base units
   * 4. Converts relative URLs to absolute
   *
   * @returns Promise resolving to a complete Product object or void if validation fails
   * @example
   * ```typescript
   * const product = await builder
   *   .setBasicInfo('Test Chemical', '/products/test', 'Supplier')
   *   .setPricing(29.99, 'USD', '$')
   *   .setQuantity(100, 'g')
   *   .build();
   *
   * if (product) {
   *   console.log(product.usdPrice);     // 29.99
   *   console.log(product.baseQuantity); // 100
   *   console.log(product.url);          // "https://example.com/products/test"
   * }
   * ```
   */
  async build(): Promise<Product | void> {
    if (!this._isMinimalProduct(this.product)) {
      return;
    }

    this.product.usdPrice = this.product.price ?? 0;
    this.product.baseQuantity =
      toBaseQuantity(this.product.quantity ?? 0, this.product.uom as UOM) ??
      this.product.quantity ??
      0;

    if (this.product.currencyCode !== "USD") {
      this.product.usdPrice = await toUSD(
        this.product.price ?? 0,
        this.product.currencyCode ?? "USD",
      );
    }

    if (!this._isProduct(this.product)) {
      console.error(`ProductBuilder| Invalid product: ${JSON.stringify(this.product)}`);
      return;
    }

    this.product.url = this._href(this.product.url);
    return this.product as Product;
  }
}
