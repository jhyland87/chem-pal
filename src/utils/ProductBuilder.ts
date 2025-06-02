import { AVAILABILITY } from "@/constants/common";
import { findCAS, isCAS } from "@/helpers/cas";
import { isParsedPrice, parsePrice, toUSD } from "@/helpers/currency";
import { isQuantityObject, parseQuantity, toBaseQuantity } from "@/helpers/quantity";
import { findFormulaInHtml } from "@/helpers/science";
import { Logger } from "@/utils/Logger";
import { isMinimalProduct, isProduct, isUOM } from "@/utils/typeGuards/common";
import { isAvailability, isValidVariant } from "@/utils/typeGuards/productbuilder";

/**
 * Product builder utility class for building product data up over different requests
 *
 * @remarks
 * This is a utility class for building product data up over different requests.
 * It is used to build the product data up over different requests, and then return a complete
 * product object.
 * @category Utils
 * @group Utils
 * @groupDescription Core utility classes for building and managing product data, including validation, transformation, and data enrichment.
 * @module ProductBuilder
 * @example
 * ```typescript
 * const builder = new ProductBuilder<Product>('https://example.com');
 * const product = await builder.build();
 * ```
 */

/**
 * Builder class for constructing Product objects with a fluent interface.
 * Implements the Builder pattern to handle complex product construction with optional fields
 * and data validation.
 *
 * @category Utils
 * @group Utils
 * @groupDescription Core utility classes for building and managing product data, including validation, transformation, and data enrichment.
 * @module ProductBuilder
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

  /** The raw data of the product */
  private _rawData: Record<string, unknown> = {};

  /** The base URL of the supplier's website */
  private baseURL: string;

  /** The logger for the product builder */
  private logger: Logger;

  /**
   * Creates a new ProductBuilder instance.
   * @param baseURL - The base URL of the supplier's website, used for resolving relative URLs
   * @example
   * ```typescript
   * const builder = new ProductBuilder('https://example.com');
   * ```
   */
  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.logger = new Logger("ProductBuilder");
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
   * Sets the pricing information for the product including price and currency details when given a parsedPrice object
   * @overload
   * @param price - ParsedPrice instance
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setPricing(parsePrice('$123.34'));
   * // Sets this._product.price to 123.34
   * // Sets this._product.currencyCode to 'USD'
   * // Sets this._product.currencySymbol to '$'
   * ```
   */
  setPricing(price: ParsedPrice): ProductBuilder<T>;
  /**
   * Sets the pricing information for the product including price and currency details when given a price
   * @overload
   * @param price - Price in string format
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setPricing('$123.34');
   * // Sets this._product.price to 123.34
   * // Sets this._product.currencyCode to 'USD'
   * // Sets this._product.currencySymbol to '$'
   * ```
   */
  setPricing(price: string): ProductBuilder<T>;
  /**
   * Sets the pricing information for the product including price and currency details when given a price
   * @overload
   * @param price - Price in number format
   * @param currencyCode - The ISO currency code (e.g., 'USD', 'EUR')
   * @param currencySymbol - The currency symbol (e.g., '$', '€')
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setPricing(123.34, 'USD', '$');
   * // Sets this._product.price to 123.34
   * // Sets this._product.currencyCode to 'USD'
   * // Sets this._product.currencySymbol to '$'
   * ```
   */
  setPricing(
    price: number | string,
    currencyCode: string,
    currencySymbol: string,
  ): ProductBuilder<T>;
  setPricing(
    price: number | string | ParsedPrice,
    currencyCode?: string,
    currencySymbol?: string,
  ): ProductBuilder<T> {
    if (isParsedPrice(price)) {
      this._product.price = price.price;
      this._product.currencyCode = price.currencyCode;
      this._product.currencySymbol = price.currencySymbol;
      return this;
    }
    if (typeof currencyCode === "string") this._product.currencyCode = currencyCode;
    if (typeof currencySymbol === "string") this._product.currencySymbol = currencySymbol;

    if (typeof price === "string") {
      if (Number.isNaN(Number(price)) === false) {
        this._product.price = Number(price);
        return this;
      }

      const parsedPrice = parsePrice(price);
      if (parsedPrice) {
        this._product.price = parsedPrice.price;
        this._product.currencyCode = parsedPrice.currencyCode;
        this._product.currencySymbol = parsedPrice.currencySymbol;
        return this;
      }
    }

    this._product.price = Number(price);

    return this;
  }

  /**
   * Sets the quantity information for the product.
   * @overload
   * @param quantity - QuantityObject format
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * // For 500 grams
   * builder.setQuantity(parseQuantity('500g'));
   * // Sets this._product.quantity to 500
   * // Sets this._product.uom to 'g'
   * ```
   */
  setQuantity(quantity: QuantityObject): ProductBuilder<T>;
  /**
   * Sets the quantity information for the product.
   * @overload
   * @param quantity - Quantity in string format
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * // For 500 grams
   * builder.setQuantity('500g');
   * // Sets this._product.quantity to 500
   * // Sets this._product.uom to 'g'
   * ```
   */
  setQuantity(quantity: string): ProductBuilder<T>;
  /**
   * Sets the quantity information for the product.
   * @overload
   * @param quantity - Quantity in number format
   * @param uom - The unit of measure (e.g., 'g', 'ml', 'kg')
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * // For 500 grams
   * builder.setQuantity(500, 'g');
   * // Sets this._product.quantity to 500
   * // Sets this._product.uom to 'g'
   * ```
   */
  setQuantity(quantity: number, uom: string): ProductBuilder<T>;
  setQuantity(quantity: QuantityObject | string | number, uom?: string): ProductBuilder<T> {
    if (typeof quantity === "undefined") return this;

    if (isQuantityObject(quantity)) {
      this._product.quantity = quantity.quantity;
      this._product.uom = quantity.uom;
      return this;
    }

    if (typeof quantity === "string" && typeof uom === "undefined") {
      const parsedQuantity = parseQuantity(quantity);
      if (parsedQuantity) {
        this._product.quantity = parsedQuantity.quantity;
        this._product.uom = parsedQuantity.uom;
        return this;
      }

      const [qty, unit] = quantity.split(/\s(.+)/s);

      if (Number.isNaN(Number(qty))) {
        this.logger.warn(`Unable to parse quantity from string: ${quantity}`);
        return this;
      }
      this._product.quantity = Number(qty);
      this._product.uom = unit;
      return this;
    }

    if (typeof quantity === "number" || Number.isInteger(quantity)) {
      this._product.quantity = Number(quantity);
      this._product.uom = uom ?? "pieces";

      return this;
    }

    this.logger.warn(
      `Unknown quantity type: ${typeof quantity} - Expected number, string, or QuantityObject`,
    );
    return this;
  }

  /**
   * Sets the unit of measure for the product.
   *
   * @param uom - The unit of measure for the product
   * @returns The builder instance for method chaining
   * @example
   */
  setUOM(uom: string): ProductBuilder<T> {
    if (typeof uom === "string" && uom.trim().length > 0) {
      this._product.uom = uom;
      return this;
    }

    this.logger.warn(`Unknown UOM: ${uom}`);
    return this;
  }

  /**
   * Sets the country of the supplier.
   *
   * @param country - The country of the supplier
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setSupplierCountry("US");
   * ```
   */
  setSupplierCountry(country: CountryCode): ProductBuilder<T> {
    this._product.supplierCountry = country;
    return this;
  }

  /**
   * Sets the shipping scope of the supplier.
   *
   * @param shipping - The shipping scope of the supplier
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setSupplierShipping("worldwide");
   * ```
   */
  setSupplierShipping(shipping: ShippingRange): ProductBuilder<T> {
    this._product.supplierShipping = shipping;
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
    if (typeof cas !== "string") {
      this.logger.warn(`setCAS| Invalid CAS number: ${cas}`);
      return this;
    }

    if (isCAS(cas)) {
      this._product.cas = cas;
    } else {
      const parsedACAS = findCAS(cas);
      if (parsedACAS) {
        this._product.cas = parsedACAS;
      }
    }
    return this;
  }

  /**
   * Sets the ID for the product.
   *
   * @param id - The unique identifier for the product
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setId(12345);
   * ```
   */
  setId(id?: number | string): ProductBuilder<T> {
    if (id) {
      this._product.id = id as T["id"];
    }
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
    if (uuid && uuid.trim().length > 0) {
      this._product.uuid = uuid;
    }
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
    if (sku && sku.trim().length > 0) {
      this._product.sku = sku;
    }
    return this;
  }

  /**
   * Sets the vendor for the product.
   *
   * @param vendor - The vendor name
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setVendor('Vendor Name');
   * ```
   */
  setVendor(vendor?: string): ProductBuilder<T> {
    if (vendor) {
      this._product.vendor = vendor;
    }
    return this;
  }

  /**
   * Tries to determine the availability of the product based on variable input.
   *
   * @param availability - The availability of the product
   * @returns The availability of the product
   * @example
   * ```typescript
   * // In stock
   * builder.determineAvailability("instock");
   * builder.determineAvailability(true);
   * builder.determineAvailability("outofstock");
   * builder.determineAvailability("unavailable");
   * builder.determineAvailability(false);
   * builder.determineAvailability("preorder");
   * builder.determineAvailability("backorder");
   * builder.determineAvailability("discontinued");
   * ```
   */
  determineAvailability(availability?: AVAILABILITY | boolean | string): Maybe<AVAILABILITY> {
    if (typeof availability === "undefined") return;

    if (isAvailability(availability)) return availability;

    if (typeof availability === "boolean")
      return availability ? AVAILABILITY.IN_STOCK : AVAILABILITY.OUT_OF_STOCK;

    if (typeof availability === "string") {
      // converting to lower and removing all non-alpha characters just to standardize the values for easier processing.
      switch (availability.toLowerCase().replaceAll(/[^a-z]/g, "")) {
        case "instock":
        case "available":
          return AVAILABILITY.IN_STOCK;
        case "unavailable":
        case "outofstock":
          return AVAILABILITY.OUT_OF_STOCK;
        case "preorder":
          return AVAILABILITY.PRE_ORDER;
        case "backorder":
          return AVAILABILITY.BACKORDER;
        case "discontinued":
          return AVAILABILITY.DISCONTINUED;
        default:
          return;
      }
    }
  }

  /**
   * Sets the availability of the product.
   *
   * @param availability - The availability of the product
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * // In stock
   * builder.setAvailability("IN_STOCK");
   * // Set as in stock
   * builder.setAvailability(false);
   * // Out of stock
   * // etc
   * ```
   */
  setAvailability(availability: AVAILABILITY): ProductBuilder<T>;
  setAvailability(availability: boolean): ProductBuilder<T>;
  setAvailability(availability: string): ProductBuilder<T>;
  setAvailability(availability: AVAILABILITY | boolean | string): ProductBuilder<T> {
    const avail = this.determineAvailability(availability);

    if (typeof avail === "undefined") {
      this.logger.warn(`Unknown availability: ${availability}`);
      return this;
    }

    this._product.availability = avail;
    return this;
  }

  /**
   * Just a place to hold the products original response object.
   *
   * @param data - The raw data to add the raw data.
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.addRawData({
   *   title: 'Sodium Chloride',
   *   price: 29.99,
   * });
   * ```
   */
  addRawData(data?: Record<string, unknown>): ProductBuilder<T> {
    Object.assign(this._rawData, data);
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
    for (const variant of variants) {
      this.addVariant(variant);
    }
    return this;
  }

  /**
   * Sets the variants for the product. Slightly different from addVariants in that it
   * will replace the existing variants with the new ones.
   *
   * @param variants - The variants to set
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setVariants([{ id: 1, title: '500g Package', price: 49.99, quantity: 500, uom: 'g' }]);
   * ```
   */
  setVariants(variants: Partial<Variant>[]): ProductBuilder<T> {
    this._product.variants = variants;
    return this;
  }

  /**
   * Get a specific property from the product.
   *
   * @param key - The key of the property to get
   * @returns The value of the property
   * @example
   * ```typescript
   * const title = builder.get("title");
   * console.log(title); // "Sodium Chloride"
   * ```
   */
  get(key: keyof T): T[keyof T] | Maybe<T[keyof T]> {
    if (key in this._product && typeof this._product[key] !== "undefined") {
      return this._product[key] as T[keyof T];
    }

    return;
  }

  /**
   * Converts a relative or partial URL to an absolute URL using the base URL.
   *
   * @param path - The URL or path to convert
   * @returns The absolute URL as a string
   * @example
   * ```typescript
   * const url = this.href('/products/123');
   * // Returns: 'https://example.com/products/123'
   * ```
   */
  private href(path: string | URL): string {
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
  async build(): Promise<Maybe<Product>> {
    if (!isMinimalProduct(this._product)) {
      return;
    }

    this._product.usdPrice = this._product.price;
    const baseQuantity = toBaseQuantity(this._product.quantity, this._product.uom);
    if (baseQuantity) {
      this._product.baseQuantity = baseQuantity;
    }

    if (this._product.currencyCode !== "USD") {
      this._product.usdPrice = await toUSD(this._product.price, this._product.currencyCode);
    }

    // Process variants if present
    if (this._product.variants?.length) {
      // Filter out invalid variants
      this._product.variants = this._product.variants.filter((variant) => isValidVariant(variant));

      // Process each variant
      for (const variant of this._product.variants ?? []) {
        if (
          "quantity" in variant &&
          "uom" in variant &&
          variant.quantity &&
          isUOM(variant.uom) &&
          typeof variant.price === "number"
        ) {
          const baseQuantity = toBaseQuantity(variant.quantity, variant.uom);
          if (baseQuantity) {
            variant.baseQuantity = baseQuantity;
          }
        }

        if (typeof variant.price === "number" && this._product.currencyCode !== "USD") {
          variant.usdPrice = await toUSD(variant.price, this._product.currencyCode ?? "USD");
        }

        if (variant.url) {
          variant.url = this.href(variant.url);
        }
      }
    }

    if (!isProduct(this._product)) {
      console.error(`ProductBuilder| Invalid _product: ${JSON.stringify(this._product)}`);
      return;
    }

    this._product.url = this.href(this._product.url);
    console.log("Built product:", this._product);
    return this._product;
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
