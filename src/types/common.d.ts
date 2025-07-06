import { UOM } from "@/constants/common";
import type { ColumnMeta } from "@tanstack/react-table";
import { Column, Row, RowData } from "@tanstack/react-table";

declare global {
  // Custom types for unit of measurements
  type WeightUnit = "kg" | "g" | "mg" | "lb" | "oz";
  type VolumeUnit = "L" | "mL" | "gal" | "qt" | "pt" | "fl oz";
  type LengthUnit = "m" | "cm" | "mm" | "in" | "ft" | "yd";
  type TemperatureUnit = "C" | "F" | "K";
  type PressureUnit = "atm" | "bar" | "psi" | "mmHg" | "inHg";
  type TimeUnit = "s" | "min" | "h" | "d";
  type AmountUnit = "mol" | "mmol" | "mol/L" | "mmol/L";

  type WeightString = `${number}${WeightUnit}`;
  type VolumeString = `${number}${VolumeUnit}`;
  type LengthString = `${number}${LengthUnit}`;
  type TemperatureString = `${number}${TemperatureUnit}`;
  type PressureString = `${number}${PressureUnit}`;
  type TimeUnitString = `${number}${TimeUnit}`;
  type AmountString = `${number}${AmountUnit}`;

  // One custom UOM type to rule them all.
  type QuantityString =
    | `${number}${WeightUnit}`
    | `${number}${VolumeUnit}`
    | `${number}${LengthUnit}`
    | `${number}${AmountUnit}`;

  /**
   * Type that allows either a value or a Promise of that value.
   * Used for functions that may return either synchronously or asynchronously.
   *
   * @param T - The type of the value
   *
   * @example
   * ```typescript
   * // Example function returning either sync or async value
   * async function getData(): Awaitable<string> {
   *   return Math.random() > 0.5
   *     ? "immediate value"
   *     : Promise.resolve("async value");
   * }
   * ```
   */
  type Awaitable<T> = T | Promise<T>;

  /**
   * Extended Response type specifically for HTML responses.
   * Used for handling HTTP responses containing HTML content.
   *
   * @example
   * ```typescript
   * async function fetchHTML(): Promise<HTMLResponse> {
   *   const response = await fetch("https://example.com");
   *   return response as HTMLResponse;
   * }
   * ```
   */
  type HTMLResponse = Response & {
    /** Returns the response body as a string */
    text: () => Promise<string>;
  };

  /**
   * Response type specifically for JSON responses.
   * Used for handling HTTP responses containing JSON content.
   *
   * @example
   * ```typescript
   * async function fetchJSON(): Promise<JSONResponse> {
   *   const response = await fetch("https://api.example.com/data");
   *   return response as JSONResponse;
   * }
   * ```
   */
  type JSONResponse = Response;

  /**
   * Type that represents either a non-null value of T or undefined.
   * Used for optional values that cannot be null when present.
   *
   * @param T - The type of the value
   *
   * @example
   * ```typescript
   * // Example function handling Maybe type
   * function processValue(value: Maybe<string>) {
   *   return value ? value.toUpperCase() : "no value";
   * }
   * ```
   */
  type Maybe<T> = NonNullable<T> | undefined | void;

  /**
   * Type that allows either a single value or an array of values of type T.
   * Used for functions that may return either a single value or an array of values.
   *
   * @param T - The type of the value
   *
   * @example
   * ```typescript
   * // Example function returning either a single value or an array of values
   * function getValues(): MaybeArray<string> {
   *   return Math.random() > 0.5 ? "single value" : ["value1", "value2"];
   * }
   * ```
   */
  type MaybeArray<T> = T | T[];

  /**
   * Represents a country code in ISO 3166-1 alpha-2 format.
   * This is a two-letter code that uniquely identifies a country.
   * Examples: "US", "GB", "DE", "FR"
   */
  type CountryCode = string;

  /**
   * Creates an opaque type with a type name
   * @param T - The base type
   * @param K - The type name string
   */
  type Brand<T, Brand extends string> = T & { [brand]: Brand };

  /**
   * Represents a shipping range type.
   * Used to define the shipping scope of a supplier or product.
   *
   * @example
   * ```typescript
   * const shipping: ShippingRange = "worldwide";
   * ```
   */
  type ShippingRange = "worldwide" | "domestic" | "international" | "local";

  /**
   * Represents a payment method.
   * Used to define the payment method of a supplier or product.
   *
   * @example
   * ```typescript
   * const paymentMethods: PaymentMethod[]   = ["mastercard", "visa", "paypal"];
   * ```
   */
  type PaymentMethod =
    | "mastercard"
    | "visa"
    | "paypal"
    | "banktransfer"
    | "cash"
    | "crypto"
    | "other";

  /**
   * Represents a base64 encoded string.
   * Used to represent binary data as a string.
   *
   * @example
   * ```typescript
   * const encoded: Base64String = "SGVsbG8gV29ybGQ=";
   * ```
   */
  type Base64String = Brand<string, "base64">;

  /**
   * Interface defining the required properties for a history entry.
   * Used to store the history of results that were clicked on.
   *
   * @example
   * ```typescript
   * const historyEntry: HistoryEntry = {
   *   timestamp: Date.now(),
   *   type: "search",
   *   data: {
   *     suppliers: ["supplier1", "supplier2"],
   *     query: "sodium chloride",
   *     resultCount: 10
   *   }
   * };
   * ```
   */
  interface SearchHistoryEntry {
    timestamp?: number;
    type: "search";
    data?: {
      suppliers: string[];
      query: string;
      resultCount: number;
    };
  }

  /**
   * Interface defining the required properties for a product history entry.
   * Used to store the history of products that were clicked on.
   *
   * @example
   * ```typescript
   * const productHistoryEntry: ProductHistoryEntry = {
   *   timestamp: Date.now(),
   *   type: "product",
   *   data: {
   *     title: "Sodium Chloride",
   *     url: "https://example.com/sodium-chloride"
   *     price: 100,
   *     currencyCode: "USD",
   *     currencySymbol: "$",
   *     quantity: 1,
   *     uom: "g"
   *   }
   * };
   * ```
   */
  interface ProductHistoryEntry {
    timestamp?: number;
    type: "product";
    data: Omit<Product, "variants">;
  }

  type HistoryEntry = SearchHistoryEntry | ProductHistoryEntry;

  /**
   * Represents a faceted search option with text values.
   * Used for filtering and categorizing search results.
   *
   * @example
   * ```typescript
   * const facet: TextOptionFacet = {
   *   name: "grade",
   *   value: "ACS"
   * };
   * ```
   */
  interface TextOptionFacet {
    /**
     * Name of the facet category
     * @example "grade"
     */
    name: string;

    /**
     * Selected or available facet value
     * @example "ACS"
     */
    value: string;
  }

  /**
   * Extended column interface with additional metadata support.
   * Used to enhance TanStack Table columns with custom metadata.
   *
   * @param TData - The type of data in the table rows
   * @param TValue - The type of value in the column cells
   *
   * @example
   * ```typescript
   * // Example column with range filter metadata
   * const column: CustomColumn<Product, number> = {
   *   id: "price",
   *   header: "Price",
   *   accessorKey: "price",
   *   columnDef: {
   *     meta: {
   *       filterVariant: "range",
   *       rangeValues: [0, 1000]
   *     }
   *   }
   * };
   * ```
   */
  interface CustomColumn<TData extends RowData, TValue = unknown> extends Column<TData, TValue> {
    /**
     * Extended column definition including metadata
     */
    columnDef: {
      /**
       * Additional column configuration metadata
       */
      meta?: ColumnMeta;
    };
  }

  /**
   * Represents a row in the product table.
   * Used for type-safe row operations in TanStack Table.
   *
   * @example
   * ```typescript
   * const productRow: ProductRow = {
   *   row: {
   *     original: {
   *       title: "Sodium Chloride",
   *       price: 19.99,
   *       quantity: 500
   *     }
   *   }
   * };
   * ```
   */
  interface ProductRow {
    /**
     * Table row containing product data
     */
    row: Row<Product>;
  }

  /**
   * Mapping of standard units of measurement to their various string representations.
   * Used for normalizing unit of measurement strings from different suppliers.
   *
   * @example
   * ```typescript
   * const uomAliases: UOMAliases = {
   *   [UOM.G]: ["g", "gram", "grams"],
   *   [UOM.KG]: ["kg", "kilo", "kilogram"],
   *   [UOM.ML]: ["ml", "milliliter", "milliliters"]
   * };
   * ```
   */
  interface UOMAliases {
    /** Alternative strings representing pieces/units */
    [UOM.PCS]: string[];
    /** Alternative strings representing kilograms */
    [UOM.KG]: string[];
    /** Alternative strings representing pounds */
    [UOM.LB]: string[];
    /** Alternative strings representing milliliters */
    [UOM.ML]: string[];
    /** Alternative strings representing grams */
    [UOM.G]: string[];
    /** Alternative strings representing liters */
    [UOM.L]: string[];
    /** Alternative strings representing quarts */
    [UOM.QT]: string[];
    /** Alternative strings representing gallons */
    [UOM.GAL]: string[];
    /** Alternative strings representing millimeters */
    [UOM.MM]: string[];
    /** Alternative strings representing centimeters */
    [UOM.CM]: string[];
    /** Alternative strings representing meters */
    [UOM.M]: string[];
    /** Alternative strings representing ounces */
    [UOM.OZ]: string[];
    /** Alternative strings representing milligrams */
    [UOM.MG]: string[];
    /** Alternative strings representing kilometers */
    [UOM.KM]: string[];
  }
}

// This export is needed to make the file a module
export {};
