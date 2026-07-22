declare global {
  /**
   * OAuth token response from the VWR (Avantor) authorization server.
   * Returned by `POST /authorizationserver/oauth/token`.
   *
   * @example
   * ```typescript
   * const token: VWRTokenResponse = {
   *   access_token: "PBPYm7hlpLqjKwN4s9H3HRLBNNU",
   *   token_type: "bearer",
   *   expires_in: 39047,
   *   scope: "openid",
   * };
   * ```
   */
  interface VWRTokenResponse {
    /** Bearer access token used in the `Authorization` header of subsequent calls. */
    access_token: string;
    /** Token type, always `"bearer"` for this API. */
    token_type: string;
    /** Lifetime of the token in seconds. */
    expires_in: number;
    /** OAuth scope granted to the token. */
    scope?: string;
  }

  /** A product image reference returned inline on a VWR search product. */
  interface VWRImage {
    /** Absolute URL to the rendered image asset. */
    url: string;
    /** Image role, e.g. `"PRIMARY"`. */
    imageType?: string;
    /** Image format, e.g. `"original"`. */
    format?: string;
    /** Alt text for the image. */
    altText?: string;
  }

  /** A per-unit-of-measure price entry on a VWR search product. */
  interface VWRUomSpecificPrice {
    /** Numeric price value. */
    value: number;
    /** ISO currency code, e.g. `"USD"`. */
    currencyIso?: string;
    /** Pre-formatted display price, e.g. `"$335.55"`. */
    formattedValue?: string;
    /** Human-readable unit description, e.g. `"Each (2,500ml)"`. */
    uomDescription?: string;
  }

  /** Base-product stock summary embedded in a VWR search product. */
  interface VWRSearchStock {
    /** Stock status, e.g. `"inStock"`. */
    stockLevelStatus?: string;
  }

  /**
   * A single product entry in a VWR search response (`products[]`).
   * The `baseProduct` id is used to fetch detail, asset, and substance data.
   */
  interface VWRSearchProduct {
    /** Product/variant code, e.g. `"NA3626344"`. Matches an ordertable `productRows[].code`. */
    code: string;
    /** Base product id used for detail/asset/substance lookups, e.g. `"11805968"`. */
    baseProduct: string;
    /** Preferred display title. */
    displayName?: string;
    /** Fallback name when `displayName` is absent. */
    name?: string;
    /** Long description. */
    description?: string;
    /** Per-UOM price entries; the first is used as the representative price. */
    uomSpecificPrices?: VWRUomSpecificPrice[];
    /** Inline image references. */
    images?: VWRImage[];
    /** Base-product stock summary. */
    stock?: VWRSearchStock;
    /** VWR catalog number, e.g. `"80722-392"`. */
    vwrCatalogNumber?: string;
    /** Whether certificates (COA) are available. */
    certificatesAvailable?: boolean;
    /** Whether an SDS/MSDS is available. */
    msdsAvailable?: boolean;
    /** Whether the product is discontinued. */
    discontinued?: boolean;
    /** Whether the product is restricted (e.g. requires a license); excluded from results. */
    restricted?: boolean;
  }

  /** Pagination metadata on a VWR search response. */
  interface VWRSearchPagination {
    /** Zero-based index of the current page. */
    currentPage?: number;
    /** Page size (the API caps this at 10 regardless of the requested value). */
    pageSize?: number;
    /** Total number of pages available for the query. */
    totalPages?: number;
    /** Total number of matching results across all pages. */
    totalResults?: number;
  }

  /** Response envelope for `POST /products/search`. */
  interface VWRSearchResponse {
    /** Matching products for the current page. */
    products: VWRSearchProduct[];
    /** Pagination metadata used to walk subsequent pages. */
    pagination?: VWRSearchPagination;
  }

  /** A price entry on a VWR ordertable product row. */
  interface VWROrdertablePrice {
    /** Numeric list price. */
    listPrice: number;
    /** Pre-formatted display price. */
    formattedValue?: string;
    /** ISO currency code, e.g. `"USD"`. */
    currencyCode?: string;
    /** Unit of measure code, e.g. `"EA"`. */
    skuUOM?: string;
    /** Human-readable unit description. */
    uomDescription?: string;
  }

  /** A key/value cell in an ordertable row's `colCellMap.entry`. */
  interface VWRColCellEntry {
    /** Column key, e.g. `"o_size"` or `"o_pack_type"`. */
    key: string;
    /** Column value, e.g. `"2.5 L"`. */
    value: string;
  }

  /** A purchasable variant row in a VWR ordertable response. */
  interface VWRProductRow {
    /** Variant code, e.g. `"NA2226459"`. */
    code: string;
    /** Catalog number used for stock-availability lookups, e.g. `"CA71008-946"`. */
    catalogNumber: string;
    /** Variant name. */
    name?: string;
    /** Column cells carrying pack type and size. */
    colCellMap?: { entry: VWRColCellEntry[] };
    /** Price entries for the variant. */
    prices?: VWROrdertablePrice[];
    /** Direct SDS download link for the variant. */
    downloadSDSLink?: string;
    /** Whether an SDS/MSDS is available for the variant. */
    msdsAvailable?: boolean;
    /** Whether the variant is discontinued. */
    discontinued?: boolean;
  }

  /** Response envelope for `GET /api/product/ordertable`. */
  interface VWROrdertableResponse {
    /** Variant rows for the base product. */
    productRows: VWRProductRow[];
    /** Base-product SDS download link. */
    downloadSDSLink?: string;
  }

  /** A document/certificate asset reference for a VWR base product. */
  interface VWRAssetReference {
    /** Asset category. */
    assetType?: 'MSDS' | 'CERTIFICATE_OF_ANALYSIS' | 'CERTIFICATE_OF_QUALITY';
    /** Absolute URL to the downloadable asset. */
    url: string;
    /** Languages the asset is available in, e.g. `["en_US", "en_CA"]`. */
    languageLists?: string[];
    /** Batch number for certificate-of-analysis assets. */
    batchNumber?: string;
    /** Product display name. */
    productName?: string;
    /** Base product number. */
    productNumber?: string;
  }

  /** Response envelope for `GET /products/{baseProduct}/assetreferences`. */
  interface VWRAssetReferencesResponse {
    /** Document/certificate asset references. */
    assetReferences: VWRAssetReference[];
  }

  /** A chemical/technical attribute for a VWR substance. */
  interface VWRSubstanceAttribute {
    /** Attribute code, e.g. `"c_cas"`, `"c_formula"`. */
    code: string;
    /** Human-readable attribute name, e.g. `"CAS"`, `"Formula"`, `"MW_value"`. */
    name: string;
    /** Attribute value, e.g. `"7664-93-9"`. */
    value: string;
  }

  /** Response envelope for `GET /api/product/chemical/substance`. */
  interface VWRSubstanceResponse {
    /** Chemical/technical attributes (CAS, formula, molecular weight, etc.). */
    substanceAttributes: VWRSubstanceAttribute[];
  }

  /** A single specification row (e.g. `{ name: "Purity", result: "> 98 %" }`). */
  interface VWRSpecificationEntry {
    /** Specification name, e.g. `"Purity"`, `"Heavy Metals"`. */
    name: string;
    /** Specification result/value, e.g. `"> 98 %"`. */
    result: string;
  }

  /** Response body for `GET /api/product/chemical/specification` (a flat array of rows). */
  type VWRSpecificationResponse = VWRSpecificationEntry[];

  /** Availability detail for a single catalog number in a stock response. */
  interface VWRStockDetail {
    /** Catalog number the availability applies to. */
    catalogNumber: string;
    /** Availability status and message. */
    availability: {
      /** Stock status, e.g. `"inStock"` or `"ON_ORDER"`. */
      stockStatus?: string;
      /** Human-readable availability message, e.g. `"Usually ships next day"`. */
      availabilityMessage?: string;
    };
  }

  /** Response envelope for `POST /api/product/getAnonymousStockAvailability`. */
  interface VWRStockResponse {
    /** Wrapper carrying the per-article availability details. */
    articleAvailabilityDetails: {
      /** One entry per requested catalog number. */
      articleAvailabilityDetail: VWRStockDetail[];
    };
  }
}

// This export is needed to make the file a module
export {};
