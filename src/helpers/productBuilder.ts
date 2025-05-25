import { UOM } from "@/constants/app";
import { isCAS } from "@/helpers/cas";
import { toUSD } from "@/helpers/currency";
import { toBaseQuantity } from "@/helpers/quantity";
import { type Maybe, type Product, type Variant } from "@/types";
import { findFormulaInHtml } from "./science";

/**
 * Builder class for constructing Product objects with a fluent interface.
 * Implements the Builder pattern to handle complex product construction with optional fields
 * and data validation.
 *
 * @example
 * ```typescript
 * const builder = new ProductBuilder<Product>('https://example.com');
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
export class ProductBuilder<T extends Product> {
  /** The partial product object being built */
  private _product: Partial<T> = {};

  /** The base URL of the supplier's website */
  private _baseURL: string;

  /**
   * Creates a new ProductBuilder instance.
   * @param _baseURL - The base URL of the supplier's website, used for resolving relative URLs
   * @example
   * ```typescript
   * const builder = new ProductBuilder('https://example.com');
   * ```
   */
  constructor(_baseURL: string) {
    this._baseURL = _baseURL;
  }

  /**
   * Sets the data for the product by merging the provided data object.
   *
   * @param data - The data to merge into the product
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setData({
   *   title: "Test Chemical",
   *   price: 29.99,
   *   quantity: 500,
   *   uom: "g"
   * });
   * ```
   */
  setData(data: Partial<T>): ProductBuilder<T> {
    Object.assign(this._product, data);
    return this;
  }

  /**
   * Sets the basic information for the product including title, URL, and supplier name.
   *
   * @param title - The display name/title of the product
   * @param url - The URL where the product can be found (can be relative to _baseURL)
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
  setBasicInfo(title: string, url: string, supplier: string): ProductBuilder<T> {
    this._product.title = title;
    this._product.url = url;
    this._product.supplier = supplier;
    return this;
  }

  /**
   * Sets the formula for the product.
   *
   * @param formula - The formula to set
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setFormula('foobar K<sub>2</sub>Cr<sub>2</sub>O<sub>7</sub> baz');
   * // sets this._product.formula to "K₂Cr₂O₇"
   * builder.setFormula("H<sub>2</sub>SO<sub>4</sub>");
   * // sets this._product.formula to "H₂SO ₄"
   * builder.setFormula("Just some text");
   * // sets this._product.formula to undefined
   * ```
   */
  setFormula(formula?: string): ProductBuilder<T> {
    if (formula && typeof formula === "string" && formula.trim().length > 0) {
      const parsedResult = findFormulaInHtml(formula);
      if (parsedResult) {
        this._product.formula = parsedResult;
      }
    }
    return this;
  }

  /**
   * Sets the grade/purity level of the product.
   * Only sets the grade if a non-empty string is provided.
   *
   * @param grade - The grade or purity level of the product
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setGrade("ACS Grade");
   * builder.setGrade("Reagent Grade");
   * ```
   */
  setGrade(grade: string): ProductBuilder<T> {
    if (grade && grade?.trim()?.length > 0) {
      this._product.grade = grade;
    }
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
  setPricing(price: number, currencyCode: string, currencySymbol: string): ProductBuilder<T> {
    this._product.price = price;
    this._product.currencyCode = currencyCode;
    this._product.currencySymbol = currencySymbol;
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
  setQuantity(quantity: number, uom: string): ProductBuilder<T> {
    this._product.quantity = quantity;
    this._product.uom = uom;
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
  setDescription(description: string): ProductBuilder<T> {
    this._product.description = description;
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
  setCAS(cas: string): ProductBuilder<T> {
    if (isCAS(cas)) {
      this._product.cas = cas;
    }
    return this;
  }

  /**
   * Sets the numeric ID for the product.
   *
   * @param id - The numeric identifier for the product
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setId(12345);
   * ```
   */
  setId(id: number): ProductBuilder<T> {
    this._product.id = id;
    return this;
  }

  /**
   * Sets the UUID for the product.
   *
   * @param uuid - The UUID string for the product
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setUUID('550e8400-e29b-41d4-a716-446655440000');
   * ```
   */
  setUUID(uuid: string): ProductBuilder<T> {
    this._product.uuid = uuid;
    return this;
  }

  /**
   * Sets the SKU (Stock Keeping Unit) for the product.
   *
   * @param sku - The SKU string for the product
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setSku('CHEM-NaCl-500G');
   * ```
   */
  setSku(sku: string): ProductBuilder<T> {
    this._product.sku = sku;
    return this;
  }

  /**
   * Adds a single variant to the product.
   *
   * @param variant - The variant object to add
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.addVariant({
   *   title: '500g Package',
   *   price: 49.99,
   *   quantity: 500,
   *   uom: 'g',
   *   sku: 'CHEM-500G'
   * });
   * ```
   */
  addVariant(variant: Partial<Variant>): ProductBuilder<T> {
    if (!this._product.variants) {
      this._product.variants = [];
    }
    this._product.variants.push(variant);
    return this;
  }

  /**
   * Adds multiple variants to the product at once.
   *
   * @param variants - Array of variant objects to add
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.addVariants([
   *   {
   *     title: '500g Package',
   *     price: 49.99,
   *     quantity: 500,
   *     uom: 'g'
   *   },
   *   {
   *     title: '1kg Package',
   *     price: 89.99,
   *     quantity: 1000,
   *     uom: 'g'
   *   }
   * ]);
   * ```
   */
  addVariants(variants: Partial<Variant>[]): ProductBuilder<T> {
    if (!this._product.variants) {
      this._product.variants = [];
    }
    this._product.variants.push(...variants);
    return this;
  }

  /**
   * Validates that a variant object has valid properties.
   * Checks numeric and string properties for correct types.
   *
   * @param variant - The variant object to validate
   * @returns boolean indicating if the variant is valid
   */
  private _isValidVariant(variant: unknown): variant is Partial<Variant> {
    if (!variant || typeof variant !== "object") return false;

    // Check that any numeric properties are actually numbers
    const numericProps = ["price", "quantity", "baseQuantity"];
    for (const prop of numericProps) {
      if (prop in variant && typeof variant[prop as keyof typeof variant] !== "number") {
        return false;
      }
    }

    // Check that any string properties are actually strings
    const stringProps = ["title", "uom", "sku", "url", "grade", "conc", "status", "statusTxt"];
    for (const prop of stringProps) {
      if (prop in variant && typeof variant[prop as keyof typeof variant] !== "string") {
        return false;
      }
    }

    return true;
  }

  /**
   * Validates that a product object has the minimum required properties.
   * Checks for presence and correct types of essential fields.
   *
   * @param product - The product object to validate
   * @returns Type predicate indicating if the object has minimum required properties
   */
  private _isMinimalProduct(product: unknown): product is Partial<T> {
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
   * Checks for presence of core product properties.
   *
   * @param product - The product object to validate
   * @returns Type predicate indicating if the object is a complete Product
   */
  private _isProduct(product: unknown): product is T {
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
   * @example
   * ```typescript
   * const url = this._href('/products/123');
   * // Returns: 'https://example.com/products/123'
   * ```
   */
  private _href(path: string | URL): string {
    const urlObj = new URL(path, this._baseURL);
    return urlObj.toString();
  }

  /**
   * Builds and validates the final Product object.
   * Performs the following steps:
   * 1. Validates minimum required properties
   * 2. Calculates USD price if in different currency
   * 3. Converts quantity to base units
   * 4. Converts relative URLs to absolute
   * 5. Processes and validates variants if present
   *
   * @returns Promise resolving to a complete Product object or void if validation fails
   * @example
   * ```typescript
   * const product = await builder
   *   .setBasicInfo('Test Chemical', '/products/test', 'Supplier')
   *   .setPricing(29.99, 'USD', '$')
   *   .setQuantity(100, 'g')
   *   .addVariant({
   *     title: '500g Package',
   *     price: 49.99,
   *     quantity: 500,
   *     uom: 'g'
   *   })
   *   .build();
   * ```
   */
  async build(): Promise<Maybe<T>> {
    if (!this._isMinimalProduct(this._product)) {
      return;
    }

    this._product.usdPrice = this._product.price ?? 0;
    this._product.baseQuantity =
      toBaseQuantity(this._product.quantity ?? 0, this._product.uom as UOM) ??
      this._product.quantity ??
      0;

    if (this._product.currencyCode !== "USD") {
      this._product.usdPrice = await toUSD(
        this._product.price ?? 0,
        this._product.currencyCode ?? "USD",
      );
    }

    // Process variants if present
    if (this._product.variants?.length) {
      // Filter out invalid variants
      this._product.variants = this._product.variants.filter((variant) =>
        this._isValidVariant(variant),
      );

      // Process each variant
      for (const variant of this._product.variants ?? []) {
        if (variant.quantity && variant.uom) {
          variant.baseQuantity =
            toBaseQuantity(variant.quantity, variant.uom as UOM) ?? variant.quantity;
        }

        if (variant.price && this._product.currencyCode !== "USD") {
          variant.usdPrice = await toUSD(variant.price, this._product.currencyCode ?? "USD");
        }

        if (variant.url) {
          variant.url = this._href(variant.url);
        }
      }
    }

    if (!this._isProduct(this._product)) {
      console.error(`ProductBuilder| Invalid _product: ${JSON.stringify(this._product)}`);
      return;
    }

    this._product.url = this._href(this._product.url);
    console.log("Built product:", this._product);
    return this._product satisfies T;
  }

  /**
   * Returns the current state of the product being built.
   * Useful for debugging or inspecting the build progress.
   *
   * @returns The current partial product object
   * @example
   * ```typescript
   * const partialProduct = builder
   *   .setBasicInfo('Test', '/test', 'Supplier')
   *   .dump();
   * console.log(partialProduct);
   * ```
   */
  dump(): Partial<T> {
    return this._product;
  }
}
