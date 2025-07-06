import type { ColumnMeta } from "@tanstack/react-table";

declare global {
  /**
   * Represents the required fields that must be present in a Product object.
   * These fields are essential for product identification and basic information.
   *
   * @typeparam T - The Product type being constrained
   *
   * @example
   * ```typescript
   * type RequiredFields = RequiredProductFields<Product>;
   * const required: RequiredFields = {
   *   title: "Sodium Chloride",
   *   price: 29.99,
   *   quantity: 500,
   *   uom: "g"
   * };
   * ```
   */
  type RequiredProductFields = Pick<
    Product,
    "title" | "price" | "currencySymbol" | "currencyCode" | "url" | "quantity" | "uom" | "supplier"
  >;

  /**
   * Represents the optional fields that may be present in a Product object.
   * These fields provide additional product information but are not required.
   *
   * @typeparam T - The Product type being constrained
   *
   * @example
   * ```typescript
   * type OptionalFields = OptionalProductFields<Product>;
   * const optional: OptionalFields = {
   *   description: "High purity sodium chloride",
   *   cas: "7647-14-5",
   *   grade: "ACS",
   *   supplier: "ChemSupplier"
   * };
   * ```
   */
  type OptionalProductFields<T> = Partial<Omit<T, keyof RequiredProductFields<T>>>;

  /**
   * Interface defining the required properties for a supplier.
   * This ensures all suppliers have the necessary readonly properties.
   */
  interface ISupplier {
    /** The name of the supplier */
    readonly supplierName: string;
    /** The base URL for the supplier */
    readonly baseURL: string;
    /** The shipping scope of the supplier */
    readonly shipping: ShippingRange;
    /** The country code of the supplier */
    readonly country: CountryCode;
    /** The payment methods accepted by the supplier */
    readonly paymentMethods: PaymentMethod[];
  }

  /**
   * Unit of measurement type
   */
  //export type UOM = string;

  /**
   * Represents a quantity measurement with a numeric value and unit.
   * Used for specifying product amounts and their units of measurement.
   *
   * @example
   * ```typescript
   * const quantity: QuantityObject = {
   *   quantity: 100,
   *   uom: "g"
   * };
   * console.log(`${quantity.quantity}${quantity.uom}`); // "100g"
   * ```
   */
  interface QuantityObject {
    /**
     * The numeric amount of the quantity
     * @example 100
     */
    quantity: number;

    /**
     * The unit of measurement (e.g., 'g', 'ml', 'kg')
     * @example "g"
     */
    uom: string;
  }

  /**
   * Application configuration settings that control various features and behaviors.
   * Used to store user preferences and feature flags.
   *
   * @example
   * ```typescript
   * const userSettings: UserSettings = {
   *   showHelp: true,
   *   caching: true,
   *   currency: "USD",
   *   location: "US",
   *   suppliers: ["supplier1", "supplier2"],
   *   theme: "light"
   * };
   * ```
   */
  interface UserSettings {
    /**
     * Controls visibility of help tooltips throughout the application.
     * Defaults to false.
     */
    showHelp: boolean;

    /**
     * Enables or disables data caching functionality.
     * Defaults to true.
     */
    caching: boolean;

    /**
     * Enables or disables search autocomplete suggestions.
     * Defaults to true.
     */
    autocomplete: boolean;

    /**
     * Currency rate for the user's currency
     * @example 1.0
     */
    currencyRate: number;

    /**
     * Selected currency code for price display
     * @example "USD"
     */
    currency: string;

    /**
     * User's geographical location for shipping calculations
     * @example "US"
     */
    location: string;

    /**
     * Currency rate for the user's currency
     * @example 1.0
     */
    currencyRate?: number;

    /**
     * Filter products based on shipping availability to user's location.
     * Defaults to false.
     */
    shipsToMyLocation: boolean;

    /**
     * Legacy feature flag for experimental functionality.
     * Note: This feature is deprecated and will be removed in a future version.
     * Use more specific feature flags instead.
     */
    foo: string;

    /**
     * Feature flag for Jason's experimental features.
     * Defaults to false.
     */
    jason: boolean;

    /**
     * Feature flag for Antoine's experimental features.
     * Defaults to false.
     */
    antoine: boolean;

    /**
     * Dimensions of the popup window in format 'widthxheight'
     * @example "800x600"
     */
    popupSize: string;

    /**
     * Controls automatic window resizing behavior.
     * Defaults to true.
     */
    autoResize: boolean;

    /**
     * Generic feature flag for experimental functionality.
     * Defaults to false.
     */
    someSetting: boolean;

    /**
     * List of supplier IDs that are enabled for searching
     * @example ["supplier1", "supplier2"]
     */
    suppliers: Array<string>;

    /**
     * Selected UI theme identifier
     * @example "light"
     */
    theme: string;

    /**
     * Controls visibility of all available table columns.
     * Defaults to true.
     */
    showAllColumns: boolean;

    /**
     * List of column identifiers that should be hidden from view
     * @example ["price", "quantity"]
     */
    hideColumns: Array<string>;

    /**
     * Controls visibility of column filter UI elements.
     * Defaults to false.
     */
    showColumnFilters: boolean;

    /**
     * Configuration object for individual column filter settings.
     * @example
     * ```typescript
     * {
     *   price: {
     *     filterVariant: "range",
     *     rangeValues: [0, 1000]
     *   }
     * }
     * ```
     */
    columnFilterConfig: Record<string, ColumnMeta>;

    /**
     * Number of results to display per supplier
     * @example 20
     */
    supplierResultLimit: number;
  }

  /**
   * Represents a specific variation of a product with its unique characteristics and pricing.
   * Used to model different versions or package sizes of the same product.
   *
   * @example
   * ```typescript
   * const variant: Variant = {
   *   title: "Sodium Chloride 500g",
   *   uom: "g",
   *   price: 19.99,
   *   quantity: 500,
   *   grade: "ACS",
   *   sku: "NaCl-500"
   * };
   * ```
   */
  interface Variant {
    /**
     * Display name of the variant
     * @example "Sodium Chloride 500g"
     */
    title?: string;

    /**
     * Description of the variant
     * @example "Sodium Chloride 500g"
     */
    description?: string;

    /**
     * Unit of measurement for the variant quantity
     * @example "g"
     */
    uom?: string;

    /**
     * Numeric price value of the variant
     * @example 19.99
     */
    price?: number;

    /**
     * ISO currency code for the price
     * @example "USD"
     */
    currencyCode?: CurrencyCode;

    /**
     * Display symbol for the currency
     * @example "$"
     */
    currencySymbol?: CurrencySymbol;

    /**
     * Available quantity in stock
     * @example 100
     */
    quantity?: number;

    /**
     * Reference quantity for unit conversion calculations
     * @example 500
     */
    baseQuantity?: number;

    /**
     * Reference unit of measurement for conversions
     * @example "g"
     */
    baseUom?: UOM;

    /**
     * Price converted to USD for comparison
     * @example 19.99
     */
    usdPrice?: number;

    /**
     * The price convert to the users local currency
     */
    localPrice?: number;

    /**
     * Stock keeping unit identifier for inventory tracking
     * @example "NaCl-500"
     */
    sku?: number | string;

    /**
     * URL to the variant's detail page
     * @example "/products/sodium-chloride-500g"
     */
    url?: string;

    /**
     * Unique identifier within the system
     * @example 12345
     */
    id?: number | string;

    /**
     * Globally unique identifier
     * @example "550e8400-e29b-41d4-a716-446655440000"
     */
    uuid?: number | string;

    /**
     * Chemical grade specification (e.g., 'ACS', 'Technical')
     * @example "ACS"
     */
    grade?: string;

    /**
     * Chemical concentration specification
     * @example "98%"
     */
    conc?: string;

    /**
     * Current status code of the variant
     * @example "IN_STOCK"
     */
    status?: string;

    /**
     * Human-readable status description
     * @example "In Stock"
     */
    statusTxt?: string;

    /**
     * Special shipping requirements or information
     * @example "Hazardous material - special shipping required"
     */
    shippingInformation?: string;

    /**
     * Availability of the variant
     * @example "IN_STOCK"
     */
    availability?: AVAILABILITY;

    /**
     * Attributes of the variant
     * @example `[{ name: "Size", value: "500g" }]`
     */
    attributes?: { name: string; value: string }[];
  }

  /**
   * Synthetic columns - stuff that I add to the response body during processing.
   */
  type SyntheticFields = {
    /**
     * Match percentage of the product title and the search string
     * @example 95
     */
    matchPercentage: number;
  };

  /**
   * Represents a chemical product with its complete details, extending the Variant interface.
   * This is the main product type used throughout the application.
   *
   * @example
   * ```typescript
   * const product: Product = {
   *   supplier: "Loudwolf",
   *   title: "Sodium Chloride ACS Grade",
   *   url: "/products/sodium-chloride-acs",
   *   price: 19.99,
   *   currencyCode: "USD",
   *   currencySymbol: "$",
   *   quantity: 500,
   *   uom: "g",
   *   cas: "7647-14-5",
   *   formula: "NaCl"
   * };
   * ```
   */
  interface Product extends Variant, SyntheticFields {
    /**
     * Name of the supplier providing the product
     * @example "Loudwolf"
     */
    supplier: string;

    /**
     * Full product title/name
     * @example "Sodium Chloride ACS Grade 500g"
     */
    title: string;

    /**
     * Absolute URL to the product's detail page
     * @example "https://supplier.com/products/sodium-chloride-500g"
     */
    url: string;

    /**
     * Current price of the product
     * @example 19.99
     */
    price: number;

    /**
     * ISO currency code for the price
     * @example "USD"
     */
    currencyCode: CurrencyCode;

    /**
     * Display symbol for the currency
     * @example "$"
     */
    currencySymbol: CurrencySymbol;

    /**
     * Available quantity in stock
     * @example 100
     */
    quantity: number;

    /**
     * Standardized unit of measurement
     * @example "g"
     */
    uom: valueof<typeof UOM>;

    /**
     * Detailed product description
     * @example "ACS grade sodium chloride suitable for analytical use"
     */
    description?: string;

    /**
     * Name of the product manufacturer
     * @example "Sigma-Aldrich"
     */
    manufacturer?: string;

    /**
     * Chemical Abstracts Service registry number
     * @example "7647-14-5"
     */
    cas?: CAS<string>;

    /**
     * Chemical molecular formula
     * @example "NaCl"
     */
    formula?: string;

    /**
     * Alternative name for the supplier
     * @example "Sigma"
     */
    vendor?: string;

    /**
     * Array of available product variations
     */
    variants?: Variant[];

    /**
     * URLs to related documentation (MSDS, SDS, etc.)
     * @example ["https://supplier.com/msds/nacl.pdf"]
     */
    docLinks?: string[];

    /**
     * Country of the supplier
     * @example "US"
     */
    supplierCountry?: CountryCode;

    /**
     * Shipping scope of the supplier
     * @example "worldwide" | "domestic" | "international" | "local"
     */
    supplierShipping?: ShippingRange;

    /**
     * Payment methods accepted by the supplier
     * @example ["visa", "mastercard"]
     */
    paymentMethods?: PaymentMethod[];

    /**
     * Levenshtein result of the product title and the search string
     * @example 95
     */
    _fuzz?: { score: number; idx: number };

    /**
     * Match percentage of the product title and the search string
     * @example 95
     */
    matchPercentage?: number;
  }

  /**
   * Represents a hierarchical task or item with nested structure.
   * Used for organizing items in a tree-like structure.
   *
   * @example
   * ```typescript
   * const item: Item = {
   *   id: 1,
   *   name: "Project A",
   *   deadline: new Date("2024-12-31"),
   *   type: "project",
   *   isComplete: false,
   *   nodes: [
   *     {
   *       id: 2,
   *       name: "Task 1",
   *       deadline: new Date("2024-06-30"),
   *       type: "task",
   *       isComplete: true
   *     }
   *   ]
   * };
   * ```
   */
  interface Item {
    /**
     * Unique numeric identifier
     * @example 1
     */
    id: number;

    /**
     * Display name of the item
     * @example "Project A"
     */
    name: string;

    /**
     * Due date for the item
     * @example new Date("2024-12-31")
     */
    deadline: Date;

    /**
     * Classification or category of the item
     * @example "project"
     */
    type: string;

    /**
     * Indicates whether the item has been completed
     * @example false
     */
    isComplete: boolean;

    /**
     * Optional array of child items
     */
    nodes?: Item[];
  }

  /**
   * Represents a stock keeping unit with detailed inventory and pricing information.
   * Used for managing product variants and their specific characteristics.
   *
   * @example
   * ```typescript
   * const sku: Sku = {
   *   priceInfo: {
   *     regularPrice: [19.99, 17.99, 15.99]
   *   },
   *   variantsMap: {
   *     volume: 500,
   *     chemicalGrade: "ACS",
   *     concentration: "98%"
   *   },
   *   skuId: "NaCl-500-ACS",
   *   seoName: "sodium-chloride-500g-acs",
   *   inventoryStatus: "IN_STOCK",
   *   inventoryStatusMsg: "In Stock",
   *   specifications: {
   *     shippingInformation: "Hazardous material"
   *   }
   * };
   * ```
   */
  interface Sku {
    /**
     * Pricing information for the SKU
     */
    priceInfo: {
      /**
       * Array of regular prices (may include different quantities)
       * @example [19.99, 17.99, 15.99]
       */
      regularPrice: number[];
    };

    /**
     * Mapping of variant-specific characteristics
     */
    variantsMap: {
      /**
       * Volume of the product
       * @example 500
       */
      volume: number;

      /**
       * Chemical grade specification
       * @example "ACS"
       */
      chemicalGrade: string;

      /**
       * Chemical concentration value
       * @example "98%"
       */
      concentration: string;
    };

    /**
     * Unique identifier for the SKU
     * @example "NaCl-500-ACS"
     */
    skuId: string;

    /**
     * URL-friendly name for SEO purposes
     * @example "sodium-chloride-500g-acs"
     */
    seoName: string;

    /**
     * Current inventory status code
     * @example "IN_STOCK"
     */
    inventoryStatus: string;

    /**
     * Human-readable inventory status message
     * @example "In Stock"
     */
    inventoryStatusMsg: string;

    /**
     * Additional product specifications
     */
    specifications: {
      /**
       * Special shipping requirements or information
       * @example "Hazardous material"
       */
      shippingInformation: string;
    };
  }

  /**
   * Basic product information structure.
   * Used for simplified product representations.
   *
   * @example
   * ```typescript
   * const details: ProductDetails = {
   *   name: "Sodium Chloride",
   *   description: "ACS grade sodium chloride",
   *   price: 19.99,
   *   quantity: 500
   * };
   * ```
   */
  interface ProductDetails {
    /**
     * Display name of the product
     * @example "Sodium Chloride"
     */
    name: string;

    /**
     * Detailed product description
     * @example "ACS grade sodium chloride"
     */
    description: string;

    /**
     * Current price of the product
     * @example 19.99
     */
    price: number;

    /**
     * Available quantity in stock
     * @example 500
     */
    quantity: number;
  }

  /**
   * Props interface for search component functionality.
   * Used to manage search state in React components.
   *
   * @example
   * ```typescript
   * const SearchComponent: React.FC<SearchProps> = ({ query, setQuery }) => {
   *   return (
   *     <input
   *       value={query}
   *       onChange={(e) => setQuery(e.target.value)}
   *       placeholder="Search..."
   *     />
   *   );
   * };
   * ```
   */
  interface SearchProps {
    /**
     * Current search query string
     * @example "sodium chloride"
     */
    query: string;

    /**
     * Callback function to update the search query
     */
    setQuery: (value: string) => void;
  }

  /**
   * Base interface for product supplier implementation.
   * Defines the common structure and functionality that all suppliers must implement.
   *
   * @example
   * ```typescript
   * class MySupplier implements Supplier {
   *   supplierName = "MySupplier";
   *   query = "";
   *   queryResults = [];
   *   baseURL = "https://mysupplier.com";
   *   controller = new AbortController();
   *   limit = 10;
   *   httpRequestHardLimit = 50;
   *   headers = { "Content-Type": "application/json" };
   * }
   * ```
   */
  interface Supplier {
    /**
     * Display name of the supplier
     * @example "Sigma-Aldrich"
     */
    supplierName: string;

    /**
     * Current active search query
     * @example "sodium chloride"
     */
    query: string;

    /**
     * Raw results from the last search query
     */
    queryResults: Array<Record<string, unknown>>;

    /**
     * Base URL for supplier's API endpoints
     * @example "https://api.supplier.com"
     */
    baseURL: string;

    /**
     * AbortController for canceling in-flight requests
     */
    controller: AbortController;

    /**
     * Maximum number of results to return
     * @example 10
     */
    limit: number;

    /**
     * Maximum number of concurrent HTTP requests
     * @example 50
     */
    httpRequestHardLimit: number;

    /**
     * Custom headers for API requests
     * @example \{ "Authorization": "Bearer token123" \}
     */
    headers: HeadersInit;
  }

  /**
   * Represents a product object in the Wix platform format.
   * Used for compatibility with Wix e-commerce platform.
   *
   * @example
   * ```typescript
   * const product: ProductObject = {
   *   discountedPrice: "17.99",
   *   price: "19.99",
   *   title: "Sodium Chloride ACS Grade",
   *   url: "/products/sodium-chloride",
   *   textOptionsFacets: [
   *     { name: "grade", value: "ACS" }
   *   ]
   * };
   * ```
   */
  interface ProductObject {
    /**
     * Price after applying any discounts
     * @example "17.99"
     */
    discountedPrice?: string;

    /**
     * Regular price of the product
     * @example "19.99"
     */
    price: string;

    /**
     * Display title of the product
     * @example "Sodium Chloride ACS Grade"
     */
    title: string;

    /**
     * URL to the product's detail page
     * @example "/products/sodium-chloride"
     */
    url: string;

    /**
     * Available text-based filtering options
     */
    textOptionsFacets?: TextOptionFacet[];
  }
}

// This export is needed to make the file a module
export {};
