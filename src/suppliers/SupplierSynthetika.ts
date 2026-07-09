import { AVAILABILITY } from "@/constants/common";
import { findCAS } from "@/helpers/cas";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { urlencode } from "@/helpers/request";
import { findMolarity, parseChemicalSpecs } from "@/helpers/science";
import { firstMap, mapDefined } from "@/helpers/utils";
import { ProductBuilder } from "@/utils/ProductBuilder";
import {
  assertIsSynthetikaSearchResponse,
  isSynthetikaProduct,
} from "@/utils/typeGuards/synthetika";
import { SupplierBase } from "./SupplierBase";
import { parseSynthetikaRestrictions } from "./synthetikaRestrictions";

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
 * @source
 */
export class SupplierSynthetika
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

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = ["mastercard", "visa"];

  /** Override the type of queryResults to use our specific type */
  protected queryResults: Array<SynthetikaProduct> = [];

  /** Used to keep track of how many requests have been made to the supplier */
  protected httpRequstCount: number = 0;

  /**
   * Derives the unique product key from a Synthetika product: its `id` (the same
   * value passed to `.setID`), stable across the query→detail transition.
   * @param data - The raw Synthetika product
   * @returns The product's id
   * @example
   * ```typescript
   * this.getUniqueProductKey(product); // "975"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: SynthetikaProduct): string {
    return String(data.id);
  }

  /** HTTP headers used as a basis for all queries */
  protected headers: HeadersInit = {
     
    accept: [
      "text/html",
      "application/xhtml+xml",
      "application/xml;q=0.9",
      "image/avif",
      "image/webp",
      "image/apng",
      "*/*;q=0.8",
    ].join(","),
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
     
  };

  /**
   * List of categories to include when filtering through the search results.
   * This list made by sorting through https://synthetikaeu.com/webapi/front/en_US/categories/list/?limit=50
   * @source
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
   * @param _limit - The maximum number of results to query for (currently unused; paging is fixed)
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
   *   console.log("No products found or search failed");
   * }
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    _limit: number = this.limit,
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

    const fuzzFiltered = this.fuzzyFilterAst<SynthetikaProduct>(products);
    const grouped = this.groupVariants<SynthetikaProduct>(fuzzFiltered);
    return this.initProductBuilders(grouped);
  }
  /**
   * Selects the title/name of a product from the search response
   * @param data - Product object from search response
   * @returns Title or name of the product
   * @source
   */
  protected titleSelector(data: SynthetikaProduct): string {
    return data.name;
  }

  /**
   * Converts the availability string from Synthetika to an AVAILABILITY enum value.
   * I wrote a bash script that iterated over their collections, then the products in
   * those collections, getting the availability for each. I only found the below:
   * - Large quantity
   * - na wyczerpaniu // Translates to "to exhaustion" (ie: running out)
   * - średnia ilość // Translates to "medium quantity"
   * - tymczasowo niedostępny // Translates to "temporarily unavailable"
   * @param availability - Availability string from Synthetika
   * @returns AVAILABILITY enum value
   * @source
   * ```typescript
   * const availability = "na wyczerpaniu";
   * const availabilityEnum = availabilityConverter(availability);
   * console.log(availabilityEnum);
   * ```
   */
  protected availabilityConverter(availability: string): AVAILABILITY {
    switch (availability.toLowerCase().trim()) {
      case "na wyczerpaniu":
        return AVAILABILITY.LIMITED_STOCK;
      case "large quantity":
      case "średnia ilość":
        return AVAILABILITY.IN_STOCK;
      case "tymczasowo niedostępny":
        return AVAILABILITY.UNAVAILABLE;
      case "nie ma w sprzedaży":
        return AVAILABILITY.OUT_OF_STOCK;
      default:
        this.logger.warn("Unknown availability - Defaulting to UNKNOWN", { availability });
        return AVAILABILITY.UNKNOWN;
    }
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
   * @source
   */
  protected initProductBuilders(
    data: SynthetikaProduct[],
  ): ProductBuilder<Product & { variants?: Variant[] }>[] {
    return mapDefined(data, (product) => {
      const productBuilder = new ProductBuilder(this.baseURL);

      const availability = this.availabilityConverter(product.availability.name);
      if (
        [AVAILABILITY.LIMITED_STOCK, AVAILABILITY.IN_STOCK].includes(availability) === false ||
        product.can_buy === false
      ) {
        this.logger.warn("Product not in stock - Skipping", {
          availability,
          product,
          can_buy: product.can_buy,
        });
        return;
      }

      productBuilder
        .setBasicInfo(product.name, product.url, this.supplierName)
        .setDescription(product.shortDescription)
        .setID(product.id)
        .setCacheKey(this.getUniqueProductKey(product))
        .setAvailability(this.availabilityConverter(product.availability.name))
        .setSku(product.code)
        .setUUID(product.code)
        .setRating(product.rate)
        .setReviewCount(product.votes)
        .setPurchaseRestriction(parseSynthetikaRestrictions(product.shortDescription));

      const quantity = firstMap(parseQuantity, [
        product.name,
        product.description,
        product.weight.weight,
      ]);

      if (quantity) productBuilder.setQuantity(quantity);

      const price = parsePrice(product.price.gross.final);
      if (price) productBuilder.setPricing(price.price, price.currencyCode, price.currencySymbol);

      if (Array.isArray(product.variants) && product.variants.length > 0) {
        productBuilder.setVariants(
          product.variants.map((v) => {
            const price = parsePrice(v.price?.gross.final ?? "");
            return {
              title: v.name,
              price: price?.price ?? 0,
              quantity: parseQuantity(v.name ?? "")?.quantity ?? 0,
              uom: parseQuantity(v.name ?? "")?.uom ?? "",
              url: v.url,
              purchaseRestriction: parseSynthetikaRestrictions(v.shortDescription),
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
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product & { variants?: Variant[] }>,
  ): Promise<ProductBuilder<Product> | void> {
    console.log("[synthetika] getProductData init", { product });
    return this.getProductDataWithCache(product, async (builder) => {
      if (builder instanceof ProductBuilder === false) {
        this.logger.warn("Invalid product object - Expected ProductBuilder instance:", {
          builder,
          product,
        });
        return;
      }

      const productURL = this.href(`/webapi/front/en_US/products/usd/${builder.get("id")}`);
      const productResponse = await this.httpGetJson({
        path: productURL,
      });

      console.log("[synthetika] productResponse", {
        builder,
        product,
        productURL,
        productResponse,
      });

      // Run the minimal check first, so if that fails we can bail early.
      if (!isSynthetikaProduct(productResponse)) {
        this.logger.warn("Product Response body did not satisfy product typeguard:", {
          productResponse,
          builder,
          product,
          productURL,
        });
        return;
      }

      let quantityObject: QuantityObject | undefined;
      if ("options_configuration" in productResponse) {
        quantityObject = mapDefined(
          productResponse.options_configuration[0].values,
          (value: SynthetikaConfigurationOptionValueSchema) => {
            return parseQuantity(value.name);
          },
        )
          .sort((a, b) => (a?.quantity ?? 0) - (b?.quantity ?? 0))
          .at(0);
        console.log("[synthetika] quantityObject (from configurationOptions", { quantityObject });
      }

      if (!quantityObject) {
        quantityObject =
          firstMap<string, QuantityObject | undefined>(parseQuantity, [
            productResponse.name,
            productResponse.description,
            productResponse.weight.weight,
          ]) ?? undefined;

        if (!quantityObject) {
          this.logger.warn("Failed to parse quantity from product response", {
            productResponse,
            builder,
            product,
            productURL,
            parsedValues: [
              productResponse.name,
              productResponse.description,
              productResponse.weight.weight,
            ],
          });
          return;
        }
      }

      builder.setQuantity(quantityObject);

      if (builder.get("price") === undefined) {
        const price = parsePrice(productResponse.price.gross.final);
        if (!price) {
          this.logger.warn("Failed to parse price from product response", {
            productResponse,
            builder,
            product,
            productURL,
            parsedValue: productResponse.price.gross.final,
          });
          return;
        }
        builder.setPricing(price.price, price.currencyCode, price.currencySymbol);
      }

      // Synthetika descriptions aren't consistently formatted (labels may sit in <strong>,
      // spans, or plain text, with unicode-subscript formulas), so extract with the tolerant
      // free-text helpers rather than a fixed DOM structure.
      const specs = parseChemicalSpecs(productResponse.description);
      const cas = findCAS(productResponse.description);
      if (cas) {
        builder.setCAS(cas);
      }
      if (specs.formula) {
        builder.setFormula(specs.formula);
      }
      if (specs.molecularWeight !== undefined) {
        builder.setMoleweight(specs.molecularWeight);
      }
      if (specs.purity !== undefined) {
        builder.setPurity(specs.purity);
      }
      if (specs.smiles) {
        builder.setSmiles(specs.smiles);
      }

      // Molarity (e.g. "1.5M") shows up in the name/description for solution products.
      const molarity =
        findMolarity(productResponse.name) ?? findMolarity(productResponse.description);
      if (molarity !== undefined) {
        builder.setConcentration(molarity);
      }

      // Images: the response gives gfx asset ids (main_image + the images array). Dedupe them
      // and map each to its full-size gfx URL.
      const imageIds = [
        ...new Set(
          [productResponse.main_image, ...(productResponse.images ?? [])].filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ),
        ),
      ];
      if (imageIds.length > 0) {
        builder.addImages(imageIds.map((id) => this.href(`/userdata/public/gfx/${id}/${id}.jpg`)));
      }

      // if (variants.length > 0) {
      //   builder.setVariants(variants);
      // }

      console.log("[synthetika] builder", { builder, product });

      return builder;
    });
  }
}
