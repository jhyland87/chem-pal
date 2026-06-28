import { AVAILABILITY } from "@/constants/common";
import { findCAS } from "@/helpers/cas";
import { parsePrice, toUSD } from "@/helpers/currency";
import { parseQuantity, toBaseQuantity } from "@/helpers/quantity";
import { findFormulaInHtml } from "@/helpers/science";
import { htmlToAscii, isMoleForm } from "@/helpers/utils";
import { Logger } from "@/utils/Logger";
import {
  isCAS,
  isCountryCode,
  isCurrencyCode,
  isCurrencySymbol,
  isMinimalProduct,
  isParsedPrice,
  isPaymentMethod,
  isProduct,
  isQuantityObject,
  isShippingRange,
  isSmiles,
  isUOM,
} from "@/utils/typeGuards/common";
import { isAvailability, isValidVariant } from "@/utils/typeGuards/productbuilder";

/**
 * Builder class for constructing Product objects with a fluent interface.
 * Implements the Builder pattern to handle complex product construction with optional fields
 * and data validation.
 *
 * @remarks
 * This is a utility class for building product data up over different requests.
 * It is used to build the product data up over different requests, and then return a complete
 * product object.
 *
 * @category Utils
 * @summary
 * Builder class for constructing Product objects with a fluent interface.
 * Implements the Builder pattern to handle complex product construction with optional fields
 * and data validation.
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
 * @source
 */
export class ProductBuilder<T extends Product> {
  /** The partial product object being built */
  private product: Partial<T> = {};

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
   * @source
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
   * @source
   */
  setData(data: Partial<T>): ProductBuilder<T> {
    if (data === null || typeof data !== "object") {
      return this;
    }
    // Route every key through its validating setter instead of a blind Object.assign, so values
    // can't bypass the per-field checks. `Record<keyof Product, …>` forces this map to stay
    // exhaustive — adding a Product field without a handler is a compile error. Keys not present
    // here (i.e. not part of Product) are dropped with a warning.
    const dispatch: Record<keyof Product, (value: unknown) => void> = {
      title: (v) => this.setTitle(v),
      supplier: (v) => this.setSupplier(v),
      url: (v) => this.setURL(v),
      permalink: (v) => this.setPermalink(v),
      description: (v) => this.setDescription(v),
      shortDescription: (v) => this.setShortDescription(v),
      manufacturer: (v) => this.setManufacturer(v),
      vendor: (v) => this.setVendor(v),
      sku: (v) => this.setSku(v),
      id: (v) => this.setID(v),
      uuid: (v) => this.setUUID(v),
      cas: (v) => this.setCAS(v),
      formula: (v) => this.setFormula(v),
      smiles: (v) => this.setSmiles(v),
      moleweight: (v) => this.setMoleweight(v),
      purity: (v) => this.setPurity(v),
      grade: (v) => this.setGrade(v),
      concentration: (v) => this.setConcentration(v),
      moles: (v) => this.setMoles(v),
      price: (v) => this.setPrice(v),
      usdPrice: (v) => this.setUsdPrice(v),
      localPrice: (v) => this.setLocalPrice(v),
      currencyCode: (v) => this.setCurrencyCode(v),
      currencySymbol: (v) => this.setCurrencySymbol(v),
      uom: (v) => this.setUOM(v),
      baseUom: (v) => this.setBaseUom(v),
      baseQuantity: (v) => this.setBaseQuantity(v),
      quantity: (v) => this.setQuantityValue(v),
      rating: (v) => this.setRating(v),
      reviewCount: (v) => this.setReviewCount(v),
      status: (v) => this.setStatus(v),
      statusTxt: (v) => this.setStatusTxt(v),
      shippingInformation: (v) => this.setShippingInformation(v),
      attributes: (v) => this.setAttributes(v),
      availability: (v) => {
        // setAvailability is overloaded per type, so a `string | boolean` union won't resolve —
        // narrow to a single type in each branch before calling.
        if (typeof v === "string") this.setAvailability(v);
        else if (typeof v === "boolean") this.setAvailability(v);
      },
      thumbnail: (v) => this.setThumbnail(v),
      imageURL: (v) => this.setImage(v),
      imageAltText: (v) => {
        if (typeof v === "string" && v.trim().length > 0) this.product.imageAltText = v;
      },
      sdsUrl: (v) => this.setSDSUrl(v),
      specSheetUrl: (v) => this.setSpecSheetUrl(v),
      docLinks: (v) => this.setDocLinks(v),
      supplierCountry: (v) => this.setSupplierCountry(v),
      supplierShipping: (v) => this.setSupplierShipping(v),
      paymentMethods: (v) => this.setSupplierPaymentMethods(v),
      variants: (v) => {
        if (Array.isArray(v)) this.setVariants(v);
      },
      matchPercentage: (v) => this.setMatchPercentage(v),
      _fuzz: (v) => {
        if (this.isFuzzMeta(v)) this.product._fuzz = v;
      },
    };

    for (const [key, value] of Object.entries(data)) {
      const handler = dispatch[key as keyof Product];
      if (handler) {
        handler(value);
      } else {
        this.logger.warn(`setData| dropping unsupported key "${key}"`, { key, value });
      }
    }
    return this;
  }

