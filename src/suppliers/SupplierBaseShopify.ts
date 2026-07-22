import { AVAILABILITY, UOM } from '@/constants/common';
import { findCAS } from '@/helpers/cas';
import { parsePrice } from '@/helpers/currency';
import { parseQuantity, standardizeUom, toMetricQuantity } from '@/helpers/quantity';
import { findMolarity, parseChemicalSpecs } from '@/helpers/science';
import { firstMap, htmlToAscii, mapDefined } from '@/helpers/utils';
import searchProductsQuery from '@/queries/shopify-product-query.gql';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { translateAstToShopifyQuery } from '@/utils/search-query/translators/translateAstToShopifyQuery';
import { isQuantityObject } from '@/utils/typeGuards/common';
import { isValidShopifySearchResponse } from '@/utils/typeGuards/shopify';
import { print } from 'graphql';
import { SupplierBase } from './SupplierBase';

/** Width (px) requested from the Shopify CDN for derived image thumbnails. */
const SHOPIFY_THUMBNAIL_WIDTH = 200;

/**
 * Base class for Shopify-based suppliers that provides common functionality for
 * interacting with the Shopify GraphQL Storefront API.
 *
 * @remarks
 * This base class queries the Shopify GraphQL API at `{apiURL}/api/{apiVersion}/graphql.json`
 * using a POST request with a product search query. The API is unauthenticated and uses the
 * public Storefront API endpoint available on `myshopify.com` domains.
 *
 * Subclasses only need to provide the `apiURL` (the myshopify.com domain) along with the
 * standard supplier properties (supplierName, baseURL, shipping, country, paymentMethods).
 *
 * @category Suppliers
 * @example
 * ```typescript
 * // Create a new class using the SupplierBaseShopify class
 * export default class SupplierMyStore
 *   extends SupplierBaseShopify
 *   implements ISupplier
 * {
 *   public readonly supplierName: string = "My Store";
 *   public readonly baseURL: string = "https://www.mystore.com";
 *   public readonly shipping: ShippingRange = "domestic";
 *   public readonly country: CountryCode = "US";
 *   public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];
 *   protected apiURL: string = "my-store.myshopify.com";
 * }
 * ```
 * @source
 */
