import { AVAILABILITY, CACHE } from "@/constants/common";
import { getCookie } from "@/helpers/cookies";
import { getUserCountryName } from "@/helpers/country";
import { parsePrice } from "@/helpers/currency";
import { parseQuantity } from "@/helpers/quantity";
import { looksLikeSmiles } from "@/helpers/smiles";
import {
  base36Timestamp,
  base64EncodeUtf8,
  getUserLanguage,
  htmlToAscii,
  mapDefined,
  md5sum,
  objectToQueryString,
} from "@/helpers/utils";
import { ProductBuilder } from "@/utils/ProductBuilder";
import { detectTermType } from "@/utils/search-query/detectTermType";
import { scoreAstMatch } from "@/utils/search-query/evaluateAst";
import { extractAllPositiveTerms } from "@/utils/search-query/extractPositiveTerms";
import type { SearchAst } from "@/utils/search-query/types";
import { cstorage } from "@/utils/storage";
import {
  assertIsAmbeedGetSearchProductAndRecommendedProductsByCASResponse,
  assertIsAmbeedProductListResponse,
  isAmbeedGetPmsSdsByAmsResponse,
  isAmbeedProductPriceResponse,
  isAmbeedProductStockResponse,
} from "@/utils/typeGuards/ambeed";
import type { JsonValue } from "type-fest";
import { SupplierBase } from "./SupplierBase";

// Decoder for ambeed's am-new2.woff cmap-substitution font.
// Source codepoint -> visible character. Verified: "łÇÊ¶ÊÊ" -> "$10.00".
// NOTE: this table is specific to am-new2.woff; re-extract if the font is rotated.
const AMBEED_FONT_MAP: Record<number, string> = {
  0x00ca: "0",
  0x00c7: "1",
  0x00cb: "2",
  0x00a7: "3",
  0x00cd: "4",
  0x00ff: "5",
  0x00f2: "6",
  0x010f: "7",
  0x00f3: "8",
  0x00ee: "9",
  0x00e8: "a",
  0x00df: "b",
  0x00de: "c",
  0x0119: "d",
  0x0121: "e",
  0x00d1: "f",
  0x00d5: "g",
  0x00d0: "h",
  0x00db: "i",
  0x00d9: "j",
  0x00d2: "k",
  0x0127: "m",
  0x010b: "n",
  0x0167: "n",
  0x0109: "o",
  0x0123: "p",
  0x00c9: "q",
  0x0104: "r",
  0x00a2: "s",
  0x00f0: "t",
  0x00c8: "u",
  0x00c5: "v",
  0x0126: "w",
  0x00fb: "x",
  0x00c3: "y",
  0x00c4: "z",
  0x00d6: "A",
  0x00d4: "B",
  0x00dd: "C",
  0x00d8: "D",
  0x012d: "E",
  0x0153: "F",
  0x012b: "G",
  0x0129: "H",
  0x00f1: "J",
  0x00ed: "K",
  0x0105: "L",
  0x00ef: "M",
  0x00e0: "N",
  0x00eb: "O",
  0x010c: "P",
  0x00e3: "Q",
  0x00a4: "R",
  0x00cf: "S",
  0x00e1: "T",
  0x00f6: "U",
  0x00dc: "V",
  0x00cc: "W",
  0x00e7: "X",
  0x00ec: "Y",
  0x00e4: "Z",
  0x00b6: ".",
  0x0142: "$",
  0x0100: "\u00A3",
  0x0101: "\u00A3",
  0x0102: "\u20AC",
  0x0155: "%",
  0x0193: ",",
  0x0164: "-",
  0x015b: "(",
  0x01a5: ")",
  0x01ab: "*",
  0x00c6: "/",
  0x00e9: "=",
  0x00ea: "<",
  0x00e2: ">",
  0x00e5: "\u2264",
  0x00a3: "\u2265",
  0x00a1: "I",
  0x0157: "l", // bare vertical stroke: I / l / 1 indistinguishable
};

// Ambeed's SDS "type" maps, taken from their storefront. The selected type is
// sent as `request_type` and is the key under `sds_list[<p_am>]` in the
// response. `getSdsType` resolves the user's country/language to one of these.
//
// Non-European countries → `sdsJson` (keyed `SDS-<COUNTRY>`).
const sdsJson = {
  "SDS-US": { type: "am" }, // United States
  "SDS-DE": { type: "am-de-de" }, // Germany
  "SDS-UK": { type: "am-europe-uk" }, // United Kingdom
  "SDS-CN": { type: "am-cn" }, // China
  "SDS-CA": { type: "am-canada" }, // Canada
  "SDS-EU": { type: "am-europe" }, // Europe
} as const;

// European countries → `sdsJsonEurope` (keyed `SDS-EU-<LANG>`).
const sdsJsonEurope = {
  "SDS-EU-EN": { type: "amgm-europe" },
  "SDS-UK-EN": { type: "amgm-europe-uk" },
  "SDS-EU-DE": { type: "amgm-de-de" },
  "SDS-EU-FR": { type: "amgm-sds-fr-fr" },
  "SDS-EU-ES": { type: "amgm-sds-es-es" },
  "SDS-EU-IT": { type: "amgm-sds-it-it" },
  "SDS-EU-DK": { type: "amgm-sds-da-dk" },
  "SDS-EU-PT": { type: "amgm-sds-pt-pt" },
  "SDS-EU-PL": { type: "amgm-sds-pl-pl" },
  "SDS-EU-SE": { type: "amgm-sds-sv-se" },
  "SDS-EU-NO": { type: "amgm-sds-no-no" },
  "SDS-EU-NL": { type: "amgm-sds-nl-nl" },
} as const;

