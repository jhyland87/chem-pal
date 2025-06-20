import { getCurrencyCodeFromSymbol, parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { createDOM } from "@/helpers/request";
import { getUserCountry, mapDefined } from "@/helpers/utils";
import ProductBuilder from "@/utils/ProductBuilder";
import SupplierBase from "./SupplierBase";

export interface SearchItem {
  id: string;
  productUrl: string;
  title: string;
  currency: CurrencyCode;
  price: number;
  originalPrice: number;
  starRating: number;
  totalRatings: number;
  apiUrl: string;
}

export interface SearchResult {
  metadata: {
    totalResults: number;
    thisPageResults: number;
    page: number;
    query: string;
  };
  pagination: {
    nextPage: string | null;
    prevPage: string | null;
  };
  results: SearchItem[];
}

export type AmazonListing = Pick<Product, "id" | "title" | "url" | "price" | "currencySymbol">;

const amazonDomains: Record<CountryCode, string> = {
  /* eslint-disable */
  US: "https://www.amazon.com", // United States (default)
  UK: "https://www.amazon.co.uk", // United Kingdom
  DE: "https://www.amazon.de", // Germany
  JP: "https://www.amazon.co.jp", // Japan
  CA: "https://www.amazon.ca", // Canada
  FR: "https://www.amazon.fr", // France
  AU: "https://www.amazon.com.au", // Australia
  CN: "https://www.amazon.cn", // China
  ES: "https://www.amazon.es", // Spain
  IT: "https://www.amazon.it", // Italy
  IN: "https://www.amazon.in", // India
  NL: "https://www.amazon.nl", // Netherlands
  PL: "https://www.amazon.pl", // Poland
  PT: "https://www.amazon.pt", // Portugal
  SE: "https://www.amazon.se", // Sweden
  SG: "https://www.amazon.com.sg", // Singapore
  MX: "https://www.amazon.com.mx", // Mexico
  AE: "https://www.amazon.ae", // United Arab Emirates
  BR: "https://www.amazon.com.br", // Brazil
  TR: "https://www.amazon.com.tr", // Turkey
  SA: "https://www.amazon.sa", // Saudi Arabia
  AR: "https://www.amazon.com.ar", // Argentina
  BE: "https://www.amazon.com.be", // Belgium
  EG: "https://www.amazon.eg", // Egypt
  IE: "https://www.amazon.ie", // Ireland
  ZA: "https://www.amazon.co.za", // South Africa
  /* eslint-enable */
};

const userCountry = getUserCountry();
if (!amazonDomains[userCountry]) {
  console.warn("No Amazon domain found for user country:", userCountry);
} else {
  console.debug("amazonDomains[getUserCountry()]:", amazonDomains[userCountry]);
}

/**
 * Base class for Amazon suppliers
 *
 * @remarks
 * This class is used to query products from Amazon.
 *
 */
export default abstract class SupplierBaseAmazon
  extends SupplierBase<Product, Product>
  implements ISupplier
{
  /**
   * The base URL of Amazon - This is determined by the users locale (eg: using output of
   * getUserCountry() from /src/helpers/utils.ts) and a lookup table. Defaults to "US" if
   * the user's country is not found in the lookup table.
   */
  public readonly baseURL: string = amazonDomains[userCountry] || amazonDomains["US"];

  /**
   * Terms found in the listing - An array of strings, at least one of which must be
   * foud in the initial listing on the product search results page.
   */
  protected termsFoundInListing: string[] = [];

  /**
   * Queries products from Amazon
   * @param query - The query to search for
   * @param limit - The maximum number of products to return
   * @returns The products from Amazon
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    limit = 10;
    const queryPagination = async (paginationQuery: string, page: number = 1) => {
      const response = await this.httpPost({
        path: `/s/query?k=${paginationQuery}&page=${page}`,
        body: {
          /* eslint-disable */
          "page-content-type": "atf",
          "prefetch-type": "rq",
          "customer-action": "pagination",
          /* eslint-enable */
        },
        headers: {
          referrer: `${this.baseURL}/s?k=${paginationQuery}&ref=nb_sb_noss`,
          referrerPolicy: "strict-origin-when-cross-origin",
        },
      });
      if (!response) {
        this.logger.error("Invalid response:", response);
        return;
      }

      const responseText = await response.text();
      console.debug("responseText BEFORE length:", responseText.length, responseText);
      const responseTextWithoutSearchTerm = responseText.replaceAll(paginationQuery, "");
      console.debug(
        "responseText AFTER length:",
        responseTextWithoutSearchTerm.length,
        responseTextWithoutSearchTerm,
      );
      return this.parseResponse(responseTextWithoutSearchTerm as string);
    };

    const resultPages = await Promise.all(
      Array.from({ length: Math.ceil(limit / 16) }, (_, i) =>
        queryPagination(`${this.supplierName}+${query}`, i + 1),
      ),
    );

    console.debug("resultPages:", resultPages);

    if (
      !resultPages ||
      !Array.isArray(resultPages) ||
      resultPages.length === 0 ||
      !Array.isArray(resultPages[0])
    ) {
      throw new Error("Result pages either not found or invalid");
    }

    const results = mapDefined(resultPages[0], (page: unknown) => {
      if (!page) return [];
      if (!Array.isArray(page)) return [];
      if (page.length !== 3) return [];
      if (page[0] !== "dispatch") return [];
      if (!page[1].startsWith("data-main-slot:search-result-")) return [];
      return this.parseSearchResult(
        page[2].html.replaceAll(`${this.supplierName}+${query}`, ""),
        this.baseURL,
      );
    });

    console.debug("Parsed results:", results);

    const fuzzedResults = this.fuzzyFilter(query, results, 40);
    console.debug("fuzzedResults:", fuzzedResults);

    return this.initProductBuilders(fuzzedResults as AmazonListing[]);
  }

  /**
   * Checks if the listing meets the requirements
   * @param result - The listing to check
   * @returns True if the listing meets the requirements, false otherwise
   */
  protected checkRequirementsForListing(result: HTMLElement): boolean {
    if (this.termsFoundInListing.length === 0) {
      return true;
    }

    if (!result.innerHTML.toLowerCase().includes(this.supplierName.toLowerCase())) {
      console.log("This item does not contain the suppliers name anywhere, removing", {
        result,
        supplierName: this.supplierName,
      });
      return false;
    }

    return true;

    const resultText = result.innerText;

    return this.termsFoundInListing.some((term) => {
      const found = resultText.toLowerCase().includes(term.toLowerCase());
      if (!found) {
        console.debug(`Term "${term}" not found in listing`, {
          term,
          resultText,
        });
      }
      return found;
    });
  }

  /**
   * Parses the search result from Amazon
   * @param raw - The raw HTML of the search result
   * @param amazonBase - The base URL of Amazon
   * @returns The parsed search result
   */
  private parseSearchResult(raw: string, amazonBase: string): Maybe<AmazonListing> {
    try {
      // To help ensure the products are from the requested supplier, run a quick check for the suppliers name.
      // That's usually included in the listing somewhere.
      // Note: To exclude any false positives from matching with any hyperlinks that have the current search
      // term (which would include the suppliers name), the exact search term (supplier+query) is removed from
      // the raw HTML before this method is called.
      if (!raw.toLowerCase().includes(this.supplierName.toLowerCase())) {
        console.debug("This item does not contain the suppliers name anywhere, removing", {
          raw,
        });
        return;
      }

      // Sometimes those sponsored listings can sneak through... Just outright delete anything that has the
      // word "sponsored" in the raw HTML.
      if (raw.toLowerCase().includes("sponsored")) {
        console.debug("This item is a sponsored listing, removing", {
          raw,
        });
        return;
      }

      const listingDocument = createDOM(`<html><body>${raw}</body></html>`);
      console.debug({ listingDocument });

      const documentBody = listingDocument.body;

      console.debug({ documentBody });

      // Check if the listing meets the requirements. Use innerText because many of the hyperlinks
      // will have the search term saved in the href attribute.
      // if (!this.checkRequirementsForListing(documentBody)) {
      //   return;
      // }

      if (!documentBody) {
        throw new Error("Document body not found");
      }

      // Extracting the title
      const titleElement = documentBody.querySelector("a h2 span");
      const title = titleElement ? titleElement.textContent?.trim() : null;

      // Extracting the price
      const priceElement = documentBody.querySelector("span.a-price span.a-price-whole");
      let price = priceElement ? priceElement.textContent?.trim() : null;

      // Extracting the currency
      const currencyElement = documentBody.querySelector("span.a-price-symbol");
      let currency = currencyElement ? currencyElement.textContent?.trim() : null;

      // Array.from(documentBody.querySelectorAll('span, div')).map(e => e.innerText).find(e => /^\$\d+\.\d+$/.test(e))

      // Extracting the original price
      const originalPriceElement = documentBody.querySelector("span.a-text-price span.a-offscreen");
      let originalPrice = originalPriceElement ? originalPriceElement.textContent?.trim() : null;

      // This is a fallback for when the price and currency are not found in the expected locations.
      if (!price || !currency) {
        const priceAndCurrency = Array.from(documentBody.querySelectorAll("span, div"))
          .map((element) => element.textContent)
          .find((text) => !!text && /^\$\d+\.\d+$/.test(text));

        if (priceAndCurrency) {
          const parsedPrice = parsePrice(priceAndCurrency);
          if (!price) price = parsedPrice?.price?.toString();
          if (!currency) currency = parsedPrice?.currencySymbol;
          if (!originalPrice) originalPrice = priceAndCurrency;
        }
      }

      // Extracting the product ID (ASIN)
      const productElement = documentBody.querySelector("[data-asin]");
      const productId = productElement ? productElement.getAttribute("data-asin") : null;

      console.debug("matches:", { productId, title, originalPrice, price });

      if (!productId || !title || !price || !currency) {
        console.warn("Missing required fields:", { productId, title, price, currency });
        return;
      }

      // Extracting the star rating
      //const starRatingElement = documentBody.querySelector("span.a-icon-alt");
      //const starRating = starRatingElement ? parseFloat(starRatingElement.textContent?.split(" ")[0] || "0") : 0;

      // Extracting the total ratings
      //const totalRatingsElement = documentBody.querySelector("span.a-size-base");
      //const totalRatings = totalRatingsElement ? Number(totalRatingsElement.textContent || "0") : 0;

      return {
        id: productId,
        url: `${amazonBase}/dp/${productId}`,
        title,
        currencySymbol: currency,
        price: Number(price),
      };
    } catch (error) {
      console.error("Error parsing search result:", error);
      return;
    }
  }

  /**
   * Parses the response from Amazon
   * @param response - The response from Amazon
   * @returns The parsed response
   */
  protected parseResponse(response: string): unknown {
    try {
      return JSON.parse(response);
    } catch {
      try {
        const splitted = response.split("\n&&&\n");
        if (splitted.length < 3) throw new Error();

        return splitted
          .map((s) => {
            try {
              return JSON.parse(s);
            } catch {
              return null;
            }
          })
          .filter((s) => s);
      } catch {
        return response as string;
      }
    }
  }

  /**
   * Initializes product builders from Amazon listings
   * @param results - The Amazon listings to initialize product builders from
   * @returns An array of product builders
   */
  protected initProductBuilders(results: AmazonListing[]): ProductBuilder<Product>[] {
    return results
      .map((item) => {
        const builder = new ProductBuilder(this.baseURL);
        builder
          .setBasicInfo(item.title, item.url, this.supplierName)
          .setPricing(
            item.price,
            getCurrencyCodeFromSymbol(item.currencySymbol),
            item.currencySymbol,
          )
          .setVendor("Amazon");

        const quantity = parseQuantity(item.title);

        if (!quantity) {
          this.logger.warn("Failed to get quantity from retrieved product data:", item);
          return;
        }

        builder.setQuantity(quantity.quantity, quantity.uom);

        return builder;
      })
      .filter((builder): builder is ProductBuilder<Product> => builder !== undefined);
  }

  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    return product;
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns - The title of the product
   */
  protected titleSelector(data: AmazonListing): string {
    return data.title;
  }
}
