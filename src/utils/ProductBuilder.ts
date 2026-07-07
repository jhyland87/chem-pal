import { AVAILABILITY } from "@/constants/common";
import { findCAS } from "@/helpers/cas";
import { parsePrice, toUSD } from "@/helpers/currency";
import { parseQuantity, toBaseQuantity } from "@/helpers/quantity";
import { findFormulaInHtml, findPurity } from "@/helpers/science";
import { htmlToAscii, isMoleForm } from "@/helpers/utils";
import { Logger } from "@/utils/Logger";
import { IS_DEV_BUILD } from "@/utils/isDevBuild";
import {
  isCAS,
  isCountryCode,
  isCurrencyCode,
  isCurrencySymbol,
  isInChI,
  isInChIKey,
  isIupacName,
  isMinimalProduct,
  isParsedPrice,
  isPaymentMethod,
  isProduct,
  isPubChemCID,
  isQuantityObject,
  isShippingRange,
  isSmiles,
  isUOM,
} from "@/utils/typeGuards/common";
import { isAvailability, isProductImage, isValidVariant } from "@/utils/typeGuards/productbuilder";

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

  /** Whether to show failed validation warnings */
  private showFailedValidation: boolean = IS_DEV_BUILD;

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
    //
    // @todo: This is AI garbage, and I need to clean it up. Too messy.
    //
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
      cacheKey: (v) => this.setCacheKey(v),
      cas: (v) => this.setCAS(v),
      formula: (v) => this.setFormula(v),
      smiles: (v) => this.setSmiles(v),
      iupacName: (v) => this.setIupacName(v),
      pubchemId: (v) => this.setPubchemId(v),
      inchiKey: (v) => this.setInChIKey(v),
      inchi: (v) => this.setInChI(v),
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
      images: (v) => this.addImages(v),
      sdsUrl: (v) => this.setSDSUrl(v),
      coaUrl: (v) => this.setCoaUrl(v),
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
      // Positional row index (synthetic, like _fuzz) — carried through if present
      // but never a real identifier.
      _id: (v) => {
        if (typeof v === "number") this.product._id = v;
      },
    };

    for (const [key, value] of Object.entries(data)) {
      const handler = dispatch[key as keyof Product];
      if (handler) {
        handler(value);
      } else {
        this.logger.warn("setData| dropping unsupported key", { key, value });
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
    } else if (title != null && this.showFailedValidation) {
      this.logger.warn("setTitle| Invalid title value", { title, builder: this });
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
    } else if (supplier != null && this.showFailedValidation) {
      this.logger.warn("setSupplier| Invalid supplier value", { supplier, builder: this });
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
    } else if (url != null && this.showFailedValidation) {
      this.logger.warn("setURL| Invalid URL", { url, builder: this });
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
    } else if (permalink != null && this.showFailedValidation) {
      this.logger.warn("setPermalink| Invalid permalink", { permalink, builder: this });
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
    } else if (sdsUrl != null && this.showFailedValidation) {
      this.logger.warn("setSDSUrl| Invalid SDS URL", { sdsUrl, builder: this });
    }
    return this;
  }

  /**
   * Sets the Certificate of Analysis (COA) URL for the product. Accepts the often-optional result
   * of a parser directly; a value that isn't a usable URL (undefined, empty, wrong type) is ignored.
   * @param coaUrl - The COA URL to set, or any value (non-URLs are ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setCoaUrl("https://example.com/coa.pdf");
   * builder.setCoaUrl(findPdfHref(html)); // no-ops when findPdfHref returns undefined
   * ```
   * @source
   */
  setCoaUrl(coaUrl: unknown): ProductBuilder<T> {
    const href = this.resolveHref(coaUrl);
    if (href) {
      this.product.coaUrl = href;
    } else if (coaUrl != null && this.showFailedValidation) {
      this.logger.warn("setCoaUrl| Invalid COA URL", { coaUrl, builder: this });
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
    const href = this.resolveHref(specSheetUrl);
    if (href) {
      this.product.specSheetUrl = href;
    } else if (specSheetUrl != null && this.showFailedValidation) {
      this.logger.warn("setSpecSheetUrl| Invalid spec sheet URL", { specSheetUrl, builder: this });
    }
    return this;
  }

  /**
   * Sets the product's default (primary) full-size image. Placed first among the image-type entries
   * so it's treated as the default; a previous default set this way is replaced. A value that isn't
   * a usable URL is ignored; alt text is only applied alongside a valid image.
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
    const image = this.buildImage(imageURL, "image", imageAltText);
    if (image) {
      this.setDefaultImage(image);
    } else if (imageURL != null && this.showFailedValidation) {
      this.logger.warn("setImage| Invalid image URL", { imageURL, builder: this });
    }
    return this;
  }

  /**
   * Sets the product's default (primary) thumbnail. Placed first among the thumbnail-type entries so
   * it's treated as the default; a previous default set this way is replaced. A supplier's main
   * thumbnail is often distinct from its gallery images, so this is kept as its own entry rather than
   * attached to any image. A value that isn't a usable URL is ignored.
   * @param thumbnail - The thumbnail URL to set, or any value (non-URLs are ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setThumbnail("https://example.com/thumb.jpg");
   * ```
   * @source
   */
  setThumbnail(thumbnail: unknown): ProductBuilder<T> {
    const image = this.buildImage(thumbnail, "thumbnail");
    if (image) {
      this.setDefaultImage(image);
    } else if (thumbnail != null && this.showFailedValidation) {
      this.logger.warn("setThumbnail| Invalid thumbnail URL", { thumbnail, builder: this });
    }
    return this;
  }

  /**
   * Appends a full-size image to the product's image list. Unlike {@link setImage}, this doesn't
   * replace the default — use it for gallery images. A value that isn't a usable URL is ignored.
   * @param imageURL - The image URL to add, or any value (non-URLs are ignored)
   * @param imageAltText - The alt text for the image, or any value (non-strings are ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.addImage("https://example.com/a.jpg", "front label");
   * ```
   * @source
   */
  addImage(imageURL: unknown, imageAltText?: unknown): ProductBuilder<T> {
    const image = this.buildImage(imageURL, "image", imageAltText);
    if (image) {
      this.pushImage(image);
    } else if (imageURL != null && this.showFailedValidation) {
      this.logger.warn("addImage| Invalid image URL", { imageURL, builder: this });
    }
    return this;
  }

  /**
   * Appends a thumbnail to the product's image list. Unlike {@link setThumbnail}, this doesn't
   * replace the default. A value that isn't a usable URL is ignored.
   * @param thumbnail - The thumbnail URL to add, or any value (non-URLs are ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.addThumbnail("https://example.com/a-t.jpg");
   * ```
   * @source
   */
  addThumbnail(thumbnail: unknown): ProductBuilder<T> {
    const image = this.buildImage(thumbnail, "thumbnail");
    if (image) {
      this.pushImage(image);
    } else if (thumbnail != null && this.showFailedValidation) {
      this.logger.warn("addThumbnail| Invalid thumbnail URL", { thumbnail, builder: this });
    }
    return this;
  }

  /**
   * Appends multiple full-size images to the product's image list. Each entry may be a plain URL
   * string (added via {@link addImage} as an `"image"`) or a pre-built `{ href, type, altText? }`
   * {@link ProductImage} object (whose explicit `type` is preserved, so mixed image/thumbnail arrays
   * are supported). Entries that don't resolve are ignored.
   * @param images - An array of URL strings and/or {@link ProductImage} values, or any value (non-arrays are ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.addImages(["https://example.com/a.jpg", "https://example.com/b.jpg"]);
   * builder.addImages([{ href: "https://example.com/a-t.jpg", type: "thumbnail" }]);
   * ```
   * @source
   */
  addImages(images: unknown): ProductBuilder<T> {
    this.addImageEntries(images, "image");
    return this;
  }

  /**
   * Appends multiple thumbnails to the product's image list. Each entry may be a plain URL string
   * (added via {@link addThumbnail} as a `"thumbnail"`) or a pre-built `{ href, type, altText? }`
   * {@link ProductImage} object (whose explicit `type` is preserved). Entries that don't resolve are
   * ignored.
   * @param thumbnails - An array of URL strings and/or {@link ProductImage} values, or any value (non-arrays are ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.addThumbnails(["https://example.com/a-t.jpg", "https://example.com/b-t.jpg"]);
   * ```
   * @source
   */
  addThumbnails(thumbnails: unknown): ProductBuilder<T> {
    this.addImageEntries(thumbnails, "thumbnail");
    return this;
  }

  /**
   * Appends each entry of an array to the product's image list. Pre-built {@link ProductImage}
   * objects are resolved with their explicit `type` preserved; any other entry is treated as a raw
   * URL and added with `defaultType` via {@link addImage}/{@link addThumbnail}.
   * @param entries - The array of URL strings and/or {@link ProductImage} values (non-arrays are ignored)
   * @param defaultType - The `type` to stamp on raw-URL entries
   * @returns Nothing.
   * @example
   * ```typescript
   * this.addImageEntries(["/a.jpg"], "image"); // adds { href: "https://base/a.jpg", type: "image" }
   * this.addImageEntries([{ href: "/a-t.jpg", type: "thumbnail" }], "image"); // preserves "thumbnail"
   * ```
   * @source
   */
  private addImageEntries(entries: unknown, defaultType: ProductImageType): void {
    if (!Array.isArray(entries)) {
      return;
    }
    const uniqueEntries = [...new Set(entries)];
    for (const entry of uniqueEntries) {
      if (isProductImage(entry)) {
        const resolved = this.resolveImageEntry(entry);
        if (resolved) this.pushImage(resolved);
      } else if (defaultType === "image") {
        this.addImage(entry);
      } else {
        this.addThumbnail(entry);
      }
    }
  }

  /**
   * Builds a {@link ProductImage} of the given type from a URL, resolving it to an absolute href, or
   * `undefined` when the URL isn't usable.
   * @param url - The image URL.
   * @param type - Whether the entry is a full-size image or a thumbnail.
   * @param altText - Optional alt text; applied only when it's a non-empty string.
   * @returns The built image entry, or `undefined` when the URL doesn't resolve.
   * @example
   * ```typescript
   * this.buildImage("/a.jpg", "image", "front"); // => { href: "https://base/a.jpg", type: "image", altText: "front" }
   * this.buildImage("", "thumbnail"); // => undefined
   * ```
   * @source
   */
  private buildImage(
    url: unknown,
    type: ProductImageType,
    altText?: unknown,
  ): ProductImage | undefined {
    const href = this.resolveHref(url);
    if (!href) {
      return undefined;
    }
    const image: ProductImage = { href, type };
    if (typeof altText === "string" && altText.trim().length > 0) {
      image.altText = altText;
    }
    return image;
  }

  /**
   * Normalizes an unknown `{ href, type, altText? }` value into a {@link ProductImage} with an
   * absolute href, or `undefined` when it isn't a valid entry or its href doesn't resolve.
   * @param entry - The candidate image entry.
   * @returns The resolved image entry, or `undefined` when it's not valid.
   * @example
   * ```typescript
   * this.resolveImageEntry({ href: "/a.jpg", type: "image" }); // => { href: "https://base/a.jpg", type: "image" }
   * this.resolveImageEntry({ href: "/a.jpg", type: "banner" }); // => undefined
   * ```
   * @source
   */
  private resolveImageEntry(entry: unknown): ProductImage | undefined {
    if (!isProductImage(entry)) {
      return undefined;
    }
    return this.buildImage(entry.href, entry.type, entry.altText);
  }

  /**
   * Appends an image entry to the product's image list, creating the list on first use.
   * @param image - The already-resolved image entry to append.
   * @returns Nothing.
   * @example
   * ```typescript
   * this.pushImage({ href: "https://example.com/a.jpg", type: "image" });
   * ```
   * @source
   */
  private pushImage(image: ProductImage): void {
    if (!this.product.images) {
      this.product.images = [];
    }
    this.product.images.push(image);
  }

  /**
   * Makes an image entry the default for its type by inserting it at the front of the list, so it's
   * the first entry of that type. Existing entries (gallery images/thumbnails) are kept.
   * @param image - The image entry to set as its type's default.
   * @returns Nothing.
   * @example
   * ```typescript
   * this.setDefaultImage({ href: "https://example.com/a.jpg", type: "image" });
   * ```
   * @source
   */
  private setDefaultImage(image: ProductImage): void {
    if (!this.product.images) {
      this.product.images = [];
    }
    this.product.images.unshift(image);
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
    } else if (grade != null && this.showFailedValidation) {
      this.logger.warn("setGrade| Invalid grade value", { grade, builder: this });
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
      if (price != null && this.showFailedValidation) {
        this.logger.warn("setPrice| Invalid price", {
          price,
          builder: this,
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
    } else if (sign != null && this.showFailedValidation) {
      this.logger.warn("setCurrencySymbol| Invalid currency symbol", {
        sign,
        builder: this,
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
    } else if (code != null && this.showFailedValidation) {
      this.logger.warn("setCurrencyCode| Invalid currency code", {
        code,
        builder: this,
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
        this.logger.warn(`setQuantity| Unable to parse quantity from string`, {
          quantity,
          builder: this,
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

    if (this.showFailedValidation) {
      this.logger.warn("setQuantity| Unknown quantity type", {
        quantity,
        builder: this,
      });
    }
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
    } else if (moles != null && this.showFailedValidation) {
      this.logger.warn("setMoles| Invalid moles", { moles, builder: this });
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
    } else if (uom != null && this.showFailedValidation) {
      this.logger.warn("setUOM| Invalid UOM", { uom, builder: this });
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
    } else if (country != null && this.showFailedValidation) {
      this.logger.warn("setSupplierCountry| Invalid country value", { country, builder: this });
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
    } else if (shipping != null && this.showFailedValidation) {
      this.logger.warn("setSupplierShipping| Invalid shipping value", { shipping, builder: this });
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
    } else if (paymentMethods != null && this.showFailedValidation) {
      this.logger.warn("setSupplierPaymentMethods| Invalid payment methods", {
        paymentMethods,
        builder: this,
      });
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
    } else if (description != null && this.showFailedValidation) {
      this.logger.warn("setDescription| Invalid description", { description, builder: this });
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
    } else if (shortDescription != null && this.showFailedValidation) {
      this.logger.warn("setShortDescription| Invalid short description", {
        shortDescription,
        builder: this,
      });
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
    } else if (rating != null && this.showFailedValidation) {
      this.logger.warn("setRating| Invalid rating", { rating, builder: this });
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
    } else if (reviewCount != null) {
      this.logger.warn("setReviewCount| Invalid review count", { reviewCount, builder: this });
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
    } else if (id != null && this.showFailedValidation) {
      this.logger.warn("setID| Invalid ID value", { id, builder: this });
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
    } else if (uuid != null && this.showFailedValidation) {
      this.logger.warn("setUUID| Invalid UUID value", { uuid, builder: this });
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
    } else if (sku != null && this.showFailedValidation) {
      this.logger.warn("setSku| Invalid SKU value", { sku, builder: this });
    }
    return this;
  }

  /**
   * Sets the stable per-product cache/exclusion identity (see
   * {@link Product.cacheKey}). Accepts a non-empty string or a number
   * (coerced to string, since some suppliers key on a numeric id). Invalid
   * input is ignored.
   * @param cacheKey - The identity string/number, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setCacheKey("FAM_889460");
   * builder.setCacheKey(12345); // stored as "12345"
   * ```
   * @source
   */
  setCacheKey(cacheKey: unknown): ProductBuilder<T> {
    if (typeof cacheKey === "string" && cacheKey.trim().length > 0) {
      this.product.cacheKey = cacheKey;
    } else if (typeof cacheKey === "number" && Number.isFinite(cacheKey)) {
      this.product.cacheKey = String(cacheKey);
    } else if (cacheKey != null && this.showFailedValidation) {
      this.logger.warn("setCacheKey| Invalid cache key value", { cacheKey, builder: this });
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
    } else if (
      smiles !== undefined &&
      smiles !== null &&
      smiles !== "" &&
      this.showFailedValidation
    ) {
      this.logger.warn("setSmiles| Invalid SMILES", {
        smiles,
        builder: this,
      });
    }
    return this;
  }

  /**
   * Sets the IUPAC name for the product. An absent value (undefined/null/empty) is ignored
   * silently; a value that is present but not a usable name is ignored and logged as a warning.
   * @param iupacName - The IUPAC name to set, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setIupacName("dipotassium;oxalate");
   * builder.setIupacName(undefined); // no-op, no warning
   * ```
   * @source
   */
  setIupacName(iupacName: unknown): ProductBuilder<T> {
    if (isIupacName(iupacName)) {
      this.product.iupacName = iupacName;
    } else if (
      iupacName !== undefined &&
      iupacName !== null &&
      iupacName !== "" &&
      this.showFailedValidation
    ) {
      this.logger.warn("setIupacName| Invalid IUPAC name", {
        iupacName,
        builder: this,
      });
    }
    return this;
  }

  /**
   * Sets the PubChem Compound ID (CID) for the product. Numeric strings are coerced first; an
   * absent value (undefined/null/empty) is ignored silently; a value that is present but not a
   * positive integer is ignored and logged as a warning.
   * @param pubchemId - The PubChem CID to set, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setPubchemId(11413);
   * builder.setPubchemId("11413"); // coerced to 11413
   * ```
   * @source
   */
  setPubchemId(pubchemId: unknown): ProductBuilder<T> {
    if (isPubChemCID(pubchemId)) {
      this.product.pubchemId = Number(pubchemId) as PubChemCID;
    } else if (
      pubchemId !== undefined &&
      pubchemId !== null &&
      pubchemId !== "" &&
      this.showFailedValidation
    ) {
      this.logger.warn("setPubchemId| Invalid PubChem CID", {
        pubchemId,
        builder: this,
      });
    }
    return this;
  }

  /**
   * Sets the InChIKey for the product. An absent value (undefined/null/empty) is ignored silently;
   * a value that is present but fails InChIKey validation is ignored and logged as a warning.
   * @param inchiKey - The InChIKey to set, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setInChIKey("IRXRGVFLQOSHOH-UHFFFAOYSA-L");
   * builder.setInChIKey(undefined); // no-op, no warning
   * ```
   * @source
   */
  setInChIKey(inchiKey: unknown): ProductBuilder<T> {
    if (isInChIKey(inchiKey)) {
      this.product.inchiKey = inchiKey;
    } else if (
      inchiKey !== undefined &&
      inchiKey !== null &&
      inchiKey !== "" &&
      this.showFailedValidation
    ) {
      this.logger.warn("setInChIKey| Invalid InChIKey", {
        inchiKey,
        builder: this,
      });
    }
    return this;
  }

  /**
   * Sets the InChI string for the product. An absent value (undefined/null/empty) is ignored
   * silently; a value that is present but fails InChI validation is ignored and logged as a
   * warning.
   * @param inchi - The InChI string to set, or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setInChI("1S/C2H2O4.2K/c3-1(4)2(5)6;;/h(H,3,4)(H,5,6);;/q;2*+1/p-2");
   * builder.setInChI(undefined); // no-op, no warning
   * ```
   * @source
   */
  setInChI(inchi: unknown): ProductBuilder<T> {
    if (isInChI(inchi)) {
      this.product.inchi = inchi;
    } else if (inchi !== undefined && inchi !== null && inchi !== "" && this.showFailedValidation) {
      this.logger.warn("setInChI| Invalid InChI", {
        inchi,
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
    } else if (vendor != null && this.showFailedValidation) {
      this.logger.warn("setVendor| Invalid vendor value", { vendor, builder: this });
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
      this.logger.warn("Unknown availability", { availability, builder: this });
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
   * Sets the purity for the product, stored as a string. A number in the `(0, 100]` range is
   * normalized to `"<n>%"`. A string is resolved via {@link findPurity}: a percentage token (with an
   * optional comparator `<`, `>`, `≤`, `≥`, `≈`) is kept when present, otherwise a recognized
   * chemical grade (`"ACS"`, `"HPLC"`, …) is used — so purity may hold either kind of value. Input
   * that yields neither is ignored.
   * @param purity - The purity to set (e.g. `99`, `"≥99%"`, `"ACS reagent"`), or any value (invalid input is ignored)
   * @returns The builder instance for method chaining
   * @example
   * ```typescript
   * builder.setPurity(98);                       // stored as "98%"
   * builder.setPurity("≥99.995% metals basis");  // stored as "≥99.995%"
   * builder.setPurity("≥98%(HPLC)");             // stored as "≥98%" (percentage wins)
   * builder.setPurity("60% in Water");           // stored as "60%"
   * builder.setPurity("ACS reagent");            // stored as "ACS" (grade fallback)
   * builder.setPurity("Ships in 3 days");        // ignored
   * ```
   * @source
   */
  setPurity(purity: unknown): ProductBuilder<T> {
    let value: string | undefined;
    if (typeof purity === "number") {
      if (!Number.isNaN(purity) && purity > 0 && purity <= 100) {
        value = `${purity}%`;
      }
    } else if (typeof purity === "string") {
      value = findPurity(purity);
    }

    if (value !== undefined) {
      this.product.purity = value;
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
    } else if (baseUom != null) {
      this.logger.warn("Invalid base UOM", { baseUom, builder: this });
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
    } else if (usdPrice != null) {
      this.logger.warn("Invalid USD price", { usdPrice, builder: this });
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
    } else if (localPrice != null) {
      this.logger.warn("Invalid local price", { localPrice, builder: this });
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