// English SDS type, the universal fallback always requested alongside the
// user's preferred type.
const SDS_TYPE_FALLBACK = "am";

// European country codes (the European subset of `shipsTo`). A user in one of
// these gets a `sdsJsonEurope` (amgm-*) SDS; everyone else uses `sdsJson`.
const EUROPEAN_COUNTRY_CODES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "CH",
  "TR",
  "GB",
]);

// Maps a language's primary subtag to the `SDS-EU-<X>` suffix. Needed because
// the suffixes are country-ish (DK/SE/NO) rather than language codes (da/sv/nb).
const LANGUAGE_TO_EU_SDS_SUFFIX: Record<string, string> = {
  en: "EN",
  de: "DE",
  fr: "FR",
  es: "ES",
  it: "IT",
  da: "DK",
  pt: "PT",
  pl: "PL",
  sv: "SE",
  nb: "NO",
  nn: "NO",
  no: "NO",
  nl: "NL",
};

/**
 * Ambeed is a Chinese chemical supplier.
 *
 * @remarks
 * Ambeed seems to have a custom API located at `https://www.ambeed.com/webapi/v1`. All the
 * GET endpoints seem to require a `params` query parameter, which is a base64 encoded JSON
 * string.
 * They only seem to ship to three locations: USA, China and two places in Amsterdam. Each
 * location has its own quantity
 *
 * ```js
 * const params = btoa(JSON.stringify({"keyword":"sodium","country":"United States","one_menu_id":0,"one_menu_life_id":0,"menu_id":0}));
 * const url = `https://ambeed.com/webapi/v1/productlistbykeyword?params=${params}`;
 * ```
 * @see https://www.ambeed.com/
 * @source
 */
