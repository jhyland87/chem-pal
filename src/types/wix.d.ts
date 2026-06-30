declare global {
  /**
   * Response type for Wix access token requests. Contains authentication and app instance information.
   */
  interface AccessTokenResponse {
    /**
     * Object containing app-specific information keyed by app ID
     */
    apps: {
      [key: string]: {
        /** Instance token for the app */
        instance: string;
        /** Internal ID number for the app */
        intId: number;
      };
    };
    /**
     * Additional dynamic properties that may be present in the response
     */
    [key: string]: unknown;
  }

  /**
   * Width/height/length measurements for a product or package, with their unit.
   */
  interface WixDimensions {
    /** Length measurement */
    length: number;
    /** Width measurement */
    width: number;
    /** Height measurement */
    height: number;
    /** Unit the measurements are expressed in (e.g. "CM", "IN") */
    unit: string;
  }

  /**
   * Inventory snapshot attached to an individual product item (variant).
   */
  interface WixItemInventory {
    /** Inventory status (e.g. "IN_STOCK", "OUT_OF_STOCK") */
    status: string;
    /** Quantity on hand, when tracked */
    quantity: number | null;
  }

  /**
   * Pre-order availability details surfaced on the product-level inventory.
   */
  interface WixPreOrderInfoView {
    /** Whether the product can currently be pre-ordered */
    preOrder: boolean;
    /** Optional message shown alongside the pre-order option */
    message: string | null;
    /** Maximum pre-order quantity, when limited */
    limit: number | null;
  }

  /**
   * Product-level inventory information, including pre-order availability.
   */
  interface WixProductInventory {
    /** Inventory status (e.g. "IN_STOCK", "OUT_OF_STOCK") */
    status: string;
    /** Quantity on hand, when tracked */
    quantity: number | null;
    /** Whether the product is available for pre-order */
    availableForPreOrder: boolean;
    /** Detailed pre-order availability view */
    preOrderInfoView: WixPreOrderInfoView | null;
  }

  /**
   * A single entry in a product's additional-info accordion (e.g. "Synonyms", "Tags").
   */
  interface WixAdditionalInfo {
    /** Unique identifier for the info section */
    id: string;
    /** Section heading */
    title: string;
    /** Section body, which may contain HTML markup */
    description: string;
    /** Display order of the section */
    index: number;
  }

  /**
   * A custom text field configured on the product (e.g. an engraving or note field).
   */
  interface WixCustomTextField {
    /** Machine-readable key for the field */
    key: string;
    /** Human-readable label for the field */
    title: string;
    /** Current value of the field */
    value: string;
    /** Whether the field must be filled in */
    isMandatory: boolean;
    /** Maximum allowed character length */
    inputLimit: number;
  }

  /**
   * Public and private tag identifiers associated with a product.
   */
  interface WixTags {
    /** Tag IDs visible to shoppers */
    publicTagIds: string[];
    /** Tag IDs visible only to the store owner */
    privateTagIds: string[];
  }

  /**
   * A downloadable digital file attached to a product.
   */
  interface WixDigitalProductFileItem {
    /** Unique identifier for the file */
    fileId: string;
    /** MIME or file type descriptor */
    fileType: string;
    /** Display file name */
    fileName: string;
  }

  /**
   * A single encoded video file belonging to a media item.
   */
  interface WixVideoFile {
    /** Direct URL to the video file */
    url: string;
    /** Quality label (e.g. "480p", "720p") */
    quality: string;
    /** Pixel width of the video */
    width: number;
    /** Pixel height of the video */
    height: number;
    /** Container/codec format (e.g. "mp4") */
    format: string;
  }

  /**
   * A product media item — an image or video shown in the product gallery.
   */
  interface WixMediaItem {
    /** Unique identifier for the media item */
    id: string;
    /** Relative or partial media URL */
    url: string;
    /** Fully-qualified media URL */
    fullUrl: string;
    /** Display order of the media item */
    index: number;
    /** Media type (e.g. "image", "video") */
    mediaType: string;
    /** Pixel width of the media */
    width: number;
    /** Pixel height of the media */
    height: number;
    /** Optional media title */
    title: string | null;
    /** Optional alternative text for accessibility */
    altText: string | null;
    /** Video type, when the media item is a video */
    videoType: string | null;
    /** Encoded video files, when the media item is a video */
    videoFiles: WixVideoFile[];
  }

  /**
   * Aggregated price-range information for a product with multiple variants.
   */
  interface WixPriceRange {
    /** Lowest price in the range */
    fromPrice: number;
    /** Formatted lowest price */
    fromPriceFormatted: string;
    /** Highest price in the range */
    toPrice: number;
    /** Formatted highest price */
    toPriceFormatted: string;
    /** Whether subscription prices are included in the range */
    includesSubscriptionPrices: boolean;
  }

  /**
   * A discount applied to a product, expressed as a mode and value.
   */
  interface WixDiscount {
    /** Discount mode (e.g. "PERCENT", "AMOUNT") */
    mode: string;
    /** Discount magnitude in the units implied by the mode */
    value: number;
  }

  /**
   * Per-unit pricing metadata used to display unit prices (e.g. price per 100g).
   */
  interface WixPricePerUnitData {
    /** Total quantity contained in the product */
    totalQuantity: number;
    /** Measurement unit for the total quantity */
    totalMeasurementUnit: string;
    /** Base quantity used for the per-unit price */
    baseQuantity: number;
    /** Measurement unit for the base quantity */
    baseMeasurementUnit: string;
  }

  /**
   * Owner-only cost and profit figures for a product.
   */
  interface WixCostAndProfitData {
    /** Raw item cost */
    itemCost: number;
    /** Formatted item cost */
    formattedItemCost: string;
    /** Raw profit amount */
    profit: number;
    /** Formatted profit amount */
    formattedProfit: string;
    /** Profit margin as a fraction */
    profitMargin: number;
  }

  /**
   * Details of an automatic item-level discount rule applied to a product.
   */
  interface WixItemDiscount {
    /** Identifier of the discount rule */
    discountRuleId: string;
    /** Name of the discount rule */
    discountRuleName: string;
    /** Price after the discount is applied */
    priceAfterDiscount: number;
    /** Numeric amount of the price after discount */
    priceAfterDiscountAmount: number;
    /** Formatted discount amount */
    discountAmount: string;
    /** Numeric discount amount */
    discountAmountValue: number;
    /** Automatic discount price per unit */
    automaticDiscountPricePerUnit: number;
    /** Formatted automatic discount price per unit */
    formattedAutomaticDiscountPricePerUnit: string;
    /** Names of the automatic discount rules applied */
    automaticDiscountRuleNames: string[];
  }

  /**
   * A ribbon (badge) with an identifier and the number of products carrying it.
   */
  interface WixRibbonWithId {
    /** Unique identifier for the ribbon */
    id: string;
    /** Display name of the ribbon */
    name: string;
    /** Number of products that carry this ribbon */
    productAmount: number;
  }

  /**
   * A breadcrumb entry describing the product's position in the category tree.
   */
  interface WixBreadcrumb {
    /** Unique identifier for the breadcrumb node */
    id: string;
    /** Display name of the breadcrumb node */
    name: string;
    /** URL slug of the breadcrumb node */
    slug: string;
  }

  /**
   * A member product within a product group, with its selected choice.
   */
  interface WixGroupMember {
    /** Identifier of the member product */
    productId: string;
    /** URL slug of the member product */
    slug: string;
    /** Inventory availability status of the member */
    inventoryAvailabilityStatus: string;
    /** The option choice that this member represents */
    choice: ProductSelection;
  }

  /**
   * Grouping information that ties variant products together under a single group.
   */
  interface WixGroupInfo {
    /** Identifier of the product group */
    productGroupId: string;
    /** Identifier of the grouping customization */
    groupingCustomizationId: string;
    /** Member products belonging to the group */
    members: WixGroupMember[];
  }

  /**
   * The cheapest variant of a product, used to display "from" pricing.
   */
  interface WixMinPriceVariant {
    /** Identifier of the variant */
    id: string;
    /** SKU of the variant */
    sku: string | null;
    /** Actual (selling) price of the variant */
    actualPrice: number;
    /** Formatted actual price */
    formattedActualPrice: string;
    /** Compare-at (original) price of the variant */
    compareAtPrice: number;
    /** Formatted compare-at price */
    formattedCompareAtPrice: string;
  }

  /**
   * Summary counts describing a product's variant inventory.
   */
  interface WixProductItemsSummary {
    /** Total number of product items (variants) */
    productItemsCount: number;
    /** Number of product items currently in stock */
    inStockProductItemsCount: number;
    /** Aggregate inventory quantity across all items */
    inventoryQuantity: number;
  }

  /**
   * Represents a specific product item with its price and options. Used for product variations.
   */
  interface ProductItem {
    /** Unique identifier for the product item */
    id: string;
    /** Array of selected option IDs that define this specific product variation */
    optionsSelections: number[];
    /** Whether this item is visible in the storefront */
    isVisible?: boolean;
    /** Whether this item is available for pre-order */
    availableForPreOrder?: boolean;
    /** SKU of the item, when set */
    sku?: string | null;
    /** Price surcharge applied on top of the base price for this item */
    surcharge?: number;
    /** Weight of the item */
    weight?: number;
    /** Numeric price value of the product item */
    price: number;
    /** Compare-at (original) price of the item */
    comparePrice?: number;
    /** Discounted price of the item */
    discountedPrice?: number;
    /** Per-unit price of the item, when applicable */
    pricePerUnit?: number | null;
    /** Human-readable formatted price string (e.g. "$19.99") */
    formattedPrice: string;
    /** Formatted compare-at price */
    formattedComparePrice?: string;
    /** Formatted discounted price */
    formattedDiscountedPrice?: string;
    /** Formatted per-unit price */
    formattedPricePerUnit?: string | null;
    /** Whether inventory is tracked for this item */
    isTrackingInventory?: boolean | null;
    /** Whether this item currently has a discount applied */
    hasDiscount?: boolean;
    /** Inventory snapshot for this item */
    inventory?: WixItemInventory | null;
    /** Physical dimensions of the product item */
    productDimensions?: WixDimensions | null;
    /** Physical dimensions of the item's package */
    packageDimensions?: WixDimensions | null;
  }

  /**
   * Represents a product option (e.g. size, color) that can be selected for a product.
   */
  interface ProductOption {
    /** Unique identifier for the option */
    id: string;
    /** Machine-readable key identifier for the option */
    key: string;
    /** Human-readable display title of the option */
    title: string;
    /** Type of option UI control (e.g. "dropdown", "radio") */
    optionType: string;
    /** Array of available selections for this option */
    selections: ProductSelection[];
  }

  /**
   * Represents a specific selection choice within a product option.
   */
  interface ProductSelection {
    /** Unique numeric identifier for the selection */
    id: number;
    /** Display value of the selection */
    value: string;
    /** Additional descriptive text for the selection */
    description: string;
    /** Machine-readable key identifier for the selection */
    key: string;
    /** Indicates whether this selection is currently in stock */
    inStock: boolean | null;
  }

  /**
   * Represents a complete product with all its details, options, and variations.
   */
  interface ProductObject {
    /** Unique identifier for the product */
    id: string;
    /** Internal handle identifier */
    handleId: string;
    /** Display name of the product */
    name: string;
    /** Detailed product description, which may contain HTML markup */
    description: string;
    /** Base price of the product before options */
    price: number;
    /** Compare-at (original) price */
    comparePrice: number;
    /** Discounted price */
    discountedPrice: number;
    /** Per-unit price, when applicable */
    pricePerUnit: number | null;
    /** Human-readable formatted price string (e.g. "$19.99") */
    formattedPrice: string;
    /** Formatted compare-at price */
    formattedComparePrice: string;
    /** Formatted discounted price */
    formattedDiscountedPrice: string;
    /** Formatted per-unit price */
    formattedPricePerUnit: string | null;
    /** Ribbon (badge) text shown on the product */
    ribbon: string;
    /** Discount percentage rate applied to the product */
    discountPercentRate: number;
    /** Currency code for the product's prices (e.g. "USD") */
    currency: string;
    /** Stock keeping unit identifier */
    sku: string;
    /** Whether product items are individually managed */
    isManageProductItems: boolean;
    /** Whether the product is visible in the storefront */
    isVisible: boolean;
    /** Indicates whether the product is currently available for purchase */
    isInStock: boolean;
    /** Whether the product is sellable */
    isSellable: boolean;
    /** Whether the product has selectable options */
    hasOptions: boolean;
    /** Pre-order availability across the product's items */
    productItemsPreOrderAvailability: string;
    /** Whether inventory is tracked for the product */
    isTrackingInventory: boolean;
    /** Weight of the product */
    weight: number;
    /** Canonical page URL of the product */
    pageUrl: string | null;
    /** Classification or category of the product */
    productType: string;
    /** SEO title */
    seoTitle: string | null;
    /** SEO description */
    seoDescription: string | null;
    /** Serialized SEO metadata as a JSON string */
    seoJson: string;
    /** URL-friendly identifier used in product page links */
    urlPart: string;
    /** Creation timestamp (epoch milliseconds) */
    creationDate: number;
    /** Last-updated timestamp (epoch milliseconds) */
    lastUpdated: number;
    /** Manufacturer or brand name of the product */
    brand: string | null;
    /** Identifier of the product's main category */
    mainCategoryId: string | null;
    /** Whether the product uses the V3 catalog schema */
    isV3: boolean;
    /** Identifiers of all categories the product belongs to */
    categoryIds: string[];
    /** Formatted minimum price when purchased with a subscription */
    formattedMinPriceWithSubscription: string | null;
    /** Formatted minimum compare-at price when purchased with a subscription */
    formattedMinComparePriceWithSubscription: string | null;
    /** Additional-info accordion sections (e.g. synonyms, hazards) */
    additionalInfo: WixAdditionalInfo[];
    /** Custom text fields configured on the product */
    customTextFields: WixCustomTextField[];
    /** Public and private tag identifiers */
    tags: WixTags | null;
    /** Downloadable digital files attached to the product */
    digitalProductFileItems: WixDigitalProductFileItem[];
    /** Array of available customization options for the product */
    options: ProductOption[];
    /** Array of specific product variations with their unique combinations */
    productItems: ProductItem[];
    /** Summary counts describing the product's variant inventory */
    productItemsSummary: WixProductItemsSummary | null;
    /** Media gallery (images and videos) for the product */
    media: WixMediaItem[];
    /** Aggregated price range across the product's variants */
    priceRange: WixPriceRange | null;
    /** Discount applied to the product */
    discount: WixDiscount | null;
    /** Per-unit pricing metadata */
    pricePerUnitData: WixPricePerUnitData | null;
    /** Owner-only cost and profit figures */
    costAndProfitData: WixCostAndProfitData | null;
    /** Automatic item-level discount details */
    itemDiscount: WixItemDiscount | null;
    /** Product-level inventory information */
    inventory: WixProductInventory | null;
    /** Physical dimensions of the product */
    productDimensions: WixDimensions | null;
    /** Physical dimensions of the product's package */
    packageDimensions: WixDimensions | null;
    /** Ribbon with identifier and product count */
    ribbonWithId: WixRibbonWithId | null;
    /** Breadcrumb trail describing the product's category path */
    breadcrumbs: WixBreadcrumb[] | null;
    /** Grouping information tying variant products together */
    groupInfo: WixGroupInfo | null;
    /** The cheapest variant, used for "from" pricing */
    minPriceVariant: WixMinPriceVariant | null;
    /** Array of variant products */
    variants?: ProductObject[];
  }

  /**
   * Represents the request parameters for querying the Wix product catalog.
   */
  interface QueryRequestParameters {
    /** Operation identifier */
    o: string;
    /** Source identifier */
    s: string;
    /** GraphQL query string */
    q: string;
    /** JSON stringified variables for the query */
    v: string;
  }

  /** A single field-match condition in a Wix filter tree. */
  interface WixTermFilter {
    term: {
      /** Field to filter on */
      field: string;
      /** Operation to perform (e.g. equals, contains) */
      op: string;
      /** Values to filter by */
      values: string[];
    };
  }

  /**
   * A node in a Wix filter tree. Either a leaf {@link WixTermFilter} or a
   * boolean combinator (`and`/`or`/`not`) used to express advanced searches.
   */
  type WixFilterNode =
    | WixTermFilter
    | { and: WixFilterNode[] }
    | { or: WixFilterNode[] }
    | { not: WixFilterNode };

  /**
   * Variables used in GraphQL queries for the Wix product catalog.
   */
  interface GraphQLQueryVariables {
    /** ID of the main collection to query */
    mainCollectionId: string;
    /** Number of items to skip in pagination */
    offset: number;
    /** Maximum number of items to return */
    limit: number;
    /** Sort criteria for the results */
    sort: string | null;
    /** Filter criteria for the query */
    filters: WixFilterNode;
  }

  /**
   * Response type for Wix product catalog queries, containing paginated product data.
   */
  interface QueryResponse {
    /** Root response data object */
    data: {
      /** Catalog information */
      catalog: {
        /** Category information */
        category: {
          /** Total number of products in the category */
          numOfProducts: number;
          /** Paginated product data with metadata */
          productsWithMetaData: {
            /** Total count of all available products matching the query */
            totalCount: number;
            /** Array of products in the current page */
            list: ProductObject[];
          };
        };
      };
    };
  }
}

// This export is needed to make the file a module
export {};
