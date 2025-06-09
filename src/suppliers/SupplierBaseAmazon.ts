import { getCurrencyCodeFromSymbol } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { createDOM } from "@/helpers/request";
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
  public readonly baseURL: string = "https://www.amazon.com";

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
    const queryPagination = async (query: string, page: number = 1) => {
      const response = await this.httpPost({
        path: `/s/query?k=${query}&page=${page}`,
        body: {
          /* eslint-disable */
          "page-content-type": "atf",
          "prefetch-type": "rq",
          "customer-action": "pagination",
          /* eslint-enable */
        },
        headers: {
          referrer: `https://www.amazon.com/s?k=${query}&ref=nb_sb_noss`,
          referrerPolicy: "strict-origin-when-cross-origin",
        },
      });
      if (!response) {
        this.logger.error("Invalid response:", response);
        return;
      }

      const responseText = await response.text();
      return this.parseResponse(responseText as string);
    };

    const resultPages = await Promise.all(
      Array.from({ length: Math.ceil(limit / 16) }, (_, i) =>
        queryPagination(`${this.supplierName}+${query}`, i + 1),
      ),
    );

    console.log("resultPages:", resultPages);

    if (
      !resultPages ||
      !Array.isArray(resultPages) ||
      resultPages.length === 0 ||
      !Array.isArray(resultPages[0])
    ) {
      throw new Error("Result pages either not found or invalid");
    }

    const results = resultPages[0]
      .flatMap((page: unknown) => {
        if (!page) return [];
        if (!Array.isArray(page)) return [];
        if (page.length !== 3) return [];
        if (page[0] !== "dispatch") return [];
        if (!page[1].startsWith("data-main-slot:search-result-")) return [];
        return this.parseSearchResult({
          raw: page[2].html,
          amazonBase: this.baseURL,
          amazonCountry: this.country,
        });
      })
      .filter((result): result is Product => result !== undefined);

    return this.initProductBuilders(results as AmazonListing[]);
  }

  /**
   * Parses the search result from Amazon
   * @param raw - The raw HTML of the search result
   * @param amazonBase - The base URL of Amazon
   * @returns The parsed search result
   */
  private parseSearchResult({
    raw,
    amazonBase,
    //amazonCountry,
  }: {
    raw: string;
    amazonBase: string;
    amazonCountry: string;
  }): Maybe<AmazonListing> {
    try {
      const document = createDOM(`<html><body>${raw}</body></html>`);

      const documentBody = document.body;

      if (!documentBody) {
        throw new Error("Document body not found");
      }

      // Extracting the title
      const titleElement = documentBody.querySelector("a h2 span");
      const title = titleElement ? titleElement.textContent?.trim() : null;

      // Extracting the price
      const priceElement = documentBody.querySelector("span.a-price span.a-price-whole");
      const price = priceElement ? priceElement.textContent?.trim() : null;

      // Extracting the currency
      const currencyElement = documentBody.querySelector("span.a-price-symbol");
      const currency = currencyElement ? currencyElement.textContent?.trim() : null;

      // Extracting the original price
      const originalPriceElement = documentBody.querySelector("span.a-text-price span.a-offscreen");
      const originalPrice = originalPriceElement ? originalPriceElement.textContent?.trim() : null;

      // Extracting the product ID (ASIN)
      const productElement = documentBody.querySelector("[data-asin]");
      const productId = productElement ? productElement.getAttribute("data-asin") : null;

      console.log("matches:", { productId, title, originalPrice, price });

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
  protected titleSelector(data: ItemListing): string {
    return data.title;
  }
}
