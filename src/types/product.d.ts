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
}

// This export is needed to make the file a module
export {};
