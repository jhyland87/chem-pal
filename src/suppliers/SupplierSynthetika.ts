import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { urlencode } from "@/helpers/request";
import { mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import { assertIsSynthetikaSearchResponse } from "@/utils/typeGuards/synthetika";
import SupplierBase from "./SupplierBase";

/**
 * Supplier implementation for Synthetika
 *
 * @remarks
 * Synthetika is a chemical supplier that sells a wide range of chemicals out of Poland.
 * Their website seems to be using Shopper, which is a CMS popular with Polish ecommerce
 * stores.
 *
 * Their Shopper instance does have a public facing API (at /webapo/front). Most
 * of the pages are limited to 50 results, which may require pagination.
 *
 * Additionally, they don't seem to use "variants" very much. The same product with just
 * slightly different quantities is just a different product, which fills up the results
 * pretty quickly. I wrote the {@link groupVariants} function to group the products that are
 * very similar all into a single product with an array of variants. This is done by removing
 * the quantity from the title/name, then removing all spaces and dashes to give us a
 * temporary unique identifier for the group. Then grouping that by that identifier.
 *
 * Links:
 * - {@link https://synthetikaeu.com | Synthetika Home Page}
 *
 * Example API Endpoints:
 *  - {@link https://synthetikaeu.com/webapi/front/en_US/search/short-list/products?text=acid&org=acid&perPage=20 | Short list (not so useful)}
 *  - {@link https://synthetikaeu.com/webapi/front/en_US/collections/list/ | List collections}
 *  - {@link https://synthetikaeu.com/webapi/front/en_US/collections/4/products/usd/ | Get products in collection}
 *  - {@link https://synthetikaeu.com/webapi/front/en_US/categories/list/ | List categories}
 *  - {@link https://synthetikaeu.com/webapi/front/en_US/products/usd/975 | Get product}
 *  - {@link https://synthetikaeu.com/webapi/front/en_US/products/usd/975/stock | Get product options}
 *  - {@link https://synthetikaeu.com/webapi/front/en_US/products/usd/main/?limit=50 | List main products}
 *  - {@link https://synthetikaeu.com/webapi/front/en_US/products/usd/search/acid?limit=50 | Product search}
 *  - {@link https://synthetikaeu.com/webapi/front/en_US/products/usd/list/108,110 | Get specific product IDs (multiple)}
 *  - {@link https://synthetikaeu.com/webapi/front/en_US/categories/53/products/usd/?limit=50 | Get products from category}
 *  - {@link https://synthetikaeu.com/webapi/front/en_US/categories/129/filters/usd/?limit=50 | Get filters from category}
 * @category Suppliers
 * @example
 * ```typescript
 * const supplier = new SupplierSynthetika();
 * for await (const product of supplier) {
 *   console.log(product);
 * }
 * ```
 */
export default class SupplierSynthetika
  extends SupplierBase<SynthetikaProduct, Product>
  implements ISupplier
{
  /** Name of supplier (for display purposes) */
  public readonly supplierName: string = "Synthetika";

  /** Base URL for HTTP(s) requests */
  public readonly baseURL: string = "https://synthetikaeu.com";

  /** Shipping scope for Synthetika */
  public readonly shipping: ShippingRange = "international";

  /** The country code of the supplier */
  public readonly country: CountryCode = "PL";

  /** Override the type of queryResults to use our specific type */
  protected queryResults: Array<SynthetikaProduct> = [];

  /** Used to keep track of how many requests have been made to the supplier */
  protected httpRequstCount: number = 0;

  /** HTTP headers used as a basis for all queries */
  protected headers: HeadersInit = {
    /* eslint-disable */
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.6",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "sec-ch-ua": '"Brave";v="135\', "Not-A.Brand";v="8\', "Chromium";v="135"',
    "sec-ch-ua-arch": '"arm"',
    "sec-ch-ua-full-version-list":
      '"Brave";v="135.0.0.0\', "Not-A.Brand";v="8.0.0.0\', "Chromium";v="135.0.0.0"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": '""',
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sec-gpc": "1",
    "x-requested-with": "XMLHttpRequest",
    /* eslint-enable */
  };

  /**
   * List of categories to include when filtering through the search results.
   * This list made by sorting through https://synthetikaeu.com/webapi/front/en_US/categories/list/?limit=50
   */
  private readonly includeCategories: number[] = [
    16, // Hydrides
    17, // Antimony
    18, // Barium
    21, // Inorganic compounds
    25, // Salts
    30, // Ammonium
    39, // Organic compounds
    40, // Aldehydes
    42, // Alcohols
    43, // Aminoacids
    44, // Amines
    45, // Acyl Halides
    46, // Esters
    47, // Ethers
    48, // Oxides
    50, // Phenols
    51, // Halogens
    52, // Ketones
    53, // Carboxylic acids
    55, // Nitroles
    57, // Polymers
    58, // Terlenes
    59, // Hydrocarbons
    60, // Saturated
    62, // Silicoorgano and Phosphoorganocompounds
    64, // Nitro Compounds
    67, // Others
    68, // Bismuth,
    70, // Cesium
    71, // Chromium
    72, // Tin
    74, // Aluminium
    75, // Zarconium
    76, // Cadmium
    77, // Lanthanum
    78, // Lithium
    79, // Magnesium
    80, // Manganese
    81, // Copper
    83, // Nickel
    84, // Lead
    87, // Mercury
    89, // Silver
    90, // Strontium
    94, // Calcium
    96, // Iron
    97, // Mixed salts
    98, // Sodium
    99, // Hydroxides
    100, // Potassium
    102, // Elements
    103, // Metals
    104, // Nonmetals
    105, // Heterocycles
    106, // Cobalt
    108, // Amides
    109, // Zinc
    110, // Aromatic
    111, // Anhydrides
    112, // Organic salts
    113, // Lactams
    114, // Lactones
    115, // Sugars
    116, // Glycols
    117, // Others
    118, // Mixed solvents
    119, // Chelates,
    120, // Colorimetric reagents
    273, // Alkyl nitriles
    278, // "*"
    279, // Chemicals sorted by use
    281, // Solvents
    290, // Industrial solvents
    292, // Pyrotechnics
    293, // Chemicals sorted by industry
    293, // Oxidizers
    294, // Reducing agents
    295, // Metal powders
    297, // Reducing agents for synthesis
    298, // Oxidizing agents for synthesis
    300, // Bases
    301, // Classic acids
    302, // Alkylating agents
    303, // Halogenating reagents
    304, // Mineral acids
    305, // Cesium
    306, // Nitrostyrenes
    307, // Nitroalkanes
    308, // Nitrobenzenes
    309, // Catalysts
  ];

  /**
   * Executes a product search query and returns matching products
   * @param query - Search term to look for
   * @param limit - The maximum number of results to query for
   * @returns Promise resolving to array of product objects or void if search fails
   * @example
   * ```typescript
   * // Search for sodium chloride with a limit of 10 results
   * const products = await this.queryProducts("sodium chloride", 10);
   * if (products) {
   *   console.log(`Found ${products.length} products`);
   *   for (const product of products) {
   *     const builtProduct = await product.build();
   *     console.log(builtProduct.title, builtProduct.price);
   *   }
   * } else {
   *   console.error("No products found or search failed");
   * }
   * ```
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    /* The code snippet is performing the following actions: */
    const params = {
      limit: 50,
      page: 1,
    };

    const products: SynthetikaProduct[] = [];
    // Iterate through the pages to collect all of the products in the search results, but
    // limit it to something reasonable (5 pages, for now)
    for (let i = 1; i <= 5; i++) {
      const pageResponse = await this.httpGetJson({
        path: `/webapi/front/en_US/products/usd/search/${urlencode(query)}`,
        params: { ...params, page: i },
      });

      assertIsSynthetikaSearchResponse(pageResponse);

      // Add these to the products array, but filter out the non-whitelisted categories first
      products.push(
        ...pageResponse.list.filter((product) =>
          this.includeCategories.includes(product.category.id),
        ),
      );

      if (pageResponse.pages <= i) break;
    }

    const fuzzFiltered = this.fuzzyFilter<SynthetikaProduct>(query, products);
    const grouped = this.groupVariants<SynthetikaProduct>(fuzzFiltered);
    return this.initProductBuilders(grouped.slice(0, limit));
  }

  /**
   * Selects the title/name of a product from the search response
   * @param data - Product object from search response
   * @returns Title or name of the product
   */
  protected titleSelector(data: SynthetikaProduct): string {
    return data.name;
  }

  /**
   * Initialize product builders from Synthetika search response data.
   * Transforms product listings into ProductBuilder instances, handling:
   * - Basic product information (name, URL, supplier)
   * - Product descriptions
   * - Product IDs and SKUs
   * - Availability status
   * - Quantity parsing from product name
   * - Price parsing from product data
   * - Variant information if available
   *
   * @param data - Array of product listings from search results
   * @returns Array of ProductBuilder instances initialized with product data
   */
  protected initProductBuilders(
    data: SynthetikaProduct[],
  ): ProductBuilder<Product & { variants?: Variant[] }>[] {
    return mapDefined(data, (product) => {
      const productBuilder = new ProductBuilder(this.baseURL);

      productBuilder
        .setBasicInfo(product.name, product.url, this.supplierName)
        .setDescription(product.shortDescription)
        .setID(product.id)
        .setAvailability(product.availability.name)
        .setSku(product.code)
        .setUUID(product.code);

      const quantity = parseQuantity(product.name);
      if (quantity) {
        productBuilder.setQuantity(quantity);
      }

      const price = parsePrice(product.price.gross.final);
      if (price) {
        productBuilder.setPricing(price.price, price.currencyCode, price.currencySymbol);
      }

      if (product.variants) {
        productBuilder.setVariants(
          product.variants.map((v) => {
            const price = parsePrice(v.price?.gross.final ?? "");
            return {
              title: v.name,
              price: price?.price ?? 0,
              quantity: parseQuantity(v.name ?? "")?.quantity ?? 0,
              uom: parseQuantity(v.name ?? "")?.uom ?? "",
              url: v.url,
            };
          }),
        );
      }

      return productBuilder;
    });
  }

  /**
   * Process the product data and return a ProductBuilder instance
   * @param product - The ProductBuilder instance to process
   * @returns Promise resolving to a ProductBuilder instance or void
   */
  protected async getProductData(
    product: ProductBuilder<Product & { variants?: Variant[] }>,
  ): Promise<ProductBuilder<Product> | void> {
    return product;
  }
}