export class SupplierAmbeed
  extends SupplierBase<AmbeedProductObject, Product>
  implements ISupplier
{
  // Name of supplier (for display purposes)
  public readonly supplierName: string = "Ambeed";

  // Base URL for HTTP(s) requests
  public readonly baseURL: string = "https://www.ambeed.com";

  // Shipping scope for Ambeed
  public readonly shipping: ShippingRange = "international";

  // The country code of the supplier.
  public readonly country: CountryCode = "CN";

  // The countries to which the supplier ships.
  public readonly shipsTo: CountryCode[] = [
    "AR",
    "BR",
    "CA",
    "MX",
    "US",
    "AT",
    "BE",
    "BG",
    "HR",
    "CY",
    "CZ",
    "DK",
    "EE",
    "FI",
    "FR",
    "DE",
    "GR",
    "HU",
    "IE",
    "IT",
    "LV",
    "LI",
    "LT",
    "LU",
    "MT",
    "NL",
    "NO",
    "PL",
    "PT",
    "RO",
    "SK",
    "SI",
    "ES",
    "SE",
    "CH",
    "TR",
    "GB",
    "AU",
    "CN",
    "IN",
    "ID",
    "JP",
    "KR",
    "MY",
    "NZ",
    "PH",
    "SG",
    "TH",
    "VN",
    "EG",
    "IL",
  ] as const;

  // The payment methods accepted by the supplier.
  public readonly paymentMethods: PaymentMethod[] = [
    "mastercard",
    "visa",
    "ach",
    "moneyorder",
    "check",
  ] as const;

  // Override the type of queryResults to use our specific type
  protected queryResults: Array<AmbeedProductObject> = [];

  // Used to keep track of how many requests have been made to the supplier.
  protected httpRequstCount: number = 0;

  /** The sign secret for the Ambeed API. */
  protected signSecret: string = this.calculateSignSecret();

  /** The XSRF token for the Ambeed API. */
  protected xsrfToken: string = "";

  // HTTP headers used as a basis for all queries.
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
    "x-requested-with": "XMLHttpRequest",
  };

  /**
   * Derives the unique product key from an Ambeed product item: its `p_am`, the
   * per-listing article id (the `?am=` in the product URL and the `pr_am` on every
   * price row). NOT `p_id` — that identifies the *compound* (≈ CAS), which Ambeed
   * lists under multiple brands, each a distinct `p_am`/URL. Keying on `p_id`
   * collapses those separate listings onto one key, corrupting the per-product
   * detail cache and tripping the duplicate-results detector. Size variants remain
   * distinguished by their own `pr_id` (`variant.id`). Falls back to `p_id` only
   * when `p_am` is absent.
   * @param data - The raw Ambeed product list item
   * @returns The product's `p_am` (per-listing article id)
   * @example
   * ```typescript
   * this.getUniqueProductKey(product); // "A112492"
   * ```
   * @source
   */
  protected getUniqueProductKey(data: AmbeedProductListResponseResultItem): string {
    return String(data.p_am || data.p_id);
  }

  // /**
  //  * Map of encoded price characters to their corresponding decoded characters.
  //  */
  // protected encodedPriceChars: Map<string, string> = new Map([
  //   ["\u00b6", "."],
  //   ["\u0142", "$"],
  //   ["\u00ca", "0"],
  //   ["\u00c7", "1"],
  //   ["\u00cb", "2"],
  //   ["\u00a7", "3"],
  //   ["\u00cd", "4"],
  //   ["\u00ff", "5"],
  //   ["\u00f2", "6"],
  //   ["\u010f", "7"],
  //   ["\u00f3", "8"],
  //   ["\u00ee", "9"],
  // ]);

  /**
   * Calculates the sign secret for the Ambeed API.
   * @returns The sign secret
   * @example
   * ```js
   * console.log(this.calculateSignSecret());
   * // "6587ab544f254fe4a5f64a41531b95b2"
   * ```
   * @source
   */
  protected calculateSignSecret(): string {
    /** Obfuscation alphabet constants from Ambeed's `f1()` signer. */
    const forwardAlphabet = "abcdefghijklmnopqrstuvwxyz";
    const reversedAlphabet = "zyxwvutsrqponmlkjihgfedcba";
    const embeddedFragmentA = "7ab544f2"; // RC4 0x6a, key "&$SR"
    const embeddedFragmentB = "fe4a5f64a41531b"; // RC4 0x80, key "W61u"
    return (
      String(forwardAlphabet.indexOf("g")) + // "6"
      String(forwardAlphabet.indexOf("f")) + // "5"
      String(reversedAlphabet.indexOf("y") * 8) + // "8"
      embeddedFragmentA +
      String(Math.pow(reversedAlphabet.indexOf("t"), 2) + 18) + // "54"
      embeddedFragmentB +
      String(Math.pow(forwardAlphabet.indexOf("k"), 2) - 5) + // "95"
      "b2"
    );
  }

  /**
   * Sets the XSRF token if it's not already set. Checks the browser cookies
   * first, and if the token isn't there, makes a request to the base URL to
   * have the backend plant it, then reads it back from the cookies.
   * @example
   * ```js
   * await this.setXsrfToken();
   * console.log(this.xsrfToken);
   * // "2|d4c7158a|d58bc32de23d069be88c542ddebdacb5|1782230077"
   * ```
   * @source
   */
  protected async setXsrfToken(): Promise<void> {
    if (this.xsrfToken) {
      return;
    }

    let cookie = await getCookie(this.baseURL, "_xsrf");
    if (cookie) {
      this.xsrfToken = cookie.value;
      return;
    }

    await this.httpGetHtml({
      path: "/",
    });

    cookie = await getCookie(this.baseURL, "_xsrf");
    if (cookie) {
      this.xsrfToken = cookie.value;
      return;
    }

    this.xsrfToken = "";
    return;
  }

  /**
   * Makes the query params for the Ambeed API.
   * @param query - The query to make the query params for
   * @returns The query params
   * @todo Add
   * @example
   * ```js
   * console.log(this.makeQueryParams("sodium chloride"));
   * // "btoa(JSON.stringify({ keyword: "sodium chloride" }))"
   * ```
   * @source
   */
  protected makeQueryParams(query: string): Base64String {
    // btoa returns a plain string; cast brands it as Base64String (a nominal Brand type).
    return btoa(JSON.stringify({ keyword: query })) as Base64String;
  }

  /**
   * Resolves the SDS document "type" to prefer for the current user, based on
   * their saved `location` (country) and `language` settings. European users
   * get a `sdsJsonEurope` (amgm-*) type matched to their language; everyone
   * else gets the country-specific `sdsJson` type. Falls back to English
   * (`am`) when there's no match.
   *
   * @returns The Ambeed SDS type string (e.g. `"amgm-de-de"`, `"am-cn"`, `"am"`)
   * @example
   * ```typescript
   * await this.getSdsType(); // user in Germany, language "de" -> "amgm-de-de"
   * ```
   * @source
   */
  private async getSdsType(): Promise<string> {
    const stored = await cstorage.local.get([CACHE.USER_SETTINGS]);
    const settings = (stored[CACHE.USER_SETTINGS] ?? {}) as Partial<UserSettings>;

    const country = (settings.location ?? "").toUpperCase();
    const language = (settings.language ?? getUserLanguage()).split("-")[0].toLowerCase();

    if (EUROPEAN_COUNTRY_CODES.has(country)) {
      if (country === "GB") {
        return sdsJsonEurope["SDS-UK-EN"].type;
      }
      const suffix = LANGUAGE_TO_EU_SDS_SUFFIX[language] ?? "EN";
      const key = `SDS-EU-${suffix}` as keyof typeof sdsJsonEurope;
      return (sdsJsonEurope[key] ?? sdsJsonEurope["SDS-EU-EN"]).type;
    }

    const key = `SDS-${country}` as keyof typeof sdsJson;
    return (sdsJson[key] ?? sdsJson["SDS-US"]).type;
  }

  /**
   * Fetches SDS documents for many products in a single batch request and
   * returns a map of AM id (`p_am`) → SDS PDF URL. Requests the user's
   * preferred SDS type plus English (`am`) as a fallback; for each product the
   * preferred type's URL wins, falling back to `am`.
   *
   * @param amNos - The product AM ids (`p_am`) to fetch SDS documents for
   * @returns A map of `p_am` → SDS URL (only products with an available SDS)
   * @example
   * ```typescript
   * await this.getSdsUrls(["A491321", "A1159477"]);
   * // { A491321: "https://.../SDS-A491321.pdf", A1159477: "https://.../SDS-A1159477.pdf" }
   * ```
   * @source
   */
  private async getSdsUrls(amNos: string[]): Promise<Record<string, string>> {
    if (amNos.length === 0) {
      return {};
    }

    const sdsType = await this.getSdsType();
    const reqBody = {
      am_nos: amNos,
      request_type: Array.from(new Set([sdsType, SDS_TYPE_FALLBACK])),
    };

    // SDS URLs are enrichment, not core data — a failed/blocked request must not take down the
    // whole supplier. Degrade to "no SDS links" instead of throwing.
    let response: unknown;
    try {
      response = await this.httpPostJson({
        path: "webapi/v1/getPmsSdsByAms",
        params: {
          params: btoa(JSON.stringify(reqBody)),
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
      });
    } catch (error) {
      this.logger.warn("Ambeed SDS request failed; continuing without SDS URLs", { error, amNos });
      return {};
    }

    if (!isAmbeedGetPmsSdsByAmsResponse(response)) {
      this.logger.warn("Invalid Ambeed SDS response", { amNos, response });
      return {};
    }

    const urls: Record<string, string> = {};
    for (const [am, byType] of Object.entries(response.value.sds_list)) {
      const preferred = byType[sdsType];
      const fallback = byType[SDS_TYPE_FALLBACK];
      const url =
        preferred?.status && preferred.url
          ? preferred.url
          : fallback?.status && fallback.url
            ? fallback.url
            : undefined;
      if (url) {
        urls[am] = url;
      }
    }
    return urls;
  }

  /**
   * Construct spec sheet URL from product id
   *
   * @param proid - The product ID
   * @returns The spec sheet URL
   * @example
   * ```js
   * console.log(this.getSpecSheetUrl("A806610"));
   * // "/product-details/specification/A806610"
   * ```
   * @source
   */
  private getSpecSheetUrl(proid: string): string {
    return this.href(`/product-details/specification/${proid}`);
  }

  /**
   * Builds a base64-encoded, signed Ambeed API `params` payload. The `timestamp`
   * is injected and signed alongside `signedFields`; the signed keys are listed
   * in `__`. Any `extraFields` ride along unsigned (e.g. `proid` on the stock
   * request). Used by both `product_price` and `product_stock`.
   * @param signedFields - Fields to sign (besides the injected `timestamp`)
   * @param extraFields - Additional fields included unsigned in the payload
   * @param timestamp - Cache-busting timestamp (defaults to now)
   * @returns The base64-encoded `params` string
   * @example
   * ```js
   * // product_price
   * this.makeSignedParams({ proid: "P000640099" });
   * // btoa(JSON.stringify({ timestamp, proid, _: "<sign>", __: ["timestamp", "proid"] }))
   * // product_stock
   * this.makeSignedParams({ bd: "BD21445" }, { proid: "P000325570" });
   * // btoa(JSON.stringify({ timestamp, bd, _: "<sign>", __: ["timestamp", "bd"], proid }))
   * ```
   * @source
   */
  protected makeSignedParams(
    signedFields: Record<string, JsonValue>,
    extraFields: Record<string, JsonValue> = {},
    timestamp: number = Date.now(),
  ): Base64String {
    const signed = { timestamp, ...signedFields };
    return btoa(
      JSON.stringify({
        ...signed,
        _: this.getSign(signed, 1),
        __: Object.keys(signed),
        ...extraFields,
      }),
    ) as Base64String;
  }

  /**
   * Ambeed cache-busting timestamp used in signed API payloads.
   * @returns Base-36 timestamp string
   * @source
   */
  protected getEncodedDate(timestamp: number = Date.now()): string {
    return base36Timestamp(timestamp);
  }

  /**
   * Ambeed request signature (deobfuscated from `getSign` in dev/ambeed3.js).
   *
   * @param data - Mode `1`: plain object signed as a query string. Other modes: string input.
   * @param mode - `1` → Base64(MD5_hex(query + sign=secret)); else → MD5_hex(string + secret)
   * @returns Signature string
   * @source
   */
  protected getSign(data: Record<string, unknown> | string, mode: 0 | 1): string {
    if (mode === 1) {
      if (typeof data === "string") {
        throw new Error("getSign mode 1 requires a plain object");
      }

      let query = objectToQueryString(data);
      query += (query ? "&sign=" : "sign=") + this.signSecret;
      return base64EncodeUtf8(md5sum(query));
    }

    return md5sum(String(data) + this.signSecret);
  }

  /**
   *
   * Ambeed encodes all the prices in a different font (newwebfont/am-new.woff) than the rest
   * of the page which is stored as unicode characters in the API and their weird font
   * characters in the source, but displays just fine in the UI. For example, the API response
   * will have the price as `\u0142\u00c7\u00cd\u00a7\u00b6\u00ca\u00ca`, which in the source
   * is `łÇÍ§¶ÊÊ`, but in the UI is displayed as `$143.00`.
   *
   * This conversion is just a simple character map lookup, which is stored at this.encodedPriceChars.
   *
   * @param str - The encoded price string
   * @returns The decoded price string
   * @example
   * ```js
   * console.log(
   *    this.decodePrice("\u0142\u00c7\u00cd\u00a7\u00b6\u00ca\u00ca"),
   *    this.decodePrice("\u0142\u00a7\u00f2\u00b6\u00ca\u00ca"),
   *    this.decodePrice("\u0142\u00c7\u00ff\u00b6\u00ca\u00ca"),
   *    this.decodePrice("\u0142\u00a7\u00cd\u010f\u00b6\u00ca\u00ca"),
   *    this.decodePrice("\u0142\u00c7\u00ca\u00b6\u00ca\u00ca")
   * )
   * // $143.00 $36.00 $15.00 $347.00 $10.00
   * ```
   * @source
   */
  // protected decodePrice(encoded: string): string {
  //   return encoded
  //     .split("")
  //     .map((char) => this.encodedPriceChars.get(char) || "")
  //     .join("");
  // }

  protected decodeAmbeedFont(str: string): string {
    if (!str || typeof str !== "string") {
      return str;
    }

    let out = "";
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      out += cp !== undefined ? (AMBEED_FONT_MAP[cp] ?? ch) : ch;
    }
    return out;
  }

  /**
   * Decodes the price object values, which are encoded in the same font as the prices in the UI.
   * @param priceData - The price object to decode
   * @returns The decoded price object
   * @example
   * ```js
   * console.log(this.decodePriceObjectValues({
   *    pr_usd: "\u0142\u00c7\u00cd\u00a7\u00b6\u00ca\u00ca",
   *    pr_am: "A1144350",
   *    vip_usd: "\u0142\u00a7\u00f2\u00b6\u00ca\u00ca",
   *    discount_usd: "\u0142\u00c7\u00ff\u00b6\u00ca\u00ca",
   *    pr_size: "1mg",
   *    pr_id: 3255116
   * }))
   * // {
   * //   pr_usd: "$143.00",
   * //   pr_am: "A1144350",
   * //   vip_usd: "$36.00",
   * //   discount_usd: "$15.00",
   * //   pr_size: "1mg",
   * //   pr_id: 3255116
   * // }
   * ```
   * @source
   */
  protected decodePriceObjectValues(
    priceData: AmbeedProductListResponsePriceList,
  ): AmbeedProductListResponsePriceList {
    return {
      ...priceData,
      pr_usd: this.decodeAmbeedFont(priceData.pr_usd),
      vip_usd: this.decodeAmbeedFont(priceData.vip_usd),
      discount_usd: this.decodeAmbeedFont(priceData.discount_usd),
    };
  }

  /**
   * Sanitizes the searchable fields of a product, removing the <em></em> tags and decoding the prices.
   * @param product - The product to sanitize
   * @returns The sanitized product
   * @example
   * ```js
   * console.log(this.sanitizeSearchableFields({
   *    p_name_en: "2-Ethoxyacetic <em>acid</em>",
   *    p_proper_name3: "2-Ethoxyacetic <em>acid</em>",
   *    p_cas: "108-24-7",
   *    priceList: [
   *      {
   *        pr_usd: "\u0142\u00c7\u00cd\u00a7\u00b6\u00ca\u00ca",
   *        pr_am: "A1144350",
   *        vip_usd: "\u0142\u00a7\u00f2\u00b6\u00ca\u00ca",
   *        discount_usd: "\u0142\u00c7\u00ff\u00b6\u00ca\u00ca",
   *        pr_size: "1mg",
   *        pr_id: 3255116
   *      }
   *    ]
   * }))
   * // {
   * //   p_name_en: "2-Ethoxyacetic acid",
   * //   p_proper_name3: "2-Ethoxyacetic acid",
   * //   p_cas: "108-24-7",
   * //   priceList: [
   * //     {
   * //       pr_usd: "$143.00",
   * //       pr_am: "A1144350",
   * //       vip_usd: "$36.00",
   * //       discount_usd: "$15.00",
   * //       pr_size: "1mg",
   * //       pr_id: 3255116
   * //     }
   * //   ]
   * // }
   * ```
   * @source
   */
  protected sanitizeSearchableFields(
    product: AmbeedProductListResponseResultItem,
  ): AmbeedProductListResponseResultItem {
    if (product.priceList) {
      product.priceList = product.priceList.map(this.decodePriceObjectValues.bind(this));
    }
    return {
      ...product,
      p_bd: product.p_bd ?? "",
      p_id: product.p_id ?? "",
      p_name_en: product.p_name_en?.replace(/<\/?em>/g, ""),
      p_proper_name3: product.p_proper_name3?.replace(/<\/?em>/g, ""),
      p_cas: product.p_cas?.replace(/<\/?em>/g, ""),
    };
  }

  /**
   * Initializes the Ambeed session: sets the XSRF token, then aligns the
   * country cookie with the user's selected country (defaulting to
   * "United States" when none is stored).
   * @returns Resolves once the session cookies are set
   * @source
   */
  setup(): Promise<void> {
    return (async () => {
      await this.setXsrfToken();
      await this.setCountryCookie(await getUserCountryName());
      await this.getCountryCookie();
    })();
  }

  /**
   * The query params are sent over in a base64 encoded JSON.stringify of
   * ```js
   * params=btoa(JSON.stringify({ keyword: "sodium chloride" }))
   * params=btoa(JSON.stringify({ keyword: "acid", page:3 }))
   * ```
   * @source
   */
  protected async queryProducts(
    query: string,
    limit: number = this.limit,
  ): Promise<ProductBuilder<Product>[] | void> {
    const searchRequest: unknown = await this.httpGetJson({
      path: "webapi/v1/productlistbykeyword",
      params: {
        params: this.makeQueryParams(query),
      },
    });

    assertIsAmbeedProductListResponse(searchRequest);

    // Sanitize the products, removing the <em></em> tags and decoding the prices.
    const products = searchRequest.value.result.map(this.sanitizeSearchableFields.bind(this));

    // Filter Ambeed's loose keyword results by the query type (CAS/formula/SMILES),
    // falling back to fuzzy name matching for plain-string queries.
    const fuzzedResults = this.filterByStructuredQuery(products);

    const slice = fuzzedResults.slice(0, limit);

    // Fetch every product's SDS document in a single batch request, then attach
    // each URL here (before queryProductsWithCache caches the builders) so the
    // SDS link is keyed/cached with the product. Products are keyed by `p_am`,
    // which initProductBuilders stores as the builder's UUID.
    const sdsByAm = await this.getSdsUrls(mapDefined(slice, (product) => product.p_am));
    const builders = this.initProductBuilders(slice);
    for (const builder of builders) {
      const pAm = builder.get("uuid");
      builder.setSDSUrl(typeof pAm === "string" ? sdsByAm[pAm] : undefined);
    }

    return builders;
  }

  /**
   * Filters Ambeed's loose keyword results down to genuine matches using the
   * *type* of the query. Ambeed's `productlistbykeyword` matches a term as both a
   * name substring and (for a valid SMILES) a structure fragment, so a query like
   * `CCO` returns unrelated compounds. This routes by query type:
   * - CAS terms match the product `p_cas`,
   * - formula terms match the (de-HTML'd) `p_moleform`,
   * - SMILES terms are matched via their resolved CAS/name (resolved once upstream
   *   by `SupplierFactory` and shared through `resolvedStructures`),
   * - plain-string queries fall back to the existing fuzzy name filter unchanged.
   *
   * Matching reuses the advanced-search AST evaluator, so boolean (AND/OR/NOT)
   * queries are honored: each item is scored against an augmented target built
   * from its name, CAS, and formula.
   *
   * @param items - The sanitized Ambeed product items to filter.
   * @returns The items whose identity matches the query, best score first.
   * @example
   * ```typescript
   * // query "1286754-10-6" -> only the item whose p_cas is 1286754-10-6
   * this.filterByStructuredQuery(items);
   * ```
   * @source
   */
  protected filterByStructuredQuery(
    items: AmbeedProductListResponseResultItem[],
  ): AmbeedProductListResponseResultItem[] {
    const parsed = this.getAst();
    const isStructured = extractAllPositiveTerms(parsed.ast).some(
      (term) => detectTermType(term) !== "string" || looksLikeSmiles(term),
    );

    // Plain name queries keep today's fuzzy behavior untouched.
    if (!isStructured) {
      return this.fuzzyFilterAst<AmbeedProductListResponseResultItem>(items);
    }

    const ast = this.rewriteStructureLeaves(parsed.ast);
    const scorer = this.fuzzScorerOverride ?? this.fuzzScorer;

    const scored = mapDefined(items, (item) => {
      const score = scoreAstMatch(this.buildMatchTarget(item), ast, {
        scorer,
        threshold: this.minMatchPercentage,
        fuzzyWords: false,
      });
      return score === null ? undefined : { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((entry) => entry.item);
  }

  /**
   * Builds the searchable text an Ambeed item is matched against: its display
   * name, English name, CAS, formula (`<sub>` markup stripped), and InChIKey.
   * Combining these lets CAS/formula/SMILES-resolved terms match the field that
   * actually identifies the compound rather than only the title.
   * @param item - The Ambeed product item.
   * @returns A single space-joined string of the item's identifying fields.
   * @example
   * ```typescript
   * this.buildMatchTarget(item); // "Mal-PEG4-AcCOOH 14-(...)acid 1286754-10-6 C14H21NO8 IBIJ..."
   * ```
   * @source
   */
  private buildMatchTarget(item: AmbeedProductListResponseResultItem): string {
    return [
      item.p_proper_name3,
      item.p_name_en,
      item.p_cas,
      item.p_moleform ? htmlToAscii(item.p_moleform) : "",
      item.p_inchikey,
    ]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" ");
  }

  /**
   * Returns a copy of the query AST with every SMILES leaf replaced by an OR of
   * its resolved identifiers (CAS numbers and name), looked up from
   * `resolvedStructures`. A SMILES leaf with no resolution is left unchanged and a
   * warning is logged, so matching degrades to the raw term. Non-SMILES leaves
   * (CAS, formula, plain strings) are returned as-is.
   * @param ast - The parsed query AST.
   * @returns A new AST with SMILES leaves rewritten to their resolved identifiers.
   * @source
   */
  private rewriteStructureLeaves(ast: SearchAst): SearchAst {
    switch (ast.type) {
      case "term": {
        if (ast.value === "" || !looksLikeSmiles(ast.value)) {
          return ast;
        }
        const resolved = this.resolvedStructures?.get(ast.value);
        const identifiers = [...(resolved?.cas ?? []), ...(resolved?.name ? [resolved.name] : [])];
        if (identifiers.length === 0) {
          this.logger.warn("No resolved structure for SMILES term; matching raw term", {
            term: ast.value,
          });
          return ast;
        }
        return this.orTerms(identifiers);
      }
      case "and":
        return {
          type: "and",
          left: this.rewriteStructureLeaves(ast.left),
          right: this.rewriteStructureLeaves(ast.right),
        };
      case "or":
        return {
          type: "or",
          left: this.rewriteStructureLeaves(ast.left),
          right: this.rewriteStructureLeaves(ast.right),
        };
      case "not":
        return { type: "not", operand: this.rewriteStructureLeaves(ast.operand) };
      default:
        return ast;
    }
  }

  /**
   * Combines a non-empty list of phrase strings into a right-leaning OR AST, so a
   * SMILES term that resolves to several identifiers matches any of them.
   * @param values - The identifier strings to OR together (must be non-empty).
   * @returns An OR-tree, or a single term node when only one value is given.
   * @example
   * ```typescript
   * this.orTerms(["64-17-5", "ethanol"]);
   * // { type: "or", left: {term 64-17-5}, right: {term ethanol} }
   * ```
   * @source
   */
  private orTerms(values: string[]): SearchAst {
    return values
      .map((value): SearchAst => ({ type: "term", value, phrase: false }))
      .reduce((left, right) => ({ type: "or", left, right }));
  }

  /**
   * Selects the title of a product from the search response
   * @param data - Product object from search response
   * @returns Title of the product
   * @source
   */
  protected titleSelector(data: AmbeedProductListResponseResultItem): string {
    return (data.p_name_en?.trim() || data.p_proper_name3?.trim()) ?? "";
  }

  /**
   * Initialize product builders from Ambeed search response data.
   * Transforms product listings into ProductBuilder instances, handling:
   * - Basic product information (title, URL, supplier)
   * - Product descriptions and content
   * - Product IDs and SKUs
   * - Availability status
   * - CAS number extraction from product content
   * - Quantity parsing from variant information
   * - Product codes and EANs
   *
   * @param data - Array of product listings from search results
   * @returns Array of ProductBuilder instances initialized with product data
   * @example
   * ```typescript
   * const results = await this.queryProducts("sodium chloride");
   * if (results) {
   *   const builders = this.initProductBuilders(results);
   *   // Each builder contains parsed product data
   *   for (const builder of builders) {
   *     const product = await builder.build();
   *     console.log({
   *       title: product.title,
   *       price: product.price,
   *       quantity: product.quantity,
   *       uom: product.uom,
   *       cas: product.cas
   *     });
   *   }
   * }
   * ```
   * @source
   */
  protected initProductBuilders(
    data: AmbeedProductListResponseResultItem[],
  ): ProductBuilder<Product>[] {
    return mapDefined(data, (product) => {
      const productBuilder = new ProductBuilder(this.baseURL);

      const productTitle = this.titleSelector(product);
      if (typeof product.priceList?.[0]?.pr_usd !== "string") {
        this.logger.warn(`Ambeed product ${productTitle} has no price`, product);
        return;
      }

      if (typeof product.priceList?.[0]?.pr_size !== "string") {
        this.logger.warn(`Ambeed product ${productTitle} has no size`, product);
        return;
      }

      productBuilder.setCAS(product.p_cas);
      productBuilder.setSpecSheetUrl(this.getSpecSheetUrl(product.p_am));

      for (const variant of product.priceList) {
        const parsedPrice = parsePrice(variant.pr_usd);
        const quantity = parseQuantity(variant.pr_size);

        if (!parsedPrice || !quantity) {
          this.logger.warn(
            `Failed to parse Ambeed product price for ${productTitle}`,
            product,
            variant,
          );
          continue;
        }

        productBuilder.addVariant({
          title: variant.pr_size,
          price: parsedPrice.price,
          currencyCode: parsedPrice.currencyCode,
          currencySymbol: parsedPrice.currencySymbol,
          quantity: quantity.quantity,
          uom: quantity.uom,
          sku: variant.pr_am,
          id: String(variant.pr_id),
        });
      }

      // Use the first variant as the main product. The ID will be wrong, but well overwrite it later.
      const mainVariant = productBuilder.getVariant(0);

      if (!mainVariant) {
        this.logger.warn(`Ambeed product ${productTitle} has no main variant`, product);
        return;
      }

      return productBuilder
        .setData(mainVariant as Partial<Product>)
        .setBasicInfo(productTitle, `/products/${product.s_url}`, this.supplierName)
        .setID(product.p_id)
        .setCacheKey(this.getUniqueProductKey(product))
        .setSku(product.p_bd)
        .setUUID(product.p_am)
        .setImage(product.p_proimg)
        .setPurity(product.p_purity)
        .setMoleweight(product.p_moleweight)
        .setFormula(product.p_moleform)
        .setDescription(product.p_name_en)
        .setSupplierCountry(this.country)
        .setSupplierShipping(this.shipping)
        .setCAS(product.p_cas);
    });
  }

  /**
   * Sets the country cookie for the Ambeed API.
   * @param country - The country to set the cookie for
   * @returns The country cookie
   * @source
   */
  protected async setCountryCookie(country: string = "United States"): Promise<void> {
    await this.httpPostJson({
      path: "/webapi/v1/countrycookie",
      params: {
        params: btoa(JSON.stringify({ country })),
      },
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
    });
  }

  /**
   * Gets the country cookie currently set for the Ambeed API.
   * @returns The country cookie response, or void if the request fails
   * @example
   * ```js
   * const countryCookie = await this.getCountryCookie();
   * console.log(countryCookie);
   * // { time: "...", lang: "en", source: 1, code: 200, value: { country: "United States" } }
   * ```
   * @source
   */
  protected async getCountryCookie(): Promise<Maybe<JsonValue>> {
    const countryCookie = await this.httpGetJson({
      path: "/webapi/v1/countrycookie",
    });

    return countryCookie;
  }

  /**
   * Extracts the priced variants from an Ambeed `product_price` response value.
   *
   * The variants live under a dynamic `${pr_bd}_${p_purity}` key (e.g.
   * `"BD41982_95%"`) that varies per product and can't be indexed by a plain
   * string, so this walks the entries and returns the first array-valued one,
   * skipping the `proInfo` block.
   *
   * @param value - The `value` object from an AmbeedProductPriceResponse
   * @returns The list of priced variants, or an empty array when none is present
   * @example
   * ```js
   * this.getPriceVariants(response.value);
   * // [{ pr_id: 3805067, pr_size: "1mg", pr_usd: "$10.00", ... }]
   * ```
   * @source
   */
  protected getPriceVariants(
    value: AmbeedProductPriceResponseValue,
  ): AmbeedProductPriceResponseVariantItem[] {
    for (const [key, entry] of Object.entries(value)) {
      if (key === "proInfo" || !Array.isArray(entry)) {
        continue;
      }
      return entry;
    }
    return [];
  }

  /**
   * No real need to get the product data on a second page, the initial product listing
   * page has enough data.
   * @param product - The product builder to get data for
   * @returns The product builder
   * @source
   */
  protected async getProductData(
    product: ProductBuilder<Product>,
  ): Promise<ProductBuilder<Product> | void> {
    // /webapi/v1/product_price?params=btoa(JSON.stringify({ proid: "P000640099" }))
    const proid = String(product.get("id"));
    const productPriceParams = this.makeSignedParams({ proid });

    const productPriceResponse = await this.httpPostJson({
      path: `/webapi/v1/product_price`,
      params: {
        num: this.getEncodedDate(),
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: new URLSearchParams({
        params: productPriceParams,
        _xsrf: this.xsrfToken,
      }).toString(),
    });

    if (!isAmbeedProductPriceResponse(productPriceResponse)) {
      this.logger.warn("Invalid Ambeed product price response", {
        productPriceParams,
        productPriceResponse,
      });
      return product;
    }

    const variants = this.getPriceVariants(productPriceResponse.value);
    this.logger.log("Ambeed product price variants", variants);

    const stock = await this.getProductStock(proid, String(product.get("sku")));
    if (stock) {
      this.applyStockAvailability(product, stock);
    }

    return product;
  }

  /**
   * Fetches per-size stock for a product from `webapi/product_stock` (note: this
   * endpoint is unversioned, unlike `product_price`). Signs the batch id (`bd`)
   * and carries the product id (`proid`) unsigned. Stock is enrichment, not core
   * data, so a failed/blocked request degrades to "no stock info" rather than
   * throwing and taking down the whole product.
   * @param proid - The product ID (`p_id`)
   * @param bd - The batch ID (`p_bd`)
   * @returns The array of per-size stock rows, or undefined if the request fails or is invalid
   * @example
   * ```js
   * const stock = await this.getProductStock("P000325570", "BD21445");
   * console.log(stock?.[0]); // { size: "25g", has_stock: 2, ... }
   * ```
   * @source
   */
  private async getProductStock(
    proid: string,
    bd: string,
  ): Promise<AmbeedProductStockResponse["value"] | undefined> {
    const productStockParams = this.makeSignedParams({ bd }, { proid });

    let response: unknown;
    try {
      response = await this.httpPostJson({
        path: "/webapi/product_stock",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: new URLSearchParams({
          params: productStockParams,
          _xsrf: this.xsrfToken,
        }).toString(),
      });
    } catch (error) {
      this.logger.warn("Ambeed stock request failed; continuing without stock", {
        error,
        proid,
        bd,
      });
      return;
    }

    if (!isAmbeedProductStockResponse(response)) {
      this.logger.warn("Invalid Ambeed product stock response", {
        productStockParams,
        response,
      });
      return;
    }

    return response.value;
  }

  /**
   * Applies stock availability to a product's variants and to the product
   * itself. Builds a set of in-stock size keys (`${quantity}${uom}`) from rows
   * with `has_stock > 0`, then marks each variant IN_STOCK/OUT_OF_STOCK by
   * matching its quantity+uom. The product is IN_STOCK if any variant is.
   * @param product - The product builder to update
   * @param stock - The per-size stock rows from `getProductStock`
   * @returns The same product builder, for chaining
   * @example
   * ```js
   * this.applyStockAvailability(builder, [{ size: "25g", has_stock: 2, ... }]);
   * // builder's "25g" variant -> AVAILABILITY.IN_STOCK
   * ```
   * @source
   */
  private applyStockAvailability(
    product: ProductBuilder<Product>,
    stock: AmbeedProductStockResponse["value"],
  ): ProductBuilder<Product> {
    const inStockSizes = new Set<string>();
    for (const row of stock) {
      if (typeof row.has_stock === "number" && row.has_stock > 0) {
        const parsed = parseQuantity(row.size);
        if (parsed) {
          inStockSizes.add(`${parsed.quantity}${parsed.uom}`);
        }
      }
    }

    const variants = product.get("variants");
    if (!Array.isArray(variants)) {
      return product;
    }

    let anyInStock = false;
    const updated = variants.map((variant) => {
      const inStock = inStockSizes.has(`${variant.quantity}${variant.uom}`);
      anyInStock ||= inStock;
      return {
        ...variant,
        availability: inStock ? AVAILABILITY.IN_STOCK : AVAILABILITY.OUT_OF_STOCK,
      };
    });

    return product.setVariants(updated).setAvailability(anyInStock);
  }
  /**
   * Fetches the product matched by a CAS number along with Ambeed's recommended
   * products for that CAS.
   * @param cas - The CAS number to look up
   * @returns The validated CAS search response
   * @throws Error if the response does not match the expected structure
   * @example
   * ```js
   * const response = await this.getSearchProductAndRecommendedProductsByCAS("108-24-7");
   * console.log(response.value.search_pro_dict.p_name_en);
   * // "Acetic anhydride"
   * console.log(response.value.r_pro_list.length);
   * // 12
   * ```
   * @source
   */
  protected async getSearchProductAndRecommendedProductsByCAS(
    cas: string,
  ): Promise<AmbeedGetSearchProductAndRecommendedProductsByCASResponse> {
    const response = await this.httpPostJson({
      path: "/webapi/v1/get_search_product_and_recommended_products_by_cas",
      params: {
        params: btoa(JSON.stringify({ cas })),
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
    });

    assertIsAmbeedGetSearchProductAndRecommendedProductsByCASResponse(response);
    return response;
  }
}