  /**
   * Validates and sets the product quantity from an arbitrary value. Unlike {@link setQuantity},
   * this sets only the numeric quantity (the UOM is set separately via its own key), so it can be
   * driven by {@link setData} where each field arrives independently.
   * @param quantity - The quantity to set, or any value (anything that isn't a positive number is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setQuantityValue(500);
   * ```
   * @source
   */
  setQuantityValue(quantity: unknown): ProductBuilder<T> {
    const value = typeof quantity === "string" ? Number(quantity) : quantity;
    if (typeof value === "number" && !Number.isNaN(value) && value > 0) {
      this.product.quantity = value;
    }
    return this;
  }

  /**
   * Narrows an unknown value to the `{ score: number; idx: number }` shape of {@link Product._fuzz}.
   * @param value - The value to test
   * @returns True when the value is a valid fuzz-metadata object
   * @example
   * ```typescript
   * this.isFuzzMeta({ score: 0.9, idx: 3 }); // true
   * this.isFuzzMeta({ score: "high" });       // false
   * ```
   * @source
   */
  private isFuzzMeta(value: unknown): value is { score: number; idx: number } {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as { score?: unknown }).score === "number" &&
      typeof (value as { idx?: unknown }).idx === "number"
    );
  }

  /**
   * Sets the basic information for the product by delegating to {@link setTitle},
   * {@link setURL}, and {@link setSupplier}, each of which validates its own input.
   *
   * @param title - The display name/title of the product, or any value (invalid input is ignored)
   * @param url - The URL where the product can be found (can be relative to baseURL), or any value
   * @param supplier - The name of the supplier/vendor, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setBasicInfo(
   *   'Hydrochloric Acid',
   *   '/products/hcl-solution',
   *   'ChemSupplier'
   * );
   * ```
   * @source
   */
  setBasicInfo(title: unknown, url: unknown, supplier: unknown): ProductBuilder<T> {
    return this.setTitle(title).setURL(url).setSupplier(supplier);
  }

  /**
   * Sets the product title. A value that isn't a non-empty string is ignored.
   * @param title - The display name/title of the product, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setTitle("Hydrochloric Acid");
   * ```
   * @source
   */
  setTitle(title: unknown): ProductBuilder<T> {
    if (typeof title === "string" && title.trim().length > 0) {
      this.product.title = title;
    }
    return this;
  }

  /**
   * Sets the supplier name. A value that isn't a non-empty string is ignored.
   * @param supplier - The name of the supplier/vendor, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setSupplier("ChemSupplier");
   * ```
   * @source
   */
  setSupplier(supplier: unknown): ProductBuilder<T> {
    if (typeof supplier === "string" && supplier.trim().length > 0) {
      this.product.supplier = supplier;
    }
    return this;
  }

  /**
   * Sets the URL for the product. A value that isn't a usable URL is ignored.
   * @param url - The URL to set, or any value (non-URLs are ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setURL("https://example.com/products/sodium-chloride-500g");
   * ```
   * @source
   */
  setURL(url: unknown): ProductBuilder<T> {
    const href = this.resolveHref(url);
    if (href) {
      this.product.url = href;
    }
    return this;
  }

  /**
   * Sets the permalink for the product. A value that isn't a usable URL is ignored.
   * @param permalink - The permalink to set, or any value (non-URLs are ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setPermalink("https://example.com/products/sodium-chloride-500g");
   * ```
   * @source
   */
  setPermalink(permalink: unknown): ProductBuilder<T> {
    const href = this.resolveHref(permalink);
    if (href) {
      this.product.permalink = href;
    }
    return this;
  }

  /**
   * Sets the SDS URL for the product. Accepts the often-optional result of a parser directly;
   * a value that isn't a usable URL (undefined, empty, wrong type) is ignored.
   * @param sdsUrl - The SDS URL to set, or any value (non-URLs are ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setSDSUrl("https://example.com/sds.pdf");
   * builder.setSDSUrl(findPdfHref(html)); // no-ops when findPdfHref returns undefined
   * ```
   * @source
   */
  setSDSUrl(sdsUrl: unknown): ProductBuilder<T> {
    const href = this.resolveHref(sdsUrl);
    if (href) {
      this.product.sdsUrl = href;
    }
    return this;
  }

  /**
   * Sets the spec sheet URL for the product. A value that isn't a non-empty string is ignored.
   * @param specSheetUrl - The spec sheet URL to set, or any value (non-strings are ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setSpecSheetUrl("https://example.com/spec-sheet.pdf");
   * ```
   * @source
   */
  setSpecSheetUrl(specSheetUrl: unknown): ProductBuilder<T> {
    if (typeof specSheetUrl === "string" && specSheetUrl.trim().length > 0) {
      this.product.specSheetUrl = specSheetUrl;
    }
    return this;
  }

  /**
   * Sets the image URL (and optional alt text) for the product. An imageURL that isn't a usable
   * URL is ignored; alt text is only applied alongside a valid image.
   * @param imageURL - The image URL to set, or any value (non-URLs are ignored)
   * @param imageAltText - The alt text for the image, or any value (non-strings are ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setImage("https://example.com/image.jpg");
   * builder.setImage("https://example.com/image.jpg", "Sodium Chloride ACS Grade 500g");
   * ```
   * @source
   */
  setImage(imageURL: unknown, imageAltText?: unknown): ProductBuilder<T> {
    const href = this.resolveHref(imageURL);
    if (!href) {
      return this;
    }
    this.product.imageURL = href;
    if (typeof imageAltText === "string" && imageAltText.trim().length > 0) {
      this.product.imageAltText = imageAltText;
    }
    return this;
  }

  /**
   * Sets the thumbnail URL for the product. A value that isn't a usable URL is ignored.
   * @param thumbnail - The thumbnail URL to set, or any value (non-URLs are ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setThumbnail("https://example.com/thumbnail.jpg/thumbnail.jpg");
   * ```
   * @source
   */
  setThumbnail(thumbnail: unknown): ProductBuilder<T> {
    const href = this.resolveHref(thumbnail);
    if (href) {
      this.product.thumbnail = href;
    }
    return this;
  }

  /**
   * Sets the formula for the product. A value that isn't a recognizable formula is ignored.
   *
   * @param formula - The formula to set, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setFormula('foobar K<sub>2</sub>Cr<sub>2</sub>O<sub>7</sub> baz');
   * // sets this.product.formula to "K₂Cr₂O₇"
   * builder.setFormula("H<sub>2</sub>SO<sub>4</sub>");
   * // sets this.product.formula to "H₂SO₄"
   * builder.setFormula("NaBH4");
   * // sets this.product.formula to "NaBH4" (clean formula stored as-is)
   * builder.setFormula("Just some text");
   * // leaves this.product.formula unset
   * ```
   * @source
   */
  setFormula(formula: unknown): ProductBuilder<T> {
    if (typeof formula !== "string" || formula.trim().length === 0) {
      return this;
    }
    const trimmed = formula.trim();
    // Store as-is when the value is already a finished formula: either a clean ASCII formula
    // (incl. ones containing "1" like "C12H22O11", which findFormulaInHtml mishandles) or one
    // already display-formatted with unicode subscripts and hydrate notation
    // (e.g. "NH₄NaC₄H₄O₆ x 4H₂O"). Re-parsing those would corrupt them.
    if (!trimmed.includes("<sub>") && (isMoleForm(trimmed) || /[₀-₉]/.test(trimmed))) {
      this.product.formula = trimmed;
      return this;
    }
    // Otherwise extract and subscript-format a formula from HTML/surrounding text.
    const parsedResult = findFormulaInHtml(trimmed);
    if (parsedResult) {
      this.product.formula = parsedResult;
    }
    return this;
  }

  /**
   * Sets the grade/purity level of the product.
   * Only sets the grade if a non-empty string is provided.
   *
   * @param grade - The grade or purity level of the product, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setGrade("ACS Grade");
   * builder.setGrade("Reagent Grade");
   * ```
   * @source
   */
  setGrade(grade: unknown): ProductBuilder<T> {
    if (typeof grade === "string" && grade.trim().length > 0) {
      this.product.grade = grade;
    }
    return this;
  }

  /**
   * Sets the price for the product. This is useful for if the price and currency are easier
   * to add separately (eg: getting the currency code is done in a different request handler)
   * @param price - The price to set (a number or numeric string), or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setPrice(123.34);
   * ```
   * @source
   */
  setPrice(price: unknown): ProductBuilder<T> {
    if (typeof price !== "number" && typeof price !== "string") {
      // A non-null, non-numeric value is a genuine misuse worth flagging; absent input is a quiet no-op.
      if (price != null) {
        this.logger.warn(`setPrice| Invalid price: ${price}`, {
          price,
          builder: this,
          product: this.product,
        });
      }
      return this;
    }
    const value = Number(price);
    if (!Number.isNaN(value)) {
      this.product.price = value;
    }
    return this;
  }

  /**
   * Sets the currency symbol for the product. This is useful for if the price and currency are easier
   * to add separately (eg: getting the currency code is done in a different request handler).
   * If no currency symbol is set, then it will be inferred from the currencyCode
   * @param sign - The currency symbol to set, or any value (anything that isn't a known symbol is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setCurrencySymbol('$');
   * ```
   * @source
   */
  setCurrencySymbol(sign: unknown): ProductBuilder<T> {
    if (isCurrencySymbol(sign)) {
      this.product.currencySymbol = sign;
    } else if (sign != null) {
      this.logger.warn(`setCurrencySymbol| Invalid currency symbol: ${sign}`, {
        sign,
        builder: this,
        product: this.product,
      });
    }
    return this;
  }

  /**
   * Sets the currency code for the product. This is useful for if the price and currency are easier
   * to add separately (eg: getting the currency code is done in a different request handler).
   * @param code - The currency code to set, or any value (anything that isn't a known code is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setCurrencyCode('USD');
   * ```
   * @source
   */
  setCurrencyCode(code: unknown): ProductBuilder<T> {
    if (isCurrencyCode(code)) {
      this.product.currencyCode = code;
    } else if (code != null) {
      this.logger.warn(`setCurrencyCode| Invalid currency code: ${code}`, {
        code,
        builder: this,
        product: this.product,
      });
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
   * // Sets this.product.price to 123.34
   * // Sets this.product.currencyCode to 'USD'
   * // Sets this.product.currencySymbol to '$'
   * ```
   * @source
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
   * // Sets this.product.price to 123.34
   * // Sets this.product.currencyCode to 'USD'
   * // Sets this.product.currencySymbol to '$'
   * ```
   * @source
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
   * // Sets this.product.price to 123.34
   * // Sets this.product.currencyCode to 'USD'
   * // Sets this.product.currencySymbol to '$'
   * ```
   * @source
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
      this.product.price = price.price;
      this.product.currencyCode = price.currencyCode;
      this.product.currencySymbol = price.currencySymbol;
      return this;
    }
    if (typeof currencyCode === "string") this.product.currencyCode = currencyCode;
    if (typeof currencySymbol === "string") this.product.currencySymbol = currencySymbol;

    if (typeof price === "string") {
      if (Number.isNaN(Number(price)) === false) {
        this.product.price = Number(price);
        return this;
      }

      const parsedPrice = parsePrice(price);
      if (parsedPrice) {
        this.product.price = parsedPrice.price;
        this.product.currencyCode = parsedPrice.currencyCode;
        this.product.currencySymbol = parsedPrice.currencySymbol;
        return this;
      }
    }

    this.product.price = Number(price);

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
   * // Sets this.product.quantity to 500
   * // Sets this.product.uom to 'g'
   * ```
   * @source
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
   * // Sets this.product.quantity to 500
   * // Sets this.product.uom to 'g'
   * ```
   * @source
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
   * // Sets this.product.quantity to 500
   * // Sets this.product.uom to 'g'
   * ```
   * @source
   */
  setQuantity(quantity: number, uom: string): ProductBuilder<T>;
  setQuantity(quantity: QuantityObject | string | number, uom?: string): ProductBuilder<T> {
    if (typeof quantity === "undefined") return this;

    if (isQuantityObject(quantity)) {
      this.product.quantity = quantity.quantity;
      this.product.uom = quantity.uom;
      return this;
    }

    if (typeof quantity === "string" && typeof uom === "undefined") {
      const parsedQuantity = parseQuantity(quantity);
      if (parsedQuantity) {
        this.product.quantity = parsedQuantity.quantity;
        this.product.uom = parsedQuantity.uom;
        return this;
      }

      const [qty, unit] = quantity.split(/\s(.+)/s);

      if (Number.isNaN(Number(qty))) {
        this.logger.warn(`Unable to parse quantity from string: ${quantity}`, {
          quantity,
          builder: this,
          product: this.product,
        });
        return this;
      }
      this.product.quantity = Number(qty);
      this.product.uom = unit;
      return this;
    }

    if (typeof quantity === "number" || Number.isInteger(quantity)) {
      this.product.quantity = Number(quantity);
      this.product.uom = uom ?? "pieces";

      return this;
    }

    this.logger.warn(
      `Unknown quantity type: ${typeof quantity} - Expected number, string, or QuantityObject`,
      {
        quantity,
        builder: this,
        product: this.product,
      },
    );
    return this;
  }

  /**
   * Sets the moles for the product.
   * @param moles - The moles to set, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setMoles(23.5);
   * ```
   * @source
   */
  setMoles(moles: unknown): ProductBuilder<T> {
    if (typeof moles === "number" && !Number.isNaN(moles) && moles > 0) {
      this.product.moles = moles;
    }
    return this;
  }
  /**
   * Sets the unit of measure for the product.
   *
   * @param uom - The unit of measure to set, or any value (anything that isn't a known UOM is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setUOM('g');
   * ```
   * @source
   */
  setUOM(uom: unknown): ProductBuilder<T> {
    if (isUOM(uom)) {
      this.product.uom = uom;
    } else if (uom != null) {
      this.logger.warn(`Unknown UOM: ${uom}`);
    }
    return this;
  }

  /**
   * Sets the country of the supplier.
   *
   * @param country - The country of the supplier, or any value (anything that isn't a known country code is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setSupplierCountry("US");
   * ```
   * @source
   */
  setSupplierCountry(country: unknown): ProductBuilder<T> {
    if (isCountryCode(country)) {
      this.product.supplierCountry = country;
    }
    return this;
  }

  /**
   * Sets the shipping scope of the supplier.
   *
   * @param shipping - The shipping scope, or any value (anything that isn't a known shipping range is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setSupplierShipping("worldwide");
   * ```
   * @source
   */
  setSupplierShipping(shipping: unknown): ProductBuilder<T> {
    if (isShippingRange(shipping)) {
      this.product.supplierShipping = shipping;
    }
    return this;
  }

  /**
   * Sets the payment methods accepted by the supplier.
   *
   * @param paymentMethods - A payment method or array of them, or any value (non-payment-method entries are dropped)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setSupplierPaymentMethods(["visa", "mastercard"]);
   * ```
   * @source
   */
  setSupplierPaymentMethods(paymentMethods: unknown): ProductBuilder<T> {
    const candidates = Array.isArray(paymentMethods) ? paymentMethods : [paymentMethods];
    const valid = candidates.filter(isPaymentMethod);
    if (valid.length > 0) {
      this.product.paymentMethods = valid;
    }
    return this;
  }

  /**
   * Sets the product description.
   *
   * @param description - The detailed description of the product, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setDescription(
   *   'High purity sodium chloride, 99.9% pure, suitable for laboratory use'
   * );
   * ```
   * @source
   */
  setDescription(description: unknown): ProductBuilder<T> {
    if (typeof description === "string" && description.trim().length > 0) {
      this.product.description = htmlToAscii(description);
    }
    return this;
  }

  /**
   * Sets the short description for the product.
   * @param shortDescription - The short description to set, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setShortDescription("Sodium Chloride 500g");
   * ```
   * @source
   */
  setShortDescription(shortDescription: unknown): ProductBuilder<T> {
    if (typeof shortDescription === "string" && shortDescription.trim().length > 0) {
      this.product.shortDescription = htmlToAscii(shortDescription);
    }
    return this;
  }

  /**
   * Sets the rating for the product.
   * @param rating - The rating to set, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setRating(4.5);
   * ```
   * @source
   */
  setRating(rating: unknown): ProductBuilder<T> {
    if (typeof rating === "number" || typeof rating === "string") {
      const value = Number(rating);
      if (!Number.isNaN(value)) {
        this.product.rating = value;
      }
    }
    return this;
  }

  /**
   * Sets the review count for the product.
   * @param reviewCount - The review count to set, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setReviewCount(100);
   * ```
   * @source
   */
  setReviewCount(reviewCount: unknown): ProductBuilder<T> {
    if (typeof reviewCount === "number" || typeof reviewCount === "string") {
      const value = Number(reviewCount);
      if (!Number.isNaN(value)) {
        this.product.reviewCount = value;
      }
    }
    return this;
  }

  /**
   * Sets the CAS (Chemical Abstracts Service) registry number for the product.
   * Validates the CAS number format before setting.
   *
   * @param cas - The CAS registry number in format "XXXXX-XX-X", or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * // For sodium chloride
   * builder.setCAS('7647-14-5');
   * // For invalid CAS number (will not set)
   * builder.setCAS('invalid-cas');
   * ```
   * @source
   */
  setCAS(cas: unknown): ProductBuilder<T> {
    if (typeof cas !== "string") {
      // Only flag a genuine misuse (a non-string value); an absent value is a quiet no-op.
      if (cas != null) {
        this.logger.warn(`setCAS| Invalid CAS number`, {
          cas,
          builder: this,
          product: this.product,
        });
      }
      return this;
    }

    if (isCAS(cas)) {
      this.product.cas = cas;
    } else {
      const parsedACAS = findCAS(cas);
      if (parsedACAS) {
        this.product.cas = parsedACAS;
      }
    }
    return this;
  }

  /**
   * Sets the ID for the product.
   *
   * @param id - The unique identifier for the product, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setID(12345);
   * ```
   * @source
   */
  setID(id: unknown): ProductBuilder<T> {
    if (typeof id === "number" || typeof id === "string") {
      // T["id"] narrows the generic product's id type; the number|string input is the data-model alias for it.
      this.product.id = id as T["id"];
    }
    return this;
  }

  /**
   * Sets the UUID for the product.
   *
   * @param uuid - The UUID string for the product, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setUUID('550e8400-e29b-41d4-a716-446655440000');
   * ```
   * @source
   */
  setUUID(uuid: unknown): ProductBuilder<T> {
    if (typeof uuid === "string" && uuid.trim().length > 0) {
      this.product.uuid = uuid;
    }
    return this;
  }

  /**
   * Sets the SKU (Stock Keeping Unit) for the product.
   *
   * @param sku - The SKU string for the product, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setSku('CHEM-NaCl-500G');
   * ```
   * @source
   */
  setSku(sku: unknown): ProductBuilder<T> {
    if (typeof sku === "string" && sku.trim().length > 0) {
      this.product.sku = sku;
    }
    return this;
  }

  /**
   * Sets the SMILES for the product. An absent value (undefined/null/empty) is ignored silently;
   * a value that is present but fails SMILES validation is ignored and logged as a warning.
   * @param smiles - The SMILES to set, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setSmiles("C1=CC=CC=C1");
   * builder.setSmiles(undefined); // no-op, no warning
   * ```
   * @source
   */
  setSmiles(smiles: unknown): ProductBuilder<T> {
    if (isSmiles(smiles)) {
      this.product.smiles = smiles;
    } else if (smiles !== undefined && smiles !== null && smiles !== "") {
      this.logger.warn(`setSmiles| Invalid SMILES: ${smiles}`, {
        smiles,
        builder: this,
      });
    }
    return this;
  }
  /**
   * Sets the vendor for the product.
   *
   * @param vendor - The vendor name, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setVendor('Vendor Name');
   * ```
   * @source
   */
  setVendor(vendor: unknown): ProductBuilder<T> {
    if (typeof vendor === "string" && vendor.trim().length > 0) {
      this.product.vendor = vendor;
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
   * @source
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
   * @source
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

    this.product.availability = avail;
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
   * @source
   */
  addVariant(variant: Partial<Variant>): ProductBuilder<T> {
    if (!this.product.variants) {
      this.product.variants = [];
    }
    this.product.variants.push(variant);
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
   * @source
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
   * @source
   */
  setVariants(variants: Partial<Variant>[]): ProductBuilder<T> {
    this.product.variants = variants;
    return this;
  }

  /**
   * Sets the purity for the product. Accepts `99`, `"99%"`, or any value; anything that doesn't
   * resolve to a percentage in the `(0, 100]` range is ignored.
   * @param purity - The purity to set (e.g. `99` or `"99%"`), or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setPurity(98);
   * builder.setPurity(98.5);
   * builder.setPurity(99);
   * builder.setPurity(99.5);
   * builder.setPurity(100);
   * builder.setPurity("98%");
   * builder.setPurity("98.5%");
   * builder.setPurity("99%");
   * builder.setPurity("99.5%");
   * builder.setPurity("100%");
   * ```
   * @source
   */
  setPurity(purity: unknown): ProductBuilder<T> {
    if (typeof purity === "string") {
      purity = Number(purity.replace("%", ""));
    }

    if (typeof purity === "number" && !Number.isNaN(purity) && purity > 0 && purity <= 100) {
      this.product.purity = purity;
    }
    return this;
  }

  /**
   * Sets the concentration for the product.
   * @param concentration - The concentration to set, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setConcentration("98%");
   * builder.setConcentration("98.5%");
   * builder.setConcentration("99%");
   * builder.setConcentration("99.5%");
   * builder.setConcentration("100%");
   * builder.setConcentration("1M");
   * ```
   * @source
   */
  setConcentration(concentration: unknown): ProductBuilder<T> {
    if (typeof concentration === "string" && concentration.trim().length > 0) {
      this.product.concentration = concentration;
    }
    return this;
  }

  /**
   * Sets the molecular weight for the product. A value that doesn't resolve to a positive number
   * is ignored.
   * @param moleweight - The molecular weight to set, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setMoleweight(100.00);
   * ```
   * @source
   */
  setMoleweight(moleweight: unknown): ProductBuilder<T> {
    if (typeof moleweight === "string") {
      moleweight = Number(moleweight);
    }

    if (typeof moleweight === "number" && !Number.isNaN(moleweight) && moleweight > 0) {
      this.product.moleweight = moleweight;
    }
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
   * @source
   */
  get(key: keyof T): T[keyof T] | Maybe<T[keyof T]> {
    if (key in this.product && typeof this.product[key] !== "undefined") {
      return this.product[key];
    }

    return;
  }

  /**
   * Sets the match percentage (Levenshtein result) for the product title
   * compared to the search string.
   *
   * @param matchPercentage - The match percentage to set, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setMatchPercentage(95);
   * ```
   * @source
   */
  setMatchPercentage(matchPercentage: unknown): ProductBuilder<T> {
    if (typeof matchPercentage === "number" && !Number.isNaN(matchPercentage)) {
      this.product.matchPercentage = matchPercentage;
    }
    return this;
  }

  /**
   * Sets the manufacturer name. A value that isn't a non-empty string is ignored.
   * @param manufacturer - The manufacturer name, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setManufacturer("Sigma-Aldrich");
   * ```
   * @source
   */
  setManufacturer(manufacturer: unknown): ProductBuilder<T> {
    if (typeof manufacturer === "string" && manufacturer.trim().length > 0) {
      this.product.manufacturer = manufacturer;
    }
    return this;
  }

  /**
   * Sets the status code of the product. A value that isn't a non-empty string is ignored.
   * @param status - The status code, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setStatus("IN_STOCK");
   * ```
   * @source
   */
  setStatus(status: unknown): ProductBuilder<T> {
    if (typeof status === "string" && status.trim().length > 0) {
      this.product.status = status;
    }
    return this;
  }

  /**
   * Sets the human-readable status text of the product. A non-string value is ignored.
   * @param statusTxt - The status description, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setStatusTxt("In Stock");
   * ```
   * @source
   */
  setStatusTxt(statusTxt: unknown): ProductBuilder<T> {
    if (typeof statusTxt === "string" && statusTxt.trim().length > 0) {
      this.product.statusTxt = statusTxt;
    }
    return this;
  }

  /**
   * Sets special shipping information for the product. A non-string value is ignored.
   * @param shippingInformation - The shipping note, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setShippingInformation("Hazardous material - special shipping required");
   * ```
   * @source
   */
  setShippingInformation(shippingInformation: unknown): ProductBuilder<T> {
    if (typeof shippingInformation === "string" && shippingInformation.trim().length > 0) {
      this.product.shippingInformation = shippingInformation;
    }
    return this;
  }

  /**
   * Sets the product attributes. Accepts an array and keeps only entries shaped like
   * `{ name: string; value: string }`; anything else is dropped.
   * @param attributes - The attributes array, or any value (invalid entries are dropped)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setAttributes([{ name: "Size", value: "500g" }]);
   * ```
   * @source
   */
  setAttributes(attributes: unknown): ProductBuilder<T> {
    if (!Array.isArray(attributes)) {
      return this;
    }
    const valid = attributes.filter(
      (entry): entry is { name: string; value: string } =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { name?: unknown }).name === "string" &&
        typeof (entry as { value?: unknown }).value === "string",
    );
    if (valid.length > 0) {
      this.product.attributes = valid;
    }
    return this;
  }

  /**
   * Sets the reference (base) quantity used for unit conversions. A value that doesn't
   * resolve to a positive number is ignored.
   * @param baseQuantity - The base quantity, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setBaseQuantity(500);
   * ```
   * @source
   */
  setBaseQuantity(baseQuantity: unknown): ProductBuilder<T> {
    const value = typeof baseQuantity === "string" ? Number(baseQuantity) : baseQuantity;
    if (typeof value === "number" && !Number.isNaN(value) && value > 0) {
      this.product.baseQuantity = value;
    }
    return this;
  }

  /**
   * Sets the reference (base) unit of measure used for conversions. Anything that isn't a
   * known UOM is ignored.
   * @param baseUom - The base unit of measure, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setBaseUom("g");
   * ```
   * @source
   */
  setBaseUom(baseUom: unknown): ProductBuilder<T> {
    if (isUOM(baseUom)) {
      this.product.baseUom = baseUom;
    }
    return this;
  }

  /**
   * Sets the price converted to USD. A value that doesn't resolve to a non-negative number
   * is ignored. Note: {@link build} recomputes this from price/currency, so it is normally derived.
   * @param usdPrice - The USD price, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setUsdPrice(19.99);
   * ```
   * @source
   */
  setUsdPrice(usdPrice: unknown): ProductBuilder<T> {
    const value = typeof usdPrice === "string" ? Number(usdPrice) : usdPrice;
    if (typeof value === "number" && !Number.isNaN(value) && value >= 0) {
      this.product.usdPrice = value;
    }
    return this;
  }

  /**
   * Sets the price converted to the user's local currency. A value that doesn't resolve to a
   * non-negative number is ignored.
   * @param localPrice - The local price, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setLocalPrice(18.5);
   * ```
   * @source
   */
  setLocalPrice(localPrice: unknown): ProductBuilder<T> {
    const value = typeof localPrice === "string" ? Number(localPrice) : localPrice;
    if (typeof value === "number" && !Number.isNaN(value) && value >= 0) {
      this.product.localPrice = value;
    }
    return this;
  }

  /**
   * Sets related documentation links (MSDS, SDS, etc.). Accepts an array and keeps only the
   * non-empty string entries; anything else is dropped.
   * @param docLinks - The documentation URLs, or any value (invalid entries are dropped)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setDocLinks(["https://supplier.com/msds/nacl.pdf"]);
   * ```
   * @source
   */
  setDocLinks(docLinks: unknown): ProductBuilder<T> {
    if (!Array.isArray(docLinks)) {
      return this;
    }
    const valid = docLinks.filter(
      (link): link is string => typeof link === "string" && link.trim().length > 0,
    );
    if (valid.length > 0) {
      this.product.docLinks = valid;
    }
    return this;
  }

  /**
   * Gets a specific variant from the product.
   *
   * @param index - The index of the variant to get
   * @returns The variant object
   * @example
   * ```typescript
   * const variant = builder.getVariant(0);
   * console.log(variant); // { id: 1, title: '500g Package', price: 49.99, quantity: 500, uom: 'g' }
   * ```
   * @source
   */
  getVariant(index: number): Variant | undefined {
    return this.product.variants?.[index];
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
   * @source
   */
  private href(path: string | URL): string {
    if (URL.canParse(path)) {
      return String(path);
    }
    const urlObj = new URL(path, this.baseURL);
    return String(urlObj);
  }

  /**
   * Resolves an unknown value to an absolute URL string, or undefined when it isn't URL-like.
   * Lets the URL setters accept the often-optional output of a parser (e.g. `findPdfHref`)
   * directly, without each caller having to null-check first.
   * @param value - The candidate URL (string or URL), or anything else
   * @returns The absolute URL as a string, or undefined if the value isn't a usable URL
   * @example
   * ```typescript
   * this.resolveHref("/sds.pdf");  // "https://example.com/sds.pdf"
   * this.resolveHref(undefined);    // undefined
   * ```
   * @source
   */
  private resolveHref(value: unknown): string | undefined {
    if (value instanceof URL) {
      return this.href(value);
    }
    if (typeof value === "string" && value.trim().length > 0) {
      return this.href(value);
    }
    return undefined;
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
   * @source
   */
  async build(): Promise<Maybe<T>> {
    if (!isMinimalProduct(this.product)) {
      return;
    }

    this.product.usdPrice = this.product.price;
    const baseQuantity = toBaseQuantity(this.product.quantity, this.product.uom);
    if (baseQuantity) {
      this.product.baseQuantity = baseQuantity;
    }

    if (this.product.currencyCode !== "USD") {
      this.product.usdPrice = await toUSD(this.product.price, this.product.currencyCode);
    }

    // Process variants if present
    if (this.product.variants?.length) {
      // Filter out invalid variants
      this.product.variants = this.product.variants.filter((variant) => isValidVariant(variant));

      // Process each variant
      for (const variant of this.product.variants ?? []) {
        if ("quantity" in variant === false || !variant.quantity) {
          this.logger.warn("Skipping variant, no quantity found", {
            variant,
            product: this.product,
            builder: this,
          });
          continue;
        }

        if ("price" in variant === false || !variant.price) {
          this.logger.warn("Skipping variant, no price found", {
            variant,
            product: this.product,
            builder: this,
          });
          continue;
        }

        if ("usdPrice" in variant === false || !variant.usdPrice) {
          variant.usdPrice = await toUSD(variant.price, this.product.currencyCode);
        }

        if ("uom" in variant === false || !variant.uom) {
          variant.uom = this.product.uom;
        }

        // Sometimes variants don't have their own titles, they're just a dropdown on
        // the same page, so if that's the case then we should append the quantity to
        // the title to differentiate them.
        if (
          "title" in variant === false ||
          !variant.title?.trim()?.length ||
          variant.title === this.product.title
        ) {
          variant.title = `${this.product.title} - ${variant.quantity}${variant.uom}`;
        }

        if (variant.url) {
          variant.url = this.href(variant.url);
        }

        // Default the variant's human-facing permalink to its own permalink,
        // then its processing URL, then the parent product's permalink/URL.
        const variantPermalink =
          variant.permalink ?? variant.url ?? this.product.permalink ?? this.product.url;
        if (variantPermalink) {
          variant.permalink = this.href(variantPermalink);
        }

        // Re-populate the variant using the parent product properties as defaults and the current
        // values as overrides.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { variants: _, ...defaults } = this.product;

        Object.assign(variant, defaults, { ...variant });
      }
    }

    if (this.product._fuzz) {
      this.product.matchPercentage = this.product._fuzz.score;
    }

    if (!isProduct(this.product)) {
      this.logger.error(`ProductBuilder| Invalid product:`, {
        product: this.product,
        builder: this,
      });
      return;
    }

    this.product.url = this.href(this.product.url);
    // Human-facing permalink defaults to the processing URL when a supplier
    // didn't set one (the common case for scraped suppliers).
    this.product.permalink = this.href(this.product.permalink ?? this.product.url);
    this.logger.debug("ProductBuilder| Built product:", { product: this.product, builder: this });
    // isProduct() above narrows to the base Product; T is the caller's concrete subtype of Product.
    return this.product as T;
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
   * @source
   */
  dump(): Partial<T> {
    return this.product;
  }

  /**
   * Creates an array of ProductBuilder instances from cached product data.
   * This is used to restore builders from cache storage.
   *
   * @param baseURL - The base URL of the supplier's website
   * @param data - Array of cached product data (from .dump())
   * @returns Array of ProductBuilder instances
   * @example
   * ```typescript
   * const cachedData = await chrome.storage.local.get('cached_products');
   * const builders = ProductBuilder.createFromCache('https://example.com', cachedData);
   * for (const builder of builders) {
   *   const product = await builder.build();
   *   console.log(product.title);
   * }
   * ```
   * @source
   */
  public static createFromCache<T extends Product>(
    baseURL: string,
    data: unknown[],
  ): ProductBuilder<T>[] {
    return data.map((d) => {
      const builder = new ProductBuilder<T>(baseURL);
      // Cached .dump() output is opaque unknown[]; no runtime shape exists for the generic Partial<T>,
      // and build() re-validates the result via isProduct() before use.
      builder.setData(d as Partial<T>);
      return builder;
    });
  }
}
