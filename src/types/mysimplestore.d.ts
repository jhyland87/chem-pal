declare global {
  /**
   * A single product image as returned in a MySimpleStore search-list item's
   * `image_list`. Only the URL is read while building products.
   */
  interface MySimpleStoreImage {
    /** Absolute image URL */
    url: string;
  }

  /**
   * The pre-formatted price object attached to each MySimpleStore search-list
   * item. `numeric` is the machine-readable value; `display` is the localized
   * string ("$40.00").
   */
  interface MySimpleStorePrice {
    /** Localized, symbol-prefixed price string (e.g. "$40.00") */
    display: string;
    /** Numeric price value (e.g. 40) */
    numeric: number;
    /** ISO 4217 currency code (e.g. "USD") */
    currency: string;
  }

  /**
   * One selected option value on a variant (e.g. the "Size" option set to
   * "1 LITER"). MySimpleStore/Spree exposes these both as `options_text` and as
   * this structured list.
   */
  interface MySimpleStoreOptionValue {
    /** Option value id */
    id: string;
    /** Raw value (e.g. "1 LITER") */
    name: string;
    /** Display value (e.g. "1 LITER") */
    presentation: string;
    /** Option group name (e.g. "Size") */
    option_type_name: string;
  }

  /**
   * A purchasable variant of a MySimpleStore product, present only on the
   * product-detail response (the search list omits it). Prices arrive as
   * strings; `options_text` carries the human size label (e.g. "Size: 1 LITER").
   */
  interface MySimpleStoreVariant {
    /** Variant id (uuid) */
    id: string;
    /** Stock keeping unit (e.g. "GRN-60-1-LTR") */
    sku?: string;
    /** Combined option label (e.g. "Size: 1 LITER") */
    options_text?: string;
    /** Structured option values for this variant */
    option_values?: MySimpleStoreOptionValue[];
    /** Numeric price as a string (e.g. "60.00") */
    price?: string;
    /** Localized price string (e.g. "$60.00") */
    display_price?: string;
    /** Units on hand */
    total_on_hand?: number;
    /** Whether the variant is purchasable */
    in_stock?: boolean;
    /** Ids of assets associated with this variant */
    asset_ids?: string[];
  }

  /**
   * A media asset on the product-detail response. The resized URLs are used for
   * the product image.
   */
  interface MySimpleStoreAsset {
    /** Asset id */
    id: string;
    /** Large (zoom) image URL */
    large_url?: string;
    /** Small (thumbnail) image URL */
    small_url?: string;
  }

  /**
   * A product as returned in a MySimpleStore search/list response
   * (`GET /api/v2/products`). Variants are NOT included here — only
   * `variant_count` — so the size/price breakdown requires the detail fetch.
   */
  interface MySimpleStoreListProduct {
    /** Product id (uuid) — stable across the list→detail transition */
    id: string;
    /** URL slug (e.g. "geraniol-60") used to fetch the detail endpoint */
    slug: string;
    /** Product display name */
    name: string;
    /** Plain-text (or lightly formatted) description */
    description_raw?: string;
    /** Pre-formatted price object */
    price?: MySimpleStorePrice;
    /** Storefront-relative product path (e.g. "/ols/products/geraniol-60") */
    relative_url: string;
    /** List of product images */
    image_list?: MySimpleStoreImage[];
    /** Fallback single image URL */
    default_asset_url?: string;
    /** Number of variants the product has */
    variant_count?: number;
    /** Whether the product is available */
    available?: boolean;
    /** Whether the product is in stock */
    in_stock?: boolean;
  }

  /**
   * A product as returned by the MySimpleStore detail endpoint
   * (`GET /api/v2/products/{slug}`). Adds the full `variants`, `assets`, and
   * richer description fields not present in the list response.
   */
  interface MySimpleStoreProductDetail {
    /** Product id (uuid) */
    id: string;
    /** URL slug */
    slug: string;
    /** Product display name */
    name: string;
    /** HTML description */
    description?: string;
    /** Plain-text description */
    description_text?: string;
    /** Numeric price as a string (e.g. "60.00") */
    price?: string;
    /** ISO 4217 currency code */
    currency?: string;
    /** Whether the product is available */
    available?: boolean;
    /** Whether the product is in stock */
    in_stock?: boolean;
    /** Purchasable variants */
    variants?: MySimpleStoreVariant[];
    /** Media assets */
    assets?: MySimpleStoreAsset[];
  }

  /**
   * The envelope returned by the MySimpleStore search/list endpoint.
   */
  interface MySimpleStoreSearchResponse {
    /** Products on the current page */
    products: MySimpleStoreListProduct[];
    /** Total number of matching products */
    total_count?: number;
    /** Total number of pages */
    pages?: number;
    /** Current page number */
    current_page?: number;
  }
}

export {};
