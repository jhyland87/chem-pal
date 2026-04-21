/* eslint-disable @typescript-eslint/naming-convention */
declare global {
  /**
   * Money object returned by the Magento 2 GraphQL API. Used wherever a price
   * value is exposed (regular, final, tier prices, etc.).
   *
   * @example
   * ```typescript
   * const money: Magento2Money = {
   *   value: 9.9,
   *   currency: "USD"
   * };
   * ```
   */
  interface Magento2Money {
    /** Numeric monetary amount */
    value: number;
    /** ISO currency code (e.g. "USD") */
    currency: string;
  }

  /**
   * Discount applied to a tiered or final price in a Magento 2 GraphQL response.
   *
   * @example
   * ```typescript
   * const discount: Magento2Discount = {
   *   amount_off: 5,
   *   percent_off: 10
   * };
   * ```
   */
  interface Magento2Discount {
    /** Absolute discount amount in the price's currency */
    amount_off: number;
    /** Percentage discount applied to the regular price */
    percent_off: number;
  }

  /**
   * Bulk-pricing tier on a Magento 2 product. Returned in the `price_tiers`
   * field for products that offer quantity-based discounts.
   *
   * @example
   * ```typescript
   * const tier: Magento2PriceTier = {
   *   quantity: 10,
   *   final_price: { value: 8.5, currency: "USD" }
   * };
   * ```
   */
  interface Magento2PriceTier {
    /** Minimum quantity required for this tier price */
    quantity: number;
    /** Price applied at or above the tier quantity */
    final_price: Magento2Money;
    /** Optional discount metadata for the tier */
    discount?: Magento2Discount;
  }

  /**
   * Set of regular/final prices for a single bound (minimum or maximum) of a
   * Magento 2 product's price range.
   *
   * @example
   * ```typescript
   * const bound: Magento2PriceBound = {
   *   regular_price: { value: 19.9, currency: "USD" },
   *   final_price: { value: 14.9, currency: "USD" }
   * };
   * ```
   */
  interface Magento2PriceBound {
    /** Pre-discount price */
    regular_price: Magento2Money;
    /** Effective (post-discount) price */
    final_price: Magento2Money;
  }

  /**
   * Price range for a Magento 2 product. The minimum and maximum bounds bracket
   * the variant prices for products with multiple variants (Configurable, Grouped).
   * For products with a single price both bounds are identical.
   *
   * @example
   * ```typescript
   * const range: Magento2PriceRange = {
   *   minimum_price: {
   *     regular_price: { value: 9.9, currency: "USD" },
   *     final_price:   { value: 9.9, currency: "USD" }
   *   },
   *   maximum_price: {
   *     regular_price: { value: 229.9, currency: "USD" },
   *     final_price:   { value: 229.9, currency: "USD" }
   *   }
   * };
   * ```
   */
  interface Magento2PriceRange {
    /** Lowest price across product variants */
    minimum_price: Magento2PriceBound;
    /** Highest price across product variants */
    maximum_price: Magento2PriceBound;
  }

  /**
   * Image returned for a Magento 2 product. Used for `image`, `small_image`,
   * `thumbnail`, and entries in `media_gallery`.
   *
   * @example
   * ```typescript
   * const image: Magento2Image = {
   *   url: "https://www.example.com/media/catalog/product/cache/abc/S/7/S770339.jpg",
   *   label: "Sodium iodide CAS No(7681-82-5)"
   * };
   * ```
   */
  interface Magento2Image {
    /** Absolute URL to the image */
    url: string;
    /** Human-readable image label (often contains the product name and CAS) */
    label: string | null;
  }

  /**
   * Category assigned to a Magento 2 product.
   *
   * @example
   * ```typescript
   * const category: Magento2Category = {
   *   uid: "MTc5OQ==",
   *   name: "Chemistry & Biochemicals",
   *   url_path: "cat-chemicals-and-biochemicals"
   * };
   * ```
   */
  interface Magento2Category {
    /** Base64-encoded category identifier */
    uid: string;
    /** Display name of the category */
    name: string;
    /** URL path segment for the category */
    url_path: string;
    /** Depth of the category in the catalog tree */
    level?: number;
  }

  /**
   * Container for HTML-formatted text fields returned by the Magento 2 API
   * (e.g. `description`, `short_description`).
   *
   * @example
   * ```typescript
   * const text: Magento2ComplexText = { html: "<p>99% pure salt</p>" };
   * ```
   */
  interface Magento2ComplexText {
    /** Raw HTML payload (may contain inline tags) */
    html: string;
  }

  /**
   * Reference to a sub-product owned by a `GroupedProduct`. Each grouped item
   * is itself a sellable simple product with its own SKU, name, and price.
   *
   * @example
   * ```typescript
   * const grouped: Magento2GroupedItem = {
   *   qty: 1,
   *   position: 1,
   *   product: {
   *     sku: "S770339-5g",
   *     name: "[S770339-5g] Sodiumthiophosphatedodecahydrate (5g)",
   *     stock_status: "IN_STOCK",
   *     quantity: null,
   *     price_range: { minimum_price: { regular_price: { value: 9.9, currency: "USD" } } }
   *   }
   * };
   * ```
   */
  interface Magento2GroupedItem {
    /** Default quantity of this sub-product included when added to cart */
    qty: number;
    /** Display position of the item within the grouped product */
    position: number;
    /** The underlying sub-product */
    product: {
      /** SKU of the sub-product (typically encodes a size suffix) */
      sku: string;
      /** Display name of the sub-product */
      name: string;
      /** Stock status string (e.g. "IN_STOCK", "OUT_OF_STOCK") */
      stock_status: string;
      /** Stock count, if exposed by the storefront */
      quantity: number | null;
      /** Sub-product price (only `minimum_price` is requested) */
      price_range: Pick<Magento2PriceRange, "minimum_price">;
    };
  }

  /**
   * Variant of a `ConfigurableProduct`. Each variant pairs a set of attribute
   * selections (e.g. size = 100g) with the underlying simple product that
   * gets added to cart when those selections are chosen.
   *
   * @example
   * ```typescript
   * const variant: Magento2ConfigurableVariant = {
   *   attributes: [{ code: "size", label: "100g", value_index: 42 }],
   *   product: {
   *     uid: "MTAxMzkwMA==",
   *     sku: "S770339-100g",
   *     name: "[S770339-100g] Sodiumthiophosphatedodecahydrate (100g)",
   *     stock_status: "IN_STOCK",
   *     quantity: null,
   *     price_range: { minimum_price: { regular_price: { value: 57.9, currency: "USD" } } }
   *   }
   * };
   * ```
   */
  interface Magento2ConfigurableVariant {
    /** Attribute selections that identify this variant */
    attributes: Array<{
      /** Machine-readable attribute code (e.g. "size") */
      code: string;
      /** Human-readable label for the selected option */
      label?: string;
      /** Numeric option identifier within the attribute */
      value_index: number;
    }>;
    /** The underlying simple product backing this variant */
    product: {
      /** Magento UID of the variant product */
      uid: string;
      /** SKU of the variant product */
      sku: string;
      /** Display name of the variant product */
      name: string;
      /** Stock status string (e.g. "IN_STOCK", "OUT_OF_STOCK") */
      stock_status: string;
      /** Stock count, if exposed by the storefront */
      quantity: number | null;
      /** Variant price (only `minimum_price` is requested) */
      price_range: Pick<Magento2PriceRange, "minimum_price">;
    };
  }

  /**
   * A single product item in the Magento 2 GraphQL `products.items` array.
   * The `__typename` field discriminates between the concrete product types
   * (Simple, Grouped, Configurable, Bundle), with `items`/`variants` populated
   * for the relevant types.
   *
   * @example
   * ```typescript
   * const item: Magento2ProductItem = {
   *   __typename: "GroupedProduct",
   *   uid: "MTAxMzkwMA==",
   *   sku: "S770339",
   *   name: "Sodiumthiophosphatedodecahydrate",
   *   url_key: "sodiumthiophosphatedodecahydrate-aladdin-scientific-s770339",
   *   url_suffix: ".html",
   *   stock_status: "IN_STOCK",
   *   quantity: null,
   *   price_range: {
   *     minimum_price: { regular_price: { value: 9.9, currency: "USD" }, final_price: { value: 9.9, currency: "USD" } },
   *     maximum_price: { regular_price: { value: 229.9, currency: "USD" }, final_price: { value: 229.9, currency: "USD" } }
   *   },
   *   items: []
   * };
   * ```
   */
  interface Magento2ProductItem {
    /** GraphQL type name discriminator */
    __typename: string;
    /** Magento UID of the product */
    uid: string;
    /** Parent SKU of the product */
    sku: string;
    /** Display name of the product */
    name: string;
    /** URL slug used to build the product page URL */
    url_key: string;
    /** Optional URL suffix (e.g. ".html") that completes the product URL */
    url_suffix?: string | null;
    /** Stock status string (e.g. "IN_STOCK", "OUT_OF_STOCK") */
    stock_status: string;
    /** Stock count, if exposed by the storefront */
    quantity?: number | null;
    /** Low-stock indicator from the storefront */
    only_x_left_in_stock?: number | null;
    /** Price range across the product's variants */
    price_range: Magento2PriceRange;
    /** Quantity-based pricing tiers, if any */
    price_tiers?: Magento2PriceTier[];
    /** Short HTML description (may be empty) */
    short_description?: Magento2ComplexText | null;
    /** Full HTML description (may be empty) */
    description?: Magento2ComplexText | null;
    /** Primary product image */
    image?: Magento2Image | null;
    /** Categories the product is assigned to */
    categories?: Magento2Category[] | null;
    /** Sub-products for `GroupedProduct` items */
    items?: Magento2GroupedItem[];
    /** Variants for `ConfigurableProduct` items */
    variants?: Magento2ConfigurableVariant[];
  }

  /**
   * Pagination metadata returned alongside the Magento 2 product list.
   *
   * @example
   * ```typescript
   * const pageInfo: Magento2PageInfo = {
   *   current_page: 1,
   *   page_size: 20,
   *   total_pages: 309
   * };
   * ```
   */
  interface Magento2PageInfo {
    /** Index of the current page (1-based) */
    current_page: number;
    /** Number of items per page */
    page_size: number;
    /** Total number of pages available */
    total_pages: number;
  }

  /**
   * Top-level shape of a successful Magento 2 GraphQL `products` query response.
   * The optional `errors` array carries partial-success errors (e.g. permission
   * denied for individual fields) alongside valid `data`.
   *
   * @example
   * ```typescript
   * const response: Magento2SearchResponse = {
   *   data: {
   *     products: {
   *       total_count: 6175,
   *       page_info: { current_page: 1, page_size: 20, total_pages: 309 },
   *       items: []
   *     }
   *   }
   * };
   * ```
   */
  interface Magento2SearchResponse {
    /** Query result payload */
    data: {
      /** Paginated product list */
      products: {
        /** Total count of matches across all pages */
        total_count: number;
        /** Pagination metadata for the current page */
        page_info: Magento2PageInfo;
        /** Items returned on the current page */
        items: Magento2ProductItem[];
      };
    };
    /** Partial-success errors returned alongside `data` */
    errors?: Array<{
      /** Human-readable error message */
      message: string;
      /** Source locations in the query where the error occurred */
      locations?: Array<{ line: number; column: number }>;
      /** Path to the field that triggered the error */
      path?: (string | number)[];
    }>;
  }
}

// This export is needed to make the file a module
export {};