export abstract class SupplierBaseShopify
  extends SupplierBase<ShopifyProductNode, Product>
  implements ISupplier
{
  /** Shopify GraphQL API version */
  protected apiVersion: string = '2026-04';

  // Shopify's search DSL supports AND/OR/NOT, so advanced queries are translated
  // server-side instead of using the keyword-only fallback.
  protected readonly supportsNativeAdvancedSearch: boolean = true;

  /**
   * Derives the unique product key from a Shopify product node: its globally
   * unique GraphQL id (e.g. `gid://shopify/Product/5710116421799`). Stable
   * regardless of `onlineStoreUrl` (which can be null for unpublished products).
   * @param data - The raw Shopify product node
   * @returns The product's gid
   * @example
   * ```typescript
   * this.getUniqueProductKey(node); // "gid://shopify/Product/5710116421799"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: ShopifyProductNode): string {
    return String(data.id);
  }

  /**
   * Builds the GraphQL variables for the `Catalog` query. The query text itself lives in
   * `@/queries/shopify-product-query.gql`; only the search string and page size vary. An advanced
   * (boolean) query is translated to Shopify's search DSL (AND/OR/NOT); a plain query is matched as
   * a title wildcard.
   *
   * @param query - The search term to match
   * @param limit - Maximum number of products to return
   * @returns The GraphQL variables for the products query
   * @example
   * ```typescript
   * const variables = this.getGraphQLVariables("gold", 200);
   * // Returns { q: "title:*gold*", n: 200, cursor: null }
   * ```
   * @source
   */
  protected getGraphQLVariables(query: string, limit: number): ShopifyQueryVariables {
    const parsed = this.getAst();
    const queryString = parsed.isAdvanced
      ? translateAstToShopifyQuery(parsed.ast)
      : `title:*${query}*`;
    return { q: queryString, n: limit, cursor: null };
  }

  /**
   * Query products from the Shopify GraphQL Storefront API.
   *
   * @param query - The search term to query for
   * @param limit - The maximum number of products to return
   * @returns A promise that resolves to an array of ProductBuilder instances or void
   * @example
   * ```typescript
   * const products = await this.queryProducts("gold test kit", 10);
   * if (products) {
   *   for (const product of products) {
   *     const built = await product.build();
   *     console.log(built.title, built.price);
   *   }
   * }
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    this.logger.info('queryProducts', { query, limit });
    // The .gql import is a parsed DocumentNode (vite-plugin-graphql-loader); the Shopify endpoint
    // wants the raw query text, so print it and pass the variables alongside. The `first` over-fetch
    // (200) gives the fuzzy filter a wide candidate pool before slicing back down to `limit`.
    const graphQLQuery = print(searchProductsQuery);
    const graphQLVariables = this.getGraphQLVariables(query, 200);
    this.logger.debug('querying for products', {
      query,
      limit,
      graphQLQuery,
      apiURL: this.apiURL,
      apiVersion: this.apiVersion,
    });

    const searchRequest = await this.httpPostJson({
      path: `/api/${this.apiVersion}/graphql.json`,
      host: this.apiURL,
      body: { query: graphQLQuery, variables: graphQLVariables },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.debug('searchRequest', { searchRequest });
    if (!isValidShopifySearchResponse(searchRequest)) {
      this.logger.error('Invalid Shopify search response', { response: searchRequest });
      throw new Error('Invalid Shopify search response', { cause: { searchRequest } });
      //return;
    }

    const products = searchRequest.data.products.edges.map((edge) => edge.node);

    if (products.length === 0) {
      this.logger.warn('Shopify search returned no products', { query });
      return;
    }

    this.logger.debug(`Query returned ${products.length} products`, { products });

    const fuzzResults = this.fuzzyFilterAst<ShopifyProductNode>(products);
    const filteredResults = this.filterProducts(fuzzResults);
    this.logger.debug('fuzzResults', {
      query,
      searchRequest,
      products,
      fuzzResults,
      filteredResults,
    });

    return this.initProductBuilders(filteredResults.slice(0, limit));
  }

  /**
   * Hook for excluding product nodes after fuzzy matching but before they are
   * turned into builders. The base implementation is a pass-through; subclasses
   * override it to drop nodes that shouldn't surface in results (for example,
   * filtering out non-chemical equipment by its storefront tags).
   * @param products - The fuzzy-matched Shopify product nodes
   * @returns The nodes that should be built into products
   * @example
   * ```typescript
   * this.filterProducts(nodes); // Base: returns `nodes` unchanged
   * ```
   * @source
   */
  protected filterProducts(products: ShopifyProductNode[]): ShopifyProductNode[] {
    return products;
  }

  /**
   * Builds a {@link QuantityObject} directly from a variant's structured
   * `weight`/`weightUnit` pair, bypassing the string quantity parser. The parser
   * requires the leading digit of a quantity to be non-zero, so a sub-1 weight
   * such as `0.3` would be misread as `3`; using the numeric value avoids that.
   * The unit is standardized (Shopify reports `POUNDS`/`GRAMS`/etc.), and a
   * missing, non-finite, or non-positive weight yields undefined.
   * @param weight - The variant's numeric weight
   * @param weightUnit - The variant's weight unit (e.g. `"POUNDS"`)
   * @returns The quantity object, or undefined when it can't be derived
   * @example
   * ```typescript
   * this.weightQuantity(0.3, "POUNDS") // Returns { quantity: 0.3, uom: "lb" }
   * this.weightQuantity(0, "GRAMS")    // Returns undefined
   * ```
   * @source
   */
  protected weightQuantity(weight: number, weightUnit: string): QuantityObject | undefined {
    if (!Number.isFinite(weight) || weight <= 0) return undefined;
    const uom = standardizeUom(weightUnit);
    if (!uom) return undefined;
    return { quantity: weight, uom };
  }

  /**
   * Initialize product builders from Shopify GraphQL search response data.
   * Transforms Shopify product nodes into ProductBuilder instances, handling:
   * - Extracting the "Default Title" variant as the primary product data (price, SKU, quantity),
   *   falling back to the first variant if no "Default Title" variant exists
   * - Excluding the "Default Title" variant from the variants list
   * - Basic product information (title, URL, supplier)
   * - Pricing via parsePrice for proper currency detection
   * - Product descriptions
   * - SKU and product IDs
   * - Quantity parsing from SKU, title, and description fields
   * - Variant mapping with price and weight information
   *
   * @param results - Array of Shopify product nodes from search results
   * @returns Array of ProductBuilder instances initialized with Shopify product data
   * @source
   */
  protected initProductBuilders(results: ShopifyProductNode[]): ProductBuilder<Product>[] {
    return mapDefined(results, (product) => {
      const defaultVariantIndex = product.variants.edges.findIndex(
        (edge) => edge.node.title === 'Default Title',
      );
      const primaryVariant =
        defaultVariantIndex !== -1
          ? product.variants.edges[defaultVariantIndex].node
          : product.variants.edges[0]?.node;

      if (!primaryVariant) return;
      this.logger.debug('primaryVariant', { primaryVariant });

      const parsedPrice = parsePrice(`$${primaryVariant.price.amount}`);
      if (!parsedPrice) return;

      // onlineStoreUrl is null for products not published to the online store;
      // fall back to the canonical product path built from the handle.
      const url = product.onlineStoreUrl ?? `${this.baseURL}/products/${product.handle}`;
      // Description is HTML; keep a plain-text copy for display and for the
      // chemical-identifier parsing below (the parsers strip markup themselves,
      // but plain text also feeds findCAS/findMolarity).
      const descriptionText = htmlToAscii(product.descriptionHtml);

      const builder = new ProductBuilder<Product>(this.baseURL);

      builder
        .setBasicInfo(product.title, url, this.supplierName)
        .setPricing(parsedPrice)
        .setAvailability(
          primaryVariant.currentlyNotInStock ? AVAILABILITY.OUT_OF_STOCK : AVAILABILITY.IN_STOCK,
        )
        .setDescription(descriptionText)
        .setSku(primaryVariant.sku)
        .setID(product.id)
        .addImages(this.productImages(product))
        .setCacheKey(this.getUniqueProductKey(product));

      // Parse the chemical identifiers out of the title + description. CAS is
      // handled by findCAS; parseChemicalSpecs pulls formula, molecular weight,
      // purity, and SMILES from the (HTML) description; molarity → concentration.
      const identifierText = `${product.title}\n${descriptionText}`;
      builder.setCAS(findCAS(identifierText));
      const specs = parseChemicalSpecs(product.descriptionHtml);
      builder
        .setFormula(specs.formula)
        .setMoleweight(specs.molecularWeight)
        .setPurity(specs.purity)
        .setSmiles(specs.smiles)
        .setConcentration(firstMap(findMolarity, [product.title, descriptionText]));

      // Prefer the listed pack size (title, then sku/description), which reflects
      // the product amount. The variant weight includes packaging and runs high,
      // so it's only a fallback — and it's read from the structured weight fields
      // rather than a parsed string to preserve sub-1 values (e.g. 0.3 lb).
      const parseableQuantityStrings = [product.title, primaryVariant.sku ?? '', descriptionText];
      this.logger.debug('parseableQuantityStrings', { parseableQuantityStrings });
      const quantity =
        firstMap(parseQuantity, parseableQuantityStrings) ??
        this.weightQuantity(primaryVariant.weight, primaryVariant.weightUnit);

      if (isQuantityObject(quantity)) {
        // Standardize imperial units (e.g. lb/oz) to metric before storing.
        const standard = toMetricQuantity(quantity);
        builder.setQuantity(standard.quantity, standard.uom);
      } else {
        this.logger.warn('Failed to parse quantity from primary variant, defaulting to 1 EA', {
          parseableQuantityStrings,
          quantity,
          builder,
          product,
        });

        builder.setQuantity(1, UOM.EA);
      }

      const remainingVariants = product.variants.edges.filter(
        (_edge, index) => index !== defaultVariantIndex,
      );

      for (const variantEdge of remainingVariants) {
        const variant = variantEdge.node;
        if (!variant.price.amount) continue;
        const variantPrice = parsePrice(`$${variant.price.amount}`);

        const parsedQuantity =
          firstMap(parseQuantity, [variant.title, variant.sku ?? '']) ??
          this.weightQuantity(variant.weight, variant.weightUnit);
        const quantity = isQuantityObject(parsedQuantity)
          ? toMetricQuantity(parsedQuantity)
          : undefined;

        builder.addVariant({
          id: variant.id,
          title: variant.title,
          sku: variant.sku ?? undefined,
          price: variantPrice?.price,
          status: variant.currentlyNotInStock ? AVAILABILITY.OUT_OF_STOCK : AVAILABILITY.IN_STOCK,
          ...(quantity ?? { quantity: 1, uom: UOM.EA }),
        });
      }

      this.enrichBuilder(builder, product);

      return builder;
    });
  }

  /**
   * Hook for attaching supplier-specific fields to a freshly built product from
   * its raw Shopify node, which carries data not stored on the builder (e.g.
   * `tags`). The base implementation is a no-op; subclasses override it, for
   * example to derive a purity grade from storefront tags.
   * @param builder - The product builder being populated
   * @param product - The raw Shopify product node it was built from
   * @returns Nothing; the builder is mutated in place
   * @example
   * ```typescript
   * this.enrichBuilder(builder, product); // Base: no-op
   * ```
   * @source
   */
  protected enrichBuilder(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    builder: ProductBuilder<Product>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    product: ShopifyProductNode,
  ): void {
    // No-op by default; suppliers override to attach fields derived from the node.
  }

  /**
   * Maps the product's images to a flat list of {@link ProductImage} entries: one full-size `image`
   * entry per `IMAGE` node in the `media` connection (in response order), each followed by its
   * `thumbnail` entry. The primary image's thumbnail is the query's `featuredImage` — Shopify's
   * pre-transformed thumbnail of that same image — while the rest use a CDN width-derived thumbnail.
   * Non-image media (video, model3d) and images without a URL are skipped.
   * @param product - The Shopify product node
   * @returns The product's image/thumbnail entries in order, or an empty array when it has none
   * @example
   * ```typescript
   * this.productImages(product);
   * // => [{ href: "https://cdn.shopify.com/s/files/.../x.jpg?v=1", type: "image", altText: "Sodium Chloride" },
   * //     { href: "https://cdn.shopify.com/s/files/.../x_150x150_crop_center.jpg?v=1", type: "thumbnail" }]
   * ```
   * @source
   */
  protected productImages(product: ShopifyProductNode): ProductImage[] {
    const featured = product.featuredImage?.url;
    const images: ProductImage[] = [];

    for (const { node } of product.media?.edges ?? []) {
      const url = node.image?.url;
      if (node.mediaContentType !== 'IMAGE' || !url) continue;

      const image: ProductImage = { href: url, type: 'image' };
      if (node.alt) image.altText = node.alt;
      images.push(image);

      // The primary image's thumbnail is Shopify's pre-transformed featuredImage;
      // the rest fall back to a CDN width-derived thumbnail.
      const thumbnail = images.length === 1 && featured ? featured : this.thumbnailUrl(url);
      if (thumbnail) images.push({ href: thumbnail, type: 'thumbnail' });
    }
    return images;
  }

  /**
   * Derives a thumbnail-sized URL for a Shopify CDN image by setting its `width`
   * query parameter, which the CDN honours to serve a resized image. Returns
   * undefined for non-Shopify-CDN or unparseable URLs so the caller falls back to
   * the full image.
   * @param url - The full-size image URL
   * @param width - The target thumbnail width in pixels
   * @returns The resized image URL, or undefined when it can't be derived
   * @example
   * ```typescript
   * this.thumbnailUrl("https://cdn.shopify.com/s/files/1/x.jpg?v=1");
   * // => "https://cdn.shopify.com/s/files/1/x.jpg?v=1&width=200"
   * ```
   * @source
   */
  protected thumbnailUrl(url: string, width: number = SHOPIFY_THUMBNAIL_WIDTH): string | undefined {
    if (!URL.canParse(url)) return undefined;
    const parsed = new URL(url);
    if (!parsed.hostname.includes('cdn.shopify')) return undefined;
    parsed.searchParams.set('width', String(width));
    return String(parsed);
  }

  /**
   * Returns the product builder as-is since all product data is available from the search response.
   * Wrapped in getProductDataWithCache for caching support.
   *
   * @param product - The product builder to return
   * @returns Promise resolving to the product builder or void
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => builder);
  }

  /**
   * Selects the title of a product from the Shopify search response for fuzzy matching.
   *
   * @param data - Shopify product node from search response
   * @returns The title of the product
   * @source
   */
  protected titleSelector(data: ShopifyProductNode): string {
    return data.title;
  }
}
