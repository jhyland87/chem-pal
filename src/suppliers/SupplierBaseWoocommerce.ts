import { findCAS } from '@/helpers/cas';
import { parseQuantity } from '@/helpers/quantity';
import { findPurity, parseChemicalSpecs } from '@/helpers/science';
import { firstMap, mapDefined } from '@/helpers/utils';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { isSearchResponse } from '@/utils/typeGuards/woocommerce';
import { SupplierBase } from './SupplierBase';

/**
 * Base class for WooCommerce-based suppliers that provides common functionality for
 * interacting with WooCommerce REST API endpoints.
 *
 * @remarks
 * Woocommerce has two versons of API endpoints for products.
 * The V1 endpoints are:
 * - `/wp-json/wc/v1`
 * - `/wp-json/wc/store/v1/products`
 * - `/wp-json/wc/store/v1/products?search=borohydride&per_page=20&page=1`
 * - `/wp-json/wc/store/v1/products/6981`
 *
 * And the V2 endpoints are:
 * - `/wp-json/wp/v2`
 * - `/wp-json/wp/v2/product`
 * - `/wp-json/wp/v2/product?search=borohydride&per_page=20&page=1`
 * - `/wp-json/wp/v2/product/6981`
 *
 * There are plenty of differences between the two, but mainly it looks like the v2 endpoint
 * doesn't include any of the variatins in the search responses.
 *
 * The first endpoint is used to search for products and returns a list of products.
 * The second endpoint is used to get the details of a single product.
 * @category Suppliers
 * @example
 * ```typescript
 * class MyChemicalSupplier extends SupplierBaseWoocommerce {
 *   public readonly supplierName = "My Chemical Supplier";
 *   protected baseURL = "https://mychemicalsupplier.com";
 * }
 *
 * const supplier = new MyChemicalSupplier();
 * for await (const product of supplier) {
 *   console.log(product);
 * }
 * ```
 *
 * @see https://github.com/woocommerce/woocommerce/blob/trunk/docs/apis/store-api/resources-endpoints/products.md
 * @source
 */
