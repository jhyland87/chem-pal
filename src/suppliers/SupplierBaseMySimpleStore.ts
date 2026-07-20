import { UOM } from "@/constants/common";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity, toBaseQuantity } from "@/helpers/quantity";
import { htmlToAscii, mapDefined } from "@/helpers/utils";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { isValidSearchResponse, isProductDetail } from "@/utils/typeGuards/mysimplestore";
import { isValidVariant } from "@/utils/typeGuards/productbuilder";
import { SupplierBase } from "./SupplierBase";
/**
 * Abstract base for suppliers running on the MySimpleStore / GoDaddy "Online Store"
 * platform (a Spree-based JSON storefront). The API lives at
 * `https://{storeId}.mysimplestore.com/api/v2`, keyed by the store's uuid, while the
 * human-facing product pages live on the supplier's own `baseURL`.
 *
 * This is a two-phase supplier: the search/list endpoint returns products without
 * their variants (only a `variant_count`), so {@link queryProducts} builds partial
 * products from the listing and {@link getProductData} fetches each product's detail
 * endpoint to enumerate the per-size variants.
 *
 * Concrete suppliers provide only their identity (`supplierName`, `baseURL`,
 * `storeId`) and shipping/payment metadata.
 * @typeParam MySimpleStoreListProduct - The raw search-list item type
 * @typeParam Product - The common Product type all suppliers map to
 * @abstract
 * @category Suppliers
 * @source
 */
