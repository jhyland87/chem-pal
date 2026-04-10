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

const amazonDomains: CountryDomainMap = {
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
  console.warn("No Amazon domain found for user country", { userCountry });
} else {
  console.debug("amazonDomains[getUserCountry()]", { domain: amazonDomains[userCountry] });
}

/**
 * Base class for Amazon suppliers
 *
 * @remarks
 * This class is used to query products from Amazon.
 *
 * @source
 */
export default abstract class SupplierBaseAmazon
  extends SupplierBase<Product, Product>
  implements ISupplier
{
  /**
   * The base URL of Amazon - This is determined by the users locale (eg: using output of
   * getUserCountry() from /src/helpers/utils.ts) and a lookup table. Defaults to "US" if
   * the user's country is not found in the lookup table.
   * @source
   */
  public readonly baseURL: string = amazonDomains[userCountry] || amazonDomains["US"];

  /**
   * Terms found in the listing - An array of strings, at least one of which must be
   * foud in the initial listing on the product search results page.
   * @source
   */
  protected termsFoundInListing?: string[];

  /**
   * Extra parameters to add to the query.url
   * @source
   */
  protected extraParams?: string;

  /**
   * Prefix to add to the query (ie: brand name or seller name)
   * @source
   */
  protected readonly queryPrefix?: string;

  /**
   * Queries products from Amazon
   * @param query - The query to search for
   * @param limit - The maximum number of products to return
   * @returns The products from Amazon
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    limit = 10;
    const queryPagination = async (paginationQuery: string, page: number = 1) => {
      const response = await this.httpPost({
        path: `/s?k=${paginationQuery}&page=${page}&${this.extraParams || ""}`,
        // path: `/s/query`, //?i=industrial&k=${paginationQuery}&page=${page}`,
        // params: {
        //   i: "industrial",
        //   k: paginationQuery,
        //   page: page,
        // },
        body: {
          /* eslint-disable */
          "page-content-type": "atf",
          "prefetch-type": "rq",
          "customer-action": "pagination",
          /* eslint-enable */
        },
        headers: {
          //referrer: `${this.baseURL}/s?k=${urlencode(paginationQuery)}&ref=nb_sb_noss`,
          referrerPolicy: "strict-origin-when-cross-origin",
          //redirect: "follow",
        },
      });
      if (!response) {
        this.logger.error("Invalid response:", { response });
        return;
      }

      const responseText = await response.text();
      this.logger.debug("responseText BEFORE length:", {
        length: responseText.length,
        responseText,
      });
      const responseTextWithoutSearchTerm = responseText.replaceAll(paginationQuery, "");
      this.logger.debug("responseText AFTER length:", {
        length: responseTextWithoutSearchTerm.length,
        responseTextWithoutSearchTerm,
      });
      return this.parseResponse(String(responseTextWithoutSearchTerm));
    };

    const resultPages = await Promise.all(
      Array.from({ length: Math.ceil(limit / 16) }, (_, i) =>
        queryPagination(`${this.queryPrefix ?? this.supplierName}+${query}`, i + 1),
      ),
    );

    this.logger.debug("resultPages:", { query, resultPages });
    if (!resultPages || !Array.isArray(resultPages) || resultPages.length === 0) {
      throw new Error("Result pages not found");
    }

    const searchTerm = `${this.queryPrefix ?? this.supplierName}+${query}`;

    const results = resultPages.flatMap((resultPage) => {
      if (!resultPage) return [];

      // New format: response is an HTML string
      if (typeof resultPage === "string") {
        const htmlWithoutSearchTerm = resultPage.replaceAll(searchTerm, "");
        const doc = createDOM(htmlWithoutSearchTerm);
        const resultElements = doc.querySelectorAll(
          '[data-component-type="s-search-result"][data-asin]',
        );
        return mapDefined(Array.from(resultElements), (el) => {
          if (!el.getAttribute("data-asin")) return;
          return this.parseSearchResult(el.outerHTML, this.baseURL);
        });
      }

      // Old format: response is an array of ["dispatch", "data-main-slot:search-result-N", {html}]
      if (Array.isArray(resultPage)) {
        return mapDefined(resultPage, (page: unknown) => {
          if (!page) return;
          if (!Array.isArray(page)) return;
          if (page.length !== 3) return;
          if (page[0] !== "dispatch") return;
          if (!page[1].startsWith("data-main-slot:search-result-")) return;
          return this.parseSearchResult(page[2].html.replaceAll(searchTerm, ""), this.baseURL);
        });
      }

      return [];
    });

    this.logger.debug("Parsed results", { query, results });

    const fuzzedResults = this.fuzzyFilter(query, results, 40);
    this.logger.debug("fuzzedResults", { query, results, fuzzedResults });

    return this.initProductBuilders(fuzzedResults);
  }

  /**
   * Checks if the listing meets the requirements
   * @param result - The listing to check
   * @returns True if the listing meets the requirements, false otherwise
   * @source
   */
  protected checkRequirementsForListing(result: HTMLElement): boolean {
    const resultText = result.innerText.toLowerCase();
    const searchList = [...(this.termsFoundInListing ?? []), this.supplierName];

    const matchedString = searchList.some((term) => {
      const found = resultText.toLowerCase().includes(term.toLowerCase());
      if (found) {
        this.logger.debug(`Term "${term}" FOUND in listing`, {
          term,
          resultText,
        });
      }
      return found;
    });

    if (!matchedString) {
      this.logger.debug("Did not find any of the specified strings in the product listing", {
        matchedString,
        searchList,
        resultText,
        result,
      });
    }

    return matchedString;
  }

  private findQID(doc: Document): Maybe<string> {
    const link = Array.from(doc.querySelectorAll("a")).find((a: HTMLAnchorElement) =>
      a.href.includes("qid="),
    );
    if (!link) {
      this.logger.warn("No QID found", { doc });
      return;
    }
    return link.href.split("qid=")[1];
  }
  /**
   * Parses the search result from Amazon
   * @param raw - The raw HTML of the search result
   * @param amazonBase - The base URL of Amazon
   * @returns The parsed search result
   * @source
   */
  private parseSearchResult(raw: string, amazonBase: string): Maybe<AmazonListing> {
    try {
      // To help ensure the products are from the requested supplier, run a quick check for the suppliers name.
      // That's usually included in the listing somewhere.
      // Note: To exclude any false positives from matching with any hyperlinks that have the current search
      // term (which would include the suppliers name), the exact search term (supplier+query) is removed from
      // the raw HTML before this method is called.
      if (!raw.toLowerCase().includes(this.supplierName.toLowerCase())) {
        this.logger.debug("This item does not contain the suppliers name anywhere, removing", {
          raw,
        });
        return;
      }

      // Sometimes those sponsored listings can sneak through... Just outright delete anything that has the
      // word "sponsored" in the raw HTML.
      if (raw.toLowerCase().includes("sponsored")) {
        this.logger.debug("This item is a sponsored listing, removing", {
          raw,
        });
        return;
      }

      const listingDocument = createDOM(`<html><body>${raw}</body></html>`);
      this.logger.debug("listingDocument", { raw, listingDocument });

      const documentBody = listingDocument.body;

      this.logger.debug("documentBody", { raw, documentBody });

      const asin = documentBody.querySelector("[data-asin]")?.getAttribute("data-asin");
      if (!asin) {
        this.logger.warn("No ASIN found", { raw, documentBody });
      } else {
        this.logger.debug("asin", { raw, documentBody, asin });
      }

      const qid = this.findQID(listingDocument);
      if (!qid) {
        this.logger.warn("No QID found", { raw, listingDocument });
      } else {
        this.logger.debug("qid", { raw, listingDocument, qid });
      }

      // Check if the listing meets the requirements. Use innerText because many of the hyperlinks
      // will have the search term saved in the href attribute.
      if (!this.checkRequirementsForListing(documentBody)) {
        return;
      }

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
          if (!price) price = String(parsedPrice?.price ?? "");
          if (!currency) currency = parsedPrice?.currencySymbol;
          if (!originalPrice) originalPrice = priceAndCurrency;
        }
      }

      // Extracting the product ID (ASIN)
      const productElement = documentBody.querySelector("[data-asin]");
      const productId = productElement ? productElement.getAttribute("data-asin") : null;

      this.logger.debug("matches", {
        productElement,
        productId,
        title,
        originalPrice,
        price,
        currency,
      });

      if (!productId || !title || !price || !currency) {
        this.logger.warn("Missing required fields", {
          productElement,
          productId,
          title,
          price,
          currency,
        });
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
      this.logger.error("Error parsing search result", { error, raw, amazonBase });
      return;
    }
  }

  /**
   * Parses the response from Amazon
   * @param response - The response from Amazon
   * @returns The parsed response
   * @source
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
        return String(response ?? "");
      }
    }
  }

  /**
   * Initializes product builders from Amazon listings
   * @param results - The Amazon listings to initialize product builders from
   * @returns An array of product builders
   * @source
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
          this.logger.warn("Failed to get quantity from retrieved product title", {
            title: item.title,
            builder,
            item,
          });
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
   * @source
   */
  protected titleSelector(data: AmazonListing): string {
    return data.title;
  }
}
