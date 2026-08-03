import labproProductsQuery from '@/queries/labpro-products.gql';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { extractAllPositiveTerms } from '@/utils/search-query/extractPositiveTerms';
import { isValidMagento2SearchResponse } from '@/utils/typeGuards/magento2';
import { print } from 'graphql';
import { SupplierBaseMagento2, type RawMagento2Variant } from './SupplierBaseMagento2';

/**
 * SupplierLabProServices — labproservices.com, a US lab-chemical reseller (Spectrum
 * Chemical catalog) running on Magento 2.4.6+.
 *
 * @remarks
 * Reuses the Magento 2 GraphQL plumbing from {@link SupplierBaseMagento2} but with three
 * store-specific differences:
 * - Its own query ({@link labproProductsQuery}) scopes results to the "Chemicals" category
 *   ({@link categoryId}) via a `name`/`category_id` filter, so it needs `categoryId` and
 *   `currentPage` variables the base query lacks.
 * - Pricing comes from `final_price` (post-discount) rather than `regular_price`.
 * - Product pages are served at `{baseURL}/{url_key}.html` with no locale path segment, so
 *   {@link getPermalink} drops the store code.
 *
 * The catalog is 100% `SimpleProduct` and the search response already carries price, CAS
 * (in the name/description), and quantity (in the name/SKU), so there is no per-product
 * detail fetch — the inherited no-op `getProductData` is used as-is.
 *
 * @category Suppliers
 * @example
 * ```typescript
 * const supplier = new SupplierLabProServices("benzoic acid", 10, new AbortController());
 * for await (const product of supplier) {
 *   console.log(product.title, product.price);
 * }
 * ```
 * @source
 */
export class SupplierLabProServices extends SupplierBaseMagento2 implements ISupplier {
  // Name of supplier (for display purposes)
  public static readonly supplierName: string = 'LabPro Services';

  // Base URL for HTTP(s) requests
  public static readonly baseURL: string = 'https://www.labproservices.com';

  // Shipping scope for LabPro Services (US domestic)
  public static readonly shipping: ShippingRange = 'domestic';

  // The country code of the supplier.
  public static readonly country: CountryCode = 'US';

  // The payment methods accepted by the supplier.
  public static readonly paymentMethods: PaymentMethod[] = ['mastercard', 'visa'];

  /** Magento category the search is scoped to ("Chemicals"; includes all descendants). */
  protected readonly categoryId: string = '8295';

  /** Page of results to request; the search only ever needs the first page. */
  protected readonly currentPage: number = 1;

  /**
   * Builds the absolute product permalink. LabPro serves product pages at
   * `{baseURL}/{url_key}.html` with no locale path segment, so the store code the base
   * class prepends is omitted.
   *
   * @param productUrl - The store-relative product URL (from {@link getProductUrl})
   * @returns The absolute permalink URL
   * @example
   * ```typescript
   * this.getPermalink("buy-benzoic-acid-b1085-500gm-ea.html");
   * // "https://www.labproservices.com/buy-benzoic-acid-b1085-500gm-ea.html"
   * ```
   * @source
   */
  protected getPermalink(productUrl: string): string {
    return `${this.baseURL}/${productUrl}`;
  }

  /**
   * Collects the single raw variant for a LabPro product. The catalog is entirely
   * `SimpleProduct`, so this synthesizes one variant from the parent fields, pricing it from
   * `final_price` (the post-discount price) and falling back to `regular_price`.
   *
   * @param item - Magento 2 product item from the search response
   * @returns A single-element array of the normalized raw variant, or an empty array when no
   *   usable price is present
   * @example
   * ```typescript
   * this.collectRawVariants(item); // [{ sku: "B1085-500GM-EA", name: "...", price: 153.7, currency: "USD" }]
   * ```
   * @source
   */
  protected collectRawVariants(item: Magento2ProductItem): RawMagento2Variant[] {
    const bound = item.price_range?.minimum_price;
    const money = bound?.final_price ?? bound?.regular_price;
    if (typeof money?.value !== 'number') {
      return [];
    }
    return [
      {
        sku: item.sku,
        name: item.name,
        price: money.value,
        currency: money.currency,
      },
    ];
  }

  /**
   * Query products from the LabPro GraphQL `products` endpoint. Mirrors the base class flow
   * but posts {@link labproProductsQuery} with the category-scoped variables. For an advanced
   * (boolean) query, the `search` term is the space-joined set of positive terms so the
   * full-text search returns a broad candidate pool in one request; the precise boolean match
   * is applied client-side by `fuzzyFilterAst`.
   *
   * @param query - The search term to query for
   * @param limit - The maximum number of products to return
   * @returns A promise that resolves to an array of ProductBuilder instances or void
   * @example
   * ```typescript
   * const products = await this.queryProducts("benzoic acid", 10);
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    // The .gql import is a parsed DocumentNode (vite-plugin-graphql-loader); the Magento 2
    // endpoint wants the raw query text, so print it and pass the variables alongside.
    const graphQLQuery = print(labproProductsQuery);
    const parsed = this.getAst();
    const search = parsed.isAdvanced
      ? extractAllPositiveTerms(parsed.ast).join(' ') || query
      : query;

    const searchRequest = await this.httpPostJson({
      path: this.graphQLPath,
      body: {
        query: graphQLQuery,
        variables: {
          search,
          categoryId: this.categoryId,
          pageSize: limit,
          currentPage: this.currentPage,
        },
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.debug('searchRequest', { searchRequest });
    if (!isValidMagento2SearchResponse(searchRequest)) {
      this.logger.error('Invalid LabPro search response', { response: searchRequest });
      throw new Error('Invalid LabPro search response', {
        cause: { searchRequest, query, supplier: this.supplierName },
      });
    }

    const items = searchRequest.data.products.items;

    if (items.length === 0) {
      this.logger.warn('LabPro search returned no products', { query });
      return;
    }

    this.logger.debug(`Query returned ${items.length} products`, { items });

    const fuzzResults = this.fuzzyFilterAst<Magento2ProductItem>(items);
    this.logger.debug('fuzzResults', { query, items, fuzzResults });

    return this.initProductBuilders(fuzzResults.slice(0, limit));
  }
}