export abstract class SupplierBaseMySimpleStore
  extends SupplierBase<MySimpleStoreListProduct, Product>
  implements ISupplier
{
  /** Display name of the supplier */
  public abstract readonly supplierName: string;

  /** Base URL for the supplier's own website (product pages, permalinks) */
  public abstract readonly baseURL: string;

  /** The MySimpleStore store id (uuid) that keys every API request */
  public abstract readonly storeId: string;

  /** Default values for products */
  protected productDefaults = {
    uom: UOM.EA,
    quantity: 1,
    currencyCode: "USD",
    currencySymbol: "$",
  };

  /**
   * The MySimpleStore API host derived from the store id. All API requests set
   * this as the `host` override so the request targets the storefront API while
   * the referrer/base stays on the supplier's own site.
   * @returns The API hostname (e.g. "7692587b-...-a6ebcdb36c13.mysimplestore.com")
   * @example
   * ```typescript
   * this.apiHost; // "7692587b-61ba-4b63-b329-a6ebcdb36c13.mysimplestore.com"
   * ```
   * @source
   */
  protected get apiHost(): string {
    return `${this.storeId}.mysimplestore.com`;
  }

  /**
   * All host origin patterns required for this supplier, extending the base
   * (which contributes `baseURL`) with the MySimpleStore API host. The concrete
   * `{storeId}.mysimplestore.com` host is covered at runtime by the wildcard
   * `https://*.mysimplestore.com/*` manifest permission.
   * @returns The list of `https://host/*` permission patterns
   * @example
   * ```typescript
   * this.requiredHosts;
   * // ["https://orbitnaturalproductderivatives.com/*", "https://7692587b-....mysimplestore.com/*"]
   * ```
   * @source
   */
  public override get requiredHosts(): string[] {
    return [...super.requiredHosts, `https://${this.apiHost}/*`];
  }

  /**
   * Derives the unique product key from a MySimpleStore search item: its stable
   * catalog uuid (the same value passed to `.setID`).
   * @param data - The raw MySimpleStore search-list product
   * @returns The product's id
   * @example
   * ```typescript
   * this.getUniqueProductKey(product); // "019dda5e-dae6-756d-90db-a579bb95294f"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: MySimpleStoreListProduct): string {
    return String(data.id);
  }

  /**
   * Selects the title of a product from the search response.
   * @param data - Product object from the search response
   * @returns The product name
   * @example
   * ```typescript
   * this.titleSelector(product); // "Thymol"
   * ```
   * @source
   */
  protected titleSelector(data: MySimpleStoreListProduct): string {
    return data.name;
  }

  /**
   * Builds the human-facing product-page URL from a search item's storefront
   * path. MySimpleStore serves product pages under `/products` on the supplier's
   * own domain, so the API's `relative_url` ("/ols/products/{slug}") is prefixed
   * with `/products`.
   * @param product - The raw MySimpleStore search-list product
   * @returns The absolute product-page URL
   * @example
   * ```typescript
   * this.productUrl(product); // "https://onpd.com/products/ols/products/geraniol-60"
   * ```
   * @source
   */
  protected productUrl(product: MySimpleStoreListProduct): string {
    return `${this.baseURL}/products${product.relative_url}`;
  }

  /**
   * Queries products from the MySimpleStore search endpoint. Issues a single GET
   * to `/api/v2/products` with the keyword filters the storefront's own search UI
   * uses, fuzzy-filters the returned products against the query, and initializes
   * partial product builders (variants are filled in later by {@link getProductData}).
   * @param query - The search term to query products for
   * @param limit - The maximum number of products to return
   * @returns Promise resolving to an array of ProductBuilder instances, or void if the search fails
   * @example
   * ```typescript
   * const results = await this.queryProducts("thymol", 10);
   * if (results) console.log(`Found ${results.length} products`);
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const searchResponse = await this.httpGetJson({
      host: this.apiHost,
      path: "/api/v2/products",
      params: {
        app: "vnext",
        page: 1,
        per_page: limit,
        "q[keywords]": query,
        "q[name_or_description_text_cont]": query,
        "q[descend_by_match]": "true",
      },
    });

    if (!isValidSearchResponse(searchResponse)) {
      this.logger.error("Invalid or empty MySimpleStore search response", { query, searchResponse });
      return;
    }

    const fuzzResults = this.fuzzyFilterAst<MySimpleStoreListProduct>(searchResponse.products);

    this.logger.info("fuzzResults", { query, products: searchResponse.products, fuzzResults });

    return this.initProductBuilders(fuzzResults.slice(0, limit));
  }

  /**
   * Initializes partial product builders from MySimpleStore search-list items.
   * The search response carries no variants, so only the product-wide fields are
   * set here (title, URL, listing price, image, description, CAS, identity); the
   * per-size variants and quantity are populated by {@link getProductData}.
   * @param products - Array of raw MySimpleStore search-list products
   * @returns Array of ProductBuilder instances seeded with listing data
   * @example
   * ```typescript
   * const builders = this.initProductBuilders(searchResponse.products);
   * console.log(builders[0].get("title")); // "Thymol"
   * ```
   * @source
   */
  protected initProductBuilders(products: MySimpleStoreListProduct[]): ProductBuilder<Product>[] {
    return mapDefined(products, (product) => {
      const builder = new ProductBuilder<Product>(this.baseURL);
      const image = product.image_list?.[0]?.url ?? product.default_asset_url;

      builder
        .setBasicInfo(product.name, this.productUrl(product), this.supplierName)
        .setID(product.id)
        .setCacheKey(this.getUniqueProductKey(product))
        .setImage(image, product.name)
        .setDescription(product.description_raw)
        // CAS lives in the free-form description copy; setCAS extracts it.
        .setCAS(`${product.name}\n${product.description_raw ?? ""}`);

      if (product.price) {
        builder.setPricing(product.price.numeric, product.price.currency ?? "USD", "$");
      }

      return builder;
    });
  }

  /**
   * Reduces a variant's quantity + uom to a single comparable scalar so variants
   * can be sorted ascending by chemical content. Mass units collapse to
   * milligrams and volume units to millilitres via {@link toBaseQuantity}; the two
   * families aren't comparable to each other, but a product's variants always
   * share a family. Missing/unknown quantities sort last.
   * @param variant - The variant to rank
   * @returns The canonical magnitude, or +Infinity when it can't be derived
   * @example
   * ```typescript
   * this.variantSortRank({ quantity: 1, uom: "l" });   // 1000
   * this.variantSortRank({ quantity: 500, uom: "g" }); // 500000
   * this.variantSortRank({});                          // Infinity
   * ```
   * @source
   */
  protected variantSortRank(variant: Partial<Variant>): number {
    if (typeof variant.quantity !== "number" || !variant.uom) {
      return Number.POSITIVE_INFINITY;
    }
    return toBaseQuantity(variant.quantity, variant.uom);
  }

  /**
   * Parses a single MySimpleStore variant into a `Partial<Variant>`. The size and
   * unit come from `options_text` ("Size: 1 LITER"), the price from the string
   * `price` field, the currency symbol from `display_price`, and the variant URL
   * from the product URL plus the sku.
   * @param variant - The raw MySimpleStore variant
   * @param productUrl - The product's canonical page URL, used to build the variant URL
   * @returns The parsed partial variant
   * @example
   * ```typescript
   * this.parseVariant(rawVariant, productUrl);
   * // { title: "1 LITER", quantity: 1, uom: "l", price: 60, currencySymbol: "$",
   * //   sku: "GRN-60-1-LTR", id: "019da6a4-...", url: ".../v/GRN-60-1-LTR" }
   * ```
   * @source
   */
  protected parseVariant(
    variant: MySimpleStoreVariant,
    productUrl: string,
  ): Partial<Variant> {
    const parsed: Partial<Variant> = { id: variant.id };

    // `options_text` is "Size: 1 LITER"; the size label is the part after the colon.
    const sizeLabel = (variant.options_text ?? variant.option_values?.[0]?.name ?? "")
      .split(":")
      .pop()
      ?.trim();
    if (sizeLabel) {
      parsed.title = sizeLabel;
      const quantity = parseQuantity(sizeLabel);
      if (quantity) {
        parsed.quantity = quantity.quantity;
        parsed.uom = quantity.uom;
      }
    }

    if (variant.price) {
      const price = Number(variant.price);
      if (!Number.isNaN(price)) {
        parsed.price = price;
      }
    }

    // Currency code/symbol come from the pre-formatted display price ("$60.00").
    const displayPrice = variant.display_price ? parsePrice(variant.display_price) : undefined;
    if (displayPrice) {
      parsed.currencyCode = displayPrice.currencyCode;
      parsed.currencySymbol = displayPrice.currencySymbol;
    }

    if (variant.sku) {
      parsed.sku = variant.sku;
      parsed.url = `${productUrl}/v/${variant.sku}`;
    }

    return parsed;
  }

  /**
   * Enriches a partial product (from {@link queryProducts}) with its detail-page
   * data. Fetches `/api/v2/products/{slug}`, parses every variant, sorts them
   * ascending by chemical quantity, promotes the smallest to the parent-level
   * price/quantity/sku, and records the full variant list. A failed detail fetch
   * keeps the product with its listing data rather than dropping it.
   * @param product - The ProductBuilder to enrich
   * @returns Promise resolving to the enriched ProductBuilder, or void if it can't be built
   * @example
   * ```typescript
   * const enriched = await this.getProductData(builder);
   * // enriched.get("variants")?.length === 4  (Geraniol 60: 1/4/5/20 LITER)
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => {
      const url = builder.get("url");
      if (typeof url !== "string") {
        this.logger.error("[MySimpleStore] Invalid product URL", { url });
        return;
      }

      // The product page URL ends in the slug (".../ols/products/{slug}"); the
      // detail endpoint is keyed by that slug.
      const slug = url.split("/").pop();
      if (!slug) {
        this.logger.error("[MySimpleStore] Could not derive slug from URL", { url });
        return builder;
      }

      let detail: unknown;
      try {
        detail = await this.httpGetJson({
          host: this.apiHost,
          path: `/api/v2/products/${slug}`,
          params: { app: "vnext" },
        });
      } catch (error) {
        this.logger.warn("[MySimpleStore] Detail fetch failed; keeping listing data", {
          error,
          slug,
        });
        return builder;
      }

      if (!isProductDetail(detail)) {
        this.logger.warn("[MySimpleStore] Invalid product detail; keeping listing data", {
          slug,
          detail,
        });
        return builder;
      }

      // Enrich product-wide fields from the detail response.
      if (detail.description) {
        builder.setDescription(htmlToAscii(detail.description));
      }
      builder.setCAS(detail.description_text ?? detail.name);
      builder.setImage(detail.assets?.[0]?.large_url ?? detail.assets?.[0]?.small_url);
      if (typeof detail.in_stock === "boolean") {
        builder.setAvailability(detail.in_stock);
      }

      const variants = (detail.variants ?? [])
        .map((variant) => this.parseVariant(variant, url))
        .sort((a, b) => {
          const rankDiff = this.variantSortRank(a) - this.variantSortRank(b);
          if (rankDiff !== 0) return rankDiff;
          return (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
        });

      const primary = variants[0];
      if (primary) {
        if (typeof primary.price === "number") builder.setPrice(primary.price);
        if (primary.currencyCode) builder.setCurrencyCode(primary.currencyCode);
        if (primary.currencySymbol) builder.setCurrencySymbol(primary.currencySymbol);
        if (typeof primary.quantity === "number" && primary.uom) {
          builder.setQuantity(primary.quantity, primary.uom);
        }
        if (primary.sku) builder.setSku(primary.sku);
      } else {
        // Single-size products carry no variants; recover the size from the name
        // or description so the product isn't dropped for lacking a quantity.
        const fallback =
          parseQuantity(detail.name) ?? parseQuantity(detail.description_text ?? "");
        if (fallback) {
          builder.setQuantity(fallback.quantity, fallback.uom);
        }
      }

      if (variants.length > 1) {
        builder.setVariants(variants.filter(isValidVariant));
      }

      return builder;
    });
  }
}
