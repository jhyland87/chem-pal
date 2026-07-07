import { UOM } from "@/constants/common";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { parseChemicalSpecs } from "@/helpers/science";
import { findPdfHref, htmlToAscii, mapDefined } from "@/helpers/utils";
import getFilteredProductsWithHasDiscount from "@/queries/wix-product-query.gql";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { translateAstToWixFilter } from "@/utils/search-query/translators/translateAstToWixFilter";
import { isParsedPrice } from "@/utils/typeGuards/common";
import { isValidVariant } from "@/utils/typeGuards/productbuilder";
import { isProductItem, isProductSelection, isValidSearchResponse } from "@/utils/typeGuards/wix";
import { print } from "graphql";
import { SupplierBase } from "./SupplierBase";
/**
 * SupplierBaseWix class that extends SupplierBase and implements AsyncIterable<Product>.
 * @abstract
 * @category Suppliers
 * @source
 */
export abstract class SupplierBaseWix
  extends SupplierBase<ProductObject, Product>
  implements ISupplier
{
  /** Display name of the supplier */
  public abstract readonly supplierName: string;

  /** Base URL for all API requests */
  public abstract readonly baseURL: string;

  /** Access token for Wix API authentication */
  protected accessToken: string = "";

  /** Ecom app ID for Wix API authentication */
  protected readonly ecomAppId: string = "1380b703-ce81-ff05-f115-39571d94dfcd";

  /** Categories for Wix API */
  protected readonly categories: Record<string, string> = {
    all: "00000000-000000-000000-000000000001",
  };

  /** Default values for products */
  protected productDefaults = {
    uom: UOM.EA,
    quantity: 1,
    currencyCode: "USD",
    currencySymbol: "$",
  };

  protected readonly minMatchPercentage: number = 45;

  // Wix's catalog filter supports and/or/not, so advanced queries are translated
  // server-side instead of using the keyword-only fallback.
  protected readonly supportsNativeAdvancedSearch: boolean = true;

  /**
   * Derives the unique product key from a Wix product object: its stable
   * catalog product id (the same value passed to `.setID`).
   * @param data - The raw Wix product object
   * @returns The product's id
   * @example
   * ```typescript
   * this.getUniqueProductKey(product); // "d1e2f3a4-..."
   * ```
   * @source
   */
  protected getUniqueProductKey(data: ProductObject): string {
    return String(data.id);
  }

  /**
   * Sets up the Wix API access by retrieving and setting the access token.
   * This method must be called before making any API requests.
   * @returns Promise that resolves when the access token is set
   * @example
   * ```typescript
   * await this.setup();
   * // Now the access token is set and API requests can be made
   * ```
   * @source
   */
  protected async setup(): Promise<void> {
    const accessTokenResponse = await fetch(`${this.baseURL}/_api/v1/access-tokens`, {
      credentials: "include",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.5",
        "cache-control": "no-cache",
        pragma: "no-cache",
        priority: "u=1, i",
        referer: this.baseURL,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      },
    });

    const data = await accessTokenResponse.json();
    this.accessToken = data.apps[this.ecomAppId].accessToken;
    this.headers = {
      ...this.headers,
       
      Authorization: this.accessToken,
    };
  }

  /**
   * Get the GraphQL variables for the Wix API
   *
   * @param query - The query to search for
   * @returns The GraphQL variables
   * @source
   */
  protected getGraphQLVariables(query: string): GraphQLQueryVariables {
    const parsed = this.getAst();
    const filters: WixFilterNode = parsed.isAdvanced
      ? translateAstToWixFilter(parsed.ast)
      : { term: { field: "name", op: "CONTAINS", values: [`*${query}*`] } };
    return {
      mainCollectionId: this.categories.all,
      offset: 0,
      limit: 150,
      sort: null,
      filters,
    } satisfies GraphQLQueryVariables;
  }

  /**
   * Query products from the Wix API
   *
   * @param query - The query to search for
   * @param limit - The limit of products to return
   * @returns A promise that resolves when the products are queried
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    // The .gql import is a parsed DocumentNode (vite-plugin-graphql-loader);
    // the Wix endpoint wants the raw query text in the `q` param, so print it.
    const graphQLQuery = print(getFilteredProductsWithHasDiscount);

    const graphQLVariables = this.getGraphQLVariables(query);

    const searchRequest = await this.httpGetJson({
      path: "_api/wix-ecommerce-storefront-web/api",
      params: {
        o: "getFilteredProducts",
        s: "WixStoresWebClient",
        q: graphQLQuery,
        v: JSON.stringify(graphQLVariables),
      },
    });

    if (isValidSearchResponse(searchRequest) === false) {
      throw new Error(`Invalid or empty Wix query response for ${query}`, {
        cause: {
          searchRequest,
          graphQLQuery,
          graphQLVariables,
          query,
          supplier: this.supplierName,
        },
      });
    }

    const fuzzResults = this.fuzzyFilterAst<ProductObject>(
      searchRequest.data.catalog.category.productsWithMetaData.list,
    );

    this.logger.info("fuzzResults", {
      query,
      productResults: searchRequest.data.catalog.category.productsWithMetaData.list,
      fuzzResults,
    });

    return this.initProductBuilders(fuzzResults.slice(0, limit));
  }

  /**
   * Initialize product builders from Wix search response data.
   * Transforms Wix product objects into ProductBuilder instances, handling:
   * - Basic product information (name, URL, supplier)
   * - Pricing information with currency details
   * - Product descriptions
   * - Product IDs and SKUs
   * - CAS number extraction from product text
   * - Complex variant handling:
   *   - Merges product items with their price and quantity information
   *   - Processes product selections for variant options
   *   - Handles multiple variant attributes and their values
   *
   * @param results - Array of Wix product objects from search results
   * @returns Array of ProductBuilder instances initialized with Wix product data
   * @example
   * ```typescript
   * const results = await this.queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this.initProductBuilders(results);
   *   // Each builder contains parsed product data from Wix
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log(product.title, product.price, product.variants);
   *   }
   * }
   * ```
   * @source
   */
  protected initProductBuilders(results: ProductObject[]): ProductBuilder<Product>[] {
    return mapDefined(results, (product) => {
      if (!product.price) {
        return;
      }

      // Build selectionId -> parsed quantity map across ALL options.
      const selectionIndex = new Map<number, ReturnType<typeof parseQuantity>>();
      for (const option of product.options ?? []) {
        for (const selection of option.selections ?? []) {
          if (!isProductSelection(selection)) {
            this.logger.warn("Invalid product selection:", { selection });
            continue;
          }
          const parsed = parseQuantity(selection.value);
          if (parsed) {
            selectionIndex.set(selection.id, parsed);
          }
        }
      }

      // Track which selection IDs are covered by explicit productItems.
      const coveredSelectionIds = new Set<number>();

      // Resolve explicit productItems first.
      const productVariants = mapDefined(product.productItems, (item: ProductItem) => {
        if (!isProductItem(item)) {
          this.logger.warn("Invalid product item:", { item });
          return;
        }

        const parsedPrice = parsePrice(item.formattedPrice ?? product.formattedPrice);
        if (!isParsedPrice(parsedPrice)) {
          return;
        }

        const resolvedQuantities = mapDefined(item.optionsSelections ?? [], (selectionId) => {
          coveredSelectionIds.add(selectionId);
          return selectionIndex.get(selectionId);
        });

        const quantityInfo = resolvedQuantities.find((q) => q && "uom" in q);
        if (!quantityInfo) {
          return;
        }

        return {
          ...parsedPrice,
          ...quantityInfo,
          id: item.id,
        };
      });

      // Synthesize the implicit default variant from the parent price.
      // Wix omits the default variant from productItems, so any selection
      // that wasn't covered above represents the parent's price point.
      const parentParsedPrice = parsePrice(product.formattedPrice);
      if (isParsedPrice(parentParsedPrice)) {
        for (const option of product.options ?? []) {
          for (const selection of option.selections ?? []) {
            if (coveredSelectionIds.has(selection.id)) continue;
            const quantityInfo = selectionIndex.get(selection.id);
            if (!quantityInfo || !("uom" in quantityInfo)) continue;

            productVariants.push({
              ...parentParsedPrice,
              ...quantityInfo,
              id: `${product.id}:${selection.id}`, // synthetic — no real Wix variant ID
            });
            coveredSelectionIds.add(selection.id);
          }
        }
      }

      // Sort variants by quantity within the same UOM, falling back to price.
      productVariants.sort((a, b) => {
        if (a.uom === b.uom) return a.quantity - b.quantity;
        return a.price - b.price;
      });

      if (!isParsedPrice(parentParsedPrice)) {
        return;
      }

      // The parent's own quantity/uom should come from the variant whose
      // price matches the parent price, not just the first variant.
      const parentVariant =
        productVariants.find((v) => v.price === parentParsedPrice.price) ?? productVariants[0];

      if (!parentVariant || !("quantity" in parentVariant) || !("uom" in parentVariant)) {
        return;
      }

      const builder = new ProductBuilder<Product>(this.baseURL);

      builder
        .setBasicInfo(
          product.name,
          `${this.baseURL}/product-page/${product.urlPart}`,
          this.supplierName,
        )
        .setPricing(
          parentParsedPrice.price,
          parentParsedPrice.currencyCode,
          parentParsedPrice.currencySymbol,
        )
        .setQuantity(parentVariant.quantity, parentVariant.uom)
        .setID(product.id)
        .setSku(product.sku)
        .setDescription(htmlToAscii(product.description))
        .setVariants(productVariants.filter(isValidVariant))
        .setCacheKey(this.getUniqueProductKey(product));

      this.applyChemicalProperties(builder, product);

      return builder;
    });
  }

  /**
   * Populates a product builder with the chemical and media properties that live in a Wix
   * product's free-form copy. Both Wix suppliers (FTF, BioFuran) scatter these across the
   * `description` and `additionalInfo` accordions in loosely-structured HTML, so the values are
   * parsed tolerantly via {@link parseChemicalSpecs} / {@link findPdfHref} and only applied when
   * found. Image comes from the first photo in the media gallery; CAS is extracted from the
   * product name and copy by {@link ProductBuilder.setCAS}.
   *
   * @param builder - The product builder to populate (mutated in place)
   * @param product - The raw Wix product object from the search response
   * @returns Nothing; the builder is mutated in place
   * @example
   * ```typescript
   * const builder = new ProductBuilder<Product>(this.baseURL);
   * this.applyChemicalProperties(builder, product);
   * // builder now carries images, sdsUrl, purity, formula, moleweight, smiles and cas
   * ```
   * @source
   */
  protected applyChemicalProperties(
    builder: ProductBuilder<Product>,
    product: ProductObject,
  ): void {
    // Specs and SDS links live in the description and/or the additional-info accordions;
    // parse both together so a supplier's layout (FTF vs BioFuran) doesn't matter.
    const additionalInfoHtml = (product.additionalInfo ?? [])
      .map((info) => info.description)
      .join("\n");
    const copy = `${product.description ?? ""}\n${additionalInfoHtml}`;

    // The setters ignore undefined/invalid input, so the parser output can be passed straight in.
    const photo = (product.media ?? []).find((item) => item.mediaType === "PHOTO" && item.fullUrl);
    const specs = parseChemicalSpecs(copy);

    builder
      .setImage(photo?.fullUrl, photo?.title ?? product.name)
      .setSDSUrl(findPdfHref(copy))
      .setPurity(specs.purity)
      .setFormula(specs.formula)
      .setMoleweight(specs.molecularWeight)
      .setSmiles(specs.smiles)
      // CAS appears in the product name (BioFuran) and/or the copy (both); setCAS extracts it.
      .setCAS(`${product.name}\n${copy}`);
  }

  /**
   * Get the product data from the Wix API
   *
   * @param product - The product to get the data for
   * @returns A promise that resolves to the product data or void if the product has no price
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return this.getProductDataWithCache(product, async (builder) => builder);
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns - The title of the product
   * @source
   */
  protected titleSelector(data: ProductObject): string {
    return data.name;
  }
}