export abstract class SupplierBaseWoocommerce
  extends SupplierBase<WooCommerceSearchResponseItem, Product>
  implements ISupplier
{
  /**
   * API key for WooCommerce authentication.
   * Used for authenticating requests to the WooCommerce REST API.
   * Should be set in the constructor of implementing classes.
   *
   * @example
   * ```typescript
   * class MySupplier extends SupplierBaseWoocommerce {
   *   constructor() {
   *     super();
   *     this.apiKey = "wc_key_123456789";
   *   }
   * }
   * ```
   * @source
   */
  protected apiKey: string = '';

  /**
   * The maximum number of objects to fetch in a single request.
   * This is used to limit the number of objects fetched in a single request
   * to avoid overwhelming the API.
   * @source
   */
  public readonly fetchObjectSizeLimit: number = 95;

  /**
   * The default product search filters to use for the WooCommerce API.
   * Can be overridden by subclasses.
   * @source
   */
  public readonly productSearchFilters: WooCommerceProductSearchParams = {
    stock_status: ['instock', 'onbackorder'],
    orderby: 'title',
  };

  /**
   * Queries the WooCommerce API for products matching the given search term.
   * Makes a GET request to the WooCommerce Store API v1 products endpoint.
   *
   * @param query - Search term to filter products
   * @param limit - The maximum number of results to query for
   * @returns Promise resolving to an array of SearchResponseItem or void if the request fails
   *
   * @example
   * ```typescript
   * const products = await supplier.queryProducts("sodium chloride");
   * if (products) {
   *   console.log(`Found ${products.length} matching products`);
   * }
   * ```
   * https://carolinachemical.com/wp-json/wc/store/v1/products?search=a&page=1&per_page=100
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const searchRequest = await this.httpGetJson({
      path: `/wp-json/wc/store/v1/products`,

      params: {
        ...this.productSearchFilters,
        search: query,
        per_page: this.fetchObjectSizeLimit,
      },
    });

    if (!isSearchResponse(searchRequest)) {
      this.logger.error('Invalid search response:', { query, searchRequest });
      return;
    }

    this.logger.info('search request response:', { searchRequest });

    const results: WooCommerceSearchResponseItem[] = this.stripInvalidResults(searchRequest);

    this.logger.info('results:', { results });

    const fuzzedResults = this.fuzzyFilterAst<WooCommerceSearchResponseItem>(results);
    this.logger.info('fuzzedResults:', { query, results, fuzzedResults });

    const builders = this.initProductBuilders(fuzzedResults.slice(0, limit));

    // Partition before enriching: drop products the user ignored, hydrate any
    // whose detail data is already cached under their identity (from a prior,
    // possibly different, search), and enrich only the misses. This is what lets
    // a product enriched under one query hydrate a different query — the whole
    // reason per-product caching exists for batch suppliers.
    const { survivors, misses } = await this.partitionForBatch(builders);
    await this.enrichVariants(misses);
    await this.cacheProductBuilders(misses);

    return survivors;
  }

  /**
   * Derives the unique product key from a WooCommerce search item: its numeric
   * product `id`. Stable regardless of the query that surfaced it, and the same
   * id the Store API `include` endpoint keys on.
   * @param data - The raw WooCommerce search-response item
   * @returns The product's id as a string
   * @example
   * ```typescript
   * this.getUniqueProductKey(item); // "12345"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: WooCommerceSearchResponseItem): string {
    return String(data.id);
  }

  /**
   * Enriches every builder's variants with detail data (title, price,
   * permalink, description, sku) fetched in bulk. Rather than one request per
   * variant, all variant IDs across all builders are gathered and requested
   * from the Store API's `include` endpoint in batches of
   * {@link fetchObjectSizeLimit}, then mapped back onto each variant by ID.
   * Variants whose detail data isn't returned are dropped. Mutates the builders
   * in place.
   * @param builders - The product builders whose variants should be enriched
   * @returns A promise that resolves once all variants have been enriched
   * @example
   * ```typescript
   * const builders = this.initProductBuilders(results);
   * await this.enrichVariants(builders);
   * // builders now carry fully-populated variants (title, price, ...)
   * ```
   * @source
   */
  protected async enrichVariants(builders: ProductBuilder<Product>[]): Promise<void> {
    const variantIds = builders.flatMap((builder) => {
      const variants = builder.get('variants');
      if (!Array.isArray(variants)) {
        return [];
      }
      return mapDefined(variants, (variant: Partial<Variant>) =>
        typeof variant.id === 'number' ? variant.id : undefined,
      );
    });

    if (variantIds.length === 0) {
      return;
    }

    const variantData = await this.fetchVariantData(variantIds);

    for (const builder of builders) {
      const variants = builder.get('variants');
      if (!Array.isArray(variants) || variants.length === 0) {
        continue;
      }

      const enriched = mapDefined(variants, (variant: Partial<Variant>) => {
        if (typeof variant.id !== 'number') {
          return;
        }
        const data = variantData.get(variant.id);
        if (!data) {
          this.logger.warn('No variant data returned for variant:', { id: variant.id });
          return;
        }

        variant.title = String(data.name ?? '');
        variant.price = Number(data.prices.price) / 100;
        variant.currencyCode = data.prices.currency_code;
        variant.currencySymbol = data.prices.currency_symbol;
        // `url` is the Store API endpoint we queried; `permalink` is the
        // human-facing variant page.
        variant.url = `/wp-json/wc/store/v1/products/${variant.id}`;
        variant.permalink = data.permalink;
        variant.description = data.description;
        variant.sku = data.sku;

        return variant;
      });

      builder.setVariants(enriched);
    }
  }

  /**
   * Fetches variant detail data in bulk from the Store API's collection
   * endpoint, requesting IDs via `include` in batches of
   * {@link fetchObjectSizeLimit} (the API's `per_page` ceiling). IDs are
   * de-duplicated first so a variant shared across products is fetched once.
   * Batches that come back invalid are logged and skipped rather than failing
   * the whole search.
   * @param variantIds - The variant (product) IDs to fetch
   * @returns A map of variant ID to its Store API response item
   * @example
   * ```typescript
   * const data = await this.fetchVariantData([6981, 6982]);
   * data.get(6981)?.name; // "Sodium Chloride 500g"
   * ```
   * @source
   */
  protected async fetchVariantData(
    variantIds: number[],
  ): Promise<Map<number, WooCommerceSearchResponseItem>> {
    const uniqueIds = [...new Set(variantIds)];
    const variantData = new Map<number, WooCommerceSearchResponseItem>();

    for (let offset = 0; offset < uniqueIds.length; offset += this.fetchObjectSizeLimit) {
      const chunk = uniqueIds.slice(offset, offset + this.fetchObjectSizeLimit);
      const response = await this.httpGetJson({
        path: `/wp-json/wc/store/v1/products`,

        params: {
          per_page: this.fetchObjectSizeLimit,
          type: 'variation',
          include: chunk.join(','),
        },
      });

      if (!isSearchResponse(response)) {
        this.logger.warn('Invalid variant batch response:', { chunk, response });
        continue;
      }

      for (const item of response) {
        variantData.set(item.id, item);
      }
    }

    return variantData;
  }

  /**
   * Strips invalid results from the search response. This avoids having to run any
   * of the heavier functions (eg: fuzzyFilter) on products that are not purchasable,
   * out-of-stock, or have no price objects to parse.
   * @param results - The search response to strip invalid results from.
   * @returns The search response with invalid results stripped.
   * @source
   */
  protected stripInvalidResults(
    results: WooCommerceSearchResponseItem[],
  ): WooCommerceSearchResponseItem[] {
    return results.filter((productResult) => {
      if (productResult.is_purchasable === false) {
        this.logger.debug('stripInvalidResults: skipping non-purchasable product:', {
          productResult,
        });
        return false;
      }
      if (productResult.is_in_stock === false) {
        this.logger.debug('stripInvalidResults: skipping out-of-stock product:', { productResult });
        return false;
      }
      if (!productResult.prices.price && !productResult.price_html) {
        this.logger.debug('stripInvalidResults: skipping product with no price objects to parse:', {
          productResult,
        });
        return false;
      }

      return true;
    });
  }
  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns Title of the product
   * @source
   */
  protected titleSelector(data: WooCommerceSearchResponseItem): string {
    return data.name;
  }

  /**
   * Hook for subclasses to contribute additional strings to be parsed for the
   * product's quantity/UoM. Returned values are appended to the list of
   * candidates fed through `parseQuantity`, after the standard
   * `name`/`description`/`short_description`/`weight`/`formatted_weight`
   * fields, so the standard fields win when they already contain a parseable
   * quantity. Default returns an empty array; subclasses opt in only when they
   * have non-standard quantity locations (e.g. attribute terms).
   * @param item - The raw WooCommerce search response item
   * @returns Extra candidate strings to parse for quantity
   * @example
   * ```typescript
   * // In a subclass that stores pack size under attributes[].terms[].name:
   * protected getAdditionalQuantityStrings(
   *   item: WooCommerceSearchResponseItem,
   * ): string[] {
   *   // input: { attributes: [{ terms: [{ name: "500 grams Plastic Tin" }] }] }
   *   // output: ["500 grams Plastic Tin"]
   *   return item.attributes?.flatMap((a) => a.terms?.map((t) => t.name) ?? []) ?? [];
   * }
   * ```
   * @source
   */
  protected getAdditionalQuantityStrings(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    item: WooCommerceSearchResponseItem,
  ): string[] {
    return [];
  }

  /**
   * Initialize product builders from WooCommerce search response data.
   * Transforms WooCommerce product data into ProductBuilder instances, handling:
   * - Basic product information (name, URL, supplier)
   * - Product identifiers (ID, SKU)
   * - Pricing information with currency details
   * - CAS number extraction from descriptions
   * - Quantity parsing from product names and descriptions
   * - Product variations with their attributes
   *
   * @param results - Array of WooCommerce search response items
   * @returns Array of ProductBuilder instances initialized with WooCommerce product data
   * @example
   * ```typescript
   * const results = await this.queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this.initProductBuilders(results);
   *   // Each builder contains parsed product data from WooCommerce
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log(product.title, product.price, product.quantity);
   *   }
   * }
   * ```
   * @source
   */
  /**
   * Picks the smallest-width image URL from a `srcset` string. A srcset is a
   * comma-separated list of `<url> <width>w` candidates; this returns the URL
   * whose `w` descriptor is smallest — the least-bandwidth image, ideal for a
   * thumbnail. Candidates without a parseable `w` descriptor are ignored.
   * @param srcset - The srcset attribute value to parse, or undefined
   * @returns The smallest-width candidate URL, or undefined when none is usable
   * @example
   * ```typescript
   * this.smallestSrcsetUrl(".../a-300x300.jpg 300w, .../a-100x100.jpg 100w");
   * // "https://.../a-100x100.jpg"
   * this.smallestSrcsetUrl(undefined); // undefined
   * ```
   * @source
   */
  protected smallestSrcsetUrl(srcset: string | undefined): string | undefined {
    if (!srcset) {
      return undefined;
    }
    let smallest: { url: string; width: number } | undefined;
    for (const candidate of srcset.split(',')) {
      const parts = candidate.trim().split(/\s+/);
      const url = parts[0];
      const descriptor = /^(\d+)w$/.exec(parts[parts.length - 1] ?? '');
      if (!url || parts.length < 2 || !descriptor) {
        continue;
      }
      const width = Number(descriptor[1]);
      if (!smallest || width < smallest.width) {
        smallest = { url, width };
      }
    }
    return smallest?.url;
  }

  protected initProductBuilders(
    results: WooCommerceSearchResponseItem[],
  ): ProductBuilder<Product>[] {
    return results.map((item) => {
      const builder = new ProductBuilder<Product>(this.baseURL);

      builder
        // `url` is the Store API endpoint ChemPal fetches; `permalink` is the
        // human-facing product page the user opens in the browser.
        .setBasicInfo(item.name, `/wp-json/wc/store/v1/products/${item.id}`, this.supplierName)
        .setPermalink(item.permalink)
        .setMatchPercentage(item.matchPercentage)
        .setDescription(item.description)
        .setShortDescription(item.short_description)
        .setRating(item.average_rating)
        .setReviewCount(item.review_count)
        .setID(item.id)
        .setSku(item.sku)
        .setCacheKey(this.getUniqueProductKey(item))
        .setAvailability(item.is_in_stock)
        .setPricing(
          Number(item.prices.price) / 100,
          item.prices.currency_code,
          item.prices.currency_symbol,
        );

      const image = item.images?.[0];
      builder.setImage(image?.src, image?.alt);
      // Use the smallest candidate from the thumbnail srcset (e.g. the 100x100)
      // rather than the default `thumbnail` (usually 300x300). Fall back to the
      // main srcset, then to the plain `thumbnail` field.
      builder.setThumbnail(
        this.smallestSrcsetUrl(image?.thumbnail_srcset) ??
          this.smallestSrcsetUrl(image?.srcset) ??
          image?.thumbnail,
      );

      builder.setCAS(firstMap(findCAS, [item.description, item.short_description]));

      // Formula and molecular weight live in a labelled spec table (e.g. a
      // "Molecular Formula" / "Molecular Weight" row). parseChemicalSpecs is
      // label-aware, so — unlike findFormulaInHtml over the raw HTML — it won't
      // mistake grade codes or UN numbers in the marketing prose (e.g. "USP",
      // "UN1428") for a formula. Prefer whichever field first yields a value.
      const specs = firstMap(
        (html: string) => {
          const parsed = parseChemicalSpecs(html);
          return parsed.formula !== undefined || parsed.molecularWeight !== undefined
            ? parsed
            : undefined;
        },
        [item.short_description, item.description],
      );
      if (specs) {
        builder.setFormula(specs.formula);
        builder.setMoleweight(specs.molecularWeight);
      }

      // Suppliers bake purity into the product name as a percentage (e.g.
      // "… ≥99.8%") or a grade (e.g. "ACS"/"HPLC"); findPurity captures either.
      // Try the name first, then fall back to the descriptions.
      builder.setPurity(
        firstMap(findPurity, [item.name, item.description, item.short_description]),
      );

      const toParseForQuantity = [
        item.name,
        item.description,
        item.short_description,
        item.weight ?? '',
        item.formatted_weight ?? '',
        ...this.getAdditionalQuantityStrings(item),
      ];

      if ('variations' in item) {
        const variations = mapDefined(item.variations, (variation: Partial<Variant>) => {
          const variant: Partial<Variant> = {
            id: variation.id,
          };

          if (Array.isArray(variation.attributes)) {
            const size = variation.attributes.find(
              (attribute) => attribute.name.toLowerCase() === 'size',
            );
            if (!size || typeof size !== 'object' || !size.value) {
              return;
            }

            toParseForQuantity.push(size.value);

            const variantQty = parseQuantity(size.value);

            if (!variantQty) {
              return;
            }
            variant.quantity = variantQty.quantity;
            variant.uom = variantQty.uom;
          }

          return variant;
        });

        if (variations.length > 0) {
          builder.addVariants(variations);
        }
      }

      const quantity = firstMap(parseQuantity, toParseForQuantity);
      if (quantity) {
        builder.setQuantity(quantity.quantity, quantity.uom);
      }

      this.logger.debug('initProductBuilder product:', builder.dump());

      return builder;
    });
  }

  /**
   * Returns the product builder unchanged. Every WooCommerce product's detail
   * data — basic fields from the search response plus fully-enriched variants
   * (see {@link enrichVariants}) — is resolved up front in
   * {@link queryProducts}, whose results are cached wholesale by
   * `queryProductsWithCache`. There is therefore no per-product detail fetch to
   * perform here. This override is still required because the base
   * `getProductData` default path self-recurses and must be replaced by every
   * supplier.
   * @param product - The product builder to finalize
   * @returns The same builder, with its variants already populated
   * @example
   * ```typescript
   * const [builder] = await supplier.queryProducts("sodium");
   * await supplier.getProductData(builder); // returns builder unchanged
   * ```
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return product;
  }
}
